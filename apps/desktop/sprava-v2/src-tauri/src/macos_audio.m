#import <Foundation/Foundation.h>
#import <CoreAudio/CoreAudio.h>
#import <objc/message.h>

/// Try to configure AVAudioSession via runtime (bypasses API_UNAVAILABLE check).
/// AVFAudio framework is loaded by WebKit, so the class may exist at runtime
/// even though the SDK marks it unavailable on macOS.
void configure_audio_session_no_duck(void) {
    Class cls = NSClassFromString(@"AVAudioSession");
    if (!cls) {
        NSLog(@"[sprava] AVAudioSession not available at runtime, skipping");
        return;
    }

    id session = ((id (*)(Class, SEL))objc_msgSend)(cls, sel_registerName("sharedInstance"));
    if (!session) return;

    NSString *category = @"AVAudioSessionCategoryPlayAndRecord";
    NSString *mode = @"AVAudioSessionModeVoiceChat";
    // Options: 0 = no ducking. Omitting AVAudioSessionCategoryOptionDuckOthers (0x2).
    // We include AllowBluetoothHFP (0x20) for headset support.
    NSUInteger options = 0x20; // AVAudioSessionCategoryOptionAllowBluetoothHFP
    NSError *error = nil;

    SEL sel = sel_registerName("setCategory:mode:options:error:");
    BOOL ok = ((BOOL (*)(id, SEL, NSString*, NSString*, NSUInteger, NSError**))objc_msgSend)(
        session, sel, category, mode, options, &error
    );

    if (!ok || error) {
        NSLog(@"[sprava] Audio session setCategory failed: %@", error);
        return;
    }

    SEL activeSel = sel_registerName("setActive:error:");
    ((BOOL (*)(id, SEL, BOOL, NSError**))objc_msgSend)(
        session, activeSel, YES, &error
    );

    if (error) {
        NSLog(@"[sprava] Audio session setActive failed: %@", error);
    } else {
        NSLog(@"[sprava] Audio session configured: no ducking");
    }
}

void reset_audio_session(void) {
    Class cls = NSClassFromString(@"AVAudioSession");
    if (!cls) return;

    id session = ((id (*)(Class, SEL))objc_msgSend)(cls, sel_registerName("sharedInstance"));
    if (!session) return;

    NSError *error = nil;
    // setActive:withOptions:error: — NotifyOthersOnDeactivation = 1
    SEL sel = sel_registerName("setActive:withOptions:error:");
    ((BOOL (*)(id, SEL, BOOL, NSUInteger, NSError**))objc_msgSend)(
        session, sel, NO, 1, &error
    );

    if (error) {
        NSLog(@"[sprava] Audio session deactivate error: %@", error);
    }
}
