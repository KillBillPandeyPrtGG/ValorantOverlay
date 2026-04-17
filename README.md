# Valorant Live Rank Overlay

Local OBS-ready Valorant overlay powered by the HenrikDev API.

It shows live rank, RR, match-point history, recent agents, and configurable UI controls from a built-in settings panel.

## Features

- Live rank + RR updates from HenrikDev API
- Rank icon rendering with fallback handling
- Animated RR transitions and periodic rank icon animation
- Match-point history with configurable display size (1-12)
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
- `rankImageBasePath`
- `showPlayerId`
- `rankAnimationIntervalSec`
- `backgroundColor`
- `textColor`
- `borderStyle`
- `transparentOverlay`
- `showConnection`
- `showLastUpdated`
- `showAgentIcons`
- `maxMatchResults` (clamped 1-12)

## API Endpoints

- `GET /rank` - Current overlay payload
- `GET /config` - Effective runtime config
- `POST /config` - Save validated config updates

## Operational Notes

- Default backend polling is 30 seconds.
- On `429` responses, polling backs off using `Retry-After` + exponential delay.
- Agent icons are downloaded once and reused from `overlay/cache/agent-icons`.
- Static responses are served with no-store headers to reduce stale OBS content.

## Troubleshooting

- If old data remains after changing player details, save settings again and wait one refresh cycle; the server now clears stale cache and fetches new player data immediately.
- If overlays look outdated in OBS, confirm source URL is `127.0.0.1:3000` and refresh the browser source.
- If rate limits continue, confirm only one server instance is running.

## Changelog

See `CHANGELOG.md` for versioned release history.