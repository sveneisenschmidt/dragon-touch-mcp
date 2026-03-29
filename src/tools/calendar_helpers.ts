import { XMLParser } from "fast-xml-parser";
import { AdbConfig, tap } from "../adb.js";
import { TAB_RESOURCE_IDS, type TabName } from "../tablet.js";

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

type RawNode = {
  "resource-id"?: string;
  text?: string;
  "content-desc"?: string;
  class?: string;
  checked?: string;
  clickable?: string;
  checkable?: string;
  bounds?: string;
  node?: RawNode | RawNode[];
};

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "",
  isArray: (_name, _jpath, _isLeaf, isAttribute) => !isAttribute,
  parseAttributeValue: false,
});

function flattenRawNodes(raw: RawNode[]): UiNode[] {
  const result: UiNode[] = [];
  for (const r of raw) {
    const b = (r.bounds ?? "").match(/\[(\d+),(\d+)\]\[(\d+),(\d+)\]/);
    if (b) {
      const x1 = +b[1], y1 = +b[2], x2 = +b[3], y2 = +b[4];
      const resourceId = r["resource-id"] ?? "";
      result.push({
        resourceId,
        shortId: resourceId.replace(/^[^/]+\//, ""),
        text: r.text ?? "",
        contentDesc: r["content-desc"] ?? "",
        className: r.class ?? "",
        checked: r.checked === "true",
        clickable: r.clickable === "true",
        checkable: r.checkable === "true",
        bounds: { x1, y1, x2, y2 },
        center: { x: Math.floor((x1 + x2) / 2), y: Math.floor((y1 + y2) / 2) },
      });
    }
    if (r.node) {
      result.push(...flattenRawNodes(Array.isArray(r.node) ? r.node : [r.node]));
    }
  }
  return result;
}

export function parseNodes(xml: string): UiNode[] {
  try {
    const doc = xmlParser.parse(xml);
    const topNodes: RawNode[] = doc?.hierarchy?.[0]?.node ?? [];
    return flattenRawNodes(Array.isArray(topNodes) ? topNodes : [topNodes]);
  } catch {
    return [];
  }
}

export function findNode(nodes: UiNode[], shortId: string): UiNode | null {
  return nodes.find((n) => n.shortId === shortId) ?? null;
}

export function findNodes(nodes: UiNode[], shortId: string): UiNode[] {
  return nodes.filter((n) => n.shortId === shortId);
}

// ─── State Detection ─────────────────────────────────────────────────────────

// Inverted index: shortId → TabName, derived from the canonical TAB_RESOURCE_IDS map.
export const TAB_MAP: Record<string, TabName> = Object.fromEntries(
  Object.entries(TAB_RESOURCE_IDS).map(([tab, resourceId]) => [
    resourceId.replace(/^[^/]+\//, ""),
    tab as TabName,
  ])
);

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

/** Returns true when neither a day-view nor week/month/schedule-view marker is found. */
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
  return [];
}

// ─── ADB Helpers ─────────────────────────────────────────────────────────────

export async function tapByResourceId(
  shortId: string,
  nodes: UiNode[],
  config: AdbConfig
): Promise<void> {
  const node = findNode(nodes, shortId);
  if (!node) throw new Error(`UI element not found: ${shortId}`);
  await tap(node.center.x, node.center.y, config);
}
