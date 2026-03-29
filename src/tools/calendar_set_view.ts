import { z } from "zod";
import { AdbConfig, dumpUiXml, ensureConnected, wakeScreen, tap } from "../adb.js";
import { switchTab } from "../tablet.js";
import type { CliCommand } from "../cli.js";
import { parseNodes, extractState, isCalendarDirty, findNode, findNodes, type CalendarView } from "./calendar_helpers.js";

const schema = z.object({
  view: z.enum(["day", "week", "month", "schedule"]),
});

// Observed top-to-bottom order of view options in the fl_type dropdown.
// Used together with the checked item's position at runtime to verify the order
// hasn't changed — if it has, we fail explicitly rather than tap the wrong item.
const DROPDOWN_ORDER: CalendarView[] = ["schedule", "day", "week", "month"];

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

    // Third dump: read dropdown items sorted top-to-bottom
    const xml3 = await dumpUiXml(config);
    const nodes3 = parseNodes(xml3);
    const sortedItems = findNodes(nodes3, "title").sort((a, b) => a.bounds.y1 - b.bounds.y1);

    // The currently active view's item carries checked=true.
    // Cross-check its position against DROPDOWN_ORDER using the view we detected
    // before opening the dropdown. If they disagree, the app layout has changed and
    // we refuse to guess rather than silently tapping the wrong item.
    const checkedIndex = sortedItems.findIndex((n) => n.checked);
    if (checkedIndex === -1) {
      return { success: false, error: "Active view not identifiable in dropdown (no checked item)", state };
    }
    const currentView = state.view === "day" ? "day" : (state.view as CalendarView);
    const expectedCheckedIndex = DROPDOWN_ORDER.indexOf(currentView);
    if (expectedCheckedIndex !== -1 && checkedIndex !== expectedCheckedIndex) {
      return {
        success: false,
        error: `Dropdown order mismatch — expected "${currentView}" at position ${expectedCheckedIndex}, checked item is at position ${checkedIndex}. App layout may have changed.`,
        state,
      };
    }

    const targetIndex = DROPDOWN_ORDER.indexOf(view as CalendarView);
    if (targetIndex < 0 || targetIndex >= sortedItems.length) {
      return { success: false, error: `View option "${view}" not found in dropdown`, state };
    }

    await tap(sortedItems[targetIndex].center.x, sortedItems[targetIndex].center.y, config);

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
