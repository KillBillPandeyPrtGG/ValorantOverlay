# Changelog

All notable changes to this project are documented in this file.

The format is based on Keep a Changelog and this project follows Semantic Versioning.

## [1.2.1] - 2026-04-18

### Added
- Added bundled rank badge PNG assets under `overlay/assets/rank-images` so the overlay works without external rank image folders.

### Changed
- Updated default `rankImageBasePath` references in server and overlay UI to `/assets/rank-images/`.
- Updated documentation and project structure references for the new in-repo rank image asset path.

## [1.2.0] - 2026-04-18

### Added
- Added `trackingDayResetTime` config support (`HH:MM`, 24-hour local server time) to define when daily match tracking resets.
- Added day-reset control in the in-overlay settings panel for runtime updates through `POST /config`.

### Changed
- Changed daily match aggregation to honor configured reset windows rather than strict midnight.
- Changed match history and agent-strip sources to competitive matches only.
- Changed point resolution to map MMR deltas by `match_id`, improving correctness when mixed match modes are present.
- Updated overlay visuals with light text/image shadows for better readability on complex OBS backgrounds.

### Fixed
- Fixed stale previous-day history showing in the next day when a custom reset time is configured.
- Fixed empty-day UI behavior by hiding history and agent rows instead of rendering placeholder `--` and empty icon slots.

### Operational
- Runtime normalization now auto-persistently backfills `trackingDayResetTime` in older `config.json` files.

## [1.1.0] - 2026-04-17

### Added
- Added full runtime config API (`GET /config`, `POST /config`) with validation for player, theme, visibility, and data controls.
- Added integrated settings panel in `overlay/index.html` to update player name/tag/region and overlay options without manual file edits.
- Added agent icon local caching in `overlay/cache/agent-icons` and static serving through `/agent-icons`.
- Added rank image local-directory support through `/rank-images` when `rankImageBasePath` points to a local filesystem path.
- Added configurable toggles and limits: `showAgentIcons`, `showConnection`, `showLastUpdated`, `transparentOverlay`, and `maxMatchResults`.

### Changed
- Changed backend polling default from `10000ms` to `30000ms` to reduce API pressure.
- Replaced fixed polling timer with an adaptive polling loop that honors temporary backoff windows.
- Updated static file serving headers to disable browser/OBS caching (`Cache-Control: no-store` and related headers).
- Updated frontend connection strategy to prioritize current origin and `3000` before legacy `3001` fallbacks.
- Updated match history rendering and agent-strip layout in overlay UI (agent icons are shown in top strip; history focuses on match points).
- Updated `config.example.json` defaults to reflect current runtime behavior.

### Fixed
- Fixed points fallback behavior by preserving prior match-point values per match ID when API history data is temporarily missing.
- Fixed temporary data degradation where history could drop to generic W/L by using safer fallback paths.
- Fixed player-switch stale state issue: changing player config now clears stale rank/match cache and triggers immediate refresh for the new player.
- Fixed resilience around Henrik API `429` responses by parsing `Retry-After` and applying exponential backoff.

### Operational
- Standardized runtime normalization for config values (`pollIntervalMs`, `maxMatchResults`, and boolean toggles) so older configs are auto-corrected on startup.
