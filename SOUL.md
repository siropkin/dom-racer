# DOM Racer Execution Plan

## Document Purpose

This file is the execution-ready roadmap for `DOM Racer`. It helps any model or contributor quickly understand what the game is, what exists, what the vibe is, and what's next.

## Project Context

### What DOM Racer Is

`DOM Racer` is a Chrome / Edge extension that turns the visible DOM of the current page into a playable top-down arcade racer. The game runs as a content-script overlay on top of real websites.

### Core Fantasy

- the page becomes the track
- visible UI becomes loot and geometry
- the run starts clean and readable
- over time the page becomes stranger, denser, and more dangerous
- the player chases score, specials, and survival

### Intended Vibe

- playful, weird, stylish
- light indie-arcade energy
- more "cool coding waiting-room toy" than serious action game

Avoid turning it into a war game, military game, or heavy destruction game.

### Current Baseline

- overlay toggle on `Shift + R` (or ``Shift + ` ``)
- three vehicle designs (coupe, buggy, truck) — score-gated unlocks
- page scanning: text → walls, images → ice, links → coins, SVG → boost
- HUD: score/time (top-left), POWER panel (top-right), GOAL panel (bottom-center), score memory (bottom-left), controls hint (bottom-right)
- seven power-ups: `MAGNET`, `INVERT`, `GHOST`, `BLACKOUT`, `COOLDOWN`, `LURE`, rare `JACKPOT`
- police chases with escalating duration, siren flash, and `GAME OVER` screen
- airplane flyovers with five drop modes
- overgrowth: bushes/trees grow from barriers after ~35s
- near-miss bonus with whoosh sound
- coin-collection goals with x2/x3/x4 multiplier tiers
- daily modifier (5 rule twists, deterministic from date)
- run grade (S/A/B/C/D) and stats on game-over
- first-play hint overlay, run counter, lifetime milestones, "NEW BEST!" celebrations
- VFX: tire dust, coin burst, speed lines, drift sparks, landing squash, celebration particles, page-reactive tint
- sound: coin pitch variation, near-miss whoosh, objective chime
- auto-pause on focus loss, sound toggle, vehicle toggle, sprite showcase (`Shift + D`)
- branding assets refreshed with in-game blue coupe

### Controls

- `Shift + R` / ``Shift + ` ``: toggle game
- `WASD` / arrows: drive
- `R`: restart | `V`: vehicle | `M`: sound | `Shift + D`: showcase | `Esc`: quit
- Game over: `Space` restart, `Esc` quit

### Architecture

- `src/content/`: page scanning, overlay bootstrapping
- `src/game/`: game loop, rendering, HUD, audio, runtime helpers
- `src/game/sprites/`: player, police, plane, pickup renderers + shared helpers
- `src/game/gameConfig.ts`: centralized tuning constants (13 sections)
- `src/shared/`: types, settings, persistence, utilities
- `public/`: manifest, icons | `branding/`: SVG sources

### Design Rules

- Keep readable within seconds
- Simple money rules
- Surprising specials, not noisy
- Escalating route pressure over raw chaos
- Humorous/stylish, not violent
- No mechanics that make the page uniformly slippery or visually muddy

## Research Notes

### Telegraphing (Mike Stout)
Keep challenge in overlapping clear questions. Pre-cues (`WEE-OO`, `NYOOM`) with enough response window. Difficulty from route pressure, not hidden state changes.

### MDA Framework
Lock target feeling first. Keep roles distinct: police = pressure, airplane = opportunity, coins = economy baseline.

### Game Feel (Vlambeer)
Maximum output for minimum input. Short playtest cycles. Additive but controlled feedback layers.

### UI Hierarchy
Primary reads: score/time/effects/warnings. Strong contrast over decorative density.

## North Star

Keep `DOM Racer` readable, funny, and instantly playable: simple money rules, random power-up surprises, and a difficulty curve that slowly turns a familiar webpage into a hostile little indie arena.

## Phase Overview

| Phase | Status | Goal |
|---|---|---|
| 1 | `done` | Core money loop |
| 2 | `done` | Overgrowth difficulty |
| 3 | `done` | Airplane world-event |
| 4 | `done` | Indie juice (near-miss, objectives, jackpot) |
| 5 | `done` | Production hardening + tests |
| 6 | `done` | README, branding, presentation |
| 7 | `done` | Micro-polish & feel tweaks |
| 8 | `done` | Player experience & store readiness |

## Phase Summaries

**Phase 1 — Core Money Loop:** Unified coin rules, staged spawn queue, special item cadence, surface classification (img/video/canvas → ice, SVG → boost). COOLDOWN and LURE specials added. Manual verification on real page types remains as a nice-to-do.

**Phase 2 — Overgrowth:** Bushes/trees grow from barrier edges after 35s. Three stages: small (slow zone) → medium (slow zone) → large (wall). Spawns every 9-15s, max 8 nodes. Renders with sway animation and smooth entry.

**Phase 3 — Airplane Event:** Five drop modes (bonus drop, coin trail, spotlight, lucky wind, police delay). Fallback-safe. Compact silhouette with white contour borders.

**Phase 4 — Indie Juice:** Near-miss bonus (+3-5 score, rotating toasts, 800ms cooldown). Coin-collection objectives with x2/x3/x4 tiers and countdown timers. Rare jackpot pickup (~6% chance, +50-100 score, golden star sprite).

**Phase 5 — Production Hardening:** 17 extractions from Game.ts into focused runtime modules. 79 smoke tests across 8 files. ESLint + Prettier. Sprite helpers in `sprites/` subdirectory. Constants centralized in `gameConfig.ts`. JSDoc on 25+ public APIs. MIT LICENSE, privacy policy, `npm run package` for Chrome Web Store ZIP.

**Phase 6 — Presentation:** README with playful voice, roadmap, feature docs. Branding SVGs redesigned with blue coupe (body-inside-cabin layout). PNGs regenerated. Store listing document prepared. Screenshot captures remain as manual task.

**Phase 7 — Micro-Polish:** 10 feel tweaks: police siren flash, coin burst particles, tire dust, speed lines, landing squash, run counter, "NEW BEST!" celebration, lifetime milestones, page-reactive tint, drift sparks.

**Phase 8 — Player Experience:** First-play hint overlay. Run summary + letter grade on game-over. Daily modifier (5 rule twists). Sound enrichment (coin pitch, near-miss whoosh, objective chime). Score-gated vehicle unlocks (buggy at 500, truck at 1500). Police chase escalation (longer chases over time). GOAL panel unified with POWER panel pattern. Version 1.0.0.

## Remaining Manual Tasks

- [ ] Play-test on real page types (GitHub, docs, forms, dashboards)
- [ ] Capture screenshots/GIFs for README and store listing
- [ ] Upload to Chrome Web Store (`npm run package` → upload ZIP)

## Practical Learnings

- Bright pages need dark keylines or white contour borders on sprites
- Independent event timers create noisy overlap; encounter stagger improves readability
- Adaptive effect resolution (`BLACKOUT` → `INVERT` on dark surfaces) must be mirrored in HUD labels
- White contour borders on all vehicle/airplane sprites improve visibility
- Sound effects timed to visual entry, not encounter creation
- FLOW combo system was removed — players found blue coins confusing. Keep economy simple.
- Survive-type objectives were removed — redundant with police escape. Goals should be action-oriented.
- Per-entry headers in stacked panels are noisy — one title + bar rows (like POWER panel) is cleaner.

## Success Criteria

A good run should feel like:
- early: clean, readable, inviting
- mid: routing decisions, specials, rising police pressure
- late: overgrown map, tighter routes, high-score tension
- failure: stylish and readable, immediate desire to retry

## Notes For Future Models

Before making major changes:
- read `README.md` and this file
- inspect `src/game/Game.ts`, `src/content/domScanner.ts`, `src/content/worldBuilder.ts`
- preserve simple readable money language
- preserve non-violent playful vibe
- avoid mechanics that make the page feel sloppy, draggy, or visually muddy
