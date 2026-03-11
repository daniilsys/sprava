import { Device, type types } from "mediasoup-client";
import { getSocket } from "./socket";
import { useVoiceStore } from "../store/voice.store";
import { useAppStore } from "../store/app.store";
import { useAuthStore } from "../store/auth.store";
import {
  startAudioMonitor,
  stopAudioMonitor,
  stopAllAudioMonitors,
} from "./audioMonitor";
import { playJoinSound, playLeaveSound } from "./sounds";
import { createNoiseGate, type NoiseGateResult } from "./noiseGate";
import {
  createNoiseSuppression,
  type NoiseSuppressionResult,
  type NoiseMode,
} from "./noiseSuppression";
import { api } from "./api";
import { invoke } from "@tauri-apps/api/core";
import {
  getStoredAudioInputDeviceId,
} from "../components/voice/AudioDeviceSelector";

let device: Device | null = null;
let sendTransport: types.Transport | null = null;
let recvTransport: types.Transport | null = null;
let producer: types.Producer | null = null;
let noiseGate: NoiseGateResult | null = null;
let noiseSuppression: NoiseSuppressionResult | null = null;
const consumers = new Map<string, types.Consumer>();

/** Shared AudioContext for all remote audio playback (one instead of N per consumer) */
let playbackCtx: AudioContext | null = null;

export function getPlaybackCtx(): AudioContext {
  if (!playbackCtx || playbackCtx.state === "closed") {
    playbackCtx = new AudioContext();
  }
  if (playbackCtx.state === "suspended") {
    playbackCtx.resume().catch(() => {});
  }
  return playbackCtx;
}
/** Maps video stream key (`${userId}:${kind}`) → consumerId so we can stop watching */
const videoConsumerKeys = new Map<string, string>();

/** Emit an event and wait for a specific response event (server uses separate events, not ack callbacks) */
function emitAndWait<T = unknown>(
  emitEvent: string,
  data: unknown,
  responseEvent: string,
  errorEvent = "voice:error",
  timeoutMs = 10000,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const socket = getSocket();
    if (!socket) return reject(new Error("No socket"));

    const timeout = setTimeout(() => {
      socket.off(responseEvent, onSuccess);
      socket.off(errorEvent, onError);
      reject(new Error(`${emitEvent} timed out`));
    }, timeoutMs);

    const onSuccess = (result: T) => {
      clearTimeout(timeout);
      socket.off(errorEvent, onError);
      resolve(result);
    };
    const onError = (err: any) => {
      clearTimeout(timeout);
      socket.off(responseEvent, onSuccess);
      reject(new Error(err?.message || `${emitEvent} failed`));
    };

    socket.once(responseEvent, onSuccess);
    socket.once(errorEvent, onError);
    socket.emit(emitEvent, data);
  });
}

