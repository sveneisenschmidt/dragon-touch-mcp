// Copyright (c) 2025 Sven Eisenschmidt. Licensed under the MIT License.
import { z } from "zod";
import { AdbConfig, setSystemSetting } from "../adb.js";
import type { CliCommand } from "../cli.js";

const schema = z.object({
  brightness: z
    .number()
    .int()
    .min(0)
    .max(255)
    .describe("Screen brightness level (0–255)"),
});

async function run(args: unknown, config: AdbConfig): Promise<unknown> {
  try {
    const { brightness } = schema.parse(args);
    await setSystemSetting("system", "screen_brightness_mode", "0", config);
    await setSystemSetting("system", "screen_brightness", String(brightness), config);
    return { success: true, brightness };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export const setBrightnessCliCommand: CliCommand = {
  name: "set_brightness",
  description: "Set the Dragon Touch tablet screen brightness (0–255) and disable auto-brightness",
  schema,
  run,
};
