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
- the player chases score, specials, and survival

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
- player car with multiple vehicle designs (coupe, buggy, truck) — score-gated unlocks
- page scanning for walls, barriers, boosts, ice zones, and pickups
- score + time HUD with active POWER panel and bottom-center GOAL panel
- page best / lifetime best persistence, run counter, lifetime milestones
- random special items with spawn cue rings
- power-ups: `BONUS`, `MAGNET`, `INVERT`, `GHOST`, `BLACKOUT` (adaptive on dark pages), `COOLDOWN`, `LURE`, rare `JACKPOT`
- police warning + chase with escalating duration, `GAME OVER` screen and `Space` restart
- immediate auto-pause with overlay on focus loss
- airplane flyover with five drop modes (bonus drop, coin trail, spotlight, lucky wind, police delay)
- overgrowth difficulty: bushes and trees grow from barriers after ~35s
- near-miss bonus with whoosh sound and rotating orange toasts
- micro-objectives: coin-collection goals with x2/x3/x4 multiplier tiers and completion chime
- daily modifier: deterministic daily rule twist from pool of 5
- run summary with letter grade (S/A/B/C/D) on game-over screen
- first-play hint overlay for new players
- VFX particles: tire dust, coin burst, speed lines, drift sparks, landing squash
- page-reactive tint, "NEW BEST!" celebration, vehicle unlock toasts
- coin pickup pitch variation, near-miss whoosh, objective completion chime
- priority-based toast system with duplicate handling
- hidden `Shift + D` sprite showcase with auto contrast pick
- sound toggle and vehicle toggle
- extension/store branding assets (refreshed with in-game blue coupe)

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
- `src/game/`: game loop, rendering, HUD, player, audio, pickups, runtime helpers
- `src/game/sprites/`: reusable sprite renderers (player, police, plane, pickups, shared helpers)
- `src/game/gameConfig.ts`: centralized tuning constants for all gameplay systems
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
| Phase 4 | `done` | Add research-driven indie juice systems |
| Phase 5 | `done` | Production hardening and test coverage |
| Phase 6 | `done` | README / presentation / branding pass |
| Phase 7 | `done` | Micro-polish & feel tweaks |
| Phase 8 | `done` | Player experience & store readiness |

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

Status: `done`

Candidate ideas: near-miss bonus, police helicopter escalation, risk-lane opportunities, page mood variants, micro-objectives, rare jackpot.

Completed:
- [x] Near-miss bonus: detect close calls with obstacles/police, award +3-5 score, show floating "CLOSE!" / "TIGHT!" / "RAZOR!" / "WHEW!" toast, 800ms cooldown, flavor text at 4+ and 8+ near-misses
- [x] Micro-objectives: per-run coin-collection goals with 6 templates across x2/x3/x4 tiers, HUD panel, scaled score bonus on completion, flavor text at 3+ and 6+ completed
- [x] Rare jackpot pickup: very rare special (~6% chance when a special would spawn), large score bonus (+50-100), golden star sprite with pulsing glow and sparkle particles, "JACKPOT!" toast

## Phase 5: Production Hardening

Status: `done`

All bounded structural cleanup extractions from `Game.ts` are complete (17 extractions across encounterRuntime, gameRunStateRuntime, gameRenderRuntime, gameEffectsRuntime, pickupSpawnRuntime, planeDropRuntime, gameEconomyRuntime, gameHudAudioRuntime, gameInputRuntime, gameOverlays). `Game.ts` retains only side-effect orchestration, core loop, and render assembly.

Completed:
- Debug API removed, scanner/runtime drift resolved, stale branches cleaned
- 72 smoke tests covering scanner->world, coin staging, specials independence, police catch flow, surface classification, magnet/cue/warning behavior, cooldown/lure activation and pull, overgrowth spawn/growth/collision, near-miss detection, micro-objectives, jackpot activation
- Release build profile (sourcemaps off), permissions doc, release checklist
- No `__domRacerDebug` in source or build
- Duplicate `parseCssColor`/`rgbToHsl` extracted from domScanner and main into `src/shared/color.ts`
- Duplicate `cloneRect` removed from `pickupSpawnRuntime.ts`; now imports from `gameRuntime.ts`
- ESLint (flat config, typescript-eslint) + Prettier added; `npm run lint` and `npm run format` scripts available
- Sprite drawing helpers extracted to `src/game/sprites/spriteHelpers.ts`, all sprite files moved to `sprites/` subdirectory
- Tuning constants centralized in `src/game/gameConfig.ts` with 13 organized sections
- `readonly` annotations on constant arrays/records, JSDoc on 25+ key exported functions, dead code removed

