// Copyright (c) 2025 Sven Eisenschmidt. Licensed under the MIT License.
import { z } from "zod";
import { writeFile } from "node:fs/promises";
import { AdbConfig, captureScreen, ensureConnected } from "../adb.js";
import { Trace } from "../trace.js";
import type { CliCommand } from "../cli.js";

const captureSchema = z.object({
  output: z.string().optional().describe("File path to save the PNG (default: ./dragon-touch-capture.png)"),
});

export const captureScreenCliCommand: CliCommand = {
  name: "capture_screen",
  description: "Take a screenshot and save to a local PNG file",
  schema: captureSchema,
  run: async (args: unknown, config: AdbConfig) => {
    try {
      const { output = "./dragon-touch-capture.png" } = args as z.infer<typeof captureSchema>;
      const trace = new Trace();
      const connected = await ensureConnected(config);
      trace.mark("ensure_connected");
      if (!connected) {
        return { success: false, error: `Cannot reach device at ${config.ip}:${config.port}`, trace: trace.toJSON() };
      }
      const base64 = await captureScreen(config);
      trace.mark("capture");
      await writeFile(output, Buffer.from(base64, "base64"));
      trace.mark("write_file");
      return { success: true, path: output, trace: trace.toJSON() };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  },
};
