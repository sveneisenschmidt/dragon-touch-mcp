# AGENTS.md — dragon-touch-mcp

Context and conventions for AI coding agents working in this repository.

## What This Project Does

`dragon-touch-mcp` is a TypeScript MCP (Model Context Protocol) server that controls a Dragon Touch 27" Android tablet (model TM27, Android 10) over ADB via Wi-Fi. It exposes MCP tools that Claude can call to switch views on the tablet.

**Tech stack:** Node.js 18+, TypeScript (ESM), `@modelcontextprotocol/sdk`, ADB (Android Debug Bridge)

## Architecture

```
src/
├── index.ts          Entry point. Detects CLI vs MCP mode, parses config,
│                     runs fail-fast startup checks (MCP only), starts server.
├── cli.ts            CLI dispatcher. CliCommand interface, parseCliCommand(),
│                     runCli() — validates JSON payload via Zod, prints JSON to stdout.
├── adb.ts            Low-level ADB abstraction. All exec() calls go here.
│                     Functions: checkAdbAvailable, connectDevice, getDeviceState,
│                     ensureConnected, isPackageInstalled, wakeScreen, tap,
│                     dumpUiXml, captureScreen, findElementCenter
├── tablet.ts         Tablet-level operations built on top of adb.ts.
│                     Functions: runCheckup, formatCheckup, switchTab, warmCache, clearTabCache
│                     Constants: TARGET_APP, TAB_RESOURCE_IDS
├── trace.ts          Per-call timing trace. Trace.mark(step) records elapsed ms.
│                     toJSON() returns { steps, total_ms } included in every tool response.
├── test/
│   ├── adb.test.ts     Unit tests for findElementCenter (pure function, no device)
│   ├── trace.test.ts   Unit tests for Trace class
│   └── tablet.test.ts  Unit tests for formatCheckup
└── tools/
    ├── get_status.ts     MCP tool + CLI command: runs checkup, returns structured JSON
    ├── tab_tools.ts      MCP tools + CLI commands: all 8 tab-switch tools via shared TAB_DEFS
    └── capture_screen.ts MCP tool + CLI command: screenshot; CLI saves PNG to file
```

## Dev Workflow

```bash
npm install          # install dependencies
npm run build        # compile TypeScript → dist/
npm run dev          # watch mode with tsx (no build step)
npm test             # run unit tests (vitest, no device required)
npm run test:watch   # vitest in watch mode during development

# Test tools interactively with the MCP inspector:
make inspect         # sets DRAGON_TOUCH_IP and opens the inspector UI
```

## Key Conventions

### ADB Command Structure

All ADB commands go through `adb.ts`. Never call `exec("adb ...")` directly in other files.

- `adbExec(args, config)` — runs `adb -s <ip>:<port> <args>`
- Device is always addressed as `<ip>:<port>` (never by USB serial)
- Commands that may fail should be wrapped in try/catch and return `null` / `false`

### Error Handling

- **Startup** (`index.ts`): fail-fast via `process.exit(1)` with a clear message to stderr
- **Tool handlers**: never throw — catch all errors and return `{ success: false, error: "..." }`
- **adb.ts functions**: return `null` / `false` on failure, never throw (except `adbExec` which throws on non-zero exit)

### Tab Switching — How It Works

Tabs are identified by Android **resource IDs**, not by text or pixel coordinates:
- Calendar: `com.fujia.calendar:id/rb_calendar1`
- Tasks: `com.fujia.calendar:id/rb_chores1`
- (and 6 more — see `TAB_RESOURCE_IDS` in `tablet.ts`)

Flow: `uiautomator dump` → read XML via `adb shell cat` → parse bounds → calculate center → tap

Tab coordinates are cached in memory after the first dump. The cache is invalidated when the screen orientation changes (checked via `settings get system user_rotation` on each call). Cache hit path skips the dump entirely (~2.3s saved).

This approach is rotation-safe and language-independent.

### Adding a New Tool

1. Find the resource ID of the target UI element via `adb shell uiautomator dump`
2. Create `src/tools/<tool_name>.ts` with two exports:
   - `register<ToolName>(server, config)` — MCP registration, calls `server.tool(name, description, zodSchema, handler)`
   - `<toolName>CliCommand: CliCommand` — CLI entry with the same Zod schema and a `run()` function that returns plain JSON
3. Import and wire both in `src/index.ts`:
   - Call `register<ToolName>(server, config)` in the MCP block
   - Add `<toolName>CliCommand` to the `allCommands` array in the CLI block
4. CLI output must always be a plain JSON-serialisable value (no MCP content envelope)

## Known Constraints

- **Android 10 background launch restrictions**: Apps cannot be launched from the background without `SYSTEM_ALERT_WINDOW`. The `am start` intent approach for tab switching is unreliable; `uiautomator` + `input tap` is the correct method.
- **uiautomator timing**: The XML dump takes ~300–800ms. If the app is animating or loading, the dump may miss elements. A retry with a short sleep is acceptable if needed.
- **ADB connection drops**: Tablets can disconnect from ADB after sleep. `ensureConnected()` in `adb.ts` handles reconnection transparently before each tool call.
- **Language independence**: The app (`com.fujia.calendar`) supports multiple languages. Always use resource IDs, never element text, for UI targeting.
- **Single device**: This server is designed for a single preconfigured device. Multi-device support is out of scope for v0.1.
