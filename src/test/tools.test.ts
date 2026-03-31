// Copyright (c) 2025 Sven Eisenschmidt. Licensed under the MIT License.
import { describe, it, expect } from "vitest";
import { parseSharedPrefsXml } from "../adb.js";
import { isSensitive } from "../tools/get_app_settings.js";
import { parseDeviceInfo } from "../tools/get_device_info.js";
import { z } from "zod";

// ---------------------------------------------------------------------------
// parseSharedPrefsXml
// ---------------------------------------------------------------------------

describe("parseSharedPrefsXml", () => {
  it("parses string values", () => {
    const xml = `<map><string name="language">en</string></map>`;
    expect(parseSharedPrefsXml(xml)).toEqual({ language: "en" });
  });

  it("parses int values", () => {
    const xml = `<map><int name="sleep_hour" value="22" /></map>`;
    expect(parseSharedPrefsXml(xml)).toEqual({ sleep_hour: "22" });
  });

  it("parses long values", () => {
    const xml = `<map><long name="last_sync" value="1700000000000" /></map>`;
    expect(parseSharedPrefsXml(xml)).toEqual({ last_sync: "1700000000000" });
  });

  it("parses float values", () => {
    const xml = `<map><float name="volume_factor" value="0.75" /></map>`;
    expect(parseSharedPrefsXml(xml)).toEqual({ volume_factor: "0.75" });
  });

  it("parses boolean values", () => {
    const xml = `<map><boolean name="notifications_enabled" value="true" /></map>`;
    expect(parseSharedPrefsXml(xml)).toEqual({ notifications_enabled: "true" });
  });

  it("parses mixed types in one file", () => {
    const xml = `
      <map>
        <string name="city">Berlin</string>
        <int name="wake_hour" value="7" />
        <boolean name="dark_mode" value="false" />
      </map>`;
    expect(parseSharedPrefsXml(xml)).toEqual({
      city: "Berlin",
      wake_hour: "7",
      dark_mode: "false",
    });
  });

  it("returns empty object for empty XML", () => {
    expect(parseSharedPrefsXml("")).toEqual({});
  });

  it("returns empty object when no recognisable tags present", () => {
    expect(parseSharedPrefsXml("<map></map>")).toEqual({});
  });
});

// ---------------------------------------------------------------------------
// isSensitive
// ---------------------------------------------------------------------------

