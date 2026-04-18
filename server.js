const fs = require("fs");
const fsp = fs.promises;
const path = require("path");
const express = require("express");
const fetch = require("node-fetch");

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const CONFIG_PATH = "./config.json";
const AGENT_ICON_CACHE_DIR = path.join(__dirname, "overlay", "cache", "agent-icons");

try {
  fs.mkdirSync(AGENT_ICON_CACHE_DIR, { recursive: true });
} catch (e) {
  console.warn("Unable to create agent icon cache directory:", e.message);
}

app.use(express.json());

const defaultConfig = {
  player: { name: "CalmAimer", tag: "3973", region: "ap" },
  apiKey: "HDEV-632cdd82-0292-44de-be24-2ca1315cf52c",
  pollIntervalMs: 30000,
  trackingDayResetTime: "00:00",
  rankImageBasePath: "/assets/rank-images/",
  showPlayerId: false,
  rankAnimationIntervalSec: 15,
  backgroundColor: "#0c0f1b",
  textColor: "#eef2ff",
  borderStyle: "solid",
  transparentOverlay: false,
  showConnection: true,
  showLastUpdated: true,
  showAgentIcons: true,
  maxMatchResults: 10
};

let config = { ...defaultConfig };

try {
  if (fs.existsSync(CONFIG_PATH)) {
    const raw = fs.readFileSync(CONFIG_PATH, "utf8");
    const userConfig = JSON.parse(raw);
    config = {
      ...config,
      ...userConfig,
      player: { ...config.player, ...(userConfig.player || {}) }
    };
  }
} catch (e) {
  console.warn("Unable to read config.json:", e.message);
}

// Ensure newly introduced keys persist even when older config.json files are loaded.
try {
  let normalized = false;
  if (typeof config.transparentOverlay !== "boolean") {
    config.transparentOverlay = false;
    normalized = true;
  }
  if (typeof config.showConnection !== "boolean") {
    config.showConnection = true;
    normalized = true;
  }
  if (typeof config.showLastUpdated !== "boolean") {
    config.showLastUpdated = true;
    normalized = true;
  }
  if (typeof config.showAgentIcons !== "boolean") {
    config.showAgentIcons = true;
    normalized = true;
  }
  const normalizedTrackingDayResetTime = parseTrackingDayResetTime(config.trackingDayResetTime);
  if (config.trackingDayResetTime !== normalizedTrackingDayResetTime) {
    config.trackingDayResetTime = normalizedTrackingDayResetTime;
    normalized = true;
  }
  const normalizedPoll = getConfiguredPollIntervalMs();
  if (config.pollIntervalMs !== normalizedPoll) {
    config.pollIntervalMs = normalizedPoll;
    normalized = true;
  }
  if (!Number.isFinite(Number(config.maxMatchResults))) {
    config.maxMatchResults = 10;
    normalized = true;
  } else {
    const clamped = Math.max(1, Math.min(12, Math.floor(Number(config.maxMatchResults))));
    if (clamped !== config.maxMatchResults) {
      config.maxMatchResults = clamped;
      normalized = true;
    }
  }
  if (normalized) {
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
  }
} catch (e) {
  console.warn("Unable to normalize config.json:", e.message);
}

const API_BASE = "https://api.henrikdev.xyz/valorant";

let pollTimer = null;
let rateLimitedUntil = 0;
let consecutiveRateLimits = 0;

function getConfiguredPollIntervalMs() {
  const parsed = Number(config.pollIntervalMs);
  if (!Number.isFinite(parsed)) return defaultConfig.pollIntervalMs;
  return Math.max(10000, Math.min(300000, Math.floor(parsed)));
}

function parseRetryAfterMs(response) {
  const fallbackMs = 60000;
  const retryAfterRaw = response.headers.get("retry-after");
  if (!retryAfterRaw) return fallbackMs;

  const seconds = Number(retryAfterRaw);
  if (Number.isFinite(seconds) && seconds >= 0) {
    return Math.max(1000, Math.floor(seconds * 1000));
  }

  const retryDate = new Date(retryAfterRaw).getTime();
  if (!Number.isNaN(retryDate)) {
    return Math.max(1000, retryDate - Date.now());
  }

  return fallbackMs;
}