export async function joinVoice(
  contextId: string,
  type: "channel" | "dm",
  userId: string,
) {
  const socket = getSocket();
  if (!socket) throw new Error("No socket");

  const store = useVoiceStore.getState();
  if (store.currentRoomId) await leaveVoice();

  store.setJoining(true);

  try {
    // Get microphone
    if (!navigator.mediaDevices) {
      throw new Error(
        "Microphone access not available — secure context required",
      );
    }

    // Determine noise cancellation mode from user settings
    let ncMode: string = "LIGHT";
    try {
      const settings = (await api.settings.get()) as { noiseCancellation?: string } | null;
      if (settings?.noiseCancellation) ncMode = settings.noiseCancellation;
    } catch {
      // default to LIGHT if settings unavailable
    }

    // When we handle noise suppression ourselves, disable WebKit's audio processing.
    // This prevents WKWebView from using the Voice Processing IO audio unit,
    // which triggers macOS to duck (lower) all other apps' audio.
    const useOwnProcessing = ncMode !== "OFF";
    const storedInputDevice = getStoredAudioInputDeviceId();
    const audioConstraints: MediaTrackConstraints = {
      echoCancellation: !useOwnProcessing,
      noiseSuppression: !useOwnProcessing,
      autoGainControl: !useOwnProcessing,
    };
    if (storedInputDevice) {
      audioConstraints.deviceId = { exact: storedInputDevice };
    }
    const rawStream = await navigator.mediaDevices.getUserMedia({
      audio: audioConstraints,
    });

    // Configure macOS audio session to prevent ducking other apps' audio
    invoke("audio_session_configure").catch(() => {});

    // Apply noise processing based on user setting
    let stream: MediaStream;
    if (ncMode === "OFF") {
      stream = rawStream;
    } else {
      try {
        noiseSuppression = await createNoiseSuppression(rawStream, ncMode as NoiseMode);
        stream = noiseSuppression.stream;
      } catch (err) {
        console.warn("[voice] Noise suppression unavailable, falling back to noise gate:", err);
        noiseGate = createNoiseGate(rawStream);
        stream = noiseGate.stream;
      }
    }
    store.setLocalStream(rawStream);

    // Join voice room
    const joinPayload =
      type === "channel"
        ? { channelId: contextId }
        : { dmConversationId: contextId };

    const joinResult = await new Promise<{
      routerRtpCapabilities: any;
      sendTransportOptions: any;
      recvTransportOptions: any;
      voiceStates: { userId: string; roomId: string }[];
      existingProducers: { userId: string; producerId: string; kind: string }[];
    }>((resolve, reject) => {
      const timeout = setTimeout(() => {
        socket.off("voice:joined", onJoined);
        socket.off("voice:error", onError);
        reject(new Error("Voice join timed out"));
      }, 10000);

      const onJoined = (data: any) => {
        clearTimeout(timeout);
        socket.off("voice:error", onError);
        resolve(data);
      };
      const onError = (data: any) => {
        clearTimeout(timeout);
        socket.off("voice:joined", onJoined);
        reject(new Error(data?.message || "Voice join failed"));
      };

      socket.once("voice:joined", onJoined);
      socket.once("voice:error", onError);
      socket.emit("voice:join", joinPayload);
    });

    const roomId =
      type === "channel" ? `channel:${contextId}` : `dm:${contextId}`;
    store.setRoom(roomId, type, contextId);

    // Add self + existing peers to voiceStates store
    useAppStore.getState().addVoiceState({ userId, roomId });
    for (const vs of joinResult.voiceStates || []) {
      store.addPeer(vs.userId);
      useAppStore.getState().addVoiceState(vs);
    }

    if (!joinResult.sendTransportOptions || !joinResult.recvTransportOptions) {
      console.error(
        "voice:joined payload missing transport options:",
        joinResult,
      );
      throw new Error("Server returned incomplete transport options");
    }

    // Create device — Tauri WKWebView UA isn't detected by mediasoup-client auto-detection,
    // so we explicitly specify the Safari12 handler (WKWebView is WebKit-based).
    device = new Device({ handlerName: "Safari12" });
    await device.load({
      routerRtpCapabilities: joinResult.routerRtpCapabilities,
    });

    // Create send transport
    sendTransport = device.createSendTransport(joinResult.sendTransportOptions);
    sendTransport.on(
      "connect",
      ({ dtlsParameters }: any, callback: any, errback: any) => {
        emitAndWait(
          "voice:connect_transport",
          {
            transportId: sendTransport!.id,
            dtlsParameters,
          },
          "voice:transport_ok",
        )
          .then(() => callback())
          .catch(errback);
      },
    );
    sendTransport.on(
      "produce",
      ({ kind, rtpParameters }: any, callback: any, errback: any) => {
        emitAndWait<{ producerId: string }>(
          "voice:produce",
          {
            transportId: sendTransport!.id,
            kind,
            rtpParameters,
          },
          "voice:produce_ok",
        )
          .then(({ producerId }) => callback({ id: producerId }))
          .catch(errback);
      },
    );

    // Create recv transport
    recvTransport = device.createRecvTransport(joinResult.recvTransportOptions);
    recvTransport.on(
      "connect",
      ({ dtlsParameters }: any, callback: any, errback: any) => {
        emitAndWait(
          "voice:connect_transport",
          {
            transportId: recvTransport!.id,
            dtlsParameters,
          },
          "voice:transport_ok",
        )
          .then(() => callback())
          .catch(errback);
      },
    );

    // Produce audio
    const audioTrack = stream.getAudioTracks()[0];
    if (audioTrack) {
      producer = await sendTransport.produce({ track: audioTrack });
    }

    // Monitor local audio level for speaking indicator (use raw stream, not gated)
    startAudioMonitor(userId, rawStream);

    // Play join sound
    playJoinSound();

    // Consume existing producers — audio only, video is opt-in
    for (const p of joinResult.existingProducers || []) {
      if (p.kind === "video") {
        // Track video producer but don't consume — user must click "watch"
        // We don't know camera vs screen here, default to camera
        store.setActiveVideoProducer(p.userId, "camera", p.producerId);
      } else {
        await consumeProducer(p.producerId, p.userId);
      }
    }
  } catch (e) {
    store.reset();
    throw e;
  } finally {
    store.setJoining(false);
  }
}

