// Copyright (c) 2025 Sven Eisenschmidt. Licensed under the MIT License.
import { readFileSync } from "node:fs";

export const KIOSK_PACKAGE = "com.dragontouch.kioskbrowser";
export const KIOSK_ACTIVITY = `${KIOSK_PACKAGE}/.MainActivity`;
export const KIOSK_ADMIN = `${KIOSK_PACKAGE}/.KioskAdminReceiver`;

const RELEASES_URL = "https://github.com/sveneisenschmidt/dragon-touch-mcp/releases/download";

/** Version of this npm package. The kiosk APK of a release has the same version. */
export function packageVersion(): string {
  // src/kiosk.ts and dist/kiosk.js both sit one level below package.json.
  const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
  return pkg.version;
}

/** Download URL of the signed kiosk APK that the release workflow attaches to a GitHub release. */
export function kioskApkUrl(version: string): string {
  return `${RELEASES_URL}/v${version}/dragon-touch-kiosk-${version}.apk`;
}
