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

    // The first row (lowest Y) is the "select all" meta-option — skip it regardless of locale.
    const profilePairs = pairs.slice(1);

    for (const { name, toggle } of profilePairs) {
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