export async function leaveVoice() {
  const socket = getSocket();
  if (socket) {
    socket.emit("voice:leave");
  }

  // Remove own voiceState before reset
  const selfId = useAuthStore.getState().user?.id;
  if (selfId) {
    useAppStore.getState().removeVoiceState(selfId);
  }

  cleanup();
  useVoiceStore.getState().reset();
}

/** Server-initiated disconnect (ring timeout, kicked, etc.) — cleanup without emitting voice:leave */
export function forceDisconnect() {
  const selfId = useAuthStore.getState().user?.id;
  if (selfId) {
    useAppStore.getState().removeVoiceState(selfId);
  }

  cleanup();
  useVoiceStore.getState().reset();
}

export async function consumeProducer(producerId: string, userId: string) {
  if (!device || !recvTransport) {
    console.warn("[voice] consumeProducer: no device or recvTransport");
    return;
  }

  try {
    const response = await emitAndWait<{
      consumerId: string;
      producerId: string;
      kind: string;
      rtpParameters: any;
    }>(
      "voice:consume_request",
      {
        producerId,
        rtpCapabilities: device.rtpCapabilities,
      },
      "voice:consumer_ready",
    );

    const consumer = await recvTransport.consume({
      id: response.consumerId,
      producerId: response.producerId,
      kind: response.kind as "audio" | "video",
      rtpParameters: response.rtpParameters,
    });

    consumers.set(response.consumerId, consumer);

    // Resume consumer — mediasoup creates consumers paused by default on client side
    await consumer.resume();

    const stream = new MediaStream([consumer.track]);

    if (response.kind === "video") {
      // Video consumer — store in videoStreams for rendering in VideoGrid
      // Determine the kind (camera vs screen) from the video stream entry if one was pre-registered
      const store = useVoiceStore.getState();
      const cameraKey = `${userId}:camera`;
      const screenKey = `${userId}:screen`;
      // Check which video kind was announced via voice:video_start
      const kind = store.videoStreams.has(screenKey) && !store.videoStreams.get(screenKey)?.stream?.getVideoTracks().length
        ? "screen"
        : store.videoStreams.has(cameraKey) && !store.videoStreams.get(cameraKey)?.stream?.getVideoTracks().length
          ? "camera"
          : "camera"; // default fallback
      store.addVideoStream(userId, kind, stream);
      videoConsumerKeys.set(`${userId}:${kind}`, response.consumerId);
      store.setActiveVideoProducer(userId, kind, producerId);
    } else {
      // Audio consumer — play via shared Web Audio API context
      useVoiceStore.getState().updatePeer(userId, {
        consumerId: response.consumerId,
        producerId,
        stream,
      });

      const ctx = getPlaybackCtx();
      const source = ctx.createMediaStreamSource(stream);
      source.connect(ctx.destination);
      // Store source node for cleanup (disconnect only, don't close shared ctx)
      (consumer as any)._audioSource = source;

      // Monitor remote audio level for speaking indicator
      startAudioMonitor(userId, stream);
    }
  } catch (err) {
    console.error("[voice] consumeProducer failed:", err);
  }
}

function cleanup() {
  stopAllAudioMonitors();
  cleanupVideo();

  noiseSuppression?.cleanup();
  noiseSuppression = null;
  noiseGate?.cleanup();
  noiseGate = null;

  producer?.close();
  producer = null;

  for (const consumer of consumers.values()) {
    // Disconnect audio source from shared playback context
    const source = (consumer as any)._audioSource as MediaStreamAudioSourceNode | undefined;
    if (source) source.disconnect();
    consumer.close();
  }
  consumers.clear();
  videoConsumerKeys.clear();

  // Close shared playback AudioContext
  if (playbackCtx) {
    playbackCtx.close().catch(() => {});
    playbackCtx = null;
  }

  sendTransport?.close();
  sendTransport = null;

  recvTransport?.close();
  recvTransport = null;

  device = null;

  // Reset macOS audio session so other apps' volume returns to normal
  invoke("audio_session_reset").catch(() => {});
}

// Socket event handlers for voice — called from useSocket
export function handleVoiceUserJoined(userId: string) {
  useVoiceStore.getState().addPeer(userId);
  // Only play sound if we're in a voice room
  if (useVoiceStore.getState().currentRoomId) {
    playJoinSound();
  }
}

export function handleVoiceUserLeft(userId: string) {
  stopAudioMonitor(userId);
  useVoiceStore.getState().removePeer(userId);
  if (useVoiceStore.getState().currentRoomId) {
    playLeaveSound();
  }
}

