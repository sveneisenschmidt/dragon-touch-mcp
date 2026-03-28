import { z } from "zod";
import { AdbConfig, readSharedPrefs } from "../adb.js";
import type { CliCommand } from "../cli.js";

const APP_PACKAGE = "com.fujia.calendar";

// Keys that may contain sensitive data are blocked regardless of their value.
const SENSITIVE_KEY_PATTERNS = [
  /jwt/i,
  /token/i,
  /cert/i,
  /secret/i,
  /password/i,
  /credential/i,
  /private/i,
  /sign/i,
];

function isSensitive(key: string): boolean {
  return SENSITIVE_KEY_PATTERNS.some((p) => p.test(key));
}

async function run(_args: unknown, config: AdbConfig): Promise<unknown> {
  const raw = await readSharedPrefs(APP_PACKAGE, config);

  const settings: Record<string, string> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (!isSensitive(key)) {
      settings[key] = value;
    }
  }

  return { success: true, settings };
}

export const getAppSettingsCliCommand: CliCommand = {
  name: "get_app_settings",
  description:
    "Read Dragon Touch app configuration from SharedPreferences (language, weather, sleep schedule, UI settings). Sensitive fields are filtered out.",
  schema: z.object({}),
  run,
};
