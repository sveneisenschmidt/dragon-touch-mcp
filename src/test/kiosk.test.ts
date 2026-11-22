// Copyright (c) 2025 Sven Eisenschmidt. Licensed under the MIT License.
import { readFileSync } from "node:fs";
import { describe, it, expect } from "vitest";
import { parseVersionName } from "../adb.js";
import { kioskApkUrl, packageVersion } from "../kiosk.js";
import { describeInstallError } from "../tools/install_kiosk.js";

describe("packageVersion", () => {
  it("returns the version from package.json", () => {
    const pkg = JSON.parse(readFileSync(new URL("../../package.json", import.meta.url), "utf8"));
    expect(packageVersion()).toBe(pkg.version);
  });
});

describe("kioskApkUrl", () => {
  it("points to the APK of the matching GitHub release", () => {
    expect(kioskApkUrl("0.6.0")).toBe(
      "https://github.com/sveneisenschmidt/dragon-touch-mcp/releases/download/v0.6.0/dragon-touch-kiosk-0.6.0.apk"
    );
  });
});

describe("parseVersionName", () => {
  it("reads versionName from dumpsys output", () => {
    expect(parseVersionName("    versionName=0.6.0\n")).toBe("0.6.0");
  });

  it("returns null when dumpsys prints no versionName", () => {
    expect(parseVersionName("")).toBeNull();
  });
});

describe("describeInstallError", () => {
  it("explains a signature mismatch with the uninstall commands", () => {
    const message = describeInstallError("Failure [INSTALL_FAILED_UPDATE_INCOMPATIBLE: ...]");
    expect(message).toContain(
      "dpm remove-active-admin com.dragontouch.kioskbrowser/.KioskAdminReceiver"
    );
    expect(message).toContain("adb uninstall com.dragontouch.kioskbrowser");
  });

  it("keeps other errors unchanged", () => {
    expect(describeInstallError("Failure [INSTALL_FAILED_INSUFFICIENT_STORAGE]")).toBe(
      "Failure [INSTALL_FAILED_INSUFFICIENT_STORAGE]"
    );
  });
});
