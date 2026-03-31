// Copyright (c) 2025 Sven Eisenschmidt. Licensed under the MIT License.
import { describe, it, expect } from "vitest";
import { navigateSchema } from "../tools/calendar_navigate.js";
import { setViewSchema } from "../tools/calendar_set_view.js";
import { setFilterSchema } from "../tools/calendar_set_filter.js";

// ─── calendar_navigate schema ─────────────────────────────────────────────────

describe("calendar_navigate schema", () => {
  it("accepts valid direction", () => {
    expect(() => navigateSchema.parse({ direction: "next" })).not.toThrow();
    expect(() => navigateSchema.parse({ direction: "prev" })).not.toThrow();
  });

  it("defaults steps to 1", () => {
    expect(navigateSchema.parse({ direction: "next" }).steps).toBe(1);
  });

  it("rejects steps above max", () => {
    expect(() => navigateSchema.parse({ direction: "next", steps: 11 })).toThrow();
  });

  it("rejects steps below 1", () => {
    expect(() => navigateSchema.parse({ direction: "next", steps: 0 })).toThrow();
  });

  it("rejects invalid direction", () => {
    expect(() => navigateSchema.parse({ direction: "forward" })).toThrow();
  });
});

// ─── calendar_set_view schema ─────────────────────────────────────────────────

describe("calendar_set_view schema", () => {
  it("accepts all valid view types", () => {
    for (const view of ["day", "week", "month", "schedule"] as const) {
      expect(() => setViewSchema.parse({ view })).not.toThrow();
    }
  });

  it("rejects invalid view", () => {
    expect(() => setViewSchema.parse({ view: "3day" })).toThrow();
  });
});

// ─── calendar_set_filter schema ───────────────────────────────────────────────

describe("calendar_set_filter schema", () => {
  it("accepts empty array (show all)", () => {
    expect(() => setFilterSchema.parse({ profiles: [] })).not.toThrow();
  });

  it("accepts profile name array", () => {
    expect(() => setFilterSchema.parse({ profiles: ["Kellin", "Tilian"] })).not.toThrow();
  });

  it("rejects missing profiles field", () => {
    expect(() => setFilterSchema.parse({})).toThrow();
  });
});
