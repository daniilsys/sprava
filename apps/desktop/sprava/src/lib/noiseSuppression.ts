/**
 * Noise suppression with two paths for minimal latency:
 *
 * LIGHT (RNNoise) — WASM compiled from nnnoiseless, runs synchronously
 * inside the AudioWorklet. Zero IPC, ~10ms latency (just the algorithm).
 *
 * HIGH_QUALITY (DeepFilterNet3) — Tauri IPC to Rust backend.
 * Single-frame batches + minimal pre-buffer, ~25ms latency.
 */

import { invoke } from "@tauri-apps/api/core";

export interface NoiseSuppressionResult {
  stream: MediaStream;
  cleanup: () => void;
}

export type NoiseMode = "LIGHT" | "HIGH_QUALITY";

export async function createNoiseSuppression(
  inputStream: MediaStream,
  mode: NoiseMode = "LIGHT",
): Promise<NoiseSuppressionResult> {
  if (mode === "LIGHT") {
    return createWasmSuppression(inputStream);
  }
  return createIpcSuppression(inputStream);
}

// ---------------------------------------------------------------------------
// LIGHT mode — WASM in AudioWorklet (zero IPC)
// ---------------------------------------------------------------------------

function createWasmWorkletUrl(): string {
  const code = `
class WasmNoiseSuppressProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.wasmReady = false;
    this.hopSize = 480;

    // Input accumulator
    this.inputBuf = new Float32Array(960);
    this.inputLen = 0;

    // Output ring buffer
    this.ringBuf = new Float32Array(4800); // ~100ms at 48kHz
    this.ringWrite = 0;
    this.ringRead = 0;
    this.ringLen = 0;

    this.port.onmessage = async (e) => {
      if (e.data.type === 'init-wasm') {
        try {
          const instance = await WebAssembly.instantiate(e.data.module);
          this.wasm = instance.exports;
          this.hopSize = this.wasm.init();
          this.inputPtr = this.wasm.get_input_ptr();
          this.outputPtr = this.wasm.get_output_ptr();
          this.wasmReady = true;
          this.port.postMessage({ type: 'ready' });
        } catch (err) {
          this.port.postMessage({ type: 'error', message: String(err) });
        }
      }
    };
  }

  process(inputs, outputs) {
    const input = inputs[0]?.[0];
    const output = outputs[0]?.[0];
    if (!input || !output) return true;

    if (!this.wasmReady) {
      output.set(input);
      return true;
    }

    const len = input.length;

    // Grow input buffer if needed (rare)
    if (this.inputLen + len > this.inputBuf.length) {
      const newBuf = new Float32Array(this.inputBuf.length * 2);
      newBuf.set(this.inputBuf.subarray(0, this.inputLen));
      this.inputBuf = newBuf;
    }
    this.inputBuf.set(input, this.inputLen);
    this.inputLen += len;

    // Process complete frames synchronously in WASM
    while (this.inputLen >= this.hopSize) {
      const mem = this.wasm.memory.buffer;
      const wasmIn = new Float32Array(mem, this.inputPtr, this.hopSize);
      wasmIn.set(this.inputBuf.subarray(0, this.hopSize));

      // Shift remaining input
      this.inputBuf.copyWithin(0, this.hopSize, this.inputLen);
      this.inputLen -= this.hopSize;

      // Process synchronously — no IPC!
      this.wasm.process_frame();

      // Read output from WASM memory
      const wasmOut = new Float32Array(mem, this.outputPtr, this.hopSize);
      const cap = this.ringBuf.length;
      for (let i = 0; i < this.hopSize; i++) {
        this.ringBuf[this.ringWrite] = wasmOut[i];
        this.ringWrite = (this.ringWrite + 1) % cap;
      }
      this.ringLen += this.hopSize;
    }

    // Output from ring buffer
    if (this.ringLen >= len) {
      const cap = this.ringBuf.length;
      for (let i = 0; i < len; i++) {
        output[i] = this.ringBuf[this.ringRead];
        this.ringRead = (this.ringRead + 1) % cap;
      }
      this.ringLen -= len;
    } else {
      // Initial fill — pass through briefly (only first ~10ms)
      output.set(input);
    }

    return true;
  }
}

registerProcessor('wasm-noise-suppress-processor', WasmNoiseSuppressProcessor);
`;
  const blob = new Blob([code], { type: "application/javascript" });
  return URL.createObjectURL(blob);
}

async function createWasmSuppression(
  inputStream: MediaStream,
): Promise<NoiseSuppressionResult> {
  // Fetch and compile WASM
  const wasmBytes = await fetch("/noise_suppress.wasm").then((r) =>
    r.arrayBuffer(),
  );
  const wasmModule = await WebAssembly.compile(wasmBytes);

  const ctx = new AudioContext({ sampleRate: 48000 });
  const source = ctx.createMediaStreamSource(inputStream);

  const workletUrl = createWasmWorkletUrl();
  await ctx.audioWorklet.addModule(workletUrl);
  URL.revokeObjectURL(workletUrl);

  const workletNode = new AudioWorkletNode(
    ctx,
    "wasm-noise-suppress-processor",
    {
      numberOfInputs: 1,
      numberOfOutputs: 1,
      channelCount: 1,
    },
  );

  // Send compiled WASM module to worklet
  workletNode.port.postMessage({ type: "init-wasm", module: wasmModule });

  // Wait for WASM initialization
  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(
      () => reject(new Error("WASM init timed out")),
      5000,
    );
    workletNode.port.onmessage = (e: MessageEvent) => {
      if (e.data.type === "ready") {
        clearTimeout(timeout);
        resolve();
      } else if (e.data.type === "error") {
        clearTimeout(timeout);
        reject(new Error(e.data.message));
      }
    };
  });

  const destination = ctx.createMediaStreamDestination();
  source.connect(workletNode);
  workletNode.connect(destination);

  return {
    stream: destination.stream,
    cleanup() {
      source.disconnect();
      workletNode.disconnect();
      ctx.close().catch(() => {});
    },
  };
}

