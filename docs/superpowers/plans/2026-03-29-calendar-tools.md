# Calendar Tools Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add 4 new `calendar_*` MCP tools (get_schedule, set_view, navigate, set_filter) and harden all existing tools with consistent graceful error handling.

**Architecture:** Shared pure parsing logic lives in `calendar_helpers.ts` (testable without ADB). Each tool file contains one `run` function that calls ADB, delegates to helpers, and returns a consistent `{ success, state?, warning?, error? }` response. All existing tool `run` functions get a top-level try/catch.

**Tech Stack:** TypeScript, Node.js, ADB (`uiautomator dump`, `input tap`, `input keyevent`), Vitest, Zod

**Spec:** `docs/superpowers/specs/2026-03-29-calendar-tools-design.md`

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `src/tools/calendar_helpers.ts` | Create | Pure XML parsing: `parseNodes`, `findNode`, `detectView`, `extractState`, `isCalendarDirty`, `parseCalendarEvents`, `tapByResourceId` |
| `src/test/calendar_helpers.test.ts` | Create | Tests for all pure functions in calendar_helpers |
| `src/tools/calendar_get_schedule.ts` | Create | Read all visible events from current calendar view |
| `src/tools/calendar_set_view.ts` | Create | Switch between day/week/month/schedule views |
| `src/tools/calendar_navigate.ts` | Create | Navigate prev/next by one or more steps |
| `src/tools/calendar_set_filter.ts` | Create | Show/hide family member profiles in filter panel |
| `src/test/calendar_tools.test.ts` | Create | Schema validation + pure logic tests for all 4 tools |
| `src/tools/set_brightness.ts` | Modify | Wrap `run` in try/catch |
| `src/tools/set_volume.ts` | Modify | Wrap `run` in try/catch |
| `src/tools/get_app_settings.ts` | Modify | Wrap `run` in try/catch |
| `src/tools/get_device_info.ts` | Modify | Wrap `run` in try/catch |
| `src/tools/capture_screen.ts` | Modify | Wrap `run` in try/catch |
| `src/tools/get_status.ts` | Modify | Wrap `run` in try/catch |
| `src/tools/get_active_tab.ts` | Modify | Wrap `run` in try/catch |
| `src/index.ts` | Modify | Import and register 4 new CLI commands |

---

## Task 1: Feature Branch

- [ ] **Create branch**

```bash
git checkout -b feature/calendar-tools
```

Expected: `Switched to a new branch 'feature/calendar-tools'`

---

## Task 2: Graceful Error Handling for Existing Tools

Wrap every `run` function in a top-level try/catch. Tests must still pass.

**Files:** `set_brightness.ts`, `set_volume.ts`, `get_app_settings.ts`, `get_device_info.ts`, `capture_screen.ts`, `get_status.ts`, `get_active_tab.ts`

- [ ] **Update `src/tools/set_brightness.ts`**

```typescript
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
```

- [ ] **Update `src/tools/set_volume.ts`**

```typescript
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
```

- [ ] **Update `src/tools/get_app_settings.ts`**

```typescript
import { z } from "zod";
import { AdbConfig, readSharedPrefs } from "../adb.js";
import type { CliCommand } from "../cli.js";

const APP_PACKAGE = "com.fujia.calendar";

const SENSITIVE_KEY_PATTERNS = [
  /jwt/i, /token/i, /cert/i, /secret/i,
  /password/i, /credential/i, /private/i, /sign/i,
];

export function isSensitive(key: string): boolean {
  return SENSITIVE_KEY_PATTERNS.some((p) => p.test(key));
}

async function run(_args: unknown, config: AdbConfig): Promise<unknown> {
  try {
    const raw = await readSharedPrefs(APP_PACKAGE, config);
    const settings: Record<string, string> = {};
    for (const [key, value] of Object.entries(raw)) {
      if (!isSensitive(key)) settings[key] = value;
    }
    return { success: true, settings };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export const getAppSettingsCliCommand: CliCommand = {
  name: "get_app_settings",
  description:
    "Read Dragon Touch app configuration from SharedPreferences (language, weather, sleep schedule, UI settings). Sensitive fields are filtered out.",
  schema: z.object({}),
  run,
};
```

- [ ] **Update `src/tools/get_device_info.ts`** — wrap the `run` function body in try/catch (leave `parseDeviceInfo` and `RawDeviceData` export unchanged):

```typescript
async function run(_args: unknown, config: AdbConfig): Promise<unknown> {
  try {
    const [
      brightness, brightnessMode, rotation, wakefulnessOut,
      volumeMusic, volumeRing, batteryOut, modelOut,
    ] = await Promise.all([
      getSystemSetting("system", "screen_brightness", config),
      getSystemSetting("system", "screen_brightness_mode", config),
      getSystemSetting("system", "user_rotation", config),
      adbExec(`shell "dumpsys power | grep -m1 mWakefulness="`, config)
        .then((r) => r.stdout.trim())
        .catch(() => ""),
      getSystemSetting("system", "volume_music_speaker", config).then(
        (v) => v ?? getSystemSetting("system", "volume_music", config)
      ),
      getSystemSetting("system", "volume_ring_speaker", config).then(
        (v) => v ?? getSystemSetting("system", "volume_ring", config)
      ),
      adbExec("shell dumpsys battery", config)
        .then((r) => r.stdout)
        .catch(() => ""),
      adbExec("shell getprop ro.product.model", config)
        .then((r) => r.stdout.trim())
        .catch(() => ""),
    ]);
    return parseDeviceInfo({ brightness, brightnessMode, rotation, wakefulnessOut, volumeMusic, volumeRing, batteryOut, modelOut });
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}
```

- [ ] **Update `src/tools/capture_screen.ts`** — wrap existing body in try/catch:

```typescript
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
```

- [ ] **Update `src/tools/get_status.ts`**

```typescript
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
```

