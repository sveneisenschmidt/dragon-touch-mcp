import { ZodTypeAny } from "zod";
import { AdbConfig } from "./adb.js";

export interface CliCommand {
  name: string;
  description: string;
  schema: ZodTypeAny;
  run(args: unknown, config: AdbConfig): Promise<unknown>;
}

/**
 * Parse process.argv to extract the CLI command name and optional JSON payload,
 * skipping known flags and their values (e.g. --ip <addr>).
 */
export function parseCliCommand(): { command: string | undefined; payload: string | undefined } {
  const args = process.argv.slice(2);
  const positional: string[] = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--ip") {
      i++; // skip value
    } else if (!args[i].startsWith("-")) {
      positional.push(args[i]);
    }
  }
  return { command: positional[0], payload: positional[1] };
}

export async function runCli(
  commands: CliCommand[],
  commandName: string,
  rawPayload: string | undefined,
  config: AdbConfig
): Promise<void> {
  const cmd = commands.find((c) => c.name === commandName);
  if (!cmd) {
    const list = commands.map((c) => `  ${c.name.padEnd(20)} ${c.description}`).join("\n");
    process.stderr.write(
      `Dragon Touch — Unknown command: "${commandName}"\n\nAvailable commands:\n${list}\n`
    );
    process.exit(1);
  }

  let payload: unknown = {};
  if (rawPayload !== undefined) {
    try {
      payload = JSON.parse(rawPayload);
    } catch {
      process.stderr.write(`Dragon Touch — Invalid JSON payload: ${rawPayload}\n`);
      process.exit(1);
    }
  }

  const parsed = cmd.schema.safeParse(payload);
  if (!parsed.success) {
    process.stderr.write(
      `Dragon Touch — Invalid payload for "${commandName}":\n${parsed.error.message}\n`
    );
    process.exit(1);
  }

  try {
    const result = await cmd.run(parsed.data, config);
    process.stdout.write(JSON.stringify(result, null, 2) + "\n");
  } catch (err) {
    process.stderr.write(
      `Dragon Touch — Command failed: ${err instanceof Error ? err.message : String(err)}\n`
    );
    process.exit(1);
  }
}
