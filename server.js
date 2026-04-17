const fs = require("fs");
const express = require("express");
const fetch = require("node-fetch");

const app = express();
const PORT = 3000;
const CONFIG_PATH = "./config.json";

const defaultConfig = {
  player: { name: "CalmAimer", tag: "3973", region: "ap" },
  apiKey: "HDEV-632cdd82-0292-44de-be24-2ca1315cf52c",
  pollIntervalMs: 10000,
  rankImageBasePath: "file:///C:/Users/user/Downloads/rank_png/"
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

const API_BASE = "https://api.henrikdev.xyz/valorant";
const PLAYER = config.player;

let cache = {
  rank: null,
  matches: [],
  stats: { wins: 0, losses: 0, streak: 0, type: null },
  lastUpdated: null,
  status: "loading",
  message: "Waiting for first update...",
  imagePath: config.rankImageBasePath,
  player: PLAYER
};

app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  next();
});

async function fetchData() {
  try {
    const mmrRes = await fetch(
      `${API_BASE}/v1/mmr/${PLAYER.region}/${PLAYER.name}/${PLAYER.tag}?api_key=${config.apiKey}`
    );
    const mmrJson = await mmrRes.json();

    const matchRes = await fetch(
      `${API_BASE}/v3/matches/${PLAYER.region}/${PLAYER.name}/${PLAYER.tag}?size=5&api_key=${config.apiKey}`
    );
    const matchJson = await matchRes.json();

    const mmrHistoryRes = await fetch(
      `${API_BASE}/v1/mmr-history/${PLAYER.region}/${PLAYER.name}/${PLAYER.tag}?api_key=${config.apiKey}`
    );
    const mmrHistoryJson = await mmrHistoryRes.json();
    const mmrHistoryData = Array.isArray(mmrHistoryJson.data) ? mmrHistoryJson.data : [];

    if (!matchJson.data) {
      throw new Error("Match history data unavailable");
    }

    let wins = 0, losses = 0, streak = 0, type = null;
    const results = [];
    let firstValidMatch = true;

    for (let index = 0; index < matchJson.data.length; index++) {
      const match = matchJson.data[index];
      const player = match.players.all_players.find(
        p => p.name === PLAYER.name && p.tag === PLAYER.tag
      );
      if (!player) continue;

      const winningTeam = match.teams.red.has_won ? "Red" : "Blue";
      const isWin = player.team === winningTeam;
      const mmrChange = mmrHistoryData[index]?.mmr_change_to_last_game ?? null;

      results.push({
        result: isWin ? "W" : "L",
        points: mmrChange
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

    cache = {
      rank: mmrJson.data,
      matches: results,
      stats: { wins, losses, streak, type },
      lastUpdated: new Date().toISOString(),
      status: "online",
      message: "Live data is updated",
      imagePath: config.rankImageBasePath,
      player: PLAYER
    };
  } catch (e) {
    console.log("Error fetching Valorant data:", e.message);
    cache.status = "offline";
    cache.message = "Unable to fetch data";
    cache.lastError = e.message;
  }
}

setInterval(fetchData, config.pollIntervalMs);
fetchData();

app.get("/rank", (req, res) => res.json(cache));

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
