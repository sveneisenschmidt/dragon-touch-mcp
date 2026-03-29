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
