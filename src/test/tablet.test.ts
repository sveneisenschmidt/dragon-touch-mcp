import { describe, it, expect } from "vitest";
import { formatCheckup, type CheckResult } from "../tablet.js";

function makeResult(overrides: Partial<CheckResult> = {}): CheckResult {
  return {
    adb: { ok: true, detail: "Android Debug Bridge version 35.0.2" },
    deviceIp: { ok: true, detail: "192.168.1.100:5555" },
    deviceReachable: { ok: true, detail: "online (state: device)" },
    appInstalled: { ok: true, detail: "com.fujia.calendar found" },
    ready: true,
    ...overrides,
  };
}

describe("formatCheckup", () => {
  it("shows READY when all checks pass", () => {
    const output = formatCheckup(makeResult());
    expect(output).toContain("Status: READY");
    expect(output).not.toContain("NOT READY");
  });

  it("shows NOT READY when ready is false", () => {
    const output = formatCheckup(makeResult({ ready: false }));
    expect(output).toContain("NOT READY");
  });

  it("shows ✓ for passing checks", () => {
    const output = formatCheckup(makeResult());
    expect(output).toContain("✓ Android Debug Bridge");
    expect(output).toContain("✓ 192.168.1.100:5555");
    expect(output).toContain("✓ online (state: device)");
    expect(output).toContain("✓ com.fujia.calendar found");
  });

  it("shows ✗ for failing checks", () => {
    const output = formatCheckup(makeResult({
      adb: { ok: false, detail: "not found in PATH — run: brew install android-platform-tools" },
      ready: false,
    }));
    expect(output).toContain("✗ not found in PATH");
  });

  it("includes the header line", () => {
    const output = formatCheckup(makeResult());
    expect(output).toContain("Dragon Touch MCP — Startup Check");
  });
});