- [ ] **Update `src/tools/get_active_tab.ts`**

```typescript
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
```

- [ ] **Run tests — verify nothing broke**

```bash
npm test
```

Expected: all existing tests pass, no new failures.

- [ ] **Commit**

```bash
git add src/tools/set_brightness.ts src/tools/set_volume.ts src/tools/get_app_settings.ts src/tools/get_device_info.ts src/tools/capture_screen.ts src/tools/get_status.ts src/tools/get_active_tab.ts
git commit -m "refactor: add graceful error handling to all existing tools"
```

---

## Task 3: `calendar_helpers.ts` — Pure Functions + Tests

All functions here are pure (no ADB calls) and fully testable.

- [ ] **Create `src/tools/calendar_helpers.ts`**

```typescript
import { AdbConfig, tap } from "../adb.js";
import type { TabName } from "../tablet.js";

// ─── Types ────────────────────────────────────────────────────────────────────

export type CalendarView = "day" | "week" | "month" | "schedule" | "unknown";

export interface CalendarState {
  tab: TabName | null;
  view: CalendarView;
}

export interface UiNode {
  resourceId: string;   // full: "com.fujia.calendar:id/fl_type"
  shortId: string;      // short: "fl_type"
  text: string;
  contentDesc: string;
  className: string;
  checked: boolean;
  clickable: boolean;
  checkable: boolean;
  bounds: { x1: number; y1: number; x2: number; y2: number };
  center: { x: number; y: number };
}

export interface CalendarEvent {
  title: string;
  time?: string;
  date?: string;
  emoji?: string;
  checked?: boolean;
}

// ─── XML Parsing ─────────────────────────────────────────────────────────────

export function parseNodes(xml: string): UiNode[] {
  const nodes: UiNode[] = [];
  const chunks = xml.split("<node ").slice(1);
  for (const chunk of chunks) {
    const end = chunk.indexOf(">");
    if (end === -1) continue;
    const attr = chunk.substring(0, end).replace(/\/$/, "");
    const get = (k: string): string =>
      (attr.match(new RegExp(k + '="([^"]*)"')) ?? [])[1] ?? "";
    const b = attr.match(/bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/);
    if (!b) continue;
    const x1 = +b[1], y1 = +b[2], x2 = +b[3], y2 = +b[4];
    const resourceId = get("resource-id");
    nodes.push({
      resourceId,
      shortId: resourceId.replace(/^[^/]+\//, ""),
      text: get("text"),
      contentDesc: get("content-desc"),
      className: get("class"),
      checked: get("checked") === "true",
      clickable: get("clickable") === "true",
      checkable: get("checkable") === "true",
      bounds: { x1, y1, x2, y2 },
      center: { x: Math.floor((x1 + x2) / 2), y: Math.floor((y1 + y2) / 2) },
    });
  }
  return nodes;
}

export function findNode(nodes: UiNode[], shortId: string): UiNode | null {
  return nodes.find((n) => n.shortId === shortId) ?? null;
}

export function findNodes(nodes: UiNode[], shortId: string): UiNode[] {
  return nodes.filter((n) => n.shortId === shortId);
}

// ─── State Detection ─────────────────────────────────────────────────────────

const TAB_MAP: Record<string, TabName> = {
  rb_calendar1: "calendar",
  rb_chores1: "tasks",
  rb_reward1: "day",
  rb_meals1: "meals",
  rb_photos1: "photos",
  rb_lists1: "lists",
  rb_steep1: "sleep",
  rb_settings1: "goal",
};

export function detectView(nodes: UiNode[]): CalendarView {
  if (nodes.some((n) => n.shortId === "rl_month_view")) return "month";
  if (nodes.some((n) => n.shortId === "rv_chores")) return "week";
  if (nodes.some((n) => n.shortId === "item_schedule_view")) return "schedule";
  if (nodes.some((n) => n.shortId === "lv_left")) return "day";
  return "unknown";
}

export function extractState(nodes: UiNode[]): CalendarState {
  const checkedTab = nodes.find(
    (n) => n.shortId in TAB_MAP && n.checked && n.checkable
  );
  return {
    tab: checkedTab ? (TAB_MAP[checkedTab.shortId] ?? null) : null,
    view: detectView(nodes),
  };
}

/** Returns true when neither a day-view nor week/month/schedule-view marker is found.
 *  Indicates a dialog is open or the app is in an unexpected state. */
export function isCalendarDirty(nodes: UiNode[]): boolean {
  return (
    !nodes.some((n) => n.shortId === "fl_type") &&
    !nodes.some((n) => n.shortId === "lv_left")
  );
}

// ─── Event Parsing ────────────────────────────────────────────────────────────

export function parseDayEvents(nodes: UiNode[]): CalendarEvent[] {
  const events: CalendarEvent[] = [];
  const emojiNodes = findNodes(nodes, "iv_emoji");
  const titleNodes = findNodes(nodes, "tv_event_name");
  // Events appear in parallel arrays; deduplicate by title (calendar shows some events twice)
  const seen = new Set<string>();
  const count = Math.min(emojiNodes.length, titleNodes.length);
  for (let i = 0; i < count; i++) {
    const title = titleNodes[i].text;
    if (!title || seen.has(title)) continue;
    seen.add(title);
    events.push({
      title,
      emoji: emojiNodes[i].text || undefined,
      checked: emojiNodes[i].checked,
    });
  }
  return events;
}

export function parseWeekEvents(nodes: UiNode[]): CalendarEvent[] {
  const events: CalendarEvent[] = [];
  let currentDate = "";
  let inGrid = false;
  let pendingTitle: string | null = null;

  for (const node of nodes) {
    // tv_day marks entry into a calendar day cell; skip profile tv_title nodes above first tv_day
    if (node.shortId === "tv_day") {
      if (pendingTitle !== null) {
        events.push({ title: pendingTitle, date: currentDate });
        pendingTitle = null;
      }
      inGrid = true;
      currentDate = node.text;
    }
    if (!inGrid) continue;
    if (node.shortId === "tv_title" && node.text) {
      if (pendingTitle !== null) {
        events.push({ title: pendingTitle, date: currentDate });
      }
      pendingTitle = node.text;
    }
    if (node.shortId === "tv_time" && pendingTitle !== null) {
      events.push({ title: pendingTitle, date: currentDate, time: node.text });
      pendingTitle = null;
    }
  }
  if (pendingTitle !== null) {
    events.push({ title: pendingTitle, date: currentDate });
  }
  return events;
}

export function parseMonthEvents(nodes: UiNode[]): CalendarEvent[] {
  const events: CalendarEvent[] = [];
  let currentDate = "";
  let pendingTitle: string | null = null;

  for (const node of nodes) {
    if (node.shortId === "tv_day") {
      if (pendingTitle !== null) {
        events.push({ title: pendingTitle, date: currentDate });
        pendingTitle = null;
      }
      currentDate = node.text;
    }
    if (node.shortId === "tv_title" && node.text) {
      if (pendingTitle !== null) {
        events.push({ title: pendingTitle, date: currentDate });
      }
      pendingTitle = node.text;
    }
    if (node.shortId === "tv_time" && pendingTitle !== null) {
      events.push({ title: pendingTitle, date: currentDate, time: node.text });
      pendingTitle = null;
    }
  }
  if (pendingTitle !== null) {
    events.push({ title: pendingTitle, date: currentDate });
  }
  return events;
}

export function parseCalendarEvents(nodes: UiNode[], view: CalendarView): CalendarEvent[] {
  if (view === "day") return parseDayEvents(nodes);
  if (view === "week") return parseWeekEvents(nodes);
  if (view === "month") return parseMonthEvents(nodes);
  return []; // schedule view: raw item_schedule_view nodes, not parsed further
}

// ─── ADB Helpers (depend on config) ──────────────────────────────────────────

export async function tapByResourceId(
  shortId: string,
  nodes: UiNode[],
  config: AdbConfig
): Promise<void> {
  const node = findNode(nodes, shortId);
  if (!node) throw new Error(`UI element not found: ${shortId}`);
  await tap(node.center.x, node.center.y, config);
}
```