describe("isSensitive", () => {
  it.each([
    "user_token",
    "jwt_access",
    "private_cert",
    "device_secret",
    "password_hash",
    "user_credential",
    "sign_key",
    "cert_data",
  ])("blocks sensitive key: %s", (key) => {
    expect(isSensitive(key)).toBe(true);
  });

  it.each([
    "language",
    "city",
    "wake_hour",
    "dark_mode",
    "weather_enabled",
    "sleep_schedule",
  ])("allows non-sensitive key: %s", (key) => {
    expect(isSensitive(key)).toBe(false);
  });

  it("is case-insensitive", () => {
    expect(isSensitive("JWT_TOKEN")).toBe(true);
    expect(isSensitive("PRIVATE_KEY")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// parseDeviceInfo
// ---------------------------------------------------------------------------

function makeRaw(overrides: Partial<Parameters<typeof parseDeviceInfo>[0]> = {}) {
  return {
    brightness: "128",
    brightnessMode: "0",
    rotation: "0",
    wakefulnessOut: "mWakefulness=Awake",
    volumeMusic: "8",
    volumeRing: "5",
    batteryOut: [
      "  AC powered: false",
      "  USB powered: true",
      "  level: 72",
      "  status: 2",
    ].join("\n"),
    modelOut: "Dragon Touch K10",
    ...overrides,
  };
}

describe("parseDeviceInfo", () => {
  it("returns success true", () => {
    const result = parseDeviceInfo(makeRaw()) as Record<string, unknown>;
    expect(result.success).toBe(true);
  });

  it("parses screen brightness and rotation", () => {
    const result = parseDeviceInfo(makeRaw()) as { screen: Record<string, unknown> };
    expect(result.screen.brightness).toBe(128);
    expect(result.screen.rotation).toBe(0);
    expect(result.screen.autoBrightness).toBe(false);
  });

  it("detects auto-brightness mode", () => {
    const result = parseDeviceInfo(makeRaw({ brightnessMode: "1" })) as { screen: Record<string, unknown> };
    expect(result.screen.autoBrightness).toBe(true);
  });

  it("parses awake state", () => {
    const awake = parseDeviceInfo(makeRaw({ wakefulnessOut: "mWakefulness=Awake" })) as { screen: Record<string, unknown> };
    expect(awake.screen.awake).toBe(true);

    const asleep = parseDeviceInfo(makeRaw({ wakefulnessOut: "mWakefulness=Asleep" })) as { screen: Record<string, unknown> };
    expect(asleep.screen.awake).toBe(false);

    const empty = parseDeviceInfo(makeRaw({ wakefulnessOut: "" })) as { screen: Record<string, unknown> };
    expect(empty.screen.awake).toBe(false);
  });

  it("parses audio volumes", () => {
    const result = parseDeviceInfo(makeRaw()) as { audio: Record<string, unknown> };
    expect(result.audio.volumeMusic).toBe(8);
    expect(result.audio.volumeRing).toBe(5);
  });

  it("returns null for missing volumes", () => {
    const result = parseDeviceInfo(makeRaw({ volumeMusic: null, volumeRing: null })) as { audio: Record<string, unknown> };
    expect(result.audio.volumeMusic).toBeNull();
    expect(result.audio.volumeRing).toBeNull();
  });

  it("parses battery level and charging state", () => {
    const result = parseDeviceInfo(makeRaw()) as { power: Record<string, unknown> };
    expect(result.power.batteryLevel).toBe(72);
    expect(result.power.batteryStatus).toBe(2);
    expect(result.power.acPowered).toBe(false);
    expect(result.power.usbPowered).toBe(true);
  });

  it("returns null for unparseable battery output", () => {
    const result = parseDeviceInfo(makeRaw({ batteryOut: "" })) as { power: Record<string, unknown> };
    expect(result.power.batteryLevel).toBeNull();
    expect(result.power.batteryStatus).toBeNull();
    expect(result.power.acPowered).toBe(false);
    expect(result.power.usbPowered).toBe(false);
  });

  it("includes device model", () => {
    const result = parseDeviceInfo(makeRaw()) as { device: Record<string, unknown> };
    expect(result.device.model).toBe("Dragon Touch K10");
  });

  it("returns null model for empty modelOut", () => {
    const result = parseDeviceInfo(makeRaw({ modelOut: "" })) as { device: Record<string, unknown> };
    expect(result.device.model).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// set_brightness schema validation
// ---------------------------------------------------------------------------

const brightnessSchema = z.object({
  brightness: z.number().int().min(0).max(255),
});

describe("set_brightness schema", () => {
  it("accepts valid brightness values", () => {
    expect(() => brightnessSchema.parse({ brightness: 0 })).not.toThrow();
    expect(() => brightnessSchema.parse({ brightness: 128 })).not.toThrow();
    expect(() => brightnessSchema.parse({ brightness: 255 })).not.toThrow();
  });

  it("rejects values below 0", () => {
    expect(() => brightnessSchema.parse({ brightness: -1 })).toThrow();
  });

  it("rejects values above 255", () => {
    expect(() => brightnessSchema.parse({ brightness: 256 })).toThrow();
  });

  it("rejects non-integer values", () => {
    expect(() => brightnessSchema.parse({ brightness: 1.5 })).toThrow();
  });

  it("rejects missing field", () => {
    expect(() => brightnessSchema.parse({})).toThrow();
  });
});

// ---------------------------------------------------------------------------
// set_volume schema validation
// ---------------------------------------------------------------------------

const volumeSchema = z.object({
  volume: z.number().int().min(0).max(15),
});

describe("set_volume schema", () => {
  it("accepts valid volume values", () => {
    expect(() => volumeSchema.parse({ volume: 0 })).not.toThrow();
    expect(() => volumeSchema.parse({ volume: 7 })).not.toThrow();
    expect(() => volumeSchema.parse({ volume: 15 })).not.toThrow();
  });

  it("rejects values below 0", () => {
    expect(() => volumeSchema.parse({ volume: -1 })).toThrow();
  });

  it("rejects values above 15", () => {
    expect(() => volumeSchema.parse({ volume: 16 })).toThrow();
  });

  it("rejects non-integer values", () => {
    expect(() => volumeSchema.parse({ volume: 3.5 })).toThrow();
  });

  it("rejects missing field", () => {
    expect(() => volumeSchema.parse({})).toThrow();
  });
});
