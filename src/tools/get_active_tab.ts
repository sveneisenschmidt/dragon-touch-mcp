// Copyright (c) 2025 Sven Eisenschmidt. Licensed under the MIT License.
import { z } from "zod";
import { AdbConfig } from "../adb.js";
import { getActiveTab } from "../tablet.js";
import type { CliCommand } from "../cli.js";

export const getActiveTabCliCommand: CliCommand = {
  name: "get_active_tab",
  description: "Return the currently active tab/view on the Dragon Touch tablet",
  schema: z.object({}),
  run: async (_args: unknown, config: AdbConfig) => {
    try {
      return await getActiveTab(config);
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  },
};
