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

    let warning: string | undefined;
    if (state.tab !== "calendar") {
      await switchTab("calendar", config);
      warning = "Switched to calendar tab";
    }

    const periodNode = findNode(nodes, "tv_range") ?? findNode(nodes, "tv_week");
    const period = periodNode?.text ?? "";
    const events = parseCalendarEvents(nodes, state.view);

    return {
      success: true,
      state: { tab: "calendar", view: state.view },
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
