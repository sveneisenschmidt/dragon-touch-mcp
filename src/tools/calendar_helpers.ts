import { XMLParser } from "fast-xml-parser";
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

/** Strips the package prefix from a full resource-id, e.g. "com.fujia.calendar:id/fl_type" → "fl_type". */
export function toShortId(resourceId: string): string {
  return resourceId.replace(/^[^/]+\//, "");
}

/**
 * Parses the uiautomator bounds string "[x1,y1][x2,y2]" into numeric coordinates.
 * Returns null when the string does not match the expected format.
 * (Regex is appropriate here — bounds is a structured plain-text value, not XML.)
 */
export function parseBounds(
  bounds: string
): { x1: number; y1: number; x2: number; y2: number } | null {
  const b = bounds.match(/\[(\d+),(\d+)\]\[(\d+),(\d+)\]/);
  if (!b) return null;
  return { x1: +b[1], y1: +b[2], x2: +b[3], y2: +b[4] };
}

/** Computes the center pixel of a bounding box. */
export function computeCenter(bounds: {
  x1: number; y1: number; x2: number; y2: number;
}): { x: number; y: number } {
  return {
    x: Math.floor((bounds.x1 + bounds.x2) / 2),
    y: Math.floor((bounds.y1 + bounds.y2) / 2),
  };
}

function flattenRawNodes(raw: RawNode[]): UiNode[] {
  const result: UiNode[] = [];
  for (const r of raw) {
    const bounds = parseBounds(r.bounds ?? "");
    if (bounds) {
      const resourceId = r["resource-id"] ?? "";
      result.push({
        resourceId,
        shortId: toShortId(resourceId),
        text: r.text ?? "",
        contentDesc: r["content-desc"] ?? "",
        className: r.class ?? "",
        checked: r.checked === "true",
        clickable: r.clickable === "true",
        checkable: r.checkable === "true",
        bounds,
        center: computeCenter(bounds),
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
    toShortId(resourceId),
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

/** Returns true when no known calendar-view marker is present (dialog open or wrong screen). */
export function isCalendarDirty(nodes: UiNode[]): boolean {
  return (
    !nodes.some((n) => n.shortId === "fl_type") &&
    !nodes.some((n) => n.shortId === "lv_left") &&
    !nodes.some((n) => n.shortId === "item_schedule_view")
  );
}

// ─── Event Parsing ────────────────────────────────────────────────────────────

function parseDayEvents(nodes: UiNode[]): CalendarEvent[] {
  const emojiNodes = findNodes(nodes, "iv_emoji");
  const titleNodes = findNodes(nodes, "tv_event_name");
  const seen = new Set<string>();
  const events: CalendarEvent[] = [];

  for (const emoji of emojiNodes) {
    // Pair by Y-overlap: find the title node that shares the same row as this emoji.
    const titleNode = titleNodes.find(
      (t) => t.bounds.y1 < emoji.bounds.y2 && t.bounds.y2 > emoji.bounds.y1
    );
    const title = titleNode?.text;
    if (!title || seen.has(title)) continue;
    seen.add(title);
    events.push({ title, emoji: emoji.text || undefined, checked: emoji.checked });
  }
  return events;
}

/**
 * Shared parser for week and month grid layouts.
 * Both views consist of tv_day date headers followed by tv_title/tv_time event pairs.
 *
 * @param skipPreGrid  When true, tv_title nodes before the first tv_day are ignored.
 *                     Week view has profile-name headers above the grid; month view does not.
 */
function parseDateGridEvents(nodes: UiNode[], skipPreGrid: boolean): CalendarEvent[] {
  const events: CalendarEvent[] = [];
  let currentDate = "";
  let inGrid = !skipPreGrid;
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

function parseWeekEvents(nodes: UiNode[]): CalendarEvent[] {
  return parseDateGridEvents(nodes, true);
}

function parseMonthEvents(nodes: UiNode[]): CalendarEvent[] {
  return parseDateGridEvents(nodes, false);
}

export function parseCalendarEvents(nodes: UiNode[], view: CalendarView): CalendarEvent[] {
  if (view === "day") return parseDayEvents(nodes);
  if (view === "week") return parseWeekEvents(nodes);
  if (view === "month") return parseMonthEvents(nodes);
  return [];
}

