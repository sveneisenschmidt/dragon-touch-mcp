// Copyright (c) 2025 Sven Eisenschmidt. Licensed under the MIT License.
import { describe, it, expect, vi, beforeEach } from "vitest";
import { formatCheckup, getActiveTab, type CheckResult } from "../tablet.js";

vi.mock("../adb.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../adb.js")>();
  return {
    ...actual,
    ensureConnected: vi.fn(),
    dumpUiXml: vi.fn(),
  };
});

import { ensureConnected, dumpUiXml } from "../adb.js";

const mockEnsureConnected = vi.mocked(ensureConnected);
const mockDumpUiXml = vi.mocked(dumpUiXml);

const CONFIG = { ip: "192.168.1.100", port: 5555 };

function makeTabXml(checkedTab: string): string {
  const tabs = [
    ["com.fujia.calendar:id/rb_calendar1", "false"],
    ["com.fujia.calendar:id/rb_chores1",   "false"],
    ["com.fujia.calendar:id/rb_reward1",   "false"],
    ["com.fujia.calendar:id/rb_meals1",    "false"],
    ["com.fujia.calendar:id/rb_photos1",   "false"],
    ["com.fujia.calendar:id/rb_lists1",    "false"],
    ["com.fujia.calendar:id/rb_steep1",    "false"],
    ["com.fujia.calendar:id/rb_settings1", "false"],
  ].map(([id, _]) => `<node resource-id="${id}" checked="${id === checkedTab ? "true" : "false"}" bounds="[0,0][100,100]" />`);
  return `<?xml version="1.0" encoding="UTF-8"?><hierarchy>${tabs.join("")}</hierarchy>`;
}

describe("getActiveTab", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockEnsureConnected.mockResolvedValue(true);
  });

  it("returns the active tab when one is checked", async () => {
    mockDumpUiXml.mockResolvedValue(makeTabXml("com.fujia.calendar:id/rb_calendar1"));
    const result = await getActiveTab(CONFIG);
    expect(result).toEqual({ success: true, tab: "calendar" });
  });

  it("detects each tab correctly", async () => {
    const cases: [string, string][] = [
      ["com.fujia.calendar:id/rb_calendar1", "calendar"],
      ["com.fujia.calendar:id/rb_chores1",   "tasks"],
      ["com.fujia.calendar:id/rb_reward1",   "day"],
      ["com.fujia.calendar:id/rb_meals1",    "meals"],
      ["com.fujia.calendar:id/rb_photos1",   "photos"],
      ["com.fujia.calendar:id/rb_lists1",    "lists"],
      ["com.fujia.calendar:id/rb_steep1",    "sleep"],
      ["com.fujia.calendar:id/rb_settings1", "goal"],
    ];
    for (const [resourceId, tab] of cases) {
      mockDumpUiXml.mockResolvedValue(makeTabXml(resourceId));
      const result = await getActiveTab(CONFIG);
      expect(result).toEqual({ success: true, tab });
    }
  });

  it("returns error when device is not reachable", async () => {
    mockEnsureConnected.mockResolvedValue(false);
    const result = await getActiveTab(CONFIG);
    expect(result.success).toBe(false);
    expect((result as { success: false; error: string }).error).toContain("192.168.1.100:5555");
  });

  it("returns error when UI dump fails", async () => {
    mockDumpUiXml.mockRejectedValue(new Error("adb timeout"));
    const result = await getActiveTab(CONFIG);
    expect(result.success).toBe(false);
    expect((result as { success: false; error: string }).error).toContain("adb timeout");
  });

  it("returns error when no tab is checked", async () => {
    mockDumpUiXml.mockResolvedValue(`<?xml version="1.0"?><hierarchy></hierarchy>`);
    const result = await getActiveTab(CONFIG);
    expect(result.success).toBe(false);
    expect((result as { success: false; error: string }).error).toContain("No active tab found");
  });
});

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
