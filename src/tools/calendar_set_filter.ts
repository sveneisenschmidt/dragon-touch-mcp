// Copyright (c) 2025 Sven Eisenschmidt. Licensed under the MIT License.
import { z } from "zod";
import { AdbConfig, dumpUiXml, ensureConnected, wakeScreen, tap, adbExec } from "../adb.js";
import { switchTab } from "../tablet.js";
import type { CliCommand } from "../cli.js";
import { Trace } from "../trace.js";
import { parseNodes, extractState, isCalendarDirty, findNode, findNodes } from "./calendar_helpers.js";

export const setFilterSchema = z.object({
  profiles: z
    .array(z.string())
    .describe("Profile names to show. Empty array shows all profiles."),
});

async function run(args: unknown, config: AdbConfig): Promise<unknown> {
  const trace = new Trace();
  try {
    const { profiles } = setFilterSchema.parse(args);

    const connected = await ensureConnected(config);
    trace.mark("ensure_connected");
    if (!connected) {
      return { success: false, error: `Cannot reach device at ${config.ip}:${config.port}`, trace: trace.toJSON() };
    }
    await wakeScreen(config);

    // First dump: state + dirty check
    const xml = await dumpUiXml(config);
    const nodes = parseNodes(xml);
    const state = extractState(nodes);
    trace.mark("initial_dump");

    if (isCalendarDirty(nodes)) {
      return {
        success: false,
        error: "Unexpected screen state — close any open dialogs and try again",
        state,
        trace: trace.toJSON(),
      };
    }

    let warning: string | undefined;
    if (state.tab !== "calendar") {
      await switchTab("calendar", config);
      warning = "Switched to calendar tab";
      trace.mark("switch_tab");
    }

    // Need to be in week/month view for fl_filter to be visible
    // If in day view, use tv_week tap to open the expanded view first
    let workingNodes = nodes;
    if (state.view === "day") {
      const tvWeek = findNode(nodes, "tv_week");
      if (!tvWeek) {
        return { success: false, error: "Cannot access filter from day view — switch to week or month view first", state, trace: trace.toJSON() };
      }
      await tap(tvWeek.center.x, tvWeek.center.y, config);
      // Poll until fl_filter is visible after day-view transition
      const deadlineDay = Date.now() + 3000;
      while (Date.now() < deadlineDay) {
        await new Promise((r) => setTimeout(r, 300));
        workingNodes = parseNodes(await dumpUiXml(config));
        if (findNode(workingNodes, "fl_filter")) break;
      }
      trace.mark("exit_day_view");
    }

    const flFilter = findNode(workingNodes, "fl_filter");
    if (!flFilter) {
      return { success: false, error: "Filter button (fl_filter) not found", state, trace: trace.toJSON() };
    }

    // Open filter panel, then poll until profile nodes appear
    await tap(flFilter.center.x, flFilter.center.y, config);
    let filterNodes: ReturnType<typeof parseNodes> = [];
    const deadlineFilter = Date.now() + 3000;
    while (Date.now() < deadlineFilter) {
      await new Promise((r) => setTimeout(r, 300));
      filterNodes = parseNodes(await dumpUiXml(config));
      if (findNodes(filterNodes, "tv_category_name").length > 0) break;
    }
    trace.mark("filter_open");

    const profileNameNodes = findNodes(filterNodes, "tv_category_name")
      .sort((a, b) => a.bounds.y1 - b.bounds.y1);
    const openedNodes = findNodes(filterNodes, "opened");

    // Pair each profile label with the toggle whose Y bounds overlap — robust to
    // the "select all" row having a different label/toggle Y offset than expected.
    const pairs = profileNameNodes.map((p) => {
      const toggle = openedNodes.find(
        (o) => o.bounds.y1 < p.bounds.y2 && o.bounds.y2 > p.bounds.y1
      );
      return toggle ? { name: p.text, toggle } : null;
    }).filter((pair): pair is { name: string; toggle: typeof openedNodes[0] } => pair !== null);

    const showAll = profiles.length === 0;
    const activeProfiles: string[] = [];

    // The first row (lowest Y) is the "select all" meta-option — skip it regardless of locale.
    const profilePairs = pairs.slice(1);

    for (const { name, toggle } of profilePairs) {
      const shouldBeVisible = showAll || profiles.includes(name);
      const isCurrentlyVisible = toggle.checked;
      if (shouldBeVisible !== isCurrentlyVisible) {
        await tap(toggle.center.x, toggle.center.y, config);
        // Poll until the toggle reflects the new state (up to 2 s)
        const deadlineToggle = Date.now() + 2000;
        while (Date.now() < deadlineToggle) {
          await new Promise((r) => setTimeout(r, 200));
          const toggleXml = await dumpUiXml(config);
          const toggleNodes = parseNodes(toggleXml);
          const refreshed = findNodes(toggleNodes, "opened").find(
            (o) => o.bounds.y1 < toggle.bounds.y2 && o.bounds.y2 > toggle.bounds.y1
          );
          if (refreshed && refreshed.checked === shouldBeVisible) break;
        }
      }
      if (shouldBeVisible) activeProfiles.push(name);
    }
    trace.mark("toggles_applied");

    // Close filter panel
    await adbExec("shell input keyevent 4", config);
    trace.mark("panel_closed");

    return {
      success: true,
      state: { tab: "calendar", view: state.view },
      active_profiles: activeProfiles,
      ...(warning ? { warning } : {}),
      trace: trace.toJSON(),
    };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err), trace: trace.toJSON() };
  }
}

export const calendarSetFilterCliCommand: CliCommand = {
  name: "calendar_set_filter",
  description:
    "Show or hide family member profiles in the Dragon Touch calendar filter. Pass an empty array to show all profiles.",
  schema: setFilterSchema,
  run,
};
