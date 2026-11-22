// Copyright (c) 2025 Sven Eisenschmidt. Licensed under the MIT License.
import { writeFile, unlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { z } from "zod";
import { AdbConfig, adbExec, ensureConnected, getPackageVersion, installApk } from "../adb.js";
import type { CliCommand } from "../cli.js";
import {
  KIOSK_ACTIVITY,
  KIOSK_ADMIN,
  KIOSK_PACKAGE,
  kioskApkUrl,
  packageVersion,
} from "../kiosk.js";

const schema = z.object({
  apkPath: z
    .string()
    .optional()
    .describe("Local APK to install instead of the release APK (e.g. a build from android/)"),
});

/** Explains the install error that a signature change causes, or returns the raw message. */
export function describeInstallError(message: string): string {
  if (message.includes("INSTALL_FAILED_UPDATE_INCOMPATIBLE")) {
    return (
      "The installed kiosk browser has a different signature. Uninstall it first: " +
      `adb shell dpm remove-active-admin ${KIOSK_ADMIN} && adb uninstall ${KIOSK_PACKAGE}`
    );
  }
  return message;
}

async function downloadApk(url: string): Promise<string> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Download of ${url} failed with HTTP ${response.status}`);
  }
  const localPath = join(tmpdir(), `dragon-touch-kiosk-${Date.now()}.apk`);
  await writeFile(localPath, Buffer.from(await response.arrayBuffer()));
  return localPath;
}

async function run(args: unknown, config: AdbConfig): Promise<unknown> {
  try {
    const { apkPath } = schema.parse(args);
    const connected = await ensureConnected(config);
    if (!connected) {
      return { success: false, error: `Cannot reach device at ${config.ip}:${config.port}` };
    }

    // An update ends the kiosk process. pidof exits non-zero when no process runs.
    const wasRunning = await adbExec(`shell pidof ${KIOSK_PACKAGE}`, config).then(
      () => true,
      () => false
    );

    const source = apkPath ?? kioskApkUrl(packageVersion());
    const localPath = apkPath ?? (await downloadApk(source));
    try {
      await installApk(localPath, config);
    } catch (err) {
      return {
        success: false,
        error: describeInstallError(err instanceof Error ? err.message : String(err)),
      };
    } finally {
      if (!apkPath) await unlink(localPath).catch(() => {});
    }

    // The foreground watchdog and the boot autostart need this app-op.
    await adbExec(`shell appops set ${KIOSK_PACKAGE} SYSTEM_ALERT_WINDOW allow`, config);
    // The screen schedule turns the screen off through the device admin.
    await adbExec(`shell dpm set-active-admin ${KIOSK_ADMIN}`, config);

    // Without extras, the kiosk activity opens the last URL from its preferences.
    if (wasRunning) {
      await adbExec(`shell am start -n ${KIOSK_ACTIVITY}`, config);
    }

    const version = await getPackageVersion(KIOSK_PACKAGE, config);
    return { success: true, version, source, restarted: wasRunning };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export const installKioskCliCommand: CliCommand = {
  name: "install_kiosk",
  description:
    "Install or update the kiosk browser APK that matches this server version on the Dragon Touch tablet",
  schema,
  run,
};
