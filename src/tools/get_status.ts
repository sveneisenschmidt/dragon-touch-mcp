// Copyright (c) 2025 Sven Eisenschmidt. Licensed under the MIT License.
import { z } from "zod";
import { AdbConfig } from "../adb.js";
import { runCheckup } from "../tablet.js";
import type { CliCommand } from "../cli.js";

export const getStatusCliCommand: CliCommand = {
  name: "get_status",
  description: "Check adb, device connectivity, and app installation",
  schema: z.object({}),
  run: async (_args: unknown, config: AdbConfig) => {
    try {
      return await runCheckup(config);
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  },
};