- [ ] **Create `src/test/calendar_helpers.test.ts`**

```typescript
import { describe, it, expect } from "vitest";
import {
  parseNodes,
  findNode,
  findNodes,
  detectView,
  extractState,
  isCalendarDirty,
  parseDayEvents,
  parseWeekEvents,
  parseMonthEvents,
  parseCalendarEvents,
} from "../tools/calendar_helpers.js";

// ─── Fixtures ────────────────────────────────────────────────────────────────

const EMPTY_XML = `<?xml version='1.0' encoding='UTF-8'?><hierarchy rotation="0"></hierarchy>`;

const DAY_VIEW_XML = `<?xml version='1.0' encoding='UTF-8'?><hierarchy rotation="0">
  <node resource-id="com.fujia.calendar:id/lv_left" class="android.widget.ImageView" clickable="true" checkable="false" checked="false" bounds="[0,100][54,165]" />
  <node resource-id="com.fujia.calendar:id/tv_week" class="android.widget.Button" text="Freitag, März 27" clickable="true" checkable="false" checked="false" bounds="[54,100][540,165]" />
  <node resource-id="com.fujia.calendar:id/iv_right" class="android.widget.ImageView" clickable="true" checkable="false" checked="false" bounds="[540,100][594,165]" />
  <node resource-id="com.fujia.calendar:id/iv_emoji" class="android.widget.CheckedTextView" text="📺" clickable="false" checkable="true" checked="false" bounds="[0,200][60,260]" />
  <node resource-id="com.fujia.calendar:id/tv_event_name" class="android.widget.TextView" text="TV (17:30-18:30)" clickable="true" checkable="false" checked="false" bounds="[60,200][1080,260]" />
  <node resource-id="com.fujia.calendar:id/touch_check_event" class="android.view.View" clickable="true" checkable="false" checked="false" bounds="[1020,200][1080,260]" />
  <node resource-id="com.fujia.calendar:id/iv_emoji" class="android.widget.CheckedTextView" text="🛏️" clickable="false" checkable="true" checked="true" bounds="[0,270][60,330]" />
  <node resource-id="com.fujia.calendar:id/tv_event_name" class="android.widget.TextView" text="Schlafen (19:00)" clickable="true" checkable="false" checked="false" bounds="[60,270][1080,330]" />
  <node resource-id="com.fujia.calendar:id/touch_check_event" class="android.view.View" clickable="true" checkable="false" checked="false" bounds="[1020,270][1080,330]" />
  <node resource-id="com.fujia.calendar:id/rb_calendar1" class="android.widget.RadioButton" text="Kalender" clickable="true" checkable="true" checked="true" bounds="[0,1805][135,1920]" />
  <node resource-id="com.fujia.calendar:id/rb_chores1" class="android.widget.RadioButton" text="Aufgaben" clickable="true" checkable="true" checked="false" bounds="[135,1805][270,1920]" />
