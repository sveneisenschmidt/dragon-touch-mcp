// Copyright (c) 2025 Sven Eisenschmidt. Licensed under the MIT License.
import { z } from "zod";
import { AdbConfig, dumpUiXml, ensureConnected, wakeScreen, tap } from "../adb.js";
import { switchTab } from "../tablet.js";
import type { CliCommand } from "../cli.js";
import { Trace } from "../trace.js";
import { parseNodes, extractState, isCalendarDirty, findNode } from "./calendar_helpers.js";

export const navigateSchema = z.object({
  direction: z.enum(["prev", "next"]),
  // Each step is one tap; taps are 400 ms apart. Keep steps small for responsive behaviour.
  steps: z.number().int().min(1).max(10).default(1),
});

async function run(args: unknown, config: AdbConfig): Promise<unknown> {
  const trace = new Trace();
  try {
    const { direction, steps } = navigateSchema.parse(args);

    const connected = await ensureConnected(config);
    trace.mark("ensure_connected");
    if (!connected) {
      return { success: false, error: `Cannot reach device at ${config.ip}:${config.port}`, trace: trace.toJSON() };
    }
    await wakeScreen(config);

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

    let calendarNodes = nodes;
    let calendarView = state.view;
    let warning: string | undefined;
    if (state.tab !== "calendar") {
      await switchTab("calendar", config);
      // Poll until the calendar view is fully rendered after the tab switch
      const deadlineTab = Date.now() + 3000;
      while (Date.now() < deadlineTab) {
        await new Promise((r) => setTimeout(r, 300));
        calendarNodes = parseNodes(await dumpUiXml(config));
        calendarView = extractState(calendarNodes).view;
        if (calendarView !== "unknown") break;
      }
      warning = "Switched to calendar tab";
      trace.mark("switch_tab");
    }

    // Day view uses lv_left/iv_right; week/month/schedule use iv_left/iv_right
    const leftId = calendarView === "day" ? "lv_left" : "iv_left";
    const rightId = "iv_right";
    const targetId = direction === "prev" ? leftId : rightId;

    const arrowNode = findNode(calendarNodes, targetId);
    if (!arrowNode) {
      return { success: false, error: `Navigation arrow "${targetId}" not found`, state, trace: trace.toJSON() };
    }

    for (let i = 0; i < steps; i++) {
      await tap(arrowNode.center.x, arrowNode.center.y, config);
      if (i < steps - 1) await new Promise((r) => setTimeout(r, 400));
    }
    trace.mark("tap_arrows");

    return {
      success: true,
      state: { tab: "calendar", view: calendarView },
      direction,
      steps,
      ...(warning ? { warning } : {}),
      trace: trace.toJSON(),
    };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err), trace: trace.toJSON() };
  }
}

export const calendarNavigateCliCommand: CliCommand = {
  name: "calendar_navigate",
  description:
    "Navigate the Dragon Touch calendar forward or backward. Step unit matches the active view: one day in day-view, one week in week-view, one month in month-view.",
  schema: navigateSchema,
  run,
};
