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
