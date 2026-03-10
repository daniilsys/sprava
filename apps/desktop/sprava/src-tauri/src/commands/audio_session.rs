use crate::audio_session;

#[tauri::command]
pub fn audio_session_configure() {
    audio_session::disable_ducking();
}

#[tauri::command]
pub fn audio_session_reset() {
    audio_session::reset();
}
