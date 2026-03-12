# DOM Racer

DOM Racer is a Chrome / Edge extension that turns the visible parts of any webpage into a playful top-down racer.

Links and buttons become loot. Text becomes geometry. Colorful surfaces can become boosts. Random power-ups spawn into the arena. Police cars show up when you get too comfortable.

It is built as a Manifest V3 extension with a TypeScript + Vite workflow and runs directly as a content-script overlay on top of the current page.

## What It Feels Like

- Drive around the live DOM instead of a traditional game map
- Collect money from visible UI
- Chain pickups into `FLOW`
- Grab random power-ups like `MAGNET`, `INVERT`, `GHOST`, and `BLACKOUT`
- Dodge police chases and survive long enough to push your page best
- Keep your settings, vehicle choice, and score history between runs

## Current Features

- `Shift + R` toggles the game on any page
- Page text is scanned into readable wall geometry
- Images and pictures can become slippery ice zones
- Reactive visual surfaces can become speed-up zones
- Links and buttons both spawn money pickups
- Ambient special pickups spawn independently from normal money
- `FLOW` streaks recolor regular coins to make the streak state obvious
- Police chases include an edge warning and a proper `GAME OVER` screen
- Sound can be toggled in-game
- Vehicle design can be cycled in-game
- Page best and lifetime best are persisted through storage
- Extension icons and store assets can be regenerated from source artwork
- A debug API is available in the page for simulation and diagnostics

## Controls

### In Game

- `Shift + R`: toggle DOM Racer on or off
- `WASD` / arrow keys: drive
- `R`: restart the current run
- `V`: switch vehicle design
- `M`: toggle sound
- `Esc`: quit

### On Police Game Over

- `Space`: restart
- `Esc`: quit

## Local Development

```bash
npm install
npm run brand
npm run build
```

### Useful Commands

```bash
npm run dev
npm run build
npm run typecheck
npm run brand
```

- `npm run dev`: rebuild the extension on file changes into `dist/`
- `npm run build`: type-check and produce a production build in `dist/`
- `npm run typecheck`: run TypeScript only
- `npm run brand`: regenerate extension icons and marketplace graphics from `branding/`

## Load Unpacked In Chrome Or Edge

1. Run `npm run build`
2. Open the extensions page
3. Enable Developer Mode
4. Click `Load unpacked`
5. Select the `dist/` directory
6. Open any page and press `Shift + R`

## How The World Is Built

DOM Racer scans the currently visible page and translates it into a compact arcade arena.

- Large fixed UI near page edges becomes barriers
- Links and button-like elements become money pickups
- Text blocks are converted into wall slices using visible text bounds
- Images and pictures can become ice
- Visually reactive surfaces can become boosts
- Random special pickups are spawned into free space during the run

The result is intentionally game-ish rather than perfectly literal. The goal is to preserve the feel of the page while still making it readable and fun as a racer.

## Power-Ups

- `MAGNET`: pulls coins toward the player
- `INVERT`: flips page colors
- `GHOST`: temporarily relaxes some movement pressure
- `BLACKOUT`: darkens the page for a short high-pressure stretch

The active power-up panel in the top-right HUD shows remaining duration.

## Persistence

DOM Racer stores:

- sound setting
- selected vehicle design
- page best score
- lifetime best score
- per-page run stats

Storage uses `chrome.storage.local` when available, with `localStorage` fallback for compatibility.

## Debug API

When the extension is active, a debug helper is installed on the page:

```js
window.__domRacerDebug.snapshot()
await window.__domRacerDebug.runAutopilot({ durationMs: 15000 })
await window.__domRacerDebug.runBatch({ runs: 5, durationMs: 10000 })
window.__domRacerDebug.latestReport()
window.__domRacerDebug.downloadLatestReport()
```

This is useful for manual balancing, diagnostics, and repeated score runs on the same page.

## Branding Assets

Branding source files live in `branding/`.

Generated assets include:

- extension icons in `public/icons/`
- marketplace assets in `public/marketplace/`

## Project Layout

```text
branding/        SVG sources and branding generator
public/          Manifest and static extension assets
src/content/     DOM scanning, overlay bootstrapping, debug API
src/game/        Game loop, rendering, audio, HUD, player logic
src/shared/      Shared types, utils, persistence helpers
src/styles/      Overlay and page-effect styles
```

## Stack

- Manifest V3
- TypeScript
- Vite
- Canvas 2D
- Web Audio API

## Notes

- The extension is designed for local loading during development
- It only requests `storage` permission
- The game runs on top of the current page and intentionally blocks native page interaction while active

## License

No license file is included yet.
