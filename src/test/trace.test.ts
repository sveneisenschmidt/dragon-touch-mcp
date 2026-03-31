// Copyright (c) 2025 Sven Eisenschmidt. Licensed under the MIT License.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Trace } from "../trace.js";

describe("Trace", () => {
  beforeEach(() => {
    let t = 0;
    vi.spyOn(performance, "now").mockImplementation(() => t += 100);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("records steps with elapsed ms", () => {
    const trace = new Trace();
    trace.mark("a");
    trace.mark("b");
    const result = trace.toJSON();
    expect(result.steps).toEqual([
      { step: "a", ms: 100 },
      { step: "b", ms: 100 },
    ]);
  });

  it("computes total_ms as sum of steps", () => {
    const trace = new Trace();
    trace.mark("x");
    trace.mark("y");
    trace.mark("z");
    expect(trace.toJSON().total_ms).toBe(300);
  });

  it("returns empty steps before any mark", () => {
    const trace = new Trace();
    expect(trace.toJSON()).toEqual({ steps: [], total_ms: 0 });
  });

  it("total getter matches total_ms", () => {
    const trace = new Trace();
    trace.mark("a");
    trace.mark("b");
    const result = trace.toJSON();
    expect(result.total_ms).toBe(trace.total);
  });
});
