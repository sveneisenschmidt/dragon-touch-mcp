import { exec } from "node:child_process";
import { promisify } from "node:util";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readFile, unlink } from "node:fs/promises";

const execAsync = promisify(exec);

const ADB_TIMEOUT_MS = 10_000;

export const REMOTE_PATHS = {
  uiDump: "/sdcard/dragon_touch_ui.xml",
  screenshot: "/sdcard/dragon_touch_cap.png",
} as const;

export interface AdbConfig {
  ip: string;
  port: number;
}

export async function adbExec(
  args: string,
  config: AdbConfig
): Promise<{ stdout: string; stderr: string }> {
  const device = `${config.ip}:${config.port}`;
  return execAsync(`adb -s ${device} ${args}`, { timeout: ADB_TIMEOUT_MS });
}

export async function checkAdbAvailable(): Promise<string | null> {
  try {
    const { stdout } = await execAsync("adb version", { timeout: ADB_TIMEOUT_MS });
    return stdout.trim().split("\n")[0] ?? null;
  } catch {
    return null;
  }
}

export async function connectDevice(config: AdbConfig): Promise<boolean> {
  const device = `${config.ip}:${config.port}`;
  try {
    const { stdout } = await execAsync(`adb connect ${device}`, { timeout: ADB_TIMEOUT_MS });
    return stdout.includes("connected to ");
  } catch {
    return false;
  }
}

export async function getDeviceState(config: AdbConfig): Promise<string | null> {
  try {
    const { stdout } = await adbExec("get-state", config);
    return stdout.trim() || null;
  } catch {
    return null;
  }
}

export async function ensureConnected(config: AdbConfig): Promise<boolean> {
  const state = await getDeviceState(config);
  if (state === "device") return true;
  // connectDevice returns true only when adb reports "connected to " in its output
  return connectDevice(config);
}

export async function isPackageInstalled(
  packageName: string,
  config: AdbConfig
): Promise<boolean> {
  try {
    const { stdout } = await adbExec(`shell pm list packages ${packageName}`, config);
    return stdout.includes(`package:${packageName}`);
  } catch {
    return false;
  }
}

export async function wakeScreen(config: AdbConfig): Promise<void> {
  try {
    // Pipe on-device so only one line crosses ADB (~77ms vs streaming full dumpsys)
    const { stdout } = await adbExec(
      `shell "dumpsys power | grep -m1 mWakefulness="`,
      config
    );
    if (stdout.includes("mWakefulness=Awake")) return;
  } catch {
    // fall through and wake anyway
  }
  await adbExec("shell input keyevent 224", config);
}

export async function tap(x: number, y: number, config: AdbConfig): Promise<void> {
  await adbExec(`shell input tap ${x} ${y}`, config);
}

export async function dumpUiXml(config: AdbConfig): Promise<string> {
  await adbExec(`shell uiautomator dump ${REMOTE_PATHS.uiDump}`, config);
  const { stdout } = await adbExec(`shell cat ${REMOTE_PATHS.uiDump}`, config);
  await adbExec(`shell rm -f ${REMOTE_PATHS.uiDump}`, config).catch(() => {});
  return stdout;
}

export async function getOrientation(config: AdbConfig): Promise<number> {
  try {
    const { stdout } = await adbExec("shell settings get system user_rotation", config);
    return parseInt(stdout.trim(), 10) || 0;
  } catch {
    return 0;
  }
}

// PNG is binary — exec-out streams raw bytes directly without a temp file
export async function captureScreen(config: AdbConfig): Promise<string> {
  const localPath = join(tmpdir(), `dragon_touch_cap_${Date.now()}.png`);
  const device = `${config.ip}:${config.port}`;
  await execAsync(
    `adb -s ${device} exec-out screencap -p > ${localPath}`,
    { timeout: ADB_TIMEOUT_MS, shell: "/bin/sh" }
  );
  const data = await readFile(localPath);
  await unlink(localPath).catch(() => {});
  return data.toString("base64");
}

export async function getSystemSetting(
  namespace: "system" | "secure" | "global",
  key: string,
  config: AdbConfig
): Promise<string | null> {
  try {
    const { stdout } = await adbExec(`shell settings get ${namespace} ${key}`, config);
    const val = stdout.trim();
    return val === "null" || val === "" ? null : val;
  } catch {
    return null;
  }
}

export async function setSystemSetting(
  namespace: "system" | "secure" | "global",
  key: string,
  value: string,
  config: AdbConfig
): Promise<void> {
  await adbExec(`shell settings put ${namespace} ${key} ${value}`, config);
}

function parseSharedPrefsXml(xml: string): Record<string, string> {
  const result: Record<string, string> = {};
  for (const m of xml.matchAll(/<string name="([^"]+)">([^<]*)<\/string>/g)) {
    result[m[1]] = m[2];
  }
  for (const m of xml.matchAll(/<(?:int|long|float) name="([^"]+)" value="([^"]+)"/g)) {
    result[m[1]] = m[2];
  }
  for (const m of xml.matchAll(/<boolean name="([^"]+)" value="([^"]+)"/g)) {
    result[m[1]] = m[2];
  }
  return result;
}

export async function readSharedPrefs(
  packageName: string,
  config: AdbConfig
): Promise<Record<string, string>> {
  try {
    const prefsDir = `/data/data/${packageName}/shared_prefs`;
    const { stdout: lsOut } = await adbExec(
      `shell "run-as ${packageName} ls ${prefsDir}"`,
      config
    );
    const files = lsOut
      .trim()
      .split(/\s+/)
      .filter((f) => f.endsWith(".xml"));
    const merged: Record<string, string> = {};
    await Promise.all(
      files.map(async (file) => {
        try {
          const { stdout } = await adbExec(
            `shell "run-as ${packageName} cat ${prefsDir}/${file}"`,
            config
          );
          Object.assign(merged, parseSharedPrefsXml(stdout));
        } catch {
          // skip unreadable files
        }
      })
    );
    return merged;
  } catch {
    return {};
  }
}

export function findElementCenter(
  xml: string,
  resourceId: string
): { x: number; y: number } | null {
  const pattern = new RegExp(
    `resource-id="${resourceId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"[^>]*bounds="\\[(\\d+),(\\d+)\\]\\[(\\d+),(\\d+)\\]"`
  );
  const match = xml.match(pattern);
  if (!match) return null;

  return {
    x: Math.floor((parseInt(match[1], 10) + parseInt(match[3], 10)) / 2),
    y: Math.floor((parseInt(match[2], 10) + parseInt(match[4], 10)) / 2),
  };
}
