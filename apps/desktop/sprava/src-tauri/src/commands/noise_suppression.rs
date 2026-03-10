use crate::noise_suppression::NoiseSuppressionState;
use tauri::State;

#[tauri::command]
pub fn noise_suppress_init(
    state: State<'_, NoiseSuppressionState>,
    mode: String,
) -> Result<usize, String> {
    state.init(&mode)
}

#[tauri::command]
pub fn noise_suppress_process(
    state: State<'_, NoiseSuppressionState>,
    samples: Vec<f32>,
) -> Result<Vec<f32>, String> {
    state.process(&samples)
}

#[tauri::command]
pub fn noise_suppress_cleanup(
    state: State<'_, NoiseSuppressionState>,
) -> Result<(), String> {
    state.cleanup();
    Ok(())
}
