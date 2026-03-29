import { describe, it, expect } from "vitest";
import {
  parseNodes,
  findNode,
  findNodes,
  detectView,
  extractState,
  isCalendarDirty,
  parseCalendarEvents,
  toShortId,
  parseBounds,
  computeCenter,
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
  <node resource-id="com.fujia.calendar:id/tv_title" text="Kellin" clickable="false" checkable="false" checked="false" bounds="[0,200][100,240]" />
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

// ─── toShortId ────────────────────────────────────────────────────────────────

describe("toShortId", () => {
  it("strips the package prefix", () => {
    expect(toShortId("com.fujia.calendar:id/fl_type")).toBe("fl_type");
  });

  it("returns the string unchanged when there is no prefix", () => {
    expect(toShortId("fl_type")).toBe("fl_type");
  });

  it("returns empty string for empty input", () => {
    expect(toShortId("")).toBe("");
  });
});

// ─── parseBounds ──────────────────────────────────────────────────────────────

describe("parseBounds", () => {
  it("parses a valid bounds string", () => {
    expect(parseBounds("[0,100][54,165]")).toEqual({ x1: 0, y1: 100, x2: 54, y2: 165 });
  });

  it("returns null for an empty string", () => {
    expect(parseBounds("")).toBeNull();
  });

  it("returns null for a malformed string", () => {
    expect(parseBounds("[0,100]")).toBeNull();
  });
});

// ─── computeCenter ────────────────────────────────────────────────────────────

describe("computeCenter", () => {
  it("computes the midpoint", () => {
    expect(computeCenter({ x1: 0, y1: 100, x2: 54, y2: 165 })).toEqual({ x: 27, y: 132 });
  });

  it("floors fractional midpoints", () => {
    expect(computeCenter({ x1: 0, y1: 0, x2: 1, y2: 1 })).toEqual({ x: 0, y: 0 });
  });
});

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

  it("handles XML-encoded special characters in text (e.g. & and quotes)", () => {
    const xml = `<hierarchy><node resource-id="com.fujia.calendar:id/tv_event_name" text="Mama &amp; Papa" bounds="[0,0][100,100]" /></hierarchy>`;
    const nodes = parseNodes(xml);
    expect(nodes[0].text).toBe("Mama & Papa");
  });

  it("handles nested nodes (returns all descendants flat)", () => {
    const xml = `<hierarchy>
      <node resource-id="com.fujia.calendar:id/outer" bounds="[0,0][200,200]">
        <node resource-id="com.fujia.calendar:id/inner" bounds="[10,10][100,100]" />
      </node>
    </hierarchy>`;
    const nodes = parseNodes(xml);
    expect(nodes).toHaveLength(2);
    expect(nodes.map((n) => n.shortId)).toEqual(["outer", "inner"]);
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

// ─── parseCalendarEvents — day view ──────────────────────────────────────────

describe("parseCalendarEvents — day", () => {
  it("parses events from day view XML", () => {
    const events = parseCalendarEvents(parseNodes(DAY_VIEW_XML), "day");
    expect(events).toHaveLength(2);
    expect(events[0]).toEqual({ title: "TV (17:30-18:30)", emoji: "📺", checked: false });
    expect(events[1]).toEqual({ title: "Schlafen (19:00)", emoji: "🛏️", checked: true });
  });

  it("deduplicates repeated events", () => {
    const doubled = DAY_VIEW_XML.replace("</hierarchy>",
      `<node resource-id="com.fujia.calendar:id/iv_emoji" class="android.widget.CheckedTextView" text="📺" clickable="false" checkable="true" checked="false" bounds="[0,400][60,460]" />
       <node resource-id="com.fujia.calendar:id/tv_event_name" class="android.widget.TextView" text="TV (17:30-18:30)" clickable="true" checkable="false" checked="false" bounds="[60,400][1080,460]" />
       </hierarchy>`);
    const events = parseCalendarEvents(parseNodes(doubled), "day");
    expect(events.filter((e) => e.title === "TV (17:30-18:30)")).toHaveLength(1);
  });

  it("returns empty array when no events", () => {
    expect(parseCalendarEvents(parseNodes(DIRTY_XML), "day")).toHaveLength(0);
  });
});

// ─── parseCalendarEvents — week view ─────────────────────────────────────────

describe("parseCalendarEvents — week", () => {
  it("parses events grouped by date", () => {
    const events = parseCalendarEvents(parseNodes(WEEK_VIEW_XML), "week");
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
    const events = parseCalendarEvents(parseNodes(xml), "week");
    expect(events).toHaveLength(1);
    expect(events[0].title).toBe("Meeting");
  });
});

// ─── parseCalendarEvents — month view ────────────────────────────────────────

describe("parseCalendarEvents — month", () => {
  it("parses month events with dates and times", () => {
    const events = parseCalendarEvents(parseNodes(MONTH_VIEW_XML), "month");
    expect(events).toHaveLength(2);
    expect(events[0]).toEqual({ title: "Geburtstag Julia", date: "März 1", time: "Ganztägig" });
    expect(events[1]).toEqual({ title: "Sport Tilian", date: "2" });
  });
});

// ─── parseCalendarEvents — other views ───────────────────────────────────────

describe("parseCalendarEvents — other", () => {
  it("returns empty array for schedule view", () => {
    expect(parseCalendarEvents([], "schedule")).toHaveLength(0);
  });

  it("returns empty array for unknown view", () => {
    expect(parseCalendarEvents([], "unknown")).toHaveLength(0);
  });
});
