# DOM Racer Execution Plan

## Document Purpose

This file is the execution-ready roadmap for `DOM Racer`.

It is meant to help any model or contributor quickly understand:

- what the game is
- what already exists
- what the intended vibe is
- what the next phases are
- which items are `planned`, `in progress`, or `done`

Update this file as work lands so it stays useful as a handoff document.

## Status Legend

- `planned`: not started yet
- `in progress`: partially implemented or currently being built
- `done`: implemented and intentionally kept
- `blocked`: waiting on a decision, dependency, or redesign

## Project Context

### What DOM Racer Is

`DOM Racer` is a Chrome / Edge extension that turns the visible DOM of the current page into a playable top-down arcade racer.

The game runs as a content-script overlay on top of real websites.

### Core Fantasy

- the page becomes the track
- visible UI becomes loot and geometry
- the run starts clean and readable
- over time the page becomes stranger, denser, and more dangerous
- the player chases score, combos, specials, and survival

### Intended Vibe

- playful
- weird
- stylish
- light indie-arcade energy
- more "cool coding waiting-room toy" than serious action game

Avoid turning it into a war game, military game, or heavy destruction game.

### Current Baseline

As of this plan version, the game already includes:

- overlay toggle on `Shift + R` (with alternate ``Shift + ` ``)
- player car with multiple vehicle designs (coupe, buggy, truck)
- page scanning for walls, barriers, boosts, ice zones, and pickups
- score + time HUD with active power panel
- page best / lifetime best persistence
- random special items with spawn cue rings
- power-ups: `MAGNET`, `INVERT`, `GHOST`, `BLACKOUT` (adaptive on dark pages), `COOLDOWN`, `LURE`
- police warning + chase with `GAME OVER` screen and `Space` restart
- immediate auto-pause with overlay on focus loss
- airplane flyover with five drop modes (bonus drop, coin trail, spotlight, lucky wind, police delay)
- priority-based toast system with duplicate handling
- hidden `Shift + D` sprite showcase with auto contrast pick
- sound toggle and vehicle toggle
- extension/store branding assets (pending refresh)

### Current Controls

- `Shift + R` or ``Shift + ` ``: toggle game
- `WASD` / arrow keys: drive
- `R`: restart run
- `V`: switch vehicle
- `M`: toggle sound
- `Shift + D`: sprite showcase debug mode
- `Esc`: quit
- on police `GAME OVER`: `Space` restart, `Esc` quit

### Current Architecture Map

- `src/content/`: page integration, scanning, overlay bootstrapping
- `src/game/`: game loop, rendering, HUD, player, audio, pickups
- `src/shared/`: shared types, settings, persistence, utilities
- `public/`: extension manifest and shipped assets
- `branding/`: icon and marketplace asset sources

### Design Rules To Preserve

- Keep the game readable within seconds.
- Keep normal money rules simple.
- Let special moments feel surprising, not noisy.
- Prefer escalating route pressure over raw chaos.
- Favor humorous or stylish events over violent ones.
- Avoid mechanics that make the whole page uniformly slippery, draggy, or visually confusing.

## Production Research Notes (Persisted)

These notes are intentionally kept here to guide future passes.

### 1) Telegraphing and fairness (Mike Stout)

Source: [Enemy Attacks and Telegraphing](https://www.gamedeveloper.com/design/enemy-attacks-and-telegraphing)

- Keep challenge in overlapping clear questions, not surprise ambiguity.
- Major events should have readable pre-cues (`WEE-OO`, `NYOOM`) and enough response window.
- Difficulty should come from route pressure and timing overlap, not hidden state changes.

### 2) Mechanics -> Dynamics -> Aesthetics (MDA)

Source: [MDA framework overview](https://en.wikipedia.org/wiki/MDA_framework)

- Lock target feeling first, then tune mechanics.
- For `DOM Racer`: keep event roles distinct:
  - police = pressure/chase
  - airplane = opportunity/route moment
  - regular coins = simple economy baseline
- Reject mechanics that blur roles or reduce first-glance readability.

### 3) Game feel iteration and signal density (Vlambeer / Nijman)

Source: [Interview on Nuclear Throne feel](https://www.rockpapershotgun.com/interview-jan-willem-nijman-on-nuclear-thrones-feel)

- Prioritize "maximum output for minimum input" with concise feedback loops.
- Tune in short playtest cycles with a small number of knobs at a time.
- Keep feedback layers additive but controlled; avoid audio/visual stack noise during key events.

### 4) UI hierarchy for moment-to-moment play

Sources:
- [HUD readability patterns](https://www.indiedevguide.com/articles/game-hud-design-techniques-ui-ux-indie-devs/)
- [UI mistakes in indie games](https://thedexigner.com/blog/ui-mistakes-in-indie-games-and-how-to-dodge-them/)

- Keep primary HUD reads to score/time/effects/critical warnings.
- Preserve strong contrast and concise labels over decorative text density.
- Add presentation only when it does not compete with chase and route perception.

## North Star

Keep `DOM Racer` readable, funny, and instantly playable: simple money rules, random power-up surprises, and a difficulty curve that slowly turns a familiar webpage into a hostile little indie arena.

## Phase Overview

| Phase | Status | Goal |
|---|---|---|
| Phase 1 | `done` | Clean up the core money loop |
| Phase 2 | `done` | Add overgrowth difficulty with trees and bushes |
| Phase 3 | `done` | Add airplane world-event prototype |
| Phase 4 | `planned` (deferred) | Add research-driven indie juice systems |
| Phase 5 | `done` | Production hardening and test coverage |
| Phase 6 | `in progress` | README / presentation / branding pass |

## Phase 1: Core Money Loop

Status: `done` (manual verification blocked)

All implementation work is complete: unified coin rules, staged spawn queue, special item cadence, balance pass, surface behavior refresh (img/picture/video/canvas -> ice, reactive surfaces -> boost), visual clarity cleanup, and sand rejection.

### Remaining (blocked)

- [ ] Manual verification on target page types (GitHub, docs, forms, grid-heavy) — requires interactive browser session
- [ ] Focused bonus item review after verification pass
- [x] Prototype best 1-2 new specials from shortlist: `COOLDOWN` and `LURE` implemented

## Phase 2: Overgrowth Difficulty

Status: `done`

Goal: create a visible mid-to-late-run difficulty ramp with bushes and trees that grow from border/barrier structures over time.

Completed:
- [x] Data model: `OvergrowthNode` with kind (bush/tree), stage (small/medium/large), anchor edge, growth timer
- [x] Spawn logic: time-gated (35s threshold), interval-based (9-15s), capped at 8 nodes, spawns from barrier/obstacle edges
- [x] Growth stages: small (10px depth) -> medium (20px, after 6s) -> large (32px, after 10s more)
- [x] Collision: small/medium stages act as slow zones, large stage acts as wall/obstacle
- [x] Integrated into Game.ts tick loop, beginRun reset, stop cleanup, and pickup spawn blockers
- [x] 8 smoke tests covering spawn timing, growth progression, collision classification, and lifecycle integration

Remaining:
- [x] Rendering: draw overgrowth nodes on canvas (bush/tree shapes, growth animation)
- [x] Tuning pass: reviewed timing/depth/density — current values well-balanced, no changes needed

## Phase 3: Airplane Event

Status: `done`

All five drop modes implemented: bonus drop, coin trail, spotlight, lucky wind, police delay. Boost lane was prototyped and removed (confusing visual). Garden trim deferred until overgrowth exists.

Airplane sprite has been tuned for readability: compact silhouette, white contour borders, flyover sound plays on viewport entry, drops center directly under the plane.

## Phase 4: Indie Juice Research Pass

Status: `planned` (deferred)

Candidate ideas: near-miss bonus, police helicopter escalation, risk-lane opportunities, page mood variants, micro-objectives, rare jackpot, daily modifiers.

Not started. Deferred until Phase 1 verification and overgrowth are further along.

## Phase 5: Production Hardening

Status: `done`

All bounded structural cleanup extractions from `Game.ts` are complete (17 extractions across encounterRuntime, gameRunStateRuntime, gameRenderRuntime, gameEffectsRuntime, pickupSpawnRuntime, planeDropRuntime, gameEconomyRuntime, gameHudAudioRuntime, gameInputRuntime, gameOverlays). `Game.ts` retains only side-effect orchestration, core loop, and render assembly.

Completed:
- Debug API removed, scanner/runtime drift resolved, stale branches cleaned
- 46 smoke tests covering scanner->world, coin staging, specials independence, police catch flow, surface classification, magnet/cue/warning behavior, cooldown/lure activation and pull, overgrowth spawn/growth/collision
- Release build profile (sourcemaps off), permissions doc, release checklist
- No `__domRacerDebug` in source or build
- Duplicate `parseCssColor`/`rgbToHsl` extracted from domScanner and main into `src/shared/color.ts`
- Duplicate `cloneRect` removed from `pickupSpawnRuntime.ts`; now imports from `gameRuntime.ts`

## Phase 6: README / Presentation

Status: `in progress`

### README — `done`

Indie/playful voice, "why this is fun" section, living roadmap table, airplane events section, store-friendly pitch block, screenshot section.

### Presentation Assets — `in progress`

- [x] Normal run screenshot captured
- [ ] Capture: special pickup, police chase, police GAME OVER, overgrowth state

### Branding Refresh — `done`

Goal: make extension icon and store assets match the actual in-game vehicles instead of using a generic placeholder car.

Completed:
- [x] Redesigned `dom-racer-icon.svg` using the blue coupe (default vehicle) with top-down perspective
- [x] Updated `dom-racer-store-tile.svg` — fixed text overflow, all text/pills fit within 440x280 bounds
- [x] Updated `dom-racer-store-cover.svg` — gameplay mockup with car, HUD, DOM elements, police warning
- [x] Car design: body as main outline with cabin/roof inside (no cross-pattern), windshield + rear window as horizontal glass bands
- [x] Colors match in-game: body #2563EB, cabin #1D4ED8, wheels #111827 with #F8FAFC border, red taillights #EF4444
- [x] Updated `generate_assets.py` to read SVGs from disk instead of embedding duplicate strings
- [x] Regenerated PNGs via `npm run brand` (icon16–512, promo tile, store cover)

## Practical Learnings

Accumulated from playtest and tuning sessions:

- Bright/low-contrast pages require explicit dark keylines or white contour borders on sprites
- Plane readability issues came from silhouette layering, not just scale
- Independent timers for major events create noisy overlap; encounter stagger dramatically improves readability
- Adaptive effect resolution (`BLACKOUT` -> `INVERT` on dark surfaces) must be mirrored in HUD labels
- Surface mechanics are easier to feel with both handling change and speed/trajectory cues
- White contour borders on all vehicle/airplane sprites improve visibility on bright backgrounds
- Sound effects timed to visual entry (not encounter creation) provide better audio-visual correspondence

## Success Criteria

When this roadmap is working, a good run should feel like this:

- early game: clean, readable, inviting
- mid game: more routing decisions, specials, rising police pressure
- late game: overgrown map, tighter routes, high-score tension
- failure: stylish and readable, with immediate desire to retry

## Session Notes

### Session — 2026-03-12 (e)

- Implemented Phase 2 overgrowth rendering in `gameRenderRuntime.ts`
- Bush sprites: rounded leafy blobs with leaf-bump clusters, green tones darkening by stage
- Tree sprites: round canopy with visible trunk center, inner canopy detail for depth
- Visual distinction: small = subtle/transparent, medium = solid/darker, large = opaque with outlines
- Smooth entry animation via scale interpolation (0.6→1.0 over 1.2s) and alpha fade-in (0.7→1.0 over 0.8s)
- Gentle sway animation using sin-wave offset for life-like motion
- Wired `drawOvergrowthNodes` into render pipeline (after focus mode, before pickups/plane)
- Added overgrowth showcase section to `Shift+D` sprite debug mode (3 bush stages + 3 tree stages)
- Tuning pass: reviewed timing/density parameters, current values well-balanced for the difficulty curve
- Phase 2 overgrowth difficulty marked `done`
- 46 tests pass, build clean, no `__domRacerDebug` in source or dist

### Session — 2026-03-12 (d)

- Implemented Phase 2 overgrowth data model and spawn logic in `src/game/overgrowthRuntime.ts`
- `OvergrowthNode` type with bush/tree kinds, small/medium/large growth stages, anchor edge tracking
- Spawn from barrier/obstacle edges after 35s run threshold, 9-15s interval, max 8 nodes
- Growth progression: small (10px, 6s) -> medium (20px, 10s) -> large (32px wall)
- Collision: small/medium = slow zones, large = obstacles (integrated into player movement and pickup spawn blockers)
- Wired into Game.ts: tick update, beginRun reset, stop cleanup
- 8 new smoke tests (spawn timing, cap, barrier spawn, growth stages, collision classification, lifecycle)
- 46 tests pass, build clean, no `__domRacerDebug` in source or dist
- Rendering deferred to next session

### Session — 2026-03-12 (c)

- Prototyped two new specials: `COOLDOWN` (instant police timer pushback + score bonus) and `LURE` (timed wide-radius gentle coin pull, coins only)
- Added cooldown/lure to SpecialEffect type, random spawn pool, labels, colors, activation messages, HUD effects, flavor text, and sprite showcase
- Lure pull uses 300px radius with gentler force than magnet; only attracts regular coins, not specials
- Cooldown reuses police delay infrastructure (policeDelayCueTimerMs) for HUD display
- Slightly reduced preferred-effect bias (58% → 52%) to give new specials fair spawn presence
- 6 new smoke tests (cooldown activation, lure activation, lure pull, cooldown police delay, lure timer, lure flavor text)
- 38 tests pass, build clean, no `__domRacerDebug` in source or dist

### Session — 2026-03-12 (b)

- Redesigned all three branding SVGs: car uses body-inside-cabin layout (no cross pattern), proper proportions
- Fixed tile text overflow: shortened subtitle, repositioned pills, all content fits within 440x280
- Regenerated all PNGs via `npm run brand`
- 32 tests pass, build clean, no `__domRacerDebug` in source or dist

### Session — 2026-03-12 (a)

- Deduplicated `cloneRect` from `pickupSpawnRuntime.ts` (now imports from `gameRuntime.ts`)
- Deduplicated `parseCssColor`/`rgbToHsl` into `src/shared/color.ts`
- Initial branding SVG refresh (blue coupe colors, but proportions had cross-pattern issue)
- Regenerated all branding PNGs via `npm run brand`
- 32 tests pass, build clean, no `__domRacerDebug` in source or dist

## Notes For Future Models

Before making major changes:

- read `README.md`
- read this file
- inspect `src/game/Game.ts`, `src/content/domScanner.ts`, `src/content/worldBuilder.ts`, and `src/game/hud.ts`
- preserve the simple readable money language
- preserve the non-violent playful vibe
- avoid adding mechanics that make the page feel sloppy, draggy, or visually muddy