// Buffer for video producer IDs that arrive before voice:video_start
const unresolvedVideoProducers = new Map<string, string[]>(); // userId → producerIds[]

export function handleVoiceNewProducer(producerId: string, userId: string, kind: string) {
  if (kind === "video") {
    const store = useVoiceStore.getState();
    const screenKey = `${userId}:screen`;
    const cameraKey = `${userId}:camera`;
    // Try to resolve a "pending" placeholder set by voice:video_start
    if (store.activeVideoProducers.get(screenKey) === "pending") {
      store.setActiveVideoProducer(userId, "screen", producerId);
    } else if (store.activeVideoProducers.get(cameraKey) === "pending") {
      store.setActiveVideoProducer(userId, "camera", producerId);
    } else {
      // voice:new_producer arrived BEFORE voice:video_start — buffer it
      const buf = unresolvedVideoProducers.get(userId) ?? [];
      buf.push(producerId);
      unresolvedVideoProducers.set(userId, buf);
    }
    return;
  }
  // Audio — auto-consume
  consumeProducer(producerId, userId);
}

export function handleVoiceConsumerReady(_data: {
  consumerId: string;
  producerId: string;
  kind: string;
  rtpParameters: any;
}) {
  // Already handled in consumeProducer
}

// ─── Video / Screen Share ────────────────────────────────────────────────────

let screenProducer: types.Producer | null = null;
let cameraProducer: types.Producer | null = null;
let screenStream: MediaStream | null = null;
let cameraStream: MediaStream | null = null;

export function getLocalVideoStream(kind: "camera" | "screen"): MediaStream | null {
  return kind === "screen" ? screenStream : cameraStream;
}

export async function startScreenShare(): Promise<MediaStream> {
  const stream = await navigator.mediaDevices.getDisplayMedia({
    video: {
      width: { ideal: 1280 },
      height: { ideal: 720 },
      frameRate: { max: 30 },
    } as any,
    audio: false,
  });
  return stream;
}

export async function startCamera(): Promise<MediaStream> {
  const stream = await navigator.mediaDevices.getUserMedia({
    video: { width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30 } },
    audio: false,
  });
  return stream;
}

export async function produceVideo(kind: "camera" | "screen"): Promise<string | null> {
  if (!sendTransport) {
    console.warn("[voice] produceVideo: no sendTransport");
    return null;
  }

  const socket = getSocket();
  if (!socket) return null;

  try {
    let stream: MediaStream;
    if (kind === "screen") {
      console.log("[voice] produceVideo: starting screen share (getDisplayMedia)");
      stream = await startScreenShare();
      screenStream = stream;
    } else {
      console.log("[voice] produceVideo: starting camera (getUserMedia)");
      stream = await startCamera();
      cameraStream = stream;
    }

    const videoTrack = stream.getVideoTracks()[0];
    if (!videoTrack) return null;

    // Ensure track is live before producing
    if (videoTrack.readyState !== "live") {
      console.error("[voice] Video track is not live:", videoTrack.readyState);
      stream.getTracks().forEach((t) => t.stop());
      return null;
    }

    // When screen share track ends (user clicks "Stop sharing" in browser UI), auto-stop
    if (kind === "screen") {
      videoTrack.addEventListener("ended", () => {
        stopVideoProducer("screen");
      });
    }

    // WKWebView (Safari) doesn't support VP8 — find H264 codec from router capabilities
    const h264Codec = device?.rtpCapabilities?.codecs?.find(
      (c) => c.mimeType.toLowerCase() === "video/h264",
    );

    const prod = await sendTransport.produce({
      track: videoTrack,
      codec: h264Codec,
      codecOptions: kind === "screen" ? { videoGoogleStartBitrate: 1000 } : undefined,
      encodings: kind === "screen"
        ? [{ maxBitrate: 1_500_000 }] // screen share: single layer, high quality
        : [
            { rid: "r0", maxBitrate: 100_000, scaleResolutionDownBy: 4 },
            { rid: "r1", maxBitrate: 300_000, scaleResolutionDownBy: 2 },
            { rid: "r2", maxBitrate: 900_000, scaleResolutionDownBy: 1 },
          ],
    });

    if (kind === "screen") {
      screenProducer = prod;
    } else {
      cameraProducer = prod;
    }

    socket.emit("voice:video_start", { kind });
    return prod.id;
  } catch (err) {
    console.error(`[voice] produceVideo(${kind}) failed:`, err);
    return null;
  }
}

