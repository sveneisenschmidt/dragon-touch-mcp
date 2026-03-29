import { z } from "zod";
import { AdbConfig, dumpUiXml, ensureConnected, wakeScreen, tap } from "../adb.js";
import { switchTab } from "../tablet.js";
import type { CliCommand } from "../cli.js";
import { parseNodes, extractState, isCalendarDirty, findNode } from "./calendar_helpers.js";

const schema = z.object({
  direction: z.enum(["prev", "next"]),
  steps: z.number().int().min(1).max(30).default(1),
});

async function run(args: unknown, config: AdbConfig): Promise<unknown> {
  try {
    const { direction, steps } = schema.parse(args);

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

    // Day view uses lv_left/iv_right; week/month/schedule use iv_left/iv_right
    const leftId = calendarView === "day" ? "lv_left" : "iv_left";
    const rightId = "iv_right";
    const targetId = direction === "prev" ? leftId : rightId;

    const arrowNode = findNode(calendarNodes, targetId);
    if (!arrowNode) {
      return { success: false, error: `Navigation arrow "${targetId}" not found`, state };
    }

    for (let i = 0; i < steps; i++) {
      await tap(arrowNode.center.x, arrowNode.center.y, config);
      if (i < steps - 1) await new Promise((r) => setTimeout(r, 400));
    }

    return {
      success: true,
      state: { tab: "calendar", view: calendarView },
      direction,
      steps,
      ...(warning ? { warning } : {}),
    };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export const calendarNavigateCliCommand: CliCommand = {
  name: "calendar_navigate",
  description:
    "Navigate the Dragon Touch calendar forward or backward. Step unit matches the active view: one day in day-view, one week in week-view, one month in month-view.",
  schema,
  run,
};
