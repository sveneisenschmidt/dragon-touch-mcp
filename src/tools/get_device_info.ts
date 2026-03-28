import { z } from "zod";
import { AdbConfig, adbExec, getSystemSetting } from "../adb.js";
import type { CliCommand } from "../cli.js";

async function run(_args: unknown, config: AdbConfig): Promise<unknown> {
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

  // Parse wakefulness
  const wakefulnessMatch = wakefulnessOut.match(/mWakefulness=(\w+)/);
  const awake = wakefulnessMatch?.at(1) === "Awake";

  // Parse battery
  const batteryLevel = batteryOut.match(/^\s*level:\s*(\d+)/m)?.at(1);
  const batteryStatus = batteryOut.match(/^\s*status:\s*(\d+)/m)?.at(1);
  const acPowered = batteryOut.match(/^\s*AC powered:\s*(true|false)/m)?.at(1);
  const usbPowered = batteryOut.match(/^\s*USB powered:\s*(true|false)/m)?.at(1);

  return {
    success: true,
    device: {
      model: modelOut || null,
    },
    screen: {
      brightness: brightness !== null ? parseInt(brightness, 10) : null,
      autoBrightness: brightnessMode === "1",
      rotation: rotation !== null ? parseInt(rotation, 10) : null,
      awake,
    },
    audio: {
      volumeMusic: volumeMusic !== null ? parseInt(volumeMusic, 10) : null,
      volumeRing: volumeRing !== null ? parseInt(volumeRing, 10) : null,
    },
    power: {
      batteryLevel: batteryLevel !== undefined ? parseInt(batteryLevel, 10) : null,
      batteryStatus: batteryStatus !== undefined ? parseInt(batteryStatus, 10) : null,
      acPowered: acPowered === "true",
      usbPowered: usbPowered === "true",
    },
  };
}

export const getDeviceInfoCliCommand: CliCommand = {
  name: "get_device_info",
  description:
    "Read screen state (brightness, rotation, awake), audio volumes, power, and device model via ADB",
  schema: z.object({}),
  run,
};
