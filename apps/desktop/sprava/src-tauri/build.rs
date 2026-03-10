fn main() {
    tauri_build::build();

    #[cfg(target_os = "macos")]
    {
        cc::Build::new()
            .file("src/macos_audio.m")
            .flag("-fobjc-arc")
            .compile("macos_audio");
        println!("cargo:rustc-link-lib=framework=AVFAudio");
        println!("cargo:rustc-link-lib=framework=Foundation");
        println!("cargo:rustc-link-lib=framework=CoreAudio");
    }
}
