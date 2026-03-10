use nnnoiseless::DenoiseState;
use std::ptr::addr_of;
use std::ptr::addr_of_mut;

const FRAME_SIZE: usize = 480;

static mut STATE: Option<Box<DenoiseState<'static>>> = None;
static mut INPUT_BUF: [f32; FRAME_SIZE] = [0.0; FRAME_SIZE];
static mut OUTPUT_BUF: [f32; FRAME_SIZE] = [0.0; FRAME_SIZE];

#[no_mangle]
pub extern "C" fn init() -> u32 {
    unsafe {
        STATE = Some(DenoiseState::new());
    }
    FRAME_SIZE as u32
}

#[no_mangle]
pub extern "C" fn get_input_ptr() -> *mut f32 {
    unsafe { addr_of_mut!(INPUT_BUF) as *mut f32 }
}

#[no_mangle]
pub extern "C" fn get_output_ptr() -> *const f32 {
    unsafe { addr_of!(OUTPUT_BUF) as *const f32 }
}

/// Process one 480-sample frame.
/// Caller writes samples to INPUT_BUF, calls this, reads from OUTPUT_BUF.
#[no_mangle]
pub extern "C" fn process_frame() {
    unsafe {
        if let Some(ref mut state) = STATE {
            let input = &*addr_of!(INPUT_BUF);
            let output = &mut *addr_of_mut!(OUTPUT_BUF);

            // RNNoise expects i16-range floats (+-32768)
            let mut scaled = [0f32; FRAME_SIZE];
            for i in 0..FRAME_SIZE {
                scaled[i] = input[i] * 32768.0;
            }
            state.process_frame(output, &scaled);
            for i in 0..FRAME_SIZE {
                output[i] /= 32768.0;
            }
        }
    }
}

#[no_mangle]
pub extern "C" fn cleanup() {
    unsafe {
        STATE = None;
    }
}