## Phase 6: README / Presentation

Status: `done` (screenshot captures remain blocked on interactive browser; code quality sweep complete)

### README — `done`

Indie/playful voice, "why this is fun" section, living roadmap table, airplane events section, store-friendly pitch block, screenshot section. Overgrowth, near-miss, micro-objectives, and jackpot sections added. Roadmap table updated with accurate statuses.

### Presentation Assets — `blocked`

- [x] Normal run screenshot captured
- [ ] Capture: special pickup, police chase, police GAME OVER, overgrowth state, near-miss graze, jackpot, micro-objective HUD — blocked on interactive browser session

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

## Phase 7: Micro-Polish & Feel Tweaks

Status: `done`

Small, high-impact tweaks drawn from indie game juice research. Each item is independently shippable in one bounded session. None change core mechanics — they add feedback, atmosphere, and retention.

### Research Sources

- Vlambeer / Jan Willem Nijman: "maximum output for minimum input" — every player action should produce visible, audible, satisfying feedback
- GameAnalytics juice framework: prioritize the 10 most frequent player actions and add layered feedback to each
- js13kgames retention research: run streaks and lightweight daily goals are the cheapest retention mechanics with the highest ROI
- Dust Racing 2D / speedlines: tire marks and speed lines are the canonical top-down racer juice

### Candidates (pick per session, easiest-to-hardest)

**Visual juice (pure feel, no gameplay change):**

- [x] **Tire dust particles**: tiny fading circles behind the car while driving (1-2 particles per frame, 300ms lifetime, match surface color — gray on normal, white on ice, green on boost). Makes movement feel weighty and grounded. Implementation: VfxParticle system in gameRenderRuntime, ~30 lines.
- [x] **Coin pickup burst**: 4-6 tiny yellow sparkle particles that burst outward when a coin is collected, then fade over 200-300ms. Makes every coin feel satisfying, not just a score increment. Implementation: spawnCoinBurstParticles in gameRenderRuntime, ~25 lines.
- [x] **Speed lines**: thin semi-transparent lines that streak past the car at high velocity (above ~70% max speed). Creates a sense of velocity on boost zones. Implementation: 3-5 lines drawn relative to car heading, ~20 lines.
- [x] **Police siren flash**: alternating red/blue glow on the police car body (120ms cycle) once it enters chase mode. Reads as "cop car" immediately, builds tension. Already has WEE-OO audio cue — this adds the visual half. Implementation: conditional fill swap in policeSprite, ~10 lines.
- [x] **Landing squash**: when the car returns from airborne state (plane drop), brief 150ms squash-and-stretch animation (scale 1.2x wide, 0.8x tall, then bounce back). Classic cartoon weight feel. Implementation: scale transform in playerSprite render, ~15 lines.

**Retention & progression (lightweight persistence):**

- [x] **Run counter**: show "RUN #N" on the start/restart overlay. Increment a persistent counter in `chrome.storage.local` each time the player begins a run. Makes each attempt feel like progress even on bad runs. No gameplay effect. Implementation: one counter in settings, display in gameOverlays, ~20 lines.
- [x] **"NEW BEST!" celebration**: when the player beats their page best score, show a celebratory "NEW PAGE BEST!" toast in gold with a brief starburst particle effect. Currently the best score updates silently. Implementation: comparison check in score persistence, toast + particles, ~25 lines.
- [x] **Lifetime milestones**: at lifetime score milestones (500, 1000, 2500, 5000, 10000), show a one-time toast. Simple `chrome.storage.local` check. Gives long-term players occasional surprise pops. Implementation: ~15 lines.

**Atmosphere (mood without noise):**

