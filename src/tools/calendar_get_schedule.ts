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

    let calendarNodes = nodes;
    let calendarView = state.view;
    let warning: string | undefined;
    if (state.tab !== "calendar") {
      await switchTab("calendar", config);
      const xml2 = await dumpUiXml(config);
      calendarNodes = parseNodes(xml2);
      calendarView = extractState(calendarNodes).view;
      warning = "Switched to calendar tab";
    }

    if (calendarView === "schedule" || calendarView === "unknown") {
      return {
        success: false,
        error: `calendar_get_schedule does not support "${calendarView}" view — switch to day, week, or month first`,
        state: { tab: "calendar", view: calendarView },
        ...(warning ? { warning } : {}),
      };
    }

    const periodNode = findNode(calendarNodes, "tv_range") ?? findNode(calendarNodes, "tv_week");
    const period = periodNode?.text ?? "";
    const events = parseCalendarEvents(calendarNodes, calendarView);

    return {
      success: true,
      state: { tab: "calendar", view: calendarView },
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