export function stopVideoProducer(kind: "camera" | "screen") {
  const socket = getSocket();

  if (kind === "screen") {
    if (screenProducer) {
      screenProducer.close();
      screenProducer = null;
    }
    if (screenStream) {
      screenStream.getTracks().forEach((t) => t.stop());
      screenStream = null;
    }
  } else {
    if (cameraProducer) {
      cameraProducer.close();
      cameraProducer = null;
    }
    if (cameraStream) {
      cameraStream.getTracks().forEach((t) => t.stop());
      cameraStream = null;
    }
  }

  socket?.emit("voice:video_stop", { kind });
}

export function handleVoiceVideoStart(userId: string, kind: "camera" | "screen") {
  const store = useVoiceStore.getState();
  // Check if voice:new_producer already arrived (race condition)
  const buf = unresolvedVideoProducers.get(userId);
  if (buf && buf.length > 0) {
    const producerId = buf.shift()!;
    if (buf.length === 0) unresolvedVideoProducers.delete(userId);
    store.setActiveVideoProducer(userId, kind, producerId);
  } else {
    // Mark as pending — will be resolved when voice:new_producer arrives
    store.setActiveVideoProducer(userId, kind, "pending");
  }
}

export function handleVoiceVideoStop(userId: string, kind: "camera" | "screen") {
  useVoiceStore.getState().removeVideoStream(userId, kind);
  useVoiceStore.getState().removeActiveVideoProducer(userId, kind);
  videoConsumerKeys.delete(`${userId}:${kind}`);
  unresolvedVideoProducers.delete(userId);
}

/** Stop watching a remote video stream (close the consumer, remove from store) */
export function stopWatchingStream(userId: string, kind: "camera" | "screen") {
  const key = `${userId}:${kind}`;
  const consumerId = videoConsumerKeys.get(key);
  if (consumerId) {
    const consumer = consumers.get(consumerId);
    if (consumer) {
      consumer.close();
      consumers.delete(consumerId);
    }
    videoConsumerKeys.delete(key);
  }
  useVoiceStore.getState().removeVideoStream(userId, kind);
}

/** Re-watch a remote video stream by re-consuming the producer */
export async function rewatchStream(userId: string, kind: "camera" | "screen") {
  const store = useVoiceStore.getState();
  const key = `${userId}:${kind}`;
  const producerId = store.activeVideoProducers.get(key);
  if (!producerId || producerId === "pending") {
    console.warn("[voice] rewatchStream: no known producerId for", key);
    return;
  }
  // Add placeholder so consumeProducer knows the kind
  store.addVideoStream(userId, kind);
  await consumeProducer(producerId, userId);
}

// ─── Simulcast layer control ─────────────────────────────────────────────────

/**
 * Request the SFU to switch the simulcast layer for a video consumer.
 * spatialLayer 0 = tiny (100kbps), 1 = mid (300kbps), 2 = full (900kbps).
 * Call this when a video tile resizes to save bandwidth.
 */
export function setPreferredLayers(
  consumerId: string,
  spatialLayer: number,
  temporalLayer?: number,
) {
  const socket = getSocket();
  if (!socket) return;
  socket.emit("voice:set_preferred_layers", {
    consumerId,
    spatialLayer,
    temporalLayer,
  });
}

/**
 * Pause a remote video consumer on the SFU (saves bandwidth when tile is off-screen).
 * Audio consumers are never paused — Opus is cheap and pausing causes clipping.
 */
export function pauseVideoConsumer(consumerId: string) {
  const socket = getSocket();
  if (!socket) return;
  socket.emit("voice:pause_consumer", { consumerId, pause: true });
}

/** Resume a previously paused video consumer. */
export function resumeVideoConsumer(consumerId: string) {
  const socket = getSocket();
  if (!socket) return;
  socket.emit("voice:pause_consumer", { consumerId, pause: false });
}

/**
 * Get the consumerId for a video stream key (e.g. "userId:camera").
 * Returns undefined if no consumer exists for that stream.
 */
export function getVideoConsumerId(userId: string, kind: "camera" | "screen"): string | undefined {
  return videoConsumerKeys.get(`${userId}:${kind}`);
}

/** Cleanup video producers — called from the main cleanup() */
function cleanupVideo() {
  screenProducer?.close();
  screenProducer = null;
  screenStream?.getTracks().forEach((t) => t.stop());
  screenStream = null;

  cameraProducer?.close();
  cameraProducer = null;
  cameraStream?.getTracks().forEach((t) => t.stop());
  cameraStream = null;

  unresolvedVideoProducers.clear();
}