- [x] **Page-reactive tint**: instead of pure transparent overlay, very subtly tint the game arena based on the page's dominant color (6% opacity wash). A blue-dominant page gets a faint blue tint. Makes each page feel unique beyond just geometry. Uses existing `parseCssColor` infrastructure. Implementation: sample page bg color, apply faint overlay rect, ~15 lines.
- [x] **Drift sparks**: when the car changes direction sharply on boost surfaces (angular velocity > 0.08 rad), emit 2-3 tiny white/yellow spark particles. Signals the speed zone is active and rewards aggressive cornering visually. Implementation: angular velocity check + particle emit, ~20 lines.

### Priority Order (recommended)

1. Police siren flash (10 lines, instant atmosphere boost)
2. Coin pickup burst (25 lines, makes every coin satisfying)
3. Tire dust particles (30 lines, movement feels grounded)
4. Run counter (20 lines, free retention)
5. "NEW BEST!" celebration (25 lines, retention moment)
6. Speed lines (20 lines, velocity feel)
7. Landing squash (15 lines, cartoon weight)
8. Lifetime milestones (15 lines, long-term surprise)
9. Page-reactive tint (15 lines, unique feel per page)
10. Drift sparks (20 lines, advanced feel)

## Phase 8: Player Experience & Store Readiness

Status: `done`

These are the gaps between "good game" and "game people actually want to keep installed." Identified by looking at what happens during a real player's first 5 minutes and first 5 days.

### The First 10 Seconds Problem

Right now: press Shift+R, game starts, no context. 79% of players abandon games within 30 seconds if confused (PlayGama 2025 research). The fix is tiny:

- [x] **First-play hint overlay**: On the VERY FIRST run ever (check `runsStarted === 1` in persistence), show a 3-line semi-transparent overlay for 4 seconds: "WASD to drive / Collect coins / Avoid police". Then fade out. Never shows again. This is the cheapest possible onboarding with the highest abandon-rate reduction.

### The "Why Should I Play Again?" Problem

Right now: you die, you see your score, you press Space. But you don't know HOW the run went. Was it good? Was it interesting? Every roguelike and arcade game that retains players shows a run summary.

- [x] **Run summary on game-over screen**: Below the score, show 3-4 compact stats from the run: time survived, coins collected, near-misses landed, objectives completed. Just text, no fancy UI. Takes ~30 lines. Makes every run feel like it told a story — "wow I had 12 near-misses that time" is a reason to play again.
- [x] **Run grade**: Based on score + time + near-misses, assign a simple letter grade (D, C, B, A, S) shown big on game-over. Players will chase S-rank on their favorite pages. One-line formula, enormous replay motivation.

### The "One More Day" Problem

Run counter and milestones help, but there's no reason to come back TOMORROW specifically. The js13kgames research says daily variety is the cheapest retention mechanic.

- [x] **Daily modifier**: Each calendar day, deterministically pick one small rule twist from a pool of 5: "Double coins", "Fast police", "Extra specials", "Slippery everywhere", "Overgrowth starts early". Show the daily modifier name on the start overlay ("TODAY: DOUBLE COINS"). Uses `new Date().toDateString()` as seed — no server needed. Gives every day a reason to check in.

### Sound Enrichment

The game has a sound toggle but the audio layer is thin. Sound reaches the brain faster than visuals (Creator Sounds Pro research) and is the fastest way to add juice.

- [x] **Coin collect sound variation**: Slightly randomize pitch (±10%) on each coin pickup so it doesn't feel repetitive. One line change if the audio system supports it.
- [x] **Near-miss whoosh**: A brief, quiet "fwip" sound on near-miss trigger. Confirms the close call before the toast even appears.
- [x] **Objective completion chime**: A small "ding" on micro-objective completion. Pairs with the violet toast for a satisfying double-feedback moment.

### Vehicle Unlocks (Cosmetic Progression)

The game has 3 vehicle designs (coupe, buggy, truck) but they're all available from the start. Unlocking through play creates a reason to keep going.

