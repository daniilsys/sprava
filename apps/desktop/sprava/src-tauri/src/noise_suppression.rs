use deep_filter::tract::{DfParams, DfTract, RuntimeParams};
use ndarray::Array2;
use nnnoiseless::DenoiseState;
use std::sync::Mutex;

const RNNOISE_FRAME_SIZE: usize = 480;

enum Engine {
    /// LIGHT — RNNoise (nnnoiseless), ~0.5 MB, very fast
    Light(Box<DenoiseState<'static>>),
    /// HIGH_QUALITY — DeepFilterNet3 (tract), ~3 MB model, heavier
    HighQuality { model: DfTract, hop_size: usize },
}

// DfTract uses Rc internally (tract TValue) but we protect all access
// through a Mutex, guaranteeing single-threaded access at all times.
unsafe impl Send for Engine {}

pub struct NoiseSuppressionState {
    inner: Mutex<Option<Engine>>,
}

unsafe impl Sync for NoiseSuppressionState {}

impl NoiseSuppressionState {
    pub fn new() -> Self {
        Self {
            inner: Mutex::new(None),
        }
    }

    /// Initialize the engine. Returns the frame/hop size for the chosen mode.
    /// mode: "LIGHT" | "HIGH_QUALITY"
    pub fn init(&self, mode: &str) -> Result<usize, String> {
        let engine = match mode {
            "LIGHT" => Engine::Light(DenoiseState::new()),
            "HIGH_QUALITY" => {
                let df_params = DfParams::default();
                let r_params = RuntimeParams::default_with_ch(1);
                let model = DfTract::new(df_params, &r_params).map_err(|e| e.to_string())?;
                let hop_size = model.hop_size;
                Engine::HighQuality { model, hop_size }
            }
            _ => return Err(format!("Unknown noise cancellation mode: {mode}")),
        };

        let hop = match &engine {
            Engine::Light(_) => RNNOISE_FRAME_SIZE,
            Engine::HighQuality { hop_size, .. } => *hop_size,
        };

        *self.inner.lock().unwrap() = Some(engine);
        Ok(hop)
    }

    pub fn process(&self, samples: &[f32]) -> Result<Vec<f32>, String> {
        let mut guard = self.inner.lock().unwrap();
        let engine = guard.as_mut().ok_or("Noise suppression not initialized")?;

        match engine {
            Engine::Light(state) => process_rnnoise(state, samples),
            Engine::HighQuality { model, hop_size } => process_deepfilter(model, *hop_size, samples),
        }
    }

    pub fn cleanup(&self) {
        *self.inner.lock().unwrap() = None;
    }
}

fn process_rnnoise(state: &mut DenoiseState<'_>, samples: &[f32]) -> Result<Vec<f32>, String> {
    if samples.is_empty() {
        return Ok(vec![]);
    }

    let n_frames = samples.len() / RNNOISE_FRAME_SIZE;
    let usable = n_frames * RNNOISE_FRAME_SIZE;

    if n_frames == 0 {
        return Ok(samples.to_vec());
    }

    let mut output = vec![0f32; usable];

    for i in 0..n_frames {
        let start = i * RNNOISE_FRAME_SIZE;
        let end = start + RNNOISE_FRAME_SIZE;

        // RNNoise expects i16-range floats (±32768), not normalized ±1
        let mut input_frame = [0f32; RNNOISE_FRAME_SIZE];
        for (j, &s) in samples[start..end].iter().enumerate() {
            input_frame[j] = s * 32768.0;
        }

        let mut output_frame = [0f32; RNNOISE_FRAME_SIZE];
        state.process_frame(&mut output_frame, &input_frame);

        // Convert back to ±1 range
        for (j, &s) in output_frame.iter().enumerate() {
            output[start + j] = s / 32768.0;
        }
    }

    if usable < samples.len() {
        output.extend_from_slice(&samples[usable..]);
    }

    Ok(output)
}

fn process_deepfilter(model: &mut DfTract, hop_size: usize, samples: &[f32]) -> Result<Vec<f32>, String> {
    if samples.is_empty() {
        return Ok(vec![]);
    }

    let n_frames = samples.len() / hop_size;
    let usable = n_frames * hop_size;

    if n_frames == 0 {
        return Ok(samples.to_vec());
    }

    let mut output = vec![0f32; usable];

    for i in 0..n_frames {
        let start = i * hop_size;
        let end = start + hop_size;

        let input_frame =
            Array2::from_shape_vec((1, hop_size), samples[start..end].to_vec())
                .map_err(|e| e.to_string())?;
        let mut output_frame = Array2::zeros((1, hop_size));

        model
            .process(input_frame.view(), output_frame.view_mut())
            .map_err(|e| e.to_string())?;

        output[start..end].copy_from_slice(output_frame.row(0).as_slice().unwrap());
    }

    if usable < samples.len() {
        output.extend_from_slice(&samples[usable..]);
    }

    Ok(output)
}
