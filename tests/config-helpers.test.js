const test = require("node:test");
const assert = require("node:assert/strict");

const {
  parseTrackingDayResetTime,
  parseOverlayBackgroundTheme,
  getTrackingWindowStart,
  getMatchTimestamp
} = require("../utils/config-helpers");

test("parseTrackingDayResetTime accepts valid HH:MM and normalizes zero padding", () => {
  assert.equal(parseTrackingDayResetTime("7:30"), "07:30");
  assert.equal(parseTrackingDayResetTime("23:59"), "23:59");
});

test("parseTrackingDayResetTime falls back for invalid values", () => {
  assert.equal(parseTrackingDayResetTime("24:00"), "00:00");
  assert.equal(parseTrackingDayResetTime("ab:cd"), "00:00");
  assert.equal(parseTrackingDayResetTime(undefined), "00:00");
});

test("parseOverlayBackgroundTheme validates allowed values and falls back", () => {
  assert.equal(parseOverlayBackgroundTheme("glass"), "glass");
  assert.equal(parseOverlayBackgroundTheme("transparent"), "transparent");
  assert.equal(parseOverlayBackgroundTheme("unknown"), "solid");
});

test("getTrackingWindowStart uses current day when now is after reset", () => {
  const now = new Date(2026, 3, 18, 10, 15, 0, 0);
  const start = getTrackingWindowStart(now, "07:30");
  assert.equal(start.getHours(), 7);
  assert.equal(start.getMinutes(), 30);
  assert.equal(start.getFullYear(), now.getFullYear());
  assert.equal(start.getMonth(), now.getMonth());
  assert.equal(start.getDate(), now.getDate());
});

test("getTrackingWindowStart uses previous day when now is before reset", () => {
  const now = new Date(2026, 3, 18, 4, 15, 0, 0);
  const start = getTrackingWindowStart(now, "07:30");
  const previousDay = new Date(now);
  previousDay.setDate(previousDay.getDate() - 1);

  assert.equal(start.getHours(), 7);
  assert.equal(start.getMinutes(), 30);
  assert.equal(start.getFullYear(), previousDay.getFullYear());
  assert.equal(start.getMonth(), previousDay.getMonth());
  assert.equal(start.getDate(), previousDay.getDate());
});

test("getMatchTimestamp parses epoch seconds, epoch milliseconds, and ISO strings", () => {
  const fromSeconds = getMatchTimestamp({ metadata: { game_start: 1710000000 } });
  assert.equal(fromSeconds.toISOString(), "2024-03-09T16:00:00.000Z");

  const fromMs = getMatchTimestamp({ metadata: { game_start: 1710000000000 } });
  assert.equal(fromMs.toISOString(), "2024-03-09T16:00:00.000Z");

  const fromIso = getMatchTimestamp({ metadata: { started_at: "2026-04-18T12:00:00.000Z" } });
  assert.equal(fromIso.toISOString(), "2026-04-18T12:00:00.000Z");
});

test("getMatchTimestamp returns null when no valid timestamp exists", () => {
  assert.equal(getMatchTimestamp({ metadata: { game_start: "not-a-time" } }), null);
  assert.equal(getMatchTimestamp({}), null);
});
