# dragon-touch-mcp

Control a Dragon Touch Android tablet from Claude over ADB via Wi-Fi.

Developed on the 27" TM27 model — should work on other Dragon Touch sizes (21", 32", etc.) since tab switching is based on Android resource IDs, not hardcoded coordinates.

![MCP Inspector showing all tools connected and get_status returning READY](docs/screenshot.png)

## Requirements

- Node.js 18+
- `adb` in PATH — `brew install android-platform-tools`
- Tablet on the same Wi-Fi network with ADB over network enabled
- `com.fujia.calendar` installed on the tablet

## Setup

```bash
npm install
make build
```

## Add to Claude Desktop

`~/Library/Application Support/Claude/claude_desktop_config.json`:

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

## Development

```bash
make build      # compile TypeScript
make test       # smoke tests
make inspect    # MCP Inspector at http://localhost:5173
make dev        # watch mode
make clean      # delete dist/
```

```bash
make test DRAGON_TOUCH_IP=192.168.1.50   # override IP
```

## Contributing

See [AGENTS.md](AGENTS.md) for architecture and conventions.

## License

MIT
