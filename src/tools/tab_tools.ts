import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { AdbConfig } from "../adb.js";
import { TabName, switchTab } from "../tablet.js";

function registerTabTool(
  server: McpServer,
  config: AdbConfig,
  toolName: string,
  description: string,
  tab: TabName
): void {
  server.tool(toolName, description, {}, async () => {
    const result = await switchTab(tab, config);
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            result.success
              ? { success: true, tab, trace: result.trace }
              : { success: false, error: result.error, trace: result.trace }
          ),
        },
      ],
    };
  });
}

export function registerTabTools(server: McpServer, config: AdbConfig): void {
  registerTabTool(server, config, "show_calendar", "Switch the Dragon Touch tablet to the Calendar tab", "calendar");
  registerTabTool(server, config, "show_tasks",    "Switch the Dragon Touch tablet to the Tasks tab",    "tasks");
  registerTabTool(server, config, "show_day",      "Switch the Dragon Touch tablet to the Day tab",      "day");
  registerTabTool(server, config, "show_meals",    "Switch the Dragon Touch tablet to the Meals tab",    "meals");
  registerTabTool(server, config, "show_photos",   "Switch the Dragon Touch tablet to the Photos tab",   "photos");
  registerTabTool(server, config, "show_lists",    "Switch the Dragon Touch tablet to the Lists tab",    "lists");
  registerTabTool(server, config, "show_sleep",    "Switch the Dragon Touch tablet to the Sleep tab",    "sleep");
  registerTabTool(server, config, "show_goal",     "Switch the Dragon Touch tablet to the Goal tab",     "goal");
}