</hierarchy>`;

const WEEK_VIEW_XML = `<?xml version='1.0' encoding='UTF-8'?><hierarchy rotation="0">
  <node resource-id="com.fujia.calendar:id/fl_type" class="android.widget.FrameLayout" clickable="true" checkable="false" checked="false" bounds="[0,100][186,187]" />
  <node resource-id="com.fujia.calendar:id/rv_chores" class="androidx.recyclerview.widget.RecyclerView" clickable="false" checkable="false" checked="false" bounds="[0,187][1080,400]" />
  <node resource-id="com.fujia.calendar:id/tv_day" class="android.widget.TextView" text="23" clickable="false" checkable="false" checked="false" bounds="[0,400][155,460]" />
  <node resource-id="com.fujia.calendar:id/tv_title" class="android.widget.TextView" text="Geburtstag Tabitha" clickable="false" checkable="false" checked="false" bounds="[0,460][540,510]" />
  <node resource-id="com.fujia.calendar:id/tv_time" class="android.widget.TextView" text="Ganztägig" clickable="false" checkable="false" checked="false" bounds="[0,510][540,550]" />
  <node resource-id="com.fujia.calendar:id/tv_title" class="android.widget.TextView" text="Sport Tilian" clickable="false" checkable="false" checked="false" bounds="[0,550][540,600]" />
  <node resource-id="com.fujia.calendar:id/tv_time" class="android.widget.TextView" text="18:00-19:00" clickable="false" checkable="false" checked="false" bounds="[0,600][540,640]" />
  <node resource-id="com.fujia.calendar:id/tv_day" class="android.widget.TextView" text="24" clickable="false" checkable="false" checked="false" bounds="[155,400][310,460]" />
  <node resource-id="com.fujia.calendar:id/tv_title" class="android.widget.TextView" text="HNO Arzt Kellin" clickable="false" checkable="false" checked="false" bounds="[155,460][540,510]" />
  <node resource-id="com.fujia.calendar:id/tv_time" class="android.widget.TextView" text="14:30-15:30" clickable="false" checkable="false" checked="false" bounds="[155,510][540,550]" />
  <node resource-id="com.fujia.calendar:id/rb_calendar1" class="android.widget.RadioButton" checkable="true" checked="true" bounds="[0,1805][135,1920]" />
</hierarchy>`;

const MONTH_VIEW_XML = `<?xml version='1.0' encoding='UTF-8'?><hierarchy rotation="0">
  <node resource-id="com.fujia.calendar:id/fl_type" class="android.widget.FrameLayout" clickable="true" checkable="false" checked="false" bounds="[0,100][186,187]" />
  <node resource-id="com.fujia.calendar:id/rl_month_view" class="android.widget.RelativeLayout" clickable="true" checkable="false" checked="false" bounds="[0,187][1080,1800]" />
  <node resource-id="com.fujia.calendar:id/tv_day" class="android.widget.TextView" text="März 1" clickable="false" checkable="false" checked="false" bounds="[0,200][155,240]" />
  <node resource-id="com.fujia.calendar:id/tv_title" class="android.widget.TextView" text="Geburtstag Julia" clickable="false" checkable="false" checked="false" bounds="[0,240][540,280]" />
  <node resource-id="com.fujia.calendar:id/tv_time" class="android.widget.TextView" text="Ganztägig" clickable="false" checkable="false" checked="false" bounds="[0,280][540,320]" />
  <node resource-id="com.fujia.calendar:id/tv_day" class="android.widget.TextView" text="2" clickable="false" checkable="false" checked="false" bounds="[155,200][310,240]" />
  <node resource-id="com.fujia.calendar:id/tv_title" class="android.widget.TextView" text="Sport Tilian" clickable="false" checkable="false" checked="false" bounds="[155,240][540,280]" />
  <node resource-id="com.fujia.calendar:id/rb_calendar1" class="android.widget.RadioButton" checkable="true" checked="true" bounds="[0,1805][135,1920]" />
</hierarchy>`;

const DIRTY_XML = `<?xml version='1.0' encoding='UTF-8'?><hierarchy rotation="0">
  <node resource-id="android:id/content" class="android.widget.FrameLayout" clickable="false" checkable="false" checked="false" bounds="[0,0][1080,1920]" />
