import {
  AdbConfig,
  checkAdbAvailable,
  connectDevice,
  dumpUiXml,
  ensureConnected,
  findElementCenter,
  getDeviceState,
  getOrientation,
  isPackageInstalled,
  tap,
  wakeScreen,
} from "./adb.js";
import { Trace, TraceResult } from "./trace.js";

export const TARGET_APP = "com.fujia.calendar";

export const TAB_RESOURCE_IDS = {
  calendar: `${TARGET_APP}:id/rb_calendar1`,
  tasks:    `${TARGET_APP}:id/rb_chores1`,
  day:      `${TARGET_APP}:id/rb_reward1`,
  meals:    `${TARGET_APP}:id/rb_meals1`,
  photos:   `${TARGET_APP}:id/rb_photos1`,
  lists:    `${TARGET_APP}:id/rb_lists1`,
  sleep:    `${TARGET_APP}:id/rb_steep1`,
  goal:     `${TARGET_APP}:id/rb_settings1`,
} as const;

export type TabName = keyof typeof TAB_RESOURCE_IDS;

// Tab center coordinates keyed by TabName.
// Invalidated when screen orientation changes.
const tabCache = new Map<TabName, { x: number; y: number }>();
let cachedOrientation: number | null = null;

export function clearTabCache(): void {
  tabCache.clear();
  cachedOrientation = null;
}

/** Call once at startup to pre-load orientation so the first switchTab is faster. */
export async function warmCache(config: AdbConfig): Promise<void> {
  cachedOrientation = await getOrientation(config);
}

export interface CheckResult {
  adb: { ok: boolean; detail: string };
  deviceIp: { ok: boolean; detail: string };
  deviceReachable: { ok: boolean; detail: string };
  appInstalled: { ok: boolean; detail: string };
  ready: boolean;
}

export async function runCheckup(config: AdbConfig): Promise<CheckResult> {
  const result: CheckResult = {
    adb: { ok: false, detail: "" },
    deviceIp: { ok: false, detail: "" },
    deviceReachable: { ok: false, detail: "" },
    appInstalled: { ok: false, detail: "" },
    ready: false,
  };

  // 1. adb binary
  const adbVersion = await checkAdbAvailable();
  if (adbVersion) {
    result.adb = { ok: true, detail: adbVersion };
  } else {
    result.adb = {
      ok: false,
      detail: "not found in PATH — run: brew install android-platform-tools",
    };
    return result;
  }

  // 2. IP configured
  result.deviceIp = {
    ok: true,
    detail: `${config.ip}:${config.port}`,
  };

  // 3. Device reachable
  await connectDevice(config);
  const state = await getDeviceState(config);
  if (state === "device") {
    result.deviceReachable = { ok: true, detail: `online (state: ${state})` };
  } else {
    result.deviceReachable = {
      ok: false,
      detail: `cannot reach ${config.ip}:${config.port} (state: ${state ?? "timeout"})`,
    };
    return result;
  }

  // 4. App installed
  const installed = await isPackageInstalled(TARGET_APP, config);
  if (installed) {
    result.appInstalled = { ok: true, detail: `${TARGET_APP} found` };
  } else {
    result.appInstalled = {
      ok: false,
      detail: `${TARGET_APP} not found on device`,
    };
    return result;
  }

  result.ready = true;
  return result;
}

export function formatCheckup(result: CheckResult): string {
  const tick = (ok: boolean) => (ok ? "✓" : "✗");
  const pad = (s: string) => s.padEnd(17);

  const lines = [
    "Dragon Touch MCP — Startup Check",
    `  ${pad("adb binary:")}     ${tick(result.adb.ok)} ${result.adb.detail}`,
    `  ${pad("device IP:")}      ${tick(result.deviceIp.ok)} ${result.deviceIp.detail}`,
    `  ${pad("device reachable:")}${tick(result.deviceReachable.ok)} ${result.deviceReachable.detail}`,
    `  ${pad("app installed:")}  ${tick(result.appInstalled.ok)} ${result.appInstalled.detail}`,
    "  " + "─".repeat(50),
    `  Status: ${result.ready ? "READY" : "NOT READY — fix the errors above before using tools"}`,
  ];

  return lines.join("\n");
}

type FetchXmlResult =
  | { success: true; xml: string }
  | { success: false; error: string };

/** Caller is responsible for ensuring the device is connected before calling. */
async function fetchUiXml(config: AdbConfig): Promise<FetchXmlResult> {
  try {
    const xml = await dumpUiXml(config);
    return { success: true, xml };
  } catch (err) {
    return {
      success: false,
      error: `Failed to dump UI: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

export type ActiveTabResult =
  | { success: true; tab: TabName }
  | { success: false; error: string };

export async function getActiveTab(config: AdbConfig): Promise<ActiveTabResult> {
  const connected = await ensureConnected(config);
  if (!connected) {
    return {
      success: false,
      error: `Cannot reach device at ${config.ip}:${config.port}. Is the tablet on the same network?`,
    };
  }

  const result = await fetchUiXml(config);
  if (!result.success) return result;

  for (const [tab, resourceId] of Object.entries(TAB_RESOURCE_IDS) as [TabName, string][]) {
    const escaped = resourceId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const pattern = new RegExp(`resource-id="${escaped}"[^>]*checked="true"`);
    if (pattern.test(result.xml)) {
      return { success: true, tab };
    }
  }

  return { success: false, error: "No active tab found. Is the app in the foreground?" };
}

export type TabSwitchResult =
  | { success: true; trace: TraceResult }
  | { success: false; error: string; trace: TraceResult };

export async function switchTab(
  tab: TabName,
  config: AdbConfig
): Promise<TabSwitchResult> {
  const trace = new Trace();

  const connected = await ensureConnected(config);
  trace.mark("ensure_connected");
  if (!connected) {
    return {
      success: false,
      error: `Cannot reach device at ${config.ip}:${config.port}. Is the tablet on the same network?`,
      trace: trace.toJSON(),
    };
  }

  await wakeScreen(config);
  trace.mark("wake_screen");

  const orientation = await getOrientation(config);
  trace.mark("get_orientation");
  if (orientation !== cachedOrientation) {
    tabCache.clear();
    cachedOrientation = orientation;
  }

  let center = tabCache.get(tab);

  if (!center) {
    const fetched = await fetchUiXml(config);
    trace.mark("ui_dump");
    if (!fetched.success) {
      return { success: false, error: fetched.error, trace: trace.toJSON() };
    }
    const xml = fetched.xml;

    const resourceId = TAB_RESOURCE_IDS[tab];
    const found = findElementCenter(xml, resourceId);

    if (!found) {
      return {
        success: false,
        error: `Tab element not found (${resourceId}). Is ${TARGET_APP} in the foreground?`,
        trace: trace.toJSON(),
      };
    }

    for (const [name, id] of Object.entries(TAB_RESOURCE_IDS) as [TabName, string][]) {
      const c = findElementCenter(xml, id);
      if (c) tabCache.set(name, c);
    }

    center = found;
    trace.mark("cache_miss_parse");
  } else {
    trace.mark("cache_hit");
  }

  await tap(center.x, center.y, config);
  trace.mark("tap");

  return { success: true, trace: trace.toJSON() };
}
