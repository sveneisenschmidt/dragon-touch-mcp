#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { AdbConfig, captureScreen, ensureConnected } from "./adb.js";
import { CheckResult, formatCheckup, runCheckup, warmCache } from "./tablet.js";
import { Trace } from "./trace.js";
import { tabCliCommands } from "./tools/tab_tools.js";
import { getStatusCliCommand } from "./tools/get_status.js";
import { captureScreenCliCommand } from "./tools/capture_screen.js";
import { getDeviceInfoCliCommand } from "./tools/get_device_info.js";
import { getAppSettingsCliCommand } from "./tools/get_app_settings.js";
import { setBrightnessCliCommand } from "./tools/set_brightness.js";
import { setVolumeCliCommand } from "./tools/set_volume.js";
import { getActiveTabCliCommand } from "./tools/get_active_tab.js";
import { calendarGetScheduleCliCommand } from "./tools/calendar_get_schedule.js";
import { calendarSetViewCliCommand } from "./tools/calendar_set_view.js";
import { calendarNavigateCliCommand } from "./tools/calendar_navigate.js";
import { calendarSetFilterCliCommand } from "./tools/calendar_set_filter.js";
import { parseCliCommand, runCli } from "./cli.js";

// ─── Config from env / CLI args ──────────────────────────────────────────────

function parseConfig(): AdbConfig {
  const args = process.argv.slice(2);
  let ip: string | undefined;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--ip" && args[i + 1]) {
      ip = args[i + 1];
    }
  }

  ip ??= process.env.DRAGON_TOUCH_IP;
  const port = parseInt(process.env.DRAGON_TOUCH_PORT ?? "5555", 10);

  if (!ip) {
    process.stderr.write(
      [
        "Dragon Touch MCP — Error",
        "  Device IP is not configured.",
        "  Set the DRAGON_TOUCH_IP environment variable or pass --ip <address>.",
        "",
        "  Example (Claude Desktop config):",
        '    "env": { "DRAGON_TOUCH_IP": "192.168.178.132" }',
        "",
      ].join("\n")
    );
    process.exit(1);
  }

  return { ip, port };
}

// ─── Fail-fast startup checks ────────────────────────────────────────────────

async function validateSetup(config: AdbConfig): Promise<CheckResult> {
  const checkup = await runCheckup(config);
  if (!checkup.ready) {
    const failing = (
      [
        ["adb", checkup.adb],
        ["device IP", checkup.deviceIp],
        ["device reachable", checkup.deviceReachable],
        ["app installed", checkup.appInstalled],
      ] as const
    )
      .filter(([, v]) => !v.ok)
      .map(([k, v]) => `  ${k}: ${v.detail}`)
      .join("\n");
    process.stderr.write(`Dragon Touch MCP — Startup Error\n${failing}\n\n`);
    process.exit(1);
  }
  return checkup;
}

// ─── Command registry ─────────────────────────────────────────────────────────

const allCommands = [
  ...tabCliCommands,
  captureScreenCliCommand,
  getStatusCliCommand,
  getDeviceInfoCliCommand,
  getAppSettingsCliCommand,
  setBrightnessCliCommand,
  setVolumeCliCommand,
  getActiveTabCliCommand,
  calendarGetScheduleCliCommand,
  calendarSetViewCliCommand,
  calendarNavigateCliCommand,
  calendarSetFilterCliCommand,
];

// ─── MCP server registration ─────────────────────────────────────────────────

function registerMcpTools(server: McpServer, config: AdbConfig): void {
  for (const cmd of allCommands.filter((c) => c.name !== captureScreenCliCommand.name)) {
    const shape = cmd.schema instanceof z.ZodObject ? cmd.schema.shape : {};
    server.tool(cmd.name, cmd.description, shape, async (args: unknown) => {
      const result = await cmd.run(args, config);
      return { content: [{ type: "text" as const, text: JSON.stringify(result) }] };
    });
  }

  // capture_screen returns an image content type — registered separately
  server.tool(
    captureScreenCliCommand.name,
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
          { type: "image", data: base64, mimeType: "image/png" },
          { type: "text", text: JSON.stringify({ trace: trace.toJSON() }) },
        ],
      };
    }
  );
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const config = parseConfig();
  const { command, payload } = parseCliCommand();

  if (command !== undefined) {
    await runCli(allCommands, command, payload, config);
    return;
  }

  // MCP server mode
  const checkup = await validateSetup(config);
  process.stderr.write(formatCheckup(checkup) + "\n\n");

  // Pre-load orientation so first switchTab call skips the getOrientation round-trip
  await warmCache(config);

  const server = new McpServer({
    name: "dragon-touch-mcp",
    version: "0.1.0",
  });

  registerMcpTools(server, config);

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  process.stderr.write(`Dragon Touch MCP — Unhandled error: ${err}\n`);
  process.exit(1);
});