</hierarchy>`;

// ─── parseNodes ───────────────────────────────────────────────────────────────

describe("parseNodes", () => {
  it("returns empty array for empty XML", () => {
    expect(parseNodes(EMPTY_XML)).toEqual([]);
  });

  it("parses resourceId and shortId", () => {
    const nodes = parseNodes(DAY_VIEW_XML);
    const node = nodes.find((n) => n.shortId === "lv_left");
    expect(node).toBeDefined();
    expect(node!.resourceId).toBe("com.fujia.calendar:id/lv_left");
  });

  it("parses text and checked attributes", () => {
    const nodes = parseNodes(DAY_VIEW_XML);
    const emoji = nodes.find((n) => n.shortId === "iv_emoji" && n.text === "🛏️");
    expect(emoji?.checked).toBe(true);
    const emoji2 = nodes.find((n) => n.shortId === "iv_emoji" && n.text === "📺");
    expect(emoji2?.checked).toBe(false);
  });

  it("computes center from bounds", () => {
    const nodes = parseNodes(DAY_VIEW_XML);
    const btn = nodes.find((n) => n.shortId === "rb_calendar1");
    expect(btn?.center).toEqual({ x: 67, y: 1862 });
  });

  it("handles nodes with no resource-id", () => {
    const xml = `<hierarchy><node resource-id="" text="hello" bounds="[0,0][100,100]" /></hierarchy>`;
    const nodes = parseNodes(xml);
    expect(nodes[0].shortId).toBe("");
  });
});

// ─── findNode / findNodes ─────────────────────────────────────────────────────

describe("findNode", () => {
  it("returns first matching node", () => {
    const nodes = parseNodes(DAY_VIEW_XML);
    expect(findNode(nodes, "lv_left")).not.toBeNull();
  });

  it("returns null when not found", () => {
    const nodes = parseNodes(DAY_VIEW_XML);
    expect(findNode(nodes, "nonexistent")).toBeNull();
  });
});

describe("findNodes", () => {
  it("returns all matching nodes", () => {
    const nodes = parseNodes(DAY_VIEW_XML);
    expect(findNodes(nodes, "iv_emoji")).toHaveLength(2);
  });

  it("returns empty array when none found", () => {
    const nodes = parseNodes(DAY_VIEW_XML);
    expect(findNodes(nodes, "nonexistent")).toHaveLength(0);
  });
});

// ─── detectView ──────────────────────────────────────────────────────────────

describe("detectView", () => {
  it("detects day view by lv_left", () => {
    expect(detectView(parseNodes(DAY_VIEW_XML))).toBe("day");
  });

  it("detects week view by rv_chores", () => {
    expect(detectView(parseNodes(WEEK_VIEW_XML))).toBe("week");
  });

  it("detects month view by rl_month_view", () => {
    expect(detectView(parseNodes(MONTH_VIEW_XML))).toBe("month");
  });

  it("returns unknown for unrecognised layout", () => {
    expect(detectView(parseNodes(DIRTY_XML))).toBe("unknown");
  });
});

// ─── extractState ─────────────────────────────────────────────────────────────

describe("extractState", () => {
  it("extracts calendar tab and day view", () => {
    const state = extractState(parseNodes(DAY_VIEW_XML));
    expect(state).toEqual({ tab: "calendar", view: "day" });
  });

  it("extracts calendar tab and week view", () => {
    const state = extractState(parseNodes(WEEK_VIEW_XML));
    expect(state).toEqual({ tab: "calendar", view: "week" });
  });

  it("returns null tab when no radio button is checked", () => {
    const state = extractState(parseNodes(DIRTY_XML));
    expect(state.tab).toBeNull();
  });
});

// ─── isCalendarDirty ─────────────────────────────────────────────────────────

describe("isCalendarDirty", () => {
  it("returns false for day view (has lv_left)", () => {
    expect(isCalendarDirty(parseNodes(DAY_VIEW_XML))).toBe(false);
  });

  it("returns false for week view (has fl_type)", () => {
    expect(isCalendarDirty(parseNodes(WEEK_VIEW_XML))).toBe(false);
  });

  it("returns true when neither fl_type nor lv_left found", () => {
    expect(isCalendarDirty(parseNodes(DIRTY_XML))).toBe(true);
  });
});

// ─── parseDayEvents ───────────────────────────────────────────────────────────

describe("parseDayEvents", () => {
  it("parses events from day view XML", () => {
    const events = parseDayEvents(parseNodes(DAY_VIEW_XML));
    expect(events).toHaveLength(2);
    expect(events[0]).toEqual({ title: "TV (17:30-18:30)", emoji: "📺", checked: false });
    expect(events[1]).toEqual({ title: "Schlafen (19:00)", emoji: "🛏️", checked: true });
  });

  it("deduplicates repeated events", () => {
    // Same XML twice — simulates calendar showing events in two sections
    const doubled = DAY_VIEW_XML.replace("</hierarchy>",
      `<node resource-id="com.fujia.calendar:id/iv_emoji" class="android.widget.CheckedTextView" text="📺" clickable="false" checkable="true" checked="false" bounds="[0,400][60,460]" />
       <node resource-id="com.fujia.calendar:id/tv_event_name" class="android.widget.TextView" text="TV (17:30-18:30)" clickable="true" checkable="false" checked="false" bounds="[60,400][1080,460]" />
       </hierarchy>`);
    const events = parseDayEvents(parseNodes(doubled));
    expect(events.filter((e) => e.title === "TV (17:30-18:30)")).toHaveLength(1);
  });

  it("returns empty array when no events", () => {
    expect(parseDayEvents(parseNodes(DIRTY_XML))).toHaveLength(0);
  });
});

// ─── parseWeekEvents ─────────────────────────────────────────────────────────

describe("parseWeekEvents", () => {
  it("parses events grouped by date", () => {
    const events = parseWeekEvents(parseNodes(WEEK_VIEW_XML));
    expect(events).toHaveLength(3);
    expect(events[0]).toEqual({ title: "Geburtstag Tabitha", date: "23", time: "Ganztägig" });
    expect(events[1]).toEqual({ title: "Sport Tilian", date: "23", time: "18:00-19:00" });
    expect(events[2]).toEqual({ title: "HNO Arzt Kellin", date: "24", time: "14:30-15:30" });
  });

  it("skips profile title nodes that appear before first tv_day", () => {
    const xml = `<hierarchy>
      <node resource-id="com.fujia.calendar:id/rv_chores" bounds="[0,0][100,100]" />
      <node resource-id="com.fujia.calendar:id/tv_title" text="Kellin" bounds="[0,50][100,100]" />
      <node resource-id="com.fujia.calendar:id/tv_day" text="25" bounds="[0,100][100,140]" />
      <node resource-id="com.fujia.calendar:id/tv_title" text="Meeting" bounds="[0,140][100,180]" />
    </hierarchy>`;
    const events = parseWeekEvents(parseNodes(xml));
    expect(events).toHaveLength(1);
    expect(events[0].title).toBe("Meeting");
  });
});

// ─── parseMonthEvents ─────────────────────────────────────────────────────────

describe("parseMonthEvents", () => {
  it("parses month events with dates and times", () => {
    const events = parseMonthEvents(parseNodes(MONTH_VIEW_XML));
    expect(events).toHaveLength(2);
    expect(events[0]).toEqual({ title: "Geburtstag Julia", date: "März 1", time: "Ganztägig" });
    expect(events[1]).toEqual({ title: "Sport Tilian", date: "2" });
  });
});

// ─── parseCalendarEvents ──────────────────────────────────────────────────────

describe("parseCalendarEvents", () => {
  it("delegates to parseDayEvents for day view", () => {
    const nodes = parseNodes(DAY_VIEW_XML);
    expect(parseCalendarEvents(nodes, "day")).toHaveLength(2);
  });

  it("delegates to parseWeekEvents for week view", () => {
    const nodes = parseNodes(WEEK_VIEW_XML);
    expect(parseCalendarEvents(nodes, "week")).toHaveLength(3);
  });

  it("returns empty array for schedule view", () => {
    expect(parseCalendarEvents([], "schedule")).toHaveLength(0);
  });
});
```