// ---------------------------------------------------------------------------
// HIGH_QUALITY mode — Tauri IPC to Rust DeepFilterNet3
// ---------------------------------------------------------------------------

const IPC_PRE_BUFFER_FRAMES = 2; // ~20ms pre-buffer

function createIpcWorkletUrl(): string {
  const code = `
class IpcNoiseSuppressProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.ringBuf = new Float32Array(48000);
    this.ringWrite = 0;
    this.ringRead = 0;
    this.ringLen = 0;

    this.inputBuf = new Float32Array(48000);
    this.inputLen = 0;

    this.hopSize = 480;
    this.preBufferSamples = 0;
    this.preBuffered = false;

    this.port.onmessage = (e) => {
      if (e.data.type === 'config') {
        this.hopSize = e.data.hopSize;
        this.preBufferSamples = e.data.preBufferSamples;
        this.preBuffered = false;
      } else if (e.data.type === 'processed') {
        const samples = e.data.samples;
        const cap = this.ringBuf.length;
        for (let i = 0; i < samples.length; i++) {
          this.ringBuf[this.ringWrite] = samples[i];
          this.ringWrite = (this.ringWrite + 1) % cap;
        }
        this.ringLen += samples.length;
        if (!this.preBuffered && this.ringLen >= this.preBufferSamples) {
          this.preBuffered = true;
        }
      }
    };
  }

  process(inputs, outputs) {
    const input = inputs[0]?.[0];
    const output = outputs[0]?.[0];
    if (!input || !output) return true;

    const len = input.length;

    if (this.inputLen + len > this.inputBuf.length) {
      const newBuf = new Float32Array(this.inputBuf.length * 2);
      newBuf.set(this.inputBuf.subarray(0, this.inputLen));
      this.inputBuf = newBuf;
    }
    this.inputBuf.set(input, this.inputLen);
    this.inputLen += len;

    // Send single hop-size frames to main thread
    while (this.inputLen >= this.hopSize) {
      const frame = this.inputBuf.slice(0, this.hopSize);
      this.inputBuf.copyWithin(0, this.hopSize, this.inputLen);
      this.inputLen -= this.hopSize;
      this.port.postMessage({ type: 'frame', samples: Array.from(frame) });
    }

    if (this.preBuffered && this.ringLen >= len) {
      const cap = this.ringBuf.length;
      for (let i = 0; i < len; i++) {
        output[i] = this.ringBuf[this.ringRead];
        this.ringRead = (this.ringRead + 1) % cap;
      }
      this.ringLen -= len;
    } else {
      for (let i = 0; i < len; i++) {
        output[i] = 0;
      }
    }

    return true;
  }
}

registerProcessor('ipc-noise-suppress-processor', IpcNoiseSuppressProcessor);
`;
  const blob = new Blob([code], { type: "application/javascript" });
  return URL.createObjectURL(blob);
}

async function createIpcSuppression(
  inputStream: MediaStream,
): Promise<NoiseSuppressionResult> {
  const hopSize = await invoke<number>("noise_suppress_init", {
    mode: "HIGH_QUALITY",
  });

  const ctx = new AudioContext({ sampleRate: 48000 });
  const source = ctx.createMediaStreamSource(inputStream);

  const workletUrl = createIpcWorkletUrl();
  await ctx.audioWorklet.addModule(workletUrl);
  URL.revokeObjectURL(workletUrl);

  const workletNode = new AudioWorkletNode(
    ctx,
    "ipc-noise-suppress-processor",
    {
      numberOfInputs: 1,
      numberOfOutputs: 1,
      channelCount: 1,
    },
  );

  workletNode.port.postMessage({
    type: "config",
    hopSize,
    preBufferSamples: hopSize * IPC_PRE_BUFFER_FRAMES,
  });

  // Strictly sequential processing (DeepFilterNet is stateful)
  let processing = false;
  const queue: number[][] = [];
  const MAX_QUEUE_SIZE = 20; // ~200ms of audio at 10ms hop size

  async function processFrame(samples: number[]) {
    try {
      const processed = await invoke<number[]>("noise_suppress_process", {
        samples,
      });
      workletNode.port.postMessage({ type: "processed", samples: processed });
    } catch (err) {
      workletNode.port.postMessage({ type: "processed", samples });
      console.error("[noise-suppression] process error:", err);
    }
  }

  async function drain() {
    if (processing) return;
    processing = true;
    while (queue.length > 0) {
      await processFrame(queue.shift()!);
    }
    processing = false;
  }

  workletNode.port.onmessage = (e: MessageEvent) => {
    if (e.data.type === "frame") {
      if (queue.length >= MAX_QUEUE_SIZE) queue.shift();
      queue.push(e.data.samples);
      drain();
    }
  };

  const destination = ctx.createMediaStreamDestination();
  source.connect(workletNode);
  workletNode.connect(destination);

  return {
    stream: destination.stream,
    cleanup() {
      source.disconnect();
      workletNode.disconnect();
      ctx.close().catch(() => {});
      invoke("noise_suppress_cleanup").catch(() => {});
    },
  };
}
