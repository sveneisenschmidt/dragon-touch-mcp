import { describe, it, expect } from "vitest";
import { findElementCenter } from "../adb.js";

const SAMPLE_XML = `<?xml version="1.0" encoding="UTF-8"?>
<hierarchy rotation="0">
  <node resource-id="com.fujia.calendar:id/rb_calendar1" bounds="[0,1805][135,1920]" />
  <node resource-id="com.fujia.calendar:id/rb_chores1" bounds="[135,1805][270,1920]" />
  <node resource-id="com.fujia.calendar:id/rb_meals1" bounds="[405,1805][540,1920]" />
  <node resource-id="com.example:id/special.chars-id" bounds="[0,0][100,100]" />
</hierarchy>`;

describe("findElementCenter", () => {
  it("returns center of first tab", () => {
    const result = findElementCenter(SAMPLE_XML, "com.fujia.calendar:id/rb_calendar1");
    expect(result).toEqual({ x: 67, y: 1862 });
  });

  it("returns center of second tab", () => {
    const result = findElementCenter(SAMPLE_XML, "com.fujia.calendar:id/rb_chores1");
    expect(result).toEqual({ x: 202, y: 1862 });
  });

  it("returns center of element with non-zero x origin", () => {
    const result = findElementCenter(SAMPLE_XML, "com.fujia.calendar:id/rb_meals1");
    expect(result).toEqual({ x: 472, y: 1862 });
  });

  it("returns null when resource ID is not found", () => {
    const result = findElementCenter(SAMPLE_XML, "com.fujia.calendar:id/nonexistent");
    expect(result).toBeNull();
  });

  it("returns null on empty XML", () => {
    expect(findElementCenter("", "com.fujia.calendar:id/rb_calendar1")).toBeNull();
  });

  it("handles resource IDs with regex special characters", () => {
    const result = findElementCenter(SAMPLE_XML, "com.example:id/special.chars-id");
    expect(result).toEqual({ x: 50, y: 50 });
  });

  it("floors fractional center coordinates", () => {
    const xml = `<node resource-id="a:id/b" bounds="[0,0][101,101]" />`;
    const result = findElementCenter(xml, "a:id/b");
    expect(result).toEqual({ x: 50, y: 50 });
  });
});
