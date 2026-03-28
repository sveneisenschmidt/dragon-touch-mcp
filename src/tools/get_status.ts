import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { AdbConfig } from "../adb.js";
import { runCheckup } from "../tablet.js";

export function registerGetStatus(server: McpServer, config: AdbConfig): void {
  server.tool(
    "get_status",
    "Run a full setup checkup: verifies adb, device connectivity, and app installation",
    {},
    async () => {
      const result = await runCheckup(config);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    }
  );
}