- [ ] **Run tests**

```bash
npm test
```

Expected: all new `calendar_helpers` tests pass, no regressions.

- [ ] **Commit**

```bash
git add src/tools/calendar_helpers.ts src/test/calendar_helpers.test.ts
git commit -m "feat: add calendar_helpers with UI node parser and event extraction"
```

---

## Task 4: `calendar_get_schedule.ts`

- [ ] **Create `src/tools/calendar_get_schedule.ts`**

```typescript
import { z } from "zod";
import { AdbConfig, dumpUiXml, ensureConnected, wakeScreen } from "../adb.js";
import { switchTab } from "../tablet.js";
import type { CliCommand } from "../cli.js";
import {
  parseNodes,
  extractState,
  isCalendarDirty,
  findNode,
  parseCalendarEvents,
} from "./calendar_helpers.js";

async function run(_args: unknown, config: AdbConfig): Promise<unknown> {
  try {
    const connected = await ensureConnected(config);
    if (!connected) {
      return { success: false, error: `Cannot reach device at ${config.ip}:${config.port}` };
    }
    await wakeScreen(config);

    const xml = await dumpUiXml(config);
    const nodes = parseNodes(xml);
    const state = extractState(nodes);

    if (isCalendarDirty(nodes)) {
      return {
        success: false,
        error: "Unexpected screen state — close any open dialogs and try again",
        state,
      };
    }

    let warning: string | undefined;
    if (state.tab !== "calendar") {
      await switchTab("calendar", config);
      warning = "Switched to calendar tab";
    }

    const periodNode = findNode(nodes, "tv_range") ?? findNode(nodes, "tv_week");
    const period = periodNode?.text ?? "";
    const events = parseCalendarEvents(nodes, state.view);

    return {
      success: true,
      state: { tab: "calendar", view: state.view },
      period,
      events,
      ...(warning ? { warning } : {}),
    };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export const calendarGetScheduleCliCommand: CliCommand = {
  name: "calendar_get_schedule",
  description:
    "Read all visible events from the current Dragon Touch calendar view. Returns structured event data for the active day, week, or month.",
  schema: z.object({}),
  run,
};
```

- [ ] **Add schema test to `src/test/calendar_tools.test.ts`** (create this file):

```typescript
import { describe, it, expect } from "vitest";
import { z } from "zod";

// ─── calendar_navigate schema ─────────────────────────────────────────────────

const navigateSchema = z.object({
  direction: z.enum(["prev", "next"]),
  steps: z.number().int().min(1).max(30).default(1),
});

describe("calendar_navigate schema", () => {
  it("accepts valid direction", () => {
    expect(() => navigateSchema.parse({ direction: "next" })).not.toThrow();
    expect(() => navigateSchema.parse({ direction: "prev" })).not.toThrow();
  });

  it("defaults steps to 1", () => {
    expect(navigateSchema.parse({ direction: "next" }).steps).toBe(1);
  });

  it("rejects steps above 30", () => {
    expect(() => navigateSchema.parse({ direction: "next", steps: 31 })).toThrow();
  });

  it("rejects steps below 1", () => {
    expect(() => navigateSchema.parse({ direction: "next", steps: 0 })).toThrow();
  });

  it("rejects invalid direction", () => {
    expect(() => navigateSchema.parse({ direction: "forward" })).toThrow();
  });
});

// ─── calendar_set_view schema ─────────────────────────────────────────────────

const setViewSchema = z.object({
  view: z.enum(["day", "week", "month", "schedule"]),
});

describe("calendar_set_view schema", () => {
  it("accepts all valid view types", () => {
    for (const view of ["day", "week", "month", "schedule"] as const) {
      expect(() => setViewSchema.parse({ view })).not.toThrow();
    }
  });

  it("rejects invalid view", () => {
    expect(() => setViewSchema.parse({ view: "3day" })).toThrow();
  });
});

// ─── calendar_set_filter schema ───────────────────────────────────────────────

const setFilterSchema = z.object({
  profiles: z.array(z.string()),
});

describe("calendar_set_filter schema", () => {
  it("accepts empty array (show all)", () => {
    expect(() => setFilterSchema.parse({ profiles: [] })).not.toThrow();
  });

  it("accepts profile name array", () => {
    expect(() => setFilterSchema.parse({ profiles: ["Kellin", "Tilian"] })).not.toThrow();
  });

  it("rejects missing profiles field", () => {
    expect(() => setFilterSchema.parse({})).toThrow();
  });
});
```

- [ ] **Run tests**

```bash
npm test
```

Expected: new schema tests pass.

- [ ] **Commit**

```bash
git add src/tools/calendar_get_schedule.ts src/test/calendar_tools.test.ts
git commit -m "feat: add calendar_get_schedule tool"
```

---

## Task 5: `calendar_set_view.ts`

- [ ] **Create `src/tools/calendar_set_view.ts`**

