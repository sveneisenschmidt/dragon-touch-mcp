// Copyright (c) 2025 Sven Eisenschmidt. Licensed under the MIT License.
import { z } from "zod";
import { AdbConfig, adbExec, ensureConnected, isPackageInstalled } from "../adb.js";
import type { CliCommand } from "../cli.js";

const KIOSK_PACKAGE = "com.dragontouch.kioskbrowser";
const KIOSK_ACTIVITY = `${KIOSK_PACKAGE}/.MainActivity`;

const schema = z.object({
  url: z.string().url().describe("URL to display in fullscreen kiosk browser"),
});

async function run(args: unknown, config: AdbConfig): Promise<unknown> {
  try {
    const { url } = schema.parse(args);
    if (url.includes("'")) {
      return { success: false, error: "URL must not contain single quotes" };
    }
    const connected = await ensureConnected(config);
    if (!connected) {
      return { success: false, error: `Cannot reach device at ${config.ip}:${config.port}` };
    }
    const installed = await isPackageInstalled(KIOSK_PACKAGE, config);
    if (!installed) {
      return { success: false, error: `Kiosk browser not installed. Run: make kiosk-install` };
    }
    await adbExec(`shell am force-stop ${KIOSK_PACKAGE}`, config);
    await adbExec(`shell am start -n ${KIOSK_ACTIVITY} --es url '${url}'`, config);
    return { success: true, url };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export const openUrlCliCommand: CliCommand = {
  name: "open_url",
  description: "Open a URL in fullscreen kiosk browser on the Dragon Touch tablet",
  schema,
  run,
};