- [x] **Score-gated vehicle unlocks**: Start with only the coupe. Unlock buggy at 500 lifetime total score, truck at 1500. Show "UNLOCKED: BUGGY" toast when lifetime score crosses threshold. Vehicle cycling (V key) only shows unlocked vehicles. Derived from lifetime total score — no separate persistence.
- [ ] **Color variants** (stretch): At higher milestones (3000, 5000), unlock gold or chrome color variants of existing designs. Reuse the same sprite drawing with different fill colors.

### Chrome Web Store Readiness

- [x] **License file**: MIT license added
- [x] **Privacy policy**: Added to README — no data collection, no analytics, no network requests, all local storage
- [x] **Manifest description update**: Updated to "Turn any webpage into a tiny arcade track — collect coins, dodge police, and survive the overgrowth."
- [x] **Version bump**: 0.1.0 -> 1.0.0 in manifest.json and package.json
- [x] **Package script**: `npm run package` builds and creates `dom-racer-1.0.0.zip` ready for Chrome Web Store upload

### Priority Order

1. First-play hint overlay (biggest abandon-rate fix, ~15 lines)
2. Run summary stats on game-over (~30 lines)
3. Run grade (S/A/B/C/D) on game-over (~15 lines)
4. Daily modifier (~40 lines, needs careful design but enormous retention value)
5. Coin collect pitch variation (~5 lines)
6. Near-miss whoosh sound (~10 lines)
7. Objective completion chime (~10 lines)
8. Score-gated vehicle unlocks (~25 lines)
9. License + privacy policy + manifest (docs only)
10. Version bump to 1.0.0 (last step before store submission)

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

### Session — 2026-03-13 (u)

- Production readiness pass: full documentation update and FLOW reference cleanup
- Updated README.md: added BONUS to power-ups list (8 total), updated micro-objectives section to reflect simplified coin-only goals with x2/x3/x4 multiplier tiers, added sound enrichment details to features list
- Updated SOUL.md: expanded Current Baseline with all Phase 7-8 features (daily modifier, run grade, vehicle unlocks, VFX, near-miss, objectives), removed stale FLOW mentions from Phase 4
- Updated docs/store-listing.md: removed FLOW streak references, updated gameplay and objectives descriptions
- Updated docs/release-checklist.md: added daily modifier smoke check
- Updated .cursor/rules/next-session.mdc: refreshed essential context with simplified objectives and police escalation
- Removed `'flow'` from `HudEffectKind` type union in `src/shared/types.ts`
- Verified: no `FLOW`, `__domRacerDebug`, or combo references remain in src/
- 79 tests pass, build clean, lint clean

### Session — 2026-03-12 (o)