```typescript
import { z } from "zod";
import { AdbConfig, dumpUiXml, ensureConnected, wakeScreen, tap } from "../adb.js";
import { switchTab } from "../tablet.js";
import type { CliCommand } from "../cli.js";
import { parseNodes, extractState, isCalendarDirty, findNode, findNodes, type CalendarView } from "./calendar_helpers.js";

const schema = z.object({
  view: z.enum(["day", "week", "month", "schedule"]),
});

// Fixed order of view options in the fl_type dropdown (all items with shortId "title").
// "3Tag" (shortId "range") is a premium option that may appear but is never targeted.
const VIEW_INDEX: Record<string, number> = {
  schedule: 0,
  day: 1,
  week: 2,
  month: 3,
};

async function run(args: unknown, config: AdbConfig): Promise<unknown> {
  try {
    const { view } = schema.parse(args);

    const connected = await ensureConnected(config);
    if (!connected) {
      return { success: false, error: `Cannot reach device at ${config.ip}:${config.port}` };
    }
    await wakeScreen(config);

    // First dump: state check
    const xml = await dumpUiXml(config);
    const nodes = parseNodes(xml);
    const state = extractState(nodes);

    if (isCalendarDirty(nodes)) {
      return {
        success: false,
        error: "Unexpected screen state — close any open dialogs and try again",
        state,
      };
    }

    let warning: string | undefined;
    if (state.tab !== "calendar") {
      await switchTab("calendar", config);
      warning = "Switched to calendar tab";
    }

    // Day view uses lv_left/iv_right and has no fl_type — need to enter week view first
    // to access fl_type. Tap the date header (tv_week) to expand the view switcher.
    if (state.view === "day") {
      const tvWeek = findNode(nodes, "tv_week");
      if (!tvWeek) {
        return { success: false, error: "Cannot find date header to open view switcher", state };
      }
      await tap(tvWeek.center.x, tvWeek.center.y, config);
      await new Promise((r) => setTimeout(r, 1000));
    }

    // Second dump: find fl_type in current view
    const xml2 = await dumpUiXml(config);
    const nodes2 = parseNodes(xml2);
    const flType = findNode(nodes2, "fl_type");
    if (!flType) {
      return { success: false, error: "View type selector (fl_type) not found", state };
    }

    // Open the dropdown
    await tap(flType.center.x, flType.center.y, config);
    await new Promise((r) => setTimeout(r, 800));

    // Third dump: read dropdown items (all "title" nodes in the overlay)
    const xml3 = await dumpUiXml(config);
    const nodes3 = parseNodes(xml3);
    const titleItems = findNodes(nodes3, "title");

    const targetIndex = VIEW_INDEX[view];
    if (targetIndex === undefined || targetIndex >= titleItems.length) {
      return { success: false, error: `View option "${view}" not found in dropdown (${titleItems.length} items)`, state };
    }

    const target = titleItems[targetIndex];
    await tap(target.center.x, target.center.y, config);

    return {
      success: true,
      state: { tab: "calendar", view: view as CalendarView },
      ...(warning ? { warning } : {}),
    };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export const calendarSetViewCliCommand: CliCommand = {
  name: "calendar_set_view",
  description:
    "Switch the Dragon Touch calendar to a specific view: day, week, month, or schedule.",
  schema,
  run,
};
```

- [ ] **Run tests**

```bash
npm test
```

Expected: all tests pass.

- [ ] **Commit**

```bash
git add src/tools/calendar_set_view.ts
git commit -m "feat: add calendar_set_view tool"
```

---

## Task 6: `calendar_navigate.ts`

- [ ] **Create `src/tools/calendar_navigate.ts`**

```typescript
import { z } from "zod";
import { AdbConfig, dumpUiXml, ensureConnected, wakeScreen, tap } from "../adb.js";
import { switchTab } from "../tablet.js";
import type { CliCommand } from "../cli.js";
import { parseNodes, extractState, isCalendarDirty, findNode } from "./calendar_helpers.js";

const schema = z.object({
  direction: z.enum(["prev", "next"]),
  steps: z.number().int().min(1).max(30).default(1),
});

async function run(args: unknown, config: AdbConfig): Promise<unknown> {
  try {
    const { direction, steps } = schema.parse(args);

    const connected = await ensureConnected(config);
    if (!connected) {
      return { success: false, error: `Cannot reach device at ${config.ip}:${config.port}` };
    }
    await wakeScreen(config);

    const xml = await dumpUiXml(config);
    const nodes = parseNodes(xml);
    const state = extractState(nodes);

    if (isCalendarDirty(nodes)) {
      return {
        success: false,
        error: "Unexpected screen state — close any open dialogs and try again",
        state,
      };
    }

    let warning: string | undefined;
    if (state.tab !== "calendar") {
      await switchTab("calendar", config);
      warning = "Switched to calendar tab";
    }

    // Day view uses lv_left/iv_right; week/month/schedule use iv_left/iv_right
    const leftId = state.view === "day" ? "lv_left" : "iv_left";
    const rightId = state.view === "day" ? "iv_right" : "iv_right";
    const targetId = direction === "prev" ? leftId : rightId;

    const arrowNode = findNode(nodes, targetId);
    if (!arrowNode) {
      return { success: false, error: `Navigation arrow "${targetId}" not found`, state };
    }

    for (let i = 0; i < steps; i++) {
      await tap(arrowNode.center.x, arrowNode.center.y, config);
      if (i < steps - 1) await new Promise((r) => setTimeout(r, 400));
    }

    return {
      success: true,
      state: { tab: "calendar", view: state.view },
      direction,
      steps,
      ...(warning ? { warning } : {}),
    };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export const calendarNavigateCliCommand: CliCommand = {
  name: "calendar_navigate",
  description:
    "Navigate the Dragon Touch calendar forward or backward. Step unit matches the active view: one day in day-view, one week in week-view, one month in month-view.",
  schema,
  run,
};
```

- [ ] **Run tests**

```bash
npm test
```

Expected: all tests pass.

- [ ] **Commit**

```bash
git add src/tools/calendar_navigate.ts
git commit -m "feat: add calendar_navigate tool"
```

---

## Task 7: `calendar_set_filter.ts`

**Note on toggle state detection:** The `opened` ImageView nodes in the filter panel represent per-profile visibility toggles. The `checked` attribute in the UI dump reflects the current toggle state — verify this empirically during testing. If `checked` does not reflect the visual state, fall back to always tapping each target profile's toggle (accepting that it may inadvertently flip already-correct state) and note the limitation in the return value.

- [ ] **Create `src/tools/calendar_set_filter.ts`**

