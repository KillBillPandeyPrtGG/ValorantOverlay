# Valorant Live Rank Overlay

Local OBS-ready Valorant overlay powered by the HenrikDev API.

It shows live rank, RR, match-point history, recent agents, and configurable UI controls from a built-in settings panel.

## Features

- Live rank + RR updates from HenrikDev API
- Rank icon rendering with fallback handling
- Animated RR transitions and periodic rank icon animation
- Match-point history with configurable display size (1-10)
- Configurable daily reset window via `trackingDayResetTime`
- Competitive-only daily history and recent agent strip
- Empty-state aware history/agent rows (hidden when no daily competitive matches exist)
- Recent agent strip with local icon caching
- In-overlay config panel for player and UI settings
- API rate-limit protections with adaptive backoff
- Cache-control headers to avoid stale OBS/browser content

## Project Structure

```text
.
|- server.js
|- package.json
|- config.example.json
`- overlay/
   |- index.html
   |- assets/
   |  `- rank-images/
   `- cache/           (generated runtime files, gitignored)
```

## Prerequisites

- Node.js 18+

## Setup

1. Install dependencies:

```bash
npm install
```

2. Create local config:

```bash
copy config.example.json config.json
```

3. Update `config.json`:

- `player.name`
- `player.tag`
- `player.region`
- `apiKey`

4. Start server:

```bash
node server.js
```

5. Verify API payload:

- `http://127.0.0.1:3000/rank`

6. Add overlay in OBS:

- Source type: Browser Source
- URL: `http://127.0.0.1:3000/`
- Recommended: enable "Refresh browser when scene becomes active"

## Configuration

Use `config.json` for defaults and `POST /config` (via UI) for runtime updates.

Supported keys:

- `player.name`, `player.tag`, `player.region`
- `apiKey`
- `pollIntervalMs` (clamped 10000-300000)
- `trackingDayResetTime` (`HH:MM` in 24h, local server time; default `00:00`)
- `rankImageBasePath`
- `showPlayerId`
- `rankAnimationIntervalSec`
- `backgroundColor`
- `textColor`
- `borderStyle`
- `overlayBackgroundTheme` (`solid`, `transparent`, or `glass`)
- `glassBlurPx` (clamped 4-28)
- `glassTintOpacity` (clamped 0.05-0.35)
- `glassBorderOpacity` (clamped 0.12-0.70)
- `glassShadowStrength` (clamped 0.20-0.80)
- `transparentOverlay`
- `showConnection`
- `showLastUpdated`
- `showAgentIcons`
- `maxMatchResults` (clamped 1-10)

Default `rankImageBasePath` is `/assets/rank-images/` and points to bundled rank images tracked in this repository.

### Day Reset Behavior

- Match tracking is now calculated from `trackingDayResetTime` instead of strict midnight.
- Example: set `trackingDayResetTime` to `04:00` to treat matches played between `00:00` and `03:59` as part of the previous day session.
- Daily match history and agent icons only include competitive matches in the active reset window.
- When there are no daily competitive matches, history and agent icon rows are hidden.

## API Endpoints

- `GET /rank` - Current overlay payload
- `GET /config` - Effective runtime config
- `POST /config` - Save validated config updates

## Operational Notes

- Default backend polling is 30 seconds.
- On `429` responses, polling backs off using `Retry-After` + exponential delay.
- Agent icons are downloaded once and reused from `overlay/cache/agent-icons`.
- Static responses are served with no-store headers to reduce stale OBS content.
- Overlay text and rank image include subtle shadows to improve readability over bright or busy scenes.

## Troubleshooting

- If old data remains after changing player details, save settings again and wait one refresh cycle; the server now clears stale cache and fetches new player data immediately.
- If overlays look outdated in OBS, confirm source URL is `127.0.0.1:3000` and refresh the browser source.
- If rate limits continue, confirm only one server instance is running.

## Changelog

See `CHANGELOG.md` for versioned release history.