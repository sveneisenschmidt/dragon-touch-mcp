# dragon-touch-mcp

Control a Dragon Touch Android tablet from Claude over ADB via Wi-Fi.

Developed on the 27" TM27 model — should work on other Dragon Touch sizes (21", 32", etc.) since tab switching is based on Android resource IDs, not hardcoded coordinates.

![MCP Inspector showing all tools connected and get_status returning READY](docs/screenshot.png)

## Requirements

- Node.js 18+
- `adb` in PATH — [Android SDK Platform Tools](https://developer.android.com/tools/releases/platform-tools) (macOS: `brew install android-platform-tools`)
- Tablet on the same Wi-Fi network with ADB over network enabled

## Setup

```bash
npm install
npm run build
```

## Add to Claude Desktop

Config file location:
- **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`
- **Linux**: `~/.config/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "dragon-touch": {
      "command": "node",
      "args": ["/path/to/dragon-touch-mcp/dist/index.js"],
      "env": {
        "DRAGON_TOUCH_IP": "192.168.178.132"
      }
    }
  }
}
```

Or pass the IP directly:

```bash
node dist/index.js --ip 192.168.178.132
```

| Variable | Default | Description |
|---|---|---|
| `DRAGON_TOUCH_IP` | — | Tablet IP address (required) |
| `DRAGON_TOUCH_PORT` | `5555` | ADB port |

## Tools

| Tool | Description |
|---|---|
| `get_status` | Check adb, device connectivity, and app installation |
| `capture_screen` | Take a screenshot of the tablet |
| `show_calendar` | Switch to Calendar tab |
| `show_tasks` | Switch to Tasks tab |
| `show_day` | Switch to Day tab |
| `show_meals` | Switch to Meals tab |
| `show_photos` | Switch to Photos tab |
| `show_lists` | Switch to Lists tab |
| `show_sleep` | Switch to Sleep tab |
| `show_goal` | Switch to Goal tab |

Tab switching uses Android resource IDs — works regardless of screen rotation or app language.

## CLI Usage

Every tool is also available as a CLI command — useful for scripting and automation without an MCP client.

```bash
# No payload needed
DRAGON_TOUCH_IP=192.168.178.132 npm run cli -- show_calendar
DRAGON_TOUCH_IP=192.168.178.132 npm run cli -- get_status

# With --ip flag
npm run cli -- --ip 192.168.178.132 show_tasks

# capture_screen saves a PNG file (default: ./dragon-touch-capture.png)
DRAGON_TOUCH_IP=192.168.178.132 npm run cli -- capture_screen
DRAGON_TOUCH_IP=192.168.178.132 npm run cli -- capture_screen '{"output": "/tmp/shot.png"}'
```

All commands output JSON to stdout and errors to stderr. Exit code `0` on success, `1` on error.

## Development

```bash
npm run build       # compile TypeScript
npm test            # run unit tests
npm run inspect     # MCP Inspector at http://localhost:5173
npm run dev         # watch mode
```

On macOS/Linux a `Makefile` is also available with the same targets plus `make clean`.

## Contributing

See [AGENTS.md](AGENTS.md) for architecture and conventions.

## License

MIT
