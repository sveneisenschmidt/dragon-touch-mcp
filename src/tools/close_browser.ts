// Copyright (c) 2025 Sven Eisenschmidt. Licensed under the MIT License.
import { z } from "zod";
import { AdbConfig, adbExec, ensureConnected } from "../adb.js";
import type { CliCommand } from "../cli.js";

const KIOSK_PACKAGE = "com.dragontouch.kioskbrowser";

const schema = z.object({});

async function run(args: unknown, config: AdbConfig): Promise<unknown> {
  try {
    const connected = await ensureConnected(config);
    if (!connected) {
      return { success: false, error: `Cannot reach device at ${config.ip}:${config.port}` };
    }
    await adbExec(`shell am force-stop ${KIOSK_PACKAGE}`, config);
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export const closeBrowserCliCommand: CliCommand = {
  name: "close_browser",
  description: "Close the fullscreen kiosk browser on the Dragon Touch tablet",
  schema,
  run,
};