- Phase 7 micro-polish: implemented 4 more feel tweaks (run counter, NEW BEST!, speed lines, landing squash)
- Run counter: persistent `runsStarted` in profile, incremented on `beginRun`, displayed as "RUN #N" toast at run start and on game-over screen
- "NEW BEST!" celebration: detects when score exceeds `pageBestScoreAtRunStart`, fires gold (#facc15) "NEW BEST!" toast + 8-10 gold particle burst, one-shot per run
- Speed lines: 3-5 thin white streaks (alpha 0.15-0.25) drawn opposite to heading when speed > 70% of max, ~40-80px long, within ~60px radius of car
- Landing squash: `landingTimerMs` in Player, detects airborne->grounded transition, 150ms squash-and-stretch (1.15x wide, 0.85x tall easing back to 1.0), applied via `scaleX`/`scaleY` in playerSprite render
- Added `spawnNewBestBurstParticles` and `drawSpeedLines` to `gameRenderRuntime.ts`
- Added `incrementRunCount` and `lifetimeRunsStarted` to settings/profile persistence
- Added `onRunStarted` callback and `initialRunCount` to GameOptions
- "RUN #N" and "NEW BEST!" added to game-over overlay and toast showcase
- 75 tests pass, build clean, lint clean, no `__domRacerDebug` in source or dist

### Session — 2026-03-12 (m)

- Final production readiness: code quality sweep and lint hardening
- Removed duplicate `randomBetween` function from `player.ts` (now imports from `gameRuntime`)
- Added `readonly` annotations to 7 constant arrays/records in `gameRuntime.ts` (`RANDOM_SPECIAL_EFFECTS`, `SPECIAL_LABELS`, `SPECIAL_COLORS`, `SPECIAL_COLOR_NAMES`, `VEHICLE_DESIGNS`, `VEHICLE_LABELS`, `SHOWCASE_THEMES`)
- Added `readonly` to `OBJECTIVE_TEMPLATES` in `microObjectiveRuntime.ts`
- Added `readonly` to `PAGE_LIGHTNESS_SAMPLE_POINTS`, `BUSH_STAGE_STYLES`, `TREE_STAGE_STYLES` in `gameRenderRuntime.ts`
- Added JSDoc comments on 25+ key exported functions across all runtime modules
- No `as any` casts found in src/ (only in tests, which is expected)
- All exported functions already had return type annotations
- Ran full lint:fix + format pass — zero issues
- 72 tests pass, build clean, lint clean, format clean, no `__domRacerDebug` in source or dist
- All production readiness tasks (items 2-6 in next-session) marked complete

### Session — 2026-03-13 (t)

- Chrome Web Store preparation: MIT LICENSE, privacy policy in README, manifest description update, version bump 0.1.0 → 1.0.0
- Added `npm run package` script (builds + zips dist/ into dom-racer-1.0.0.zip)
- Added *.zip to .gitignore
- Phase 8 marked `done` — all player experience and store readiness items complete
- 79 tests pass, build clean, lint clean, no `__domRacerDebug` in source or dist

### Session — 2026-03-13 (s)

- Phase 8 player experience: daily modifier, sound enrichment, vehicle unlocks
- Daily modifier: deterministic daily rule twist from pool of 5 (DOUBLE_COINS, FAST_POLICE, EXTRA_SPECIALS, SLIPPERY, EARLY_OVERGROWTH). Hash of `toDateString()` selects modifier. Shown as "TODAY: X" toast at run start. Per-run overrides — config values not permanently changed.
- Sound enrichment: coin pickup pitch randomized ±10%, near-miss whoosh (sine sweep 2200→600Hz, 50ms), objective completion chime (800Hz + 1200Hz sine, 100ms)
- Score-gated vehicle unlocks: coupe always available, buggy at 500 lifetime total score, truck at 1500. V key only cycles unlocked vehicles. Unlock toast shown when threshold crossed after run. Added `VEHICLES` config section, `getUnlockedVehicleDesigns`, `getNextUnlockedVehicleDesign` to gameRuntime, `lifetimeTotalScore` to ScoreSummary/GameOptions.
- Added `spawnStartMs` optional param to `resolveOvergrowthSpawnStep` for EARLY_OVERGROWTH modifier
- 79 tests pass, build clean, lint clean, no `__domRacerDebug` in source or dist

### Session — 2026-03-12 (r)

- Phase 8 player experience: first-play hint, run summary, run grade
- First-play hint overlay: shows "WASD to drive / Collect coins / Avoid police" for 4s on very first run (runNumber === 1), fades out over 500ms, never shows again
- Run summary stats on game-over: compact one-line stats below score showing TIME, COINS, CLOSE (near-misses), OBJ (objectives completed)
- Run grade: large colored letter grade (S/A/B/C/D) between score and stats on game-over screen, based on score and time thresholds
- Expanded `GameOverState` to carry run stats (elapsedMs, coinsCollected, nearMisses, objectivesCompleted) captured at moment of game over
- 79 tests pass, build clean, lint clean, no `__domRacerDebug` in source or dist

### Session — 2026-03-12 (l)

- Production readiness: constants organization and file structure
- Created `src/game/gameConfig.ts` with 11 organized config sections: `TIMING`, `TOAST`, `COINS`, `SPECIALS`, `EFFECTS`, `JACKPOT`, `POLICE`, `PLANE`, `ENCOUNTER`, `OVERGROWTH`, `NEAR_MISS`, `OBJECTIVES`, `PLAYER`
- All key tuning parameters (timing thresholds, scoring, spawn intervals, physics, probabilities) centralized and discoverable
- Refactored `gameRuntime.ts` to re-export legacy named constants from `gameConfig` for backward compatibility
- Refactored `player.ts` to import physics constants from `PLAYER` config section
- Refactored `overgrowthRuntime.ts`, `nearMissRuntime.ts`, `microObjectiveRuntime.ts`, `gameEffectsRuntime.ts` to source constants from `gameConfig`
- Moved 5 sprite files into `src/game/sprites/` subdirectory: `spriteHelpers.ts`, `playerSprite.ts`, `policeSprite.ts`, `planeSprite.ts`, `pickupSprites.ts`
- Created `src/game/sprites/index.ts` barrel export with all public sprite APIs
- Updated all imports across `Game.ts`, `encounterRuntime.ts`, `gameRenderRuntime.ts`, `gameOverlays.ts`, `gameStateTypes.ts`, `player.ts`
- 72 tests pass, build clean, lint clean, no `__domRacerDebug` in source or dist

### Session — 2026-03-12 (k)

- Production readiness: sprite drawing consolidation
- Created `src/game/spriteHelpers.ts` with 4 reusable canvas drawing primitives: `drawBorderedRect`, `drawWheel`, `drawContourOutline`, `traceStarPath`
- Refactored `playerSprite.ts`: removed local `drawWheel`, replaced 7 rounded-rect patterns and 2 contour outlines with helpers
- Refactored `policeSprite.ts`: removed local `drawPoliceWheel`, replaced 4 rounded-rect patterns with helpers, parameterized wheel halfHeight (1.8 vs 1.75)
- Refactored `planeSprite.ts`: replaced body shadow and body bordered-rect patterns with helpers
- Refactored `pickupSprites.ts`: replaced special pickup body pattern and 2 star path loops with helpers
- Overgrowth rendering in `gameRenderRuntime.ts` uses ellipses (not rounded rects), so no helper overlap — left unchanged
- Visual output is identical — pure refactor, no design changes
- 72 tests pass, build clean, lint clean, no `__domRacerDebug` in source or dist

### Session — 2026-03-12 (j)

- Added ESLint (flat config with typescript-eslint) and Prettier to the project
- ESLint rules: consistent-type-imports, no-unused-vars (with _ prefix ignore), eqeqeq, no-explicit-any (warn in src, off in tests)
- Prettier: singleQuote, trailingComma all, printWidth 100
- Formatted entire codebase with Prettier, fixed all ESLint errors
- Added `lint`, `lint:fix`, `format`, `format:check` npm scripts
- Updated README Development section with new scripts
- 72 tests pass, build clean, no `__domRacerDebug` in source or dist

### Session — 2026-03-12 (i)

- Updated README.md with full documentation for new gameplay systems
- Added Overgrowth section: difficulty ramp with bushes/trees growing from barriers
- Added Near-Miss Bonus section: +3-5 score for grazing walls/police, rotating orange toasts
- Added Micro-Objectives section: per-run mini-goals, +25 bonus, violet toasts, HUD panel
- Fixed Roadmap table: all phases 1-5 marked Done (previously had stale "Mostly done" and "In progress")
- Added 4 new screenshot/GIF placeholders: overgrowth state, near-miss graze, jackpot pickup, micro-objective HUD
- Added overgrowth, near-miss, micro-objectives to Current Features list
- Updated SOUL.md Phase 6 status to reflect README work is done, only screenshots blocked
- Updated release checklist with new systems (overgrowth, near-miss, micro-objectives, jackpot)
- Updated next-session handoff context
- 72 tests pass, build clean, no `__domRacerDebug` in source or dist

### Session — 2026-03-12 (h)

- Implemented Phase 4 rare jackpot pickup — final indie juice item
- Jackpot spawns with ~6% chance when a regular special would spawn (`JACKPOT_SPAWN_CHANCE = 0.06`)
- Larger pickup size (26px vs 20px) for visual weight
- Golden 6-pointed star sprite with pulsing outer glow, inner star highlight, and rotating sparkle particles
- On collection: instant +50-100 score bonus (random), "JACKPOT!" toast in gold (#facc15), high priority
- No timer, no side effects — purely a rare big-score moment
- Jackpot is NOT in the `RANDOM_SPECIAL_EFFECTS` pool; spawns via separate chance roll before `pickSpecialEffect`
- Longer spawn cue ring (1800ms vs 1200ms) to build anticipation
- Added to sprite showcase (8 specials now: bonus, magnet, invert, ghost, blackout, cooldown, lure, jackpot)
- Added "JACKPOT!" to showcase toast messages
- 6 new smoke tests (activation resolution, spawn chance range, pickup size, spawn with forced roll, regular spawn when roll fails, Game-level activation)
- Phase 4 marked `done` — all indie juice items complete
- 72 tests pass, build clean, no `__domRacerDebug` in source or dist

### Session — 2026-03-12 (g)

- Implemented Phase 4 micro-objectives system in `src/game/microObjectiveRuntime.ts`
- Pool of 6 objective templates: collect 5/8/12 coins, reach 80 pts, 3 close calls, grab special
- One active objective at a time, assigned after 6-10s initial delay, then 4-8s between completions
- On completion: +25 score bonus, rotating toast (NAILED!/DONE!/CLEAR!/CHECK!) in violet
- On failure/timeout: objective silently expires, new one assigned after 3-5s
- Survive-duration objectives succeed when timer expires (player stayed alive)
- Timed objectives (8 coins 20s) expire/fail when timer runs out before target reached
- No duplicate template assignment in a row; score-threshold objectives skip if score already ≥80% of target
- HUD: bottom-center panel with ★ label, progress text, thin progress bar (violet #a78bfa accent)
- Objective data flows through buildHudState: `objectiveText`, `objectiveProgress` fields on HudState
- Flavor text at 3+ objectives ("Checking boxes like a pro.") and 6+ ("Objective machine. HR wants a word.")
- Objective completion words added to sprite showcase toast messages
- State resets on beginRun and stop
- 12 new smoke tests (assignment delay, coin completion, timed expiry, survive completion, no-repeat template, score threshold skip, near-miss tracking, beginRun reset, HUD text format, completion words, flavor text, template pool)
- 66 tests pass, build clean, no `__domRacerDebug` in source or dist

### Session — 2026-03-12 (f)

- Implemented Phase 4 near-miss bonus system in `src/game/nearMissRuntime.ts`
- Near-miss detection: expand player rect by 5px threshold, check intersection without collision
- Awards +3 to +5 score per near-miss, with 800ms cooldown to prevent spamming
- Checks against active obstacles (barriers + large overgrowth) and police car (when chasing)
- Skips detection when player is airborne or ghost mode is active
- Four rotating toast messages: CLOSE!, TIGHT!, RAZOR!, WHEW! in orange (#fb923c)
- Near-miss flavor text: "Living on the edge. Literally." at 4+ misses, "Thread the needle much?" at 8+
- Near-miss count and cooldown reset on beginRun and stop
- Near-miss toast words added to sprite showcase debug mode
- Wired into Game.ts tick loop after dead spot check, before pickup collection
- 8 new smoke tests (isNearMiss true/false/far, cooldown blocking, trigger with score, police rect, beginRun reset, flavor text)
- 54 tests pass, build clean, no `__domRacerDebug` in source or dist

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

### Session — 2026-03-12 (n)

- Phase 7 micro-polish: implemented top 3 visual juice tweaks
- Police siren flash: alternating red (#ef4444) / blue (#3b82f6) body fill on 120ms cycle during chase phase in `policeSprite.ts`
- Coin pickup burst: 4-6 yellow sparkle particles burst outward from collection point, fade over 200-300ms
- Tire dust particles: 1-2 fading circles per frame behind car when speed > 50, surface-colored (gray/white/green), 300ms lifetime
- Added shared `VfxParticle` system in `gameRenderRuntime.ts`: update (in-place compact), draw, coin burst spawn, tire dust spawn, capped at 120 particles
- Added `getAngle()` to `Player` class for tire dust heading calculation
- Particles render between pickups and player sprite in the draw pipeline
- VFX particles reset on `beginRun` and `stop`
- 3 new smoke tests: particle expiration/cleanup, coin burst spawn, tire dust surface colors
- 75 tests pass, build clean, lint clean, no `__domRacerDebug` in source or dist

### Session — 2026-03-12 (q)

- Code organization pass: file splitting and module colocalization
- Extracted VFX particle system into `src/game/vfxRuntime.ts`: `VfxParticle` interface, `VFX_PARTICLE_CAP`, `updateVfxParticles`, `drawVfxParticles`, `spawnCoinBurstParticles`, `spawnNewBestBurstParticles`, `spawnTireDustParticles`, `spawnDriftSparkParticles`, `drawSpeedLines`
- Moved overgrowth rendering (`drawOvergrowthNodes`, bush/tree stage styles, entry scale helper) from `gameRenderRuntime.ts` into `overgrowthRuntime.ts` to colocate all overgrowth code
- `gameRenderRuntime.ts` reduced from 532 to 189 lines (base render utilities only)
- Split monolithic test file `gameInvariants.smoke.test.ts` (1978 lines, 77 tests) into 7 focused test files: `economy.smoke.test.ts` (15), `specials.smoke.test.ts` (15), `encounters.smoke.test.ts` (15), `overgrowth.smoke.test.ts` (8), `nearMiss.smoke.test.ts` (8), `objectives.smoke.test.ts` (12), `vfx.smoke.test.ts` (4)
- Created `tests/testHelpers.ts` with shared `createCanvas` and `createWorldWithRegularCoins` helpers
- Increased ESLint `maximumDefaultProjectFileMatchCount` to 20 for expanded test file count
- Updated `gameOverlays.ts` import for `drawOvergrowthNodes` to new location in `overgrowthRuntime`
- 79 tests pass, build clean, lint clean, no `__domRacerDebug` in source or dist

### Session — 2026-03-12 (p)

- FINAL Phase 7 micro-polish session: implemented last 3 feel tweaks
- Lifetime milestones: `shownMilestones` array in profile's `lifetime` object, checked after each `recordPageRun` via `checkAndMarkMilestones()`
- Milestones at 500/1000/2500/5000/10000 lifetime score, each fires once ever, "LT 1000!" toast in cyan (#22d3ee)
- Page-reactive tint: `getPageTintColor()` samples page center background color, returns `rgba(r,g,b,0.06)` string
- Tint sampled once on `beginRun`, stored as `pageTintColor`, drawn as fillRect before focus mode layer
- Drift sparks: `previousAngle` in Player, `getAngularDelta()` returns absolute wrapped delta
- Sparks emit when on boost + angular delta > 0.08 rad: 2-3 white/yellow particles, 150ms lifetime, scatter sideways from rear
- `spawnDriftSparkParticles` added to `gameRenderRuntime.ts`
- Phase 7 marked `done` — all 10 micro-polish items complete
- 75 tests pass, build clean, lint clean, no `__domRacerDebug` in source or dist

### Session — 2026-03-12 (q)

- Code organization pass: cleaned up gameRuntime.ts and reduced Game.ts
- Removed all 85 lines of legacy re-exported constants from `gameRuntime.ts`; consumers now import config groups directly from `gameConfig.ts`
- Moved `SurfaceSample` interface from `gameRuntime.ts` to `gameStateTypes.ts`
- Removed internal re-export aliases from `gameEffectsRuntime.ts` (INVERT_EFFECT_DURATION_MS etc. → direct EFFECTS.* usage)
- Updated 11 consumer files (Game.ts, encounterRuntime.ts, pickupSpawnRuntime.ts, planeDropRuntime.ts, gameRunStateRuntime.ts, gameEffectsRuntime.ts, gameHudAudioRuntime.ts, gameRenderRuntime.ts, specials.smoke.test.ts and more) to import from `gameConfig.ts` groups
- Extracted full police chase lifecycle into `resolvePoliceChaseTickStep` in `encounterRuntime.ts` with event-based side-effect dispatch
- gameRuntime.ts: 546 → 444 lines (lean utility + game-data module, no re-exports)
- Game.ts: 1957 → 1860 lines (import cleanup + police chase extraction)
- 79 tests pass, build clean, lint clean, no `__domRacerDebug` in source or dist

## Notes For Future Models

Before making major changes:

- read `README.md`
- read this file
- inspect `src/game/Game.ts`, `src/content/domScanner.ts`, `src/content/worldBuilder.ts`, and `src/game/hud.ts`
- preserve the simple readable money language
- preserve the non-violent playful vibe
- avoid adding mechanics that make the page feel sloppy, draggy, or visually muddy
