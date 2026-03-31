// Copyright (c) 2025 Sven Eisenschmidt. Licensed under the MIT License.
import { z } from "zod";
import { AdbConfig, setSystemSetting } from "../adb.js";
import type { CliCommand } from "../cli.js";

const schema = z.object({
  volume: z
    .number()
    .int()
    .min(0)
    .max(15)
    .describe("Media volume level (0–15)"),
});

async function run(args: unknown, config: AdbConfig): Promise<unknown> {
  try {
    const { volume } = schema.parse(args);
    await setSystemSetting("system", "volume_music_speaker", String(volume), config);
    return { success: true, volume };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export const setVolumeCliCommand: CliCommand = {
  name: "set_volume",
  description: "Set the Dragon Touch tablet media volume (0–15)",
  schema,
  run,
};
