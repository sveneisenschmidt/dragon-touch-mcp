import { z } from "zod";
import { AdbConfig, dumpUiXml, ensureConnected, wakeScreen, tap } from "../adb.js";
import { switchTab } from "../tablet.js";
import type { CliCommand } from "../cli.js";
import { parseNodes, extractState, detectView, isCalendarDirty, findNode, findNodes, type CalendarView } from "./calendar_helpers.js";

export const setViewSchema = z.object({
  view: z.enum(["day", "week", "month", "schedule"]),
});

// Observed top-to-bottom order of view options in the fl_type dropdown.
// Used together with the checked item's position at runtime to verify the order
// hasn't changed — if it has, we fail explicitly rather than tap the wrong item.
const DROPDOWN_ORDER: CalendarView[] = ["schedule", "day", "week", "month"];

async function run(args: unknown, config: AdbConfig): Promise<unknown> {
  try {
    const { view } = setViewSchema.parse(args);

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

    // Open the dropdown, then poll until the items appear (up to 3 s).
    // A fixed delay is unreliable — the dropdown may not be rendered yet when
    // we dump, yielding background nodes without checked state.
    await tap(flType.center.x, flType.center.y, config);
    let sortedItems: ReturnType<typeof findNodes> = [];
    const deadline = Date.now() + 3000;
    while (Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 300));
      const xmlPoll = await dumpUiXml(config);
      const nodesPoll = parseNodes(xmlPoll);
      const items = findNodes(nodesPoll, "title").sort((a, b) => a.bounds.y1 - b.bounds.y1);
      if (items.length >= DROPDOWN_ORDER.length) {
        sortedItems = items;
        break;
      }
    }
    if (sortedItems.length < DROPDOWN_ORDER.length) {
      return { success: false, error: "View type dropdown did not open", state };
    }

    // If the app exposes a checked item, use it to verify DROPDOWN_ORDER hasn't
    // changed. If checked state is absent (app doesn't always set it), skip the
    // order check and proceed with positional matching — don't fail hard.
    const checkedIndex = sortedItems.findIndex((n) => n.checked);
    const currentView = state.view === "day" ? "day" : (state.view as CalendarView);
    const expectedCheckedIndex = DROPDOWN_ORDER.indexOf(currentView);
    if (checkedIndex !== -1 && expectedCheckedIndex !== -1 && checkedIndex !== expectedCheckedIndex) {
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
    await new Promise((r) => setTimeout(r, 800));

    // Verify the view actually changed — don't trust that the tap landed correctly.
    const xmlVerify = await dumpUiXml(config);
    const verifiedView = detectView(parseNodes(xmlVerify));
    if (verifiedView !== view) {
      return {
        success: false,
        error: `View change unconfirmed — expected "${view}", got "${verifiedView}"`,
        state: { tab: "calendar", view: verifiedView },
        ...(warning ? { warning } : {}),
      };
    }

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
  schema: setViewSchema,
  run,
};
