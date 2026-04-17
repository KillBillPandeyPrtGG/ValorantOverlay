# 🎯 Valorant Live Rank Overlay (Tracker-Style)

A custom OBS overlay that displays your **Valorant rank, RR, match results, streak, winrate, and recent match history** — built using the HenrikDev API.

This is a **local, fast, and customizable alternative to Tracker.gg overlays**.

---

# 🚀 Features

## 🟢 Core
- Live Rank (e.g. Ascendant 2)
- Real-time RR updates
- Rank icon display

## 🔥 Advanced (Tracker-style)
- Match history (last 5 games → W/L boxes)
- Accurate winrate (based on matches, not RR guessing)
- Live streak tracking (🔥 win / 🥶 loss)

## ✨ Animations
- Smooth RR ticking (counts up/down)
- Rank icon pop + glow on rank change
- Clean, transparent overlay (OBS-ready)

---

# 🧠 How It Works

Henrik API → Node.js Server → OBS Overlay (HTML)

### Backend (`server.js`)
- Fetches:
  - Rank data (MMR endpoint)
  - Match history (matches endpoint)
  - Match RR delta (mmr-history endpoint)
- Calculates:
  - Wins / Losses
  - Winrate
  - Current streak
- Serves data via:

### Configuration
- Copy `config.example.json` to `config.json`
- Keep `config.json` private to protect your API key and player settings
- `config.example.json` is committed so others can bootstrap the project quickly

http://localhost:3000/rank

---

### Frontend (`overlay/index.html`)
- Fetches local API every 5 seconds
- Displays:
  - Rank + RR
  - Match history
  - Streak + winrate
- Handles animations (RR ticking, icon effects)

---

# 📦 Project Structure

valorant-overlay/
│
├── server.js        # Backend (API + logic)
├── package.json     # Dependencies
│
└── overlay/
    └── index.html  # OBS overlay UI

---

# ⚙️ Setup Guide

## 1. Install Node.js
Download: https://nodejs.org

---

## 2. Install dependencies

npm install

---

## 3. Start server

node server.js

You should see:
Server running on http://localhost:3000

---

## 4. Test API

Open:
http://localhost:3000/rank

You should see JSON data.

---

## 5. Add to OBS

### Steps:
1. Open OBS
2. Add Source → Browser
3. Enable Local File
4. Select:
overlay/index.html

---

### Recommended OBS Settings:

- Width: 800
- Height: 300
- Shutdown when not visible: OFF
- Refresh when active: ON

---

# 🎨 Customization

## Rank Images
Update this path in `config.json` or `overlay/index.html`:

"rankImageBasePath": "file:///C:/Users/user/Downloads/rank_png/"

You can also update `player.name`, `player.tag`, and `player.region` in `config.json`.

---

## Overlay Position

Edit CSS:

.overlay {
  top: 40px;
  left: 40px;
}

---

## Colors

- Win: #4cff9a
- Loss: #ff5c5c

---

# ⚠️ API Notes

- Uses HenrikDev Valorant API
- API documentation: https://app.swaggerhub.com/apis-docs/Henrik-3/HenrikDev-API/4.2.1
- Uses `v1/mmr-history` to compute per-match RR deltas
- Rate limit: ~30 requests/min
- Current setup:
  - Backend fetch: every 10s
  - Frontend fetch: every 5s
- Recommended install: `npm install`


---

# ❗ Limitations

- Session resets when server restarts
- No long-term match history storage
- No player stats (K/D, HS%) yet

---

# 🚀 Future Upgrades (Optional)

- Agent icons per match
- K/D + Headshot %
- RR progress bar (0–100)
- Rank-up sound effects
- Session tracking (persistent storage)

---

# 💡 Why This > Tracker Overlay

- Faster (local API)
- Fully customizable
- No external dependency
- Better animations

---

# 🛠 Built For

- Streamers (OBS)
- Valorant content creators
- Coaching streams
- "Unranked to Immortal" series

---

# 📌 Credits

- API: HenrikDev Valorant API
- UI/Logic: Custom implementation

---

# 🧠 Tip

If overlay doesn’t update:
- Check server is running
- Refresh OBS source
- Verify API response

---

# 🔥 Author Note

This setup is already **80–90% of Tracker.gg overlay quality**,  
and with small upgrades, it can easily surpass it.