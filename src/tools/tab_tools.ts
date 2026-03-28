import { z } from "zod";
import { AdbConfig } from "../adb.js";
import { TabName, switchTab } from "../tablet.js";
import type { CliCommand } from "../cli.js";

const TAB_DEFS: { toolName: string; description: string; tab: TabName }[] = [
  { toolName: "show_calendar", description: "Switch the Dragon Touch tablet to the Calendar tab", tab: "calendar" },
  { toolName: "show_tasks",    description: "Switch the Dragon Touch tablet to the Tasks tab",    tab: "tasks"    },
  { toolName: "show_day",      description: "Switch the Dragon Touch tablet to the Day tab",      tab: "day"      },
  { toolName: "show_meals",    description: "Switch the Dragon Touch tablet to the Meals tab",    tab: "meals"    },
  { toolName: "show_photos",   description: "Switch the Dragon Touch tablet to the Photos tab",   tab: "photos"   },
  { toolName: "show_lists",    description: "Switch the Dragon Touch tablet to the Lists tab",    tab: "lists"    },
  { toolName: "show_sleep",    description: "Switch the Dragon Touch tablet to the Sleep tab",    tab: "sleep"    },
  { toolName: "show_goal",     description: "Switch the Dragon Touch tablet to the Goal tab",     tab: "goal"     },
];

const tabSchema = z.object({});

export const tabCliCommands: CliCommand[] = TAB_DEFS.map(({ toolName, description, tab }) => ({
  name: toolName,
  description,
  schema: tabSchema,
  run: async (_args: unknown, config: AdbConfig) => {
    const result = await switchTab(tab, config);
    return result.success
      ? { success: true, tab, trace: result.trace }
      : { success: false, error: result.error, trace: result.trace };
  },
}));

