# Calendar Tools — Design Spec
**Date:** 2026-03-29

## Overview

Add 4 new MCP tools for interacting with the calendar tab of the Dragon Touch app (`com.fujia.calendar`), discovered via live ADB UI exploration. Also harden all existing tools with consistent graceful error handling.

## Discovery Summary

Live ADB discovery (`uiautomator dump`) revealed the calendar tab has two distinct UI layers:

**Day view** (default): day navigation arrows (`lv_left`, `iv_right`), event list (`tv_event_name`, `iv_emoji`, `touch_check_event`), add button (`iv_add`).

**Week/Month/Schedule views** (opened by tapping the date header): accessed via `fl_type` dropdown with options Day / Week / Month / Schedule. All share `iv_left`/`iv_right` for period navigation and `fl_filter` for profile filtering.

**Filter panel** (`fl_filter`): shows family member profiles by `tv_category_name` (user-defined names, not localized). Each profile has an `opened` toggle. Profiles found: Familie, Kellin, Tilian, Nadine, Kathrin.

**View type selector** (`fl_type`): fixed dropdown with 4 options in stable order — Schedule (index 0), Day (index 1), Week (index 2), Month (index 3). "3Tag" appears to be a premium-only option, excluded.

## New Tools

### `calendar_get_schedule`
Reads all visible events from the current calendar view and returns structured data.

**Parameters:** none

**Flow:**
1. `ensureConnected` → `wakeScreen` → `dumpUiXml` (single dump)
2. Extract `state` from dump (tab via `rb_calendar1[checked]`, view via `tv_type`)
3. Dirty state check: if neither `fl_type` nor `lv_left` found → return error (day view uses `lv_left`; week/month/schedule use `fl_type`)
4. Parse events based on current view:
   - Day: `tv_event_name` + `iv_emoji` + `touch_check_event[checked]` + `tv_week`
   - Week: `tv_title` + `tv_time` + `tv_day` + `tv_week` + profile counters from `rv_chores`
   - Month: `tv_title` + `tv_time` + `tv_day` per slot
   - Schedule: `item_schedule_view` nodes

**Returns:**
```ts
{
  success: true,
  state: { tab: "calendar", view: "day" | "week" | "month" | "schedule" },
  period: string,        // e.g. "März 23-29" from tv_range
  events: Array<{
    title: string,
    time?: string,
    date?: string,
    emoji?: string,
    checked?: boolean,
    profile?: string,
  }>
}
```

---

### `calendar_set_view`
Switches the calendar to a specific view type.

**Parameters:** `view: "day" | "week" | "month" | "schedule"`

**Flow:**
1. `ensureConnected` → `wakeScreen` → `dumpUiXml` (single dump)
2. Extract state + dirty state check
3. Tab check: if `rb_calendar1` not checked → auto-switch + set `warning`
4. Find `fl_type` bounds → tap center
5. Wait → second dump to read dropdown items; match target view by finding the `title` node whose text corresponds to the requested view (implementation maps `view` enum to expected localized strings per locale — fallback: position-based with "3Tag" skipped if absent)
6. No verification dump — trust the tap

**Note on dump count:** 2 dumps — one for initial state check, one to read the dropdown items after tapping `fl_type`. Unavoidable.

**Returns:**
```ts
{
  success: true,
  state: { tab: "calendar", view: "day" | "week" | "month" | "schedule" },
  warning?: string,   // set if tab was auto-switched
}
```

---

### `calendar_navigate`
Moves the calendar forward or backward by one or more steps. Step unit adapts to the active view (day in day-view, week in week-view, month in month-view).

**Parameters:**
- `direction: "prev" | "next"`
- `steps?: number` (default: 1, max: 30)

**Flow:**
1. `ensureConnected` → `wakeScreen` → `dumpUiXml` (single dump)
2. Extract state + dirty state check
3. Tab check: if not on calendar → auto-switch + set `warning`
4. Find `iv_left` (prev) or `iv_right` (next) bounds → tap `steps` times with short delay between taps

**Returns:**
```ts
{
  success: true,
  state: { tab: "calendar", view: string },
  direction: "prev" | "next",
  steps: number,
  warning?: string,
}
```

---

### `calendar_set_filter`
Shows or hides family member profiles in the calendar filter panel.

**Parameters:** `profiles: string[]` — names of profiles to show. Empty array = show all.

**Flow:**
1. `ensureConnected` → `wakeScreen` → `dumpUiXml` (single dump)
2. Extract state + dirty state check
3. Tab check: if not on calendar → auto-switch + set `warning`
4. Find `fl_filter` bounds → tap to open panel
5. Wait → second dump to read `tv_category_name` nodes and `opened` toggle states
6. For each profile: if name in `profiles` (or `profiles` is empty) → ensure `opened` is active; otherwise ensure inactive. Tap toggle only if state needs to change.
7. Close panel with `keyevent BACK`

**Note:** Profile names are user-defined, not localized. Unknown names in `profiles` are silently ignored.

**Returns:**
```ts
{
  success: true,
  state: { tab: "calendar", view: string },
  active_profiles: string[],   // profiles now visible
  warning?: string,
}
```

**Note on dump count:** This tool makes 2 dumps — one before opening the filter (for state/tab check), one after opening it (to read profile toggle states). Unavoidable because the filter panel is a separate overlay.

---

## Shared Response Shape

All tools — new and existing — use this base shape:

```ts
{
  success: boolean,
  error?: string,        // present on failure
  warning?: string,      // present when state was auto-corrected
  state?: {
    tab: TabName,
    view?: string,       // present when known (calendar tools always set this)
  },
  // ...tool-specific fields
}
```

`state` is omitted by tools that make no UI dump (e.g. `set_brightness`, `set_volume`).

---

## Dirty State Detection

All calendar tools check for dirty state after the initial dump:

- Neither `fl_type` nor `lv_left` found → unexpected overlay or dialog open, or not on calendar tab
- Day view uses `lv_left`/`iv_right`; Week/Month/Schedule use `iv_left`/`iv_right` and expose `fl_type`

On dirty state: return `{ success: false, error: "Unexpected screen state — close any open dialogs and try again", state }`.

---

## Graceful Error Handling (All Tools)

All `run` functions — new and existing — are wrapped in a top-level try/catch:

```ts
async function run(args, config) {
  try {
    // ...logic...
    return { success: true, ... };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}
```

Tools that already have partial error handling (`capture_screen`, `tab_tools`) are unified to this shape.

---

## File Structure

```
src/tools/
  calendar_helpers.ts          # internal shared logic (not exported as CLI command)
  calendar_get_schedule.ts
  calendar_set_view.ts
  calendar_navigate.ts
  calendar_set_filter.ts
```

`calendar_helpers.ts` provides:
- `dumpAndExtractState(config)` → `{ nodes, state, isDirty }`
- `tapByResourceId(resourceId, nodes, config)` → taps center of first matching node
- `extractState(nodes)` → reads `rb_*[checked]` and `tv_type`

---

## ADB Primitives

No new ADB functions needed. All operations use existing primitives from `adb.ts`:
- `ensureConnected`, `wakeScreen`, `dumpUiXml`, `tap`

---

## Out of Scope

- Creating/editing events (requires dialog interaction with text input — separate spec)
- Meals, Lists, Sleep, Photos tabs (separate spec)
- "3Tag" view (appears to be premium-gated)
- Reading event detail on tap (separate spec)
