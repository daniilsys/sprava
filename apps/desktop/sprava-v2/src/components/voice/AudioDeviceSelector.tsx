import { useEffect, useState, useCallback } from "react";
import { useTranslation } from "react-i18next";

const LS_KEY_INPUT = "audio-input-device";
const LS_KEY_OUTPUT = "audio-output-device";

export function getStoredAudioInputDeviceId(): string | null {
  return localStorage.getItem(LS_KEY_INPUT);
}

export function getStoredAudioOutputDeviceId(): string | null {
  return localStorage.getItem(LS_KEY_OUTPUT);
}

interface AudioDeviceSelectorProps {
  onDeviceChange?: (type: "audioinput" | "audiooutput", deviceId: string) => void;
}

export function AudioDeviceSelector({ onDeviceChange }: AudioDeviceSelectorProps) {
  const { t } = useTranslation("voice");
  const [inputDevices, setInputDevices] = useState<MediaDeviceInfo[]>([]);
  const [outputDevices, setOutputDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedInput, setSelectedInput] = useState<string>(
    () => getStoredAudioInputDeviceId() ?? "",
  );
  const [selectedOutput, setSelectedOutput] = useState<string>(
    () => getStoredAudioOutputDeviceId() ?? "",
  );

  const refreshDevices = useCallback(async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      setInputDevices(devices.filter((d) => d.kind === "audioinput"));
      setOutputDevices(devices.filter((d) => d.kind === "audiooutput"));
    } catch (err) {
      console.warn("[AudioDeviceSelector] Failed to enumerate devices:", err);
    }
  }, []);

  useEffect(() => {
    refreshDevices();

    navigator.mediaDevices.addEventListener("devicechange", refreshDevices);
    return () => {
      navigator.mediaDevices.removeEventListener("devicechange", refreshDevices);
    };
  }, [refreshDevices]);

  const handleInputChange = (deviceId: string) => {
    setSelectedInput(deviceId);
    if (deviceId) {
      localStorage.setItem(LS_KEY_INPUT, deviceId);
    } else {
      localStorage.removeItem(LS_KEY_INPUT);
    }
    onDeviceChange?.("audioinput", deviceId);
    window.dispatchEvent(
      new CustomEvent("audio-device-change", {
        detail: { type: "audioinput", deviceId },
      }),
    );
  };

  const handleOutputChange = (deviceId: string) => {
    setSelectedOutput(deviceId);
    if (deviceId) {
      localStorage.setItem(LS_KEY_OUTPUT, deviceId);
    } else {
      localStorage.removeItem(LS_KEY_OUTPUT);
    }
    onDeviceChange?.("audiooutput", deviceId);
    window.dispatchEvent(
      new CustomEvent("audio-device-change", {
        detail: { type: "audiooutput", deviceId },
      }),
    );
  };

  const selectClasses =
    "w-full bg-elevated text-text-primary text-xs rounded-md px-2 py-1.5 border border-border-subtle focus:border-primary focus:outline-none transition-colors cursor-pointer appearance-none";

  return (
    <div className="flex flex-col gap-3 p-3 min-w-[240px]">
      <div className="flex flex-col gap-1">
        <label className="text-[11px] font-medium text-text-secondary uppercase tracking-wide">
          {t("devices.microphone")}
        </label>
        <select
          className={selectClasses}
          value={selectedInput}
          onChange={(e) => handleInputChange(e.target.value)}
        >
          <option value="">{t("devices.default")}</option>
          {inputDevices.map((d) => (
            <option key={d.deviceId} value={d.deviceId}>
              {d.label || t("devices.microphoneFallback", { id: d.deviceId.slice(0, 8) })}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-[11px] font-medium text-text-secondary uppercase tracking-wide">
          {t("devices.speaker")}
        </label>
        <select
          className={selectClasses}
          value={selectedOutput}
          onChange={(e) => handleOutputChange(e.target.value)}
        >
          <option value="">{t("devices.default")}</option>
          {outputDevices.map((d) => (
            <option key={d.deviceId} value={d.deviceId}>
              {d.label || t("devices.speakerFallback", { id: d.deviceId.slice(0, 8) })}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
