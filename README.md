# DOM Racer

A Chrome / Edge extension that turns any webpage into a tiny arcade track.

Links become loot. Text becomes walls. Images become ice. Buttons become coins. Police show up when you get too comfortable. An airplane drops weird gifts from the sky. The page you were reading five seconds ago is now a hostile little arena, and you love it.

## Why This Is Fun

Most browser extensions add features. This one turns your tab into a game.

The magic is that every page plays differently. A docs page is a maze of text walls. A dashboard is an open racetrack with scattered buttons. A landing page is a slippery ice rink full of hero images. You never know what the track will look like until you press the hotkey.

Then: coins to chase, power-ups to grab, police cars that punish staying too long, and a propeller plane that drops route moments across the map. The difficulty curve is simple: the longer you survive, the weirder it gets.

## Store-Friendly Pitch

DOM Racer turns every page into a tiny arcade track: dash through live UI, scoop coin lines, trigger weird specials, and survive cleanly telegraphed police pressure without leaving your tab.

## Quick Start

```bash
npm install
npm run build
```

1. Open Chrome or Edge extensions page
2. Enable Developer Mode
3. Click `Load unpacked` and select the `dist/` directory
4. Open any page and press `Shift + R` (or ``Shift + ` ``)

## Controls

| Context | Key | Action |
|---|---|---|
| Anywhere | `Shift + R` or ``Shift + ` `` | Toggle DOM Racer |
| In game | `WASD` / arrow keys | Drive |
| In game | `R` | Restart run |
| In game | `V` | Switch vehicle design |
| In game | `M` | Toggle sound |
| In game | `Shift + D` | Sprite showcase mode |
| In game | `Esc` | Quit |
| Game over | `Space` | Restart |
| Game over | `Esc` | Quit |

## Current Features

- Every page becomes a unique track — text is walls, images are ice, links are coins
- Nine power-ups to collect: `BONUS`, `MAGNET`, `INVERT`, `GHOST`, `BLUR`, `OIL_SLICK`, `REVERSE`, `MYSTERY`, and a rare golden `JACKPOT`
- Police chases with flashing sirens — the longer you survive, the longer they chase
- Airplane flyovers that drop bonus coins, specials, and lucky wind across the map
- Overgrowth: bushes and trees grow from walls over time, narrowing your routes
- Coin-collection goals with x2, x3, x4 bonus multipliers and countdown timers
- Near-miss bonus for grazing walls and police without crashing
- A different daily modifier every day — double coins, fast police, slippery surfaces, and more
- Three vehicle designs unlocked by reaching lifetime score milestones
- Run counter, page bests, lifetime bests, milestone celebrations
- Auto-pause when you switch tabs, sound toggle, and a hint overlay for first-time players

## How The World Is Built

DOM Racer scans the currently visible page and translates it into a compact arcade arena.

- Large fixed UI near page edges becomes barriers
- Links and button-like elements become money pickups
- Text blocks are converted into wall slices using visible text bounds
- Images and pictures become ice
- Visually reactive surfaces become boosts
- Random special pickups spawn into free space during the run

The result is intentionally game-ish rather than perfectly literal. The goal is to preserve the feel of the page while still making it readable and fun as a racer.

## Power-Ups

- `BONUS`: instant score award (+40)
- `MAGNET`: pulls coins and specials toward the player
- `INVERT`: flips page colors
- `GHOST`: temporarily relaxes movement pressure and blocks police lock
- `BLUR`: applies a CSS blur to the page for a short hazy stretch
- `OIL_SLICK`: dramatically slows the car for a few seconds
- `REVERSE`: flips steering controls for a disorienting stretch
- `MYSTERY`: randomly activates any other effect (good or bad)
- `JACKPOT`: very rare golden star that awards a large instant score bonus (+50–100)

The active power-up panel in the top-right HUD shows remaining duration.

## Airplane Events

A propeller plane occasionally crosses the arena and drops one of five route moments:

- **Bonus drop**: a special pickup appears at the drop point
- **Coin trail**: a line of regular coins spawns behind the plane along its flight path
- **Spotlight**: an existing special pickup gets highlighted with a longer cue
- **Lucky wind**: nearby coins are gently nudged into a readable route
- **Police delay**: police spawn timing is briefly pushed back

Each mode has its own fallback: if conditions are not right at drop time, the plane safely resolves to a bonus drop instead.

## Overgrowth

After about 35 seconds of survival, the page starts fighting back. Bushes and trees sprout from the edges of barriers and walls, slowly encroaching into your driving lanes.

Each growth passes through three stages: small (a speed bump), medium (a proper slow zone), and large (a full wall). New growths appear every 9–15 seconds, up to eight at a time. The result is a map that gradually tightens, forcing you into riskier routes as the run goes long.

Bushes are leafy blobs; trees are round canopies with visible trunks. Both sway gently and animate in smoothly so nothing feels like a pop-in surprise.

## Near-Miss Bonus

Thread the gap between your car and a wall or police cruiser and you earn a near-miss bonus: +3 to +5 points per graze, with a short cooldown so it does not spam. The HUD flashes one of four rotating toasts — `CLOSE!`, `TIGHT!`, `RAZOR!`, `WHEW!` — in orange to celebrate your questionable driving decisions.

Stack enough near-misses in a single run and the flavor text starts roasting you for it.

## Micro-Objectives

Each run quietly assigns you a coin-collection goal a few seconds in: collect N coins in X seconds. There are six templates in the pool across three difficulty tiers (x2, x3, x4 multiplier), and you only see one at a time.

Complete a goal and you get a score bonus (scaled by multiplier tier) plus a satisfying violet toast. Miss it and the objective silently expires, replaced by a new one after a short cooldown. The HUD shows your current objective, progress bar, and remaining time in a compact bottom-center GOAL panel that matches the POWER panel pattern.

## Screenshots & Motion

![Normal run on GitHub Issues page](assets/screenshot-normal-run.png)

_More captures coming soon._

| Moment | Type | Status |
|---|---|---|
| Normal run | Screenshot | Done |
| Special pickup | Screenshot | Planned |
| Police chase | GIF | Planned |
| Police GAME OVER | Screenshot | Planned |
| Airplane flyover | GIF | Planned |
| Coin trail | GIF | Planned |
| Lucky wind | GIF | Planned |
| Overgrowth state | Screenshot | Planned |
| Near-miss graze | GIF | Planned |
| Jackpot pickup | Screenshot | Planned |
| Micro-objective HUD | Screenshot | Planned |

## Persistence

DOM Racer stores sound setting, selected vehicle design, page best score, lifetime best score, and per-page run stats using `chrome.storage.local` (with `localStorage` fallback).

## Roadmap

| Phase | Status | Goal |
|---|---|---|
| Core money loop | Done | Lock the collectible loop |
| Overgrowth difficulty | Done | Trees and bushes that grow over time |
| Airplane event | Done | Rare stylish world events |
| Indie juice | Done | Near-miss bonuses, micro-objectives, rare jackpot |
| Production hardening | Done | Tests, structure, release readiness |
| Presentation | Done | README polish, branding, store assets |
| Micro-polish | Done | Visual juice, particles, retention tweaks |
| Player experience | Done | Onboarding, run summary, daily modifiers, vehicle unlocks |

## Debug Mode

Use `Shift + D` to open the sprite/debug showcase mode for visual checks and quick style validation. No page-level debug API is exposed.

## Project Layout

```text
branding/            SVG sources and branding generator
public/              Manifest and static extension assets
src/content/         DOM scanning, overlay bootstrapping, page integration
src/game/            Game loop, rendering, audio, HUD, player logic
src/game/sprites/    Reusable sprite renderers (player, police, plane, pickups)
src/game/gameConfig.ts  Centralized tuning constants for all gameplay systems
src/shared/          Shared types, utils, persistence helpers
src/styles/          Overlay and page-effect styles
```

## Development

```bash
npm run dev          # Rebuild on file changes
npm run build        # Type-check + production build
npm run typecheck    # TypeScript only
npm run test         # Run smoke tests
npm run lint         # ESLint check
npm run lint:fix     # ESLint auto-fix
npm run format       # Prettier format
npm run format:check # Prettier check (CI-friendly)
npm run brand        # Regenerate extension icons and marketplace graphics
npm run package      # Build + create Chrome Web Store ZIP
```

## Stack

Manifest V3, TypeScript, Vite, Canvas 2D, Web Audio API, ESLint, Prettier.

## Privacy

DOM Racer collects **no data** and makes **no network requests**. All game state (scores, settings, run history) is stored locally on your device using `chrome.storage.local`. Nothing leaves your browser. There is no analytics, no telemetry, no tracking, and no remote services of any kind.

The extension requests `storage` permission for local game data and `<all_urls>` host access because the game needs to run on any page you choose.

## Notes

- The extension only requests `storage` permission
- The game runs on top of the current page and blocks native interaction while active
- Host scope uses `<all_urls>` because the core interaction model requires running on arbitrary pages

## License

MIT — see [LICENSE](LICENSE).