function parseTrackingDayResetTime(value) {
  const fallback = defaultConfig.trackingDayResetTime;
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

function getTrackingWindowStart(now, trackingDayResetTime) {
  const [hoursRaw, minutesRaw] = parseTrackingDayResetTime(trackingDayResetTime).split(":");
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

async function fetchJsonOrThrow(url) {
  const response = await fetch(url);
  let json;
  try {
    json = await response.json();
  } catch {
    json = null;
  }

  if (response.status === 429) {
    const rateLimitError = new Error("Rate limit exceeded");
    rateLimitError.code = "RATE_LIMIT";
    rateLimitError.retryAfterMs = parseRetryAfterMs(response);
    rateLimitError.details = json;
    throw rateLimitError;
  }

  if (!response.ok) {
    const message = json?.errors?.[0]?.message || `HTTP ${response.status}`;
    const httpError = new Error(message);
    httpError.code = "HTTP_ERROR";
    httpError.status = response.status;
    throw httpError;
  }

  return json;
}

function resolveRankImageDir(imageBasePath) {
  if (typeof imageBasePath !== "string" || imageBasePath.trim() === "") {
    return null;
  }

  if (imageBasePath.startsWith("file:///")) {
    try {
      const fileUrl = new URL(imageBasePath);
      return path.normalize(decodeURIComponent(fileUrl.pathname.replace(/^\//, "")));
    } catch {
      return null;
    }
  }

  if (/^[a-zA-Z]:\\/.test(imageBasePath) || imageBasePath.startsWith("\\\\")) {
    return path.normalize(imageBasePath);
  }

  return null;
}

function getPublicRankImageBasePath(imageBasePath) {
  const localDir = resolveRankImageDir(imageBasePath);
  if (localDir) {
    return "/rank-images/";
  }
  return imageBasePath || defaultConfig.rankImageBasePath;
}

const rankImageDir = resolveRankImageDir(config.rankImageBasePath);
if (rankImageDir && fs.existsSync(rankImageDir)) {
  app.use("/rank-images", express.static(rankImageDir));
} else if (rankImageDir) {
  console.warn("Rank image directory not found:", rankImageDir);
}

let cache = {
  rank: null,
  matches: [],
  stats: { wins: 0, losses: 0, streak: 0, type: null },
  lastUpdated: null,
  status: "loading",
  message: "Waiting for first update...",
  imagePath: getPublicRankImageBasePath(config.rankImageBasePath),
  player: config.player,
  backgroundColor: config.backgroundColor,
  textColor: config.textColor,
  borderStyle: config.borderStyle,
  transparentOverlay: config.transparentOverlay === true,
  showAgentIcons: config.showAgentIcons !== false,
  trackingDayResetTime: parseTrackingDayResetTime(config.trackingDayResetTime)
};

app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  next();
});

app.options("*", (req, res) => res.sendStatus(204));

app.use(express.static(path.join(__dirname, "overlay"), {
  etag: false,
  lastModified: false,
  setHeaders: (res) => {
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
  }
}));
app.use("/agent-icons", express.static(AGENT_ICON_CACHE_DIR));

function getAgentIconCacheName(agentIconUrl) {
  if (typeof agentIconUrl !== "string" || !agentIconUrl) return null;
  try {
    const parsed = new URL(agentIconUrl);
    const parts = parsed.pathname.split("/").filter(Boolean);
    const agentsIndex = parts.findIndex(part => part === "agents");
    const agentId = agentsIndex >= 0 ? parts[agentsIndex + 1] : null;
    const extension = path.extname(parsed.pathname) || ".png";
    if (!agentId) return null;
    return `${agentId}${extension}`;
  } catch {
    return null;
  }
}

async function resolveCachedAgentIconUrl(agentIconUrl) {
  if (typeof agentIconUrl !== "string" || !agentIconUrl) {
    return null;
  }

  const cacheName = getAgentIconCacheName(agentIconUrl);
  if (!cacheName) {
    return agentIconUrl;
  }

  const targetPath = path.join(AGENT_ICON_CACHE_DIR, cacheName);
  const publicPath = `/agent-icons/${cacheName}`;

  if (fs.existsSync(targetPath)) {
    return publicPath;
  }

  try {
    const response = await fetch(agentIconUrl);
    if (!response.ok) {
      return agentIconUrl;
    }

    const bytes = await response.buffer();
    if (!bytes || bytes.length === 0) {
      return agentIconUrl;
    }

    const tempPath = `${targetPath}.tmp`;
    await fsp.writeFile(tempPath, bytes);
    await fsp.rename(tempPath, targetPath);
    return publicPath;
  } catch {
    return agentIconUrl;
  }
}

app.get("/config", (req, res) => {
  return res.json({
    player: {
      name: config.player?.name || defaultConfig.player.name,
      tag: config.player?.tag || defaultConfig.player.tag,
      region: config.player?.region || defaultConfig.player.region
    },
    backgroundColor: config.backgroundColor || defaultConfig.backgroundColor,
    textColor: config.textColor || defaultConfig.textColor,
    borderStyle: config.borderStyle || defaultConfig.borderStyle,
    transparentOverlay: config.transparentOverlay === true,
    showConnection: config.showConnection !== false,
    showAgentIcons: config.showAgentIcons !== false,
    showLastUpdated: config.showLastUpdated !== false,
    trackingDayResetTime: parseTrackingDayResetTime(config.trackingDayResetTime),
    maxMatchResults: Math.max(1, Math.min(12, Math.floor(Number(config.maxMatchResults) || 10)))
  });
});

app.post("/config", (req, res) => {
  const safeHex = value => typeof value === "string" && /^#([0-9A-F]{6}|[0-9A-F]{3})$/i.test(value);
  const updates = {};

  const allowedBorderStyles = ["solid", "dashed", "dotted", "double", "groove", "ridge", "inset", "outset", "none"];
  if (safeHex(req.body.backgroundColor)) {
    updates.backgroundColor = req.body.backgroundColor;
  }
  if (safeHex(req.body.textColor)) {
    updates.textColor = req.body.textColor;
  }
  if (typeof req.body.borderStyle === "string" && allowedBorderStyles.includes(req.body.borderStyle)) {
    updates.borderStyle = req.body.borderStyle;
  }
  let transparentOverlay = req.body.transparentOverlay;
  if (typeof transparentOverlay === "string") {
    const normalized = transparentOverlay.trim().toLowerCase();
    if (normalized === "true") transparentOverlay = true;
    if (normalized === "false") transparentOverlay = false;
  }
  if (typeof transparentOverlay === "boolean") {
    updates.transparentOverlay = transparentOverlay;
  }

  let showConnection = req.body.showConnection;
  if (typeof showConnection === "string") {
    const normalized = showConnection.trim().toLowerCase();
    if (normalized === "true") showConnection = true;
    if (normalized === "false") showConnection = false;
  }
  if (typeof showConnection === "boolean") {
    updates.showConnection = showConnection;
  }

  let showLastUpdated = req.body.showLastUpdated;
  if (typeof showLastUpdated === "string") {
    const normalized = showLastUpdated.trim().toLowerCase();
    if (normalized === "true") showLastUpdated = true;
    if (normalized === "false") showLastUpdated = false;
  }
  if (typeof showLastUpdated === "boolean") {
    updates.showLastUpdated = showLastUpdated;
  }

  let showAgentIcons = req.body.showAgentIcons;
  if (typeof showAgentIcons === "string") {
    const normalized = showAgentIcons.trim().toLowerCase();
    if (normalized === "true") showAgentIcons = true;
    if (normalized === "false") showAgentIcons = false;
  }
  if (typeof showAgentIcons === "boolean") {
    updates.showAgentIcons = showAgentIcons;
  }

  if (typeof req.body.trackingDayResetTime === "string") {
    const normalizedTrackingDayResetTime = parseTrackingDayResetTime(req.body.trackingDayResetTime);
    if (normalizedTrackingDayResetTime === req.body.trackingDayResetTime.trim()) {
      updates.trackingDayResetTime = normalizedTrackingDayResetTime;
    }
  }

  const parsedMaxMatchResults = Number(req.body.maxMatchResults);
  if (Number.isFinite(parsedMaxMatchResults)) {
    updates.maxMatchResults = Math.max(1, Math.min(12, Math.floor(parsedMaxMatchResults)));
  }

  const playerPayload = req.body.player;
  if (playerPayload && typeof playerPayload === "object") {
    const nextPlayer = { ...config.player };
    let hasPlayerUpdate = false;

    if (typeof playerPayload.name === "string" && playerPayload.name.trim()) {
      nextPlayer.name = playerPayload.name.trim();
      hasPlayerUpdate = true;
    }
    if (typeof playerPayload.tag === "string" && playerPayload.tag.trim()) {
      nextPlayer.tag = playerPayload.tag.trim();
      hasPlayerUpdate = true;
    }
    if (typeof playerPayload.region === "string" && playerPayload.region.trim()) {
      nextPlayer.region = playerPayload.region.trim().toLowerCase();
      hasPlayerUpdate = true;
    }

    if (hasPlayerUpdate) {
      updates.player = nextPlayer;
    }
  }

  if (Object.keys(updates).length === 0) {
    return res.status(400).json({ error: "No valid config values provided." });
  }

  try {
    const previousPlayer = {
      name: config.player?.name || "",
      tag: config.player?.tag || "",
      region: config.player?.region || ""
    };
    const updatedConfig = { ...config, ...updates };
    const nextPlayer = updatedConfig.player || previousPlayer;
    const playerChanged =
      previousPlayer.name !== nextPlayer.name ||
      previousPlayer.tag !== nextPlayer.tag ||
      previousPlayer.region !== nextPlayer.region;

    fs.writeFileSync(CONFIG_PATH, JSON.stringify(updatedConfig, null, 2));
    config = updatedConfig;
    cache.backgroundColor = config.backgroundColor;
    cache.textColor = config.textColor;
    cache.borderStyle = config.borderStyle;
    cache.transparentOverlay = config.transparentOverlay === true;
    cache.showConnection = config.showConnection !== false;
    cache.showAgentIcons = config.showAgentIcons !== false;
    cache.showLastUpdated = config.showLastUpdated !== false;
    cache.trackingDayResetTime = parseTrackingDayResetTime(config.trackingDayResetTime);
    cache.maxMatchResults = Math.max(1, Math.min(12, Math.floor(Number(config.maxMatchResults) || 10)));
    cache.player = config.player;

    if (playerChanged) {
      cache.rank = null;
      cache.matches = [];
      cache.stats = { wins: 0, losses: 0, streak: 0, type: null };
      cache.lastUpdated = null;
      cache.status = "loading";
      cache.message = "Refreshing data for updated player...";
      delete cache.lastError;
      rateLimitedUntil = 0;
      consecutiveRateLimits = 0;

      // Fetch immediately so the overlay switches players without stale history.
      fetchData().catch(() => {
        // fetchData already updates cache status/errors; swallow unhandled promise rejection.
      });
    }

    return res.json({
      success: true,
      config: updates,
      transparentOverlay: cache.transparentOverlay,
      showConnection: cache.showConnection,
      showAgentIcons: cache.showAgentIcons,
      showLastUpdated: cache.showLastUpdated,
      trackingDayResetTime: cache.trackingDayResetTime,
      maxMatchResults: cache.maxMatchResults,
      player: cache.player,
      playerChanged
    });
  } catch (e) {
    console.error("Failed to save config:", e.message);
    return res.status(500).json({ error: "Unable to save config." });
  }
});

async function fetchData() {
  try {
    const activePlayer = config.player;
    const mmrJson = await fetchJsonOrThrow(
      `${API_BASE}/v1/mmr/${activePlayer.region}/${activePlayer.name}/${activePlayer.tag}?api_key=${config.apiKey}`
    );

    const requestedMatchSize = Math.max(10, Math.min(12, Math.floor(Number(config.maxMatchResults) || 10)));
    const matchJson = await fetchJsonOrThrow(
      `${API_BASE}/v3/matches/${activePlayer.region}/${activePlayer.name}/${activePlayer.tag}?size=${requestedMatchSize}&api_key=${config.apiKey}`
    );

    const mmrHistoryJson = await fetchJsonOrThrow(
      `${API_BASE}/v1/mmr-history/${activePlayer.region}/${activePlayer.name}/${activePlayer.tag}?api_key=${config.apiKey}`
    );
    const mmrHistoryData = Array.isArray(mmrHistoryJson.data) ? mmrHistoryJson.data : [];
    const mmrByMatchId = new Map(
      mmrHistoryData
        .filter((entry) => entry && typeof entry.match_id === "string")
        .map((entry) => [entry.match_id, entry.mmr_change_to_last_game])
    );

    const matchData = Array.isArray(matchJson.data) ? matchJson.data : null;
    const matchErrorMessage = Array.isArray(matchJson?.errors) && matchJson.errors[0]?.message
      ? matchJson.errors[0].message
      : null;
    const hasMatchData = Array.isArray(matchData);

    if (!hasMatchData) {
      console.log(
        "Match history temporarily unavailable:",
        matchErrorMessage || "Empty response"
      );
    }

    let wins = 0, losses = 0, streak = 0, type = null;
    const results = [];
    let firstValidMatch = true;
    const previousPointsByMatchId = new Map(
      (Array.isArray(cache.matches) ? cache.matches : [])
        .filter(item => item && item.matchId && typeof item.points === "number")
        .map(item => [item.matchId, item.points])
    );

    const trackingWindowStart = getTrackingWindowStart(new Date(), config.trackingDayResetTime);
    const matchesToProcess = hasMatchData
      ? matchData.filter((match) => {
          const modeId = String(match?.metadata?.mode_id || "").toLowerCase();
          const modeName = String(match?.metadata?.mode || "").toLowerCase();
          const isCompetitive = modeId === "competitive" || modeName === "competitive";
          if (!isCompetitive) return false;

          const matchTime = getMatchTimestamp(match);
          if (!matchTime) return true;
          return matchTime >= trackingWindowStart;
        })
      : [];

    for (let index = 0; index < matchesToProcess.length; index++) {
      const match = matchesToProcess[index];
      const player = match.players.all_players.find(
        p => p.name === activePlayer.name && p.tag === activePlayer.tag
      );
      if (!player) continue;

      const matchId = match?.metadata?.matchid || null;

      const winningTeam = match.teams.red.has_won ? "Red" : "Blue";
      const isWin = player.team === winningTeam;
      const historyChange = matchId ? mmrByMatchId.get(matchId) : undefined;
      let mmrChange = typeof historyChange === "number" ? historyChange : null;

      if (mmrChange === null && matchId && previousPointsByMatchId.has(matchId)) {
        mmrChange = previousPointsByMatchId.get(matchId);
      }

      if (mmrChange === null && index === 0 && typeof mmrJson?.data?.mmr_change_to_last_game === "number") {
        mmrChange = mmrJson.data.mmr_change_to_last_game;
      }

      const rawAgentIcon = player.assets?.agent?.small || null;
      const cachedAgentIcon = await resolveCachedAgentIconUrl(rawAgentIcon);

      results.push({
        matchId,
        result: isWin ? "W" : "L",
        points: mmrChange,
        agentIcon: cachedAgentIcon,
        agentName: player.character || null
      });

      if (isWin) wins++; else losses++;

      if (firstValidMatch) {
        type = isWin ? "win" : "loss";
        streak = 1;
        firstValidMatch = false;
      } else if ((isWin && type === "win") || (!isWin && type === "loss")) {
        streak++;
      } else {
        break;
      }
    }

    const nextMatches = hasMatchData
      ? results
      : (Array.isArray(cache.matches) ? cache.matches : []);

    const nextStats = hasMatchData
      ? { wins, losses, streak, type }
      : (cache.stats || { wins: 0, losses: 0, streak: 0, type: null });

    cache = {
      rank: mmrJson.data,
      matches: nextMatches,
      stats: nextStats,
      lastUpdated: new Date().toISOString(),
      status: "online",
      message: hasMatchData
        ? "Live data is updated"
        : "Live rank updated (match history temporarily unavailable)",
      imagePath: getPublicRankImageBasePath(config.rankImageBasePath),
      player: activePlayer,
      showPlayerId: config.showPlayerId === true,
      rankAnimationIntervalSec: Number.isFinite(config.rankAnimationIntervalSec)
        ? config.rankAnimationIntervalSec
        : 15,
      backgroundColor: config.backgroundColor || "#0c0f1b",
      textColor: config.textColor || "#eef2ff",
      borderStyle: config.borderStyle || "solid",
      transparentOverlay: config.transparentOverlay === true,
      showConnection: config.showConnection !== false,
      showAgentIcons: config.showAgentIcons !== false,
      showLastUpdated: config.showLastUpdated !== false,
      trackingDayResetTime: parseTrackingDayResetTime(config.trackingDayResetTime),
      maxMatchResults: Math.max(1, Math.min(12, Math.floor(Number(config.maxMatchResults) || 10)))
    };
    rateLimitedUntil = 0;
    consecutiveRateLimits = 0;
  } catch (e) {
    if (e.code === "RATE_LIMIT") {
      consecutiveRateLimits += 1;
      const baseMs = getConfiguredPollIntervalMs();
      const exponentialMs = Math.min(300000, baseMs * Math.pow(2, Math.min(consecutiveRateLimits, 3)));
      const backoffMs = Math.max(exponentialMs, Number(e.retryAfterMs) || 0, 60000);
      rateLimitedUntil = Date.now() + backoffMs;
      cache.status = "loading";
      cache.message = `Rate limited. Backing off for ${Math.ceil(backoffMs / 1000)}s`;
      cache.lastError = e.message;
      console.log("Rate limit hit. Backing off for", Math.ceil(backoffMs / 1000), "seconds");
      return;
    }

    console.log("Error fetching Valorant data:", e.message);
    cache.status = "offline";
    cache.message = "Unable to fetch data";
    cache.lastError = e.message;
  }
}

async function runPollingLoop() {
  await fetchData();

  const now = Date.now();
  const nextDelayMs = rateLimitedUntil > now
    ? rateLimitedUntil - now
    : getConfiguredPollIntervalMs();

  clearTimeout(pollTimer);
  pollTimer = setTimeout(runPollingLoop, Math.max(1000, nextDelayMs));
}

runPollingLoop();

app.get("/rank", (req, res) => res.json(cache));

app.get("/", (req, res) => {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  res.sendFile(path.join(__dirname, "overlay", "index.html"));
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
