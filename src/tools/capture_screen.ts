import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { AdbConfig, captureScreen, ensureConnected } from "../adb.js";
import { Trace } from "../trace.js";

export function registerCaptureScreen(server: McpServer, config: AdbConfig): void {
  server.tool(
    "capture_screen",
    "Take a screenshot of the Dragon Touch tablet and return it as an image",
    {},
    async () => {
      const trace = new Trace();

      const connected = await ensureConnected(config);
      trace.mark("ensure_connected");

      if (!connected) {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                success: false,
                error: `Cannot reach device at ${config.ip}:${config.port}`,
                trace: trace.toJSON(),
              }),
            },
          ],
        };
      }

      const base64 = await captureScreen(config);
      trace.mark("capture");

      return {
        content: [
          {
            type: "image",
            data: base64,
            mimeType: "image/png",
          },
          {
            type: "text",
            text: JSON.stringify({ trace: trace.toJSON() }),
          },
        ],
      };
    }
  );
}