```typescript
import { z } from "zod";
import { AdbConfig, dumpUiXml, ensureConnected, wakeScreen, tap, adbExec } from "../adb.js";
import { switchTab } from "../tablet.js";
import type { CliCommand } from "../cli.js";
import { parseNodes, extractState, isCalendarDirty, findNode, findNodes } from "./calendar_helpers.js";

const schema = z.object({
  profiles: z
    .array(z.string())
    .describe("Profile names to show. Empty array shows all profiles."),
});

async function run(args: unknown, config: AdbConfig): Promise<unknown> {
  try {
    const { profiles } = schema.parse(args);

    const connected = await ensureConnected(config);
    if (!connected) {
      return { success: false, error: `Cannot reach device at ${config.ip}:${config.port}` };
    }
    await wakeScreen(config);

    // First dump: state + dirty check
    const xml = await dumpUiXml(config);
    const nodes = parseNodes(xml);
    const state = extractState(nodes);

    if (isCalendarDirty(nodes)) {
      return {
        success: false,
        error: "Unexpected screen state — close any open dialogs and try again",
        state,
      };
    }

    let warning: string | undefined;
    if (state.tab !== "calendar") {
      await switchTab("calendar", config);
      warning = "Switched to calendar tab";
    }

    // Need to be in week/month view for fl_filter to be visible
    // If in day view, use tv_week tap to open the expanded view first
    let workingNodes = nodes;
    if (state.view === "day") {
      const tvWeek = findNode(nodes, "tv_week");
      if (!tvWeek) {
        return { success: false, error: "Cannot access filter from day view — switch to week or month view first", state };
      }
      await tap(tvWeek.center.x, tvWeek.center.y, config);
      await new Promise((r) => setTimeout(r, 1000));
      const xml2 = await dumpUiXml(config);
      workingNodes = parseNodes(xml2);
    }

    const flFilter = findNode(workingNodes, "fl_filter");
    if (!flFilter) {
      return { success: false, error: "Filter button (fl_filter) not found", state };
    }

    // Open filter panel
    await tap(flFilter.center.x, flFilter.center.y, config);
    await new Promise((r) => setTimeout(r, 1000));

    // Second dump: read filter panel content
    const xml3 = await dumpUiXml(config);
    const filterNodes = parseNodes(xml3);

    const profileNameNodes = findNodes(filterNodes, "tv_category_name")
      .sort((a, b) => a.bounds.y1 - b.bounds.y1);
    const openedNodes = findNodes(filterNodes, "opened")
      .sort((a, b) => a.bounds.y1 - b.bounds.y1);

    // Pair profiles with their toggles (matched by sorted y-position)
    const pairs = profileNameNodes.map((p, i) => ({
      name: p.text,
      toggle: openedNodes[i],
    })).filter((pair) => pair.toggle);

    const showAll = profiles.length === 0;
    const activeProfiles: string[] = [];

    for (const { name, toggle } of pairs) {
      if (name === "Alles auswählen") continue; // skip the "select all" meta-option
      const shouldBeVisible = showAll || profiles.includes(name);
      const isCurrentlyVisible = toggle.checked;
      if (shouldBeVisible !== isCurrentlyVisible) {
        await tap(toggle.center.x, toggle.center.y, config);
        await new Promise((r) => setTimeout(r, 300));
      }
      if (shouldBeVisible) activeProfiles.push(name);
    }

    // Close filter panel
    await adbExec("shell input keyevent 4", config);

    return {
      success: true,
      state: { tab: "calendar", view: state.view },
      active_profiles: activeProfiles,
      ...(warning ? { warning } : {}),
    };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export const calendarSetFilterCliCommand: CliCommand = {
  name: "calendar_set_filter",
  description:
    "Show or hide family member profiles in the Dragon Touch calendar filter. Pass an empty array to show all profiles.",
  schema,
  run,
};
```

- [ ] **Run tests**

```bash
npm test
```

Expected: all tests pass.

- [ ] **Commit**

```bash
git add src/tools/calendar_set_filter.ts
git commit -m "feat: add calendar_set_filter tool"
```

---

## Task 8: Register Tools + Final Verification

- [ ] **Update `src/index.ts`** — add 4 imports and register in `allCommands`:

In the imports block (after existing tool imports):
```typescript
import { calendarGetScheduleCliCommand } from "./tools/calendar_get_schedule.js";
import { calendarSetViewCliCommand } from "./tools/calendar_set_view.js";
import { calendarNavigateCliCommand } from "./tools/calendar_navigate.js";
import { calendarSetFilterCliCommand } from "./tools/calendar_set_filter.js";
```

In `allCommands`:
```typescript
const allCommands = [
  ...tabCliCommands,
  captureScreenCliCommand,
  getStatusCliCommand,
  getDeviceInfoCliCommand,
  getAppSettingsCliCommand,
  setBrightnessCliCommand,
  setVolumeCliCommand,
  getActiveTabCliCommand,
  calendarGetScheduleCliCommand,
  calendarSetViewCliCommand,
  calendarNavigateCliCommand,
  calendarSetFilterCliCommand,
];
```

- [ ] **Build**

```bash
npm run build
```

Expected: no TypeScript errors.

- [ ] **Run full test suite**

```bash
npm test
```

Expected: all tests pass.

- [ ] **Commit**

```bash
git add src/index.ts
git commit -m "feat: register calendar_* tools in MCP server"
```

---

## Self-Review Notes

**`calendar_set_view` makes 3 dumps** (not 2 as in the spec) when starting from day view: initial state dump + post-tv_week-tap dump + dropdown dump. This is correct behaviour — day view requires an extra tap to reach `fl_type`.

**`calendar_set_filter` filter toggle state** relies on `checked` attribute of the `opened` ImageView. This needs empirical verification on the device. If `checked` does not reflect toggle state, the implementation must be revised during testing to use an alternative detection method (e.g. comparing image bounds/tint via screenshot).

**`calendar_navigate` arrow IDs**: day view left arrow is `lv_left`; week/month/schedule left arrow is `iv_left`. The right arrow is always `iv_right` across all views — confirmed from discovery data.
