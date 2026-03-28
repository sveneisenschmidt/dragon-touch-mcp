import { z } from "zod";
import { AdbConfig } from "../adb.js";
import { runCheckup } from "../tablet.js";
import type { CliCommand } from "../cli.js";

export const getStatusCliCommand: CliCommand = {
  name: "get_status",
  description: "Check adb, device connectivity, and app installation",
  schema: z.object({}),
  run: async (_args: unknown, config: AdbConfig) => runCheckup(config),
};
