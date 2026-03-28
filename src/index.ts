#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { AdbConfig } from "./adb.js";
import { CheckResult, formatCheckup, runCheckup, warmCache } from "./tablet.js";
import { registerTabTools } from "./tools/tab_tools.js";
import { registerGetStatus } from "./tools/get_status.js";
import { registerCaptureScreen } from "./tools/capture_screen.js";

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

// ─── Main ────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const config = parseConfig();

  const checkup = await validateSetup(config);
  process.stderr.write(formatCheckup(checkup) + "\n\n");

  // Pre-load orientation so first switchTab call skips the getOrientation round-trip
  await warmCache(config);

  // Start MCP server
  const server = new McpServer({
    name: "dragon-touch-mcp",
    version: "0.1.0",
  });

  registerGetStatus(server, config);
  registerTabTools(server, config);
  registerCaptureScreen(server, config);

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  process.stderr.write(`Dragon Touch MCP — Unhandled error: ${err}\n`);
  process.exit(1);
});
