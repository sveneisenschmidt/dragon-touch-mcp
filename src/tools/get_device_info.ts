import { z } from "zod";
import { AdbConfig, adbExec, getSystemSetting } from "../adb.js";
import type { CliCommand } from "../cli.js";

export interface RawDeviceData {
  brightness: string | null;
  brightnessMode: string | null;
  rotation: string | null;
  wakefulnessOut: string;
  volumeMusic: string | null;
  volumeRing: string | null;
  batteryOut: string;
  modelOut: string;
}

export function parseDeviceInfo(raw: RawDeviceData): object {
  const wakefulnessMatch = raw.wakefulnessOut.match(/mWakefulness=(\w+)/);
  const awake = wakefulnessMatch?.at(1) === "Awake";

  const batteryLevel = raw.batteryOut.match(/^\s*level:\s*(\d+)/m)?.at(1);
  const batteryStatus = raw.batteryOut.match(/^\s*status:\s*(\d+)/m)?.at(1);
  const acPowered = raw.batteryOut.match(/^\s*AC powered:\s*(true|false)/m)?.at(1);
  const usbPowered = raw.batteryOut.match(/^\s*USB powered:\s*(true|false)/m)?.at(1);

  return {
    success: true,
    device: {
      model: raw.modelOut || null,
    },
    screen: {
      brightness: raw.brightness !== null ? parseInt(raw.brightness, 10) : null,
      autoBrightness: raw.brightnessMode === "1",
      rotation: raw.rotation !== null ? parseInt(raw.rotation, 10) : null,
      awake,
    },
    audio: {
      volumeMusic: raw.volumeMusic !== null ? parseInt(raw.volumeMusic, 10) : null,
      volumeRing: raw.volumeRing !== null ? parseInt(raw.volumeRing, 10) : null,
    },
    power: {
      batteryLevel: batteryLevel !== undefined ? parseInt(batteryLevel, 10) : null,
      batteryStatus: batteryStatus !== undefined ? parseInt(batteryStatus, 10) : null,
      acPowered: acPowered === "true",
      usbPowered: usbPowered === "true",
    },
  };
}

async function run(_args: unknown, config: AdbConfig): Promise<unknown> {
  try {
  const [
    brightness,
    brightnessMode,
    rotation,
    wakefulnessOut,
    volumeMusic,
    volumeRing,
    batteryOut,
    modelOut,
  ] = await Promise.all([
    getSystemSetting("system", "screen_brightness", config),
    getSystemSetting("system", "screen_brightness_mode", config),
    getSystemSetting("system", "user_rotation", config),
    adbExec(`shell "dumpsys power | grep -m1 mWakefulness="`, config)
      .then((r) => r.stdout.trim())
      .catch(() => ""),
    getSystemSetting("system", "volume_music_speaker", config).then(
      (v) => v ?? getSystemSetting("system", "volume_music", config)
    ),
    getSystemSetting("system", "volume_ring_speaker", config).then(
      (v) => v ?? getSystemSetting("system", "volume_ring", config)
    ),
    adbExec("shell dumpsys battery", config)
      .then((r) => r.stdout)
      .catch(() => ""),
    adbExec("shell getprop ro.product.model", config)
      .then((r) => r.stdout.trim())
      .catch(() => ""),
  ]);

  return parseDeviceInfo({ brightness, brightnessMode, rotation, wakefulnessOut, volumeMusic, volumeRing, batteryOut, modelOut });
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export const getDeviceInfoCliCommand: CliCommand = {
  name: "get_device_info",
  description:
    "Read screen state (brightness, rotation, awake), audio volumes, power, and device model via ADB",
  schema: z.object({}),
  run,
};
