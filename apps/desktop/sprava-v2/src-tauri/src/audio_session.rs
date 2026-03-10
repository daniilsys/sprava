#[cfg(target_os = "macos")]
extern "C" {
    fn configure_audio_session_no_duck();
    fn reset_audio_session();
}

/// Disable macOS audio ducking (other apps' volume being lowered).
pub fn disable_ducking() {
    #[cfg(target_os = "macos")]
    unsafe {
        configure_audio_session_no_duck();
    }
}

/// Reset the audio session when leaving voice.
pub fn reset() {
    #[cfg(target_os = "macos")]
    unsafe {
        reset_audio_session();
    }
}
