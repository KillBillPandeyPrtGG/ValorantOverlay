function parseTrackingDayResetTime(value, fallback = "00:00") {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  const match = /^(\d{1,2}):(\d{2})$/.exec(trimmed);
  if (!match) return fallback;

  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (!Number.isInteger(hours) || !Number.isInteger(minutes)) return fallback;
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return fallback;

  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

function parseOverlayBackgroundTheme(value, fallback = "solid") {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "solid" || normalized === "transparent" || normalized === "glass") {
    return normalized;
  }
  return fallback;
}

function getTrackingWindowStart(now, trackingDayResetTime, fallback = "00:00") {
  const [hoursRaw, minutesRaw] = parseTrackingDayResetTime(trackingDayResetTime, fallback).split(":");
  const hours = Number(hoursRaw);
  const minutes = Number(minutesRaw);

  const start = new Date(now);
  start.setSeconds(0, 0);
  start.setHours(hours, minutes, 0, 0);

  if (now < start) {
    start.setDate(start.getDate() - 1);
  }

  return start;
}

function getMatchTimestamp(match) {
  const metadata = match?.metadata || {};
  const candidates = [
    metadata.game_start,
    metadata.started_at,
    metadata.game_start_patched,
    match?.started_at
  ];

  for (const candidate of candidates) {
    if (typeof candidate === "number" && Number.isFinite(candidate)) {
      const ms = candidate > 1e12 ? candidate : candidate * 1000;
      const parsed = new Date(ms);
      if (!Number.isNaN(parsed.getTime())) {
        return parsed;
      }
    }

    if (typeof candidate === "string" && candidate.trim()) {
      const parsed = new Date(candidate);
      if (!Number.isNaN(parsed.getTime())) {
        return parsed;
      }
    }
  }

  return null;
}

module.exports = {
  parseTrackingDayResetTime,
  parseOverlayBackgroundTheme,
  getTrackingWindowStart,
  getMatchTimestamp
};