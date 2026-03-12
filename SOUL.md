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
- more “cool coding waiting-room toy” than serious action game

Avoid turning it into a war game, military game, or heavy destruction game.

### Current Baseline

As of this plan version, the game already includes:

- overlay toggle on `Shift + R`
- player car with multiple vehicle designs
- page scanning for walls, barriers, boosts, and pickups
- score + time HUD
- active power panel
- page best / lifetime best persistence
- random special items
- power-ups such as `MAGNET`, `INVERT`, `GHOST`, and `BLACKOUT`
- adaptive special behavior where dark-surface `BLACKOUT` resolves to `INVERT`
- police warning + chase
- police `GAME OVER` screen with explicit `Space` restart
- airplane warning + flyover `BON` drop event
- priority-based toast system with duplicate handling and eviction rules
- hidden `Shift + D` sprite showcase with theme switching and auto contrast pick
- sound toggle and vehicle toggle
- extension/store branding assets
- in-game debug visibility via sprite showcase mode (no page-level debug API)

### Current Controls

- `Shift + R`: toggle game
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

## Known Production Risks

These are already identified and should be addressed in the hardening phase.

- `deadSpot` / `hazard` branches still exist in runtime logic but are not currently produced by the scanner
- `src/game/Game.ts` is now a large multi-system runtime file and should be split by responsibility
- there is no automated gameplay regression harness yet for economy + police + airplane pacing behavior
- there is little to no automated coverage for scanner -> world -> gameplay transitions

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
| Phase 1 | `in progress` | Clean up the core money loop |
| Phase 2 | `planned` | Add overgrowth difficulty with trees and bushes |
| Phase 3 | `in progress` | Add airplane world-event prototype |
| Phase 4 | `planned` | Add research-driven indie juice systems |
| Phase 5 | `in progress` | Production hardening and test coverage |
| Phase 6 | `in progress` | README / presentation pass |

## Phase 1: Core Money Loop

Status: `in progress`

Goal: lock the core collectible loop before adding more chaos.

### 1. Pickup Source Audit

Status: `in progress`

- [x] Ensure regular money only comes from visible `links` and `buttons`
- [x] Remove any remaining normal-coin generation not backed by page button/link sources
- [ ] Verify scanner behavior on:
  - [ ] docs / article page
  - [ ] GitHub page
  - [ ] dashboard page
  - [ ] grid-heavy page like Google Calendar
- [x] Confirm that specials are the only random pickups not tied to page controls

Definition of done:

- every regular coin has a readable page source
- random ambient items are always specials, not normal money

### 2. Unified Coin Rules

Status: `done`

- [x] Make all regular coins the same size
- [x] Make all regular coins the same base score
- [x] Keep all regular coins visually unified
- [x] Keep `FLOW` readability by recoloring regular coins blue during active flow
- [x] Verify there is no leftover hidden distinction between button coins and link coins

Definition of done:

- players only read 2 normal coin states:
  - regular gold coin
  - regular blue `FLOW` coin

### 3. Staged Coin Spawn Queue

Status: `done`

- [x] Build a spawn queue from eligible link/button pickup anchors
- [x] Spawn only a limited starting batch at round start
- [x] Refill coins over time instead of front-loading all of them
- [x] Add a max visible coin cap
- [x] Add minimum spawn delay
- [x] Add slightly faster refill after collections
- [x] Prevent spawns on blocked / unsafe / unreachable positions

Suggested first tuning target:

- start with `6-10` visible coins
- refill every `1.5s-3s`
- allow small adaptive refill pressure after recent collections

Definition of done:

- the arena still has something to chase after the opening seconds

### 4. Random Special Item Cadence

Status: `done`

- [x] Keep specials independent from button/link pickups
- [x] Spawn specials at random valid positions
- [x] Limit simultaneous specials
- [x] Tune visible cadence for normal 60-90 second runs
- [x] Improve spawn feedback so special appearance is obvious but not noisy

Definition of done:

- a normal run usually shows multiple special opportunities

### 5. Balance Pass

Status: `done`

- [x] Tune starting visible coin count
- [x] Tune refill rate
- [x] Tune visible coin cap
- [x] Tune special frequency
- [x] Rebalance police timing against the new coin economy
- [x] Verify there are very few “empty map” moments

### 6. Visual Clarity Cleanup

Status: `in progress`

- [x] Remove the background grid layer from gameplay rendering
- [x] Remove decorative screen line borders from gameplay overlay UI
- [x] Keep HUD readability and hierarchy clear after border removal
- [x] Improve police and airplane sprite contrast for bright-page readability
- [x] Show sound state (`ON` / `OFF`) in the same HUD hint line as `M` and `SOUND`
- [x] Run a toast stacking readability pass (overlap/spacing/legibility when multiple messages are active)
- [ ] Verify the map still reads quickly without adding visual noise

### 7. Verification Pass

Status: `blocked`

- [ ] Manual test on GitHub repo page
- [ ] Manual test on long-form article / docs page
- [ ] Manual test on form-heavy page
- [ ] Manual test on grid-heavy page
- [ ] Confirm:
  - [ ] coins only on links/buttons
  - [ ] no huge initial flood
  - [ ] no unreachable queue spawns
  - [ ] specials still appear naturally
  - [ ] flow recolor still reads clearly
  - [ ] police still feels fair

Blocker:

- Manual drive verification on real pages requires an interactive browser extension session, which is not available in this CLI-only environment.

### 8. Bonus Item Review (When Core Loop Is Stable)

Status: `in progress`

Goal: review power-up clarity and keep only specials that are fun and instantly understandable.

- [ ] Run a focused review of current bonus items after Phase 1 verification
- [x] Re-evaluate `GHOST` clarity (what it does, when it helps, whether players feel it)
- [x] Re-evaluate full-page `BLACKOUT` readability and fairness
- [x] Make `BLACKOUT` adapt to dark pages by resolving to `INVERT`
- [x] Make HUD effect labels reflect adaptive effect resolution
- [x] Keep currently liked specials unless they conflict with readability
- [x] Brainstorm and shortlist `2-4` new special ideas
- [ ] Prototype only the best `1-2` new specials with simple rules
- [x] Preserve non-violent playful vibe and avoid visual muddiness

Shortlist (no prototypes yet):

- `STREAK BANK`: for a short window, regular coins grant a small extra bonus if collected in quick succession
- `ROUTE SCAN`: briefly highlights one safe high-density coin route with subtle lane markers
- `LURE`: pulls one ambient special closer to the player's current lane without forcing pickup
- `COOLDOWN`: delays the next police spawn timer a little when collected under pressure

Definition of done:

- each active bonus item is understandable within a few seconds
- unclear specials are reworked, replaced, or removed intentionally
- final special pool feels surprising, readable, and fun

### 9. Surface Behavior Refresh

Status: `done`

Goal: make image-heavy pages feel playful without replacing route decisions with raw speed.

- [x] Change scanned `img` / `picture` surfaces from `boost` to `ice`
- [x] Keep visually reactive UI surfaces as `boost` so boost moments remain readable and intentional
- [x] Implement `ice` handling with low grip + low friction + tiny entry speed burst + subtle drift
- [x] Make police chase movement react to `ice` surfaces too
- [x] Keep controls and HUD readability unchanged

Definition of done:

- image/picture surfaces no longer behave like simple speed boosts
- route pressure still comes from positioning and spawn pacing, not chaos

### 10. Sand Design Spike

Status: `done`

Goal: decide whether sand adds meaningful choices right now.

- [x] Evaluate adding a `sand` surface archetype
- [x] Decide to reject `sand` for now to avoid overlapping with existing slow-zone readability
- [x] Keep no `sand` scanner/world/runtime branches in this phase

Decision note:

- Sand is intentionally rejected in the current phase. Existing text-wall slow zones already represent friction clearly, and adding another drag surface now would dilute the "simple money + readable route pressure" rule.

## Phase 2: Overgrowth Difficulty

Status: `planned`

Goal: create a visible mid-to-late-run difficulty ramp.

### Trees And Bushes System

- [ ] Add `bush` blockers that grow out of border / obstacle-adjacent elements
- [ ] Add `tree` blockers as larger variants
- [ ] Start growth from scanned UI border/barrier structure first so escalation has a readable source
- [ ] Grow over time in waves instead of instantly
- [ ] Stage escalation over run time: `bushes` first, then convert/upgrade some lanes into `trees`
- [ ] Make them collide with:
  - [ ] player
  - [ ] police car
- [ ] Bias growth toward edges / existing structure
- [ ] Keep early growth sparse and readable
- [ ] Tune late-game density so it becomes harder, not impossible

Definition of done:

- early game feels open
- late game feels overgrown
- growth source and escalation read clearly (border-origin bushes before trees)
- players must route around growth instead of driving straight through

## Phase 3: Airplane Event

Status: `in progress`

Goal: add a rare, stylish world event that changes the map in a playful way.

### Airplane Design Rules

- [x] Airplane should feel whimsical, not military
- [x] Do not use bombs
- [x] Event should be readable at a glance
- [x] Event should create opportunity, not random punishment

### Candidate Effects

- [x] `Bonus drop`: airplane drops a bonus-only special pickup
- [ ] `Coin trail`: airplane leaves a short line of coins across the map
- [x] `Boost lane`: airplane paints a temporary speed strip
- [ ] `Lucky wind`: airplane gently nudges nearby coins into a route
- [ ] `Spotlight`: airplane reveals or highlights a special
- [ ] `Garden trim`: airplane cuts back bushes / trees and opens a lane
- [ ] `Police delay`: airplane disrupts police timing briefly

### Recommended First Prototype

Status: `in progress`

- [x] Implement airplane flyover visual
- [x] Implement one `bonus drop` pickup event (`BON`) with rarity/cooldown timing
- [x] Add airplane edge warning indicator (`NYOOM`) before entry
- [x] Stabilize and tune airplane sprite readability in gameplay (shape, propeller, contrast, placement)
- [x] Add and tune a "cool" airplane sound profile that is noticeable without becoming noisy
- [x] Stagger airplane and police cadence to reduce same-time overlap noise
- [ ] Implement `coin trail`
- [x] Implement temporary `boost lane`
- [x] Add cooldown / rarity rules

Definition of done:

- players immediately notice the airplane event
- the airplane creates a fun go-there-now moment

## Phase 4: Indie Juice Research Pass

Status: `planned`

Goal: add cool indie flavor without bloating the rules.

### Candidate Systems To Research / Prototype

- [ ] near-miss bonus around police / overgrowth
- [ ] late-run police escalation pass: transition pressure from `police car` to a readable `police helicopter` variant after clear score/time thresholds
- [ ] risk-lane high-value opportunity
- [ ] page mood variants like `night shift`, `office panic`, `focus mode`
- [ ] micro-objectives during a run
- [ ] rare jackpot event
- [ ] daily or per-page modifiers for replay value

Rule:

- [ ] only keep additions that strengthen `action -> reward -> expansion`
- [ ] reject anything that makes the page harder to read without adding meaningful decisions
- [ ] for police-helicopter escalation, keep telegraphing/fairness explicit and preserve playful non-violent tone

## Phase 5: Production Hardening

Status: `in progress`

Goal: make the game safe to share more widely.

### Code / Logic Fixes

- [x] Resolve scanner/runtime drift for `deadSpot` and `hazard`
- [x] Remove page-level debug API surface (`window.__domRacerDebug`)
- [x] Split `src/game/Game.ts` into focused runtime systems (events, rendering, effects, state)
- [x] Audit remaining stale gameplay branches

### Test Coverage

- [x] Add smoke coverage for DOM scan -> world build
- [x] Add coverage for staged coin spawning
- [x] Add coverage for special item spawning
- [x] Add coverage for police catch -> game over -> restart
- [x] Close overgrowth collision gap with scope-guard coverage while overgrowth stays deferred (deadSpot safety reset + empty hazard/deadSpot scanner/world channels)
- [x] Add hazard-channel guard coverage for world refresh safety reset while overgrowth remains deferred

### Final Tuning

- [x] spawn cadence
- [x] police frequency
- [x] tiny encounter pacing polish (stagger constants only)
- [ ] overgrowth speed
- [ ] visible coin cap

### Chrome Web Store Readiness (Near-Term)

- [x] Add production build profile with sourcemaps disabled by default
- [x] Re-audit permissions + host scope and document rationale for `<all_urls>`
- [x] Add lightweight release checklist (build, smoke checks, docs sanity)
- [x] Ensure no page-level debug globals are present in production bundles

## Phase 6: README / Presentation

Status: `in progress`

Goal: make the project page feel as cool as the game.

### README

- [x] Rewrite `README.md` to match the current game instead of the MVP
- [ ] Make the voice more indie and playful
- [ ] Add a sharp “why this is fun” section
- [ ] Add a living roadmap section
- [ ] Add a short store-friendly pitch block

### Presentation Assets

- [ ] Add screenshot section
- [ ] Add GIF / motion placeholders
- [ ] Capture:
  - [ ] normal run
  - [ ] special pickup
  - [ ] police chase
  - [ ] police `GAME OVER`
  - [ ] future overgrowth state

## Suggested Execution Order

1. Phase 5 hardening first: structure cleanup + baseline test harness
2. Resolve scanner/runtime drift and stale branches
3. Add regression checks for economy/police/airplane event pacing
4. Complete Phase 1 manual verification on target page types
5. Design polish pass: event pacing and tuning loops (no new noisy systems)
6. Continue Phase 2 overgrowth prototype
7. Continue Phase 4 indie juice candidates under readability constraints
8. Polish README and presentation assets for store readiness

## Immediate Next Build Target

Status: `done`

### Milestone: Phase 5 Hardening Baseline

- [x] Remove page-level debug API from runtime (`window.__domRacerDebug`)
- [x] Introduce first automated smoke tests:
  - [x] scanner -> world build sanity
  - [x] regular coin source and staging invariants
  - [x] specials independence invariants
  - [x] police catch -> `GAME OVER` -> restart flow
- [x] Split `src/game/Game.ts` into smaller modules without changing behavior
- [x] Add release build profile for Chrome Web Store (sourcemaps off by default)
- [x] Re-run `npm run build` and keep regression notes here

### Next Session Follow-Ups (Locked Order)

- [x] Extract rendering-only gameplay helpers from `src/game/Game.ts` into `src/game/gameRenderRuntime.ts` without changing controls/loop behavior
- [x] Remove stale pickup collection branch state (`collectedIds`) and keep deferred-channel smoke guardrails explicit (`scanner` kind allowlist + empty `hazards`/`deadSpots` world channels)
- [x] Continue splitting `src/game/Game.ts` by subsystem boundaries (encounters/rendering/effects) without behavior changes
- [x] Add remaining hardening coverage for overgrowth collision behavior (or explicitly defer/remove if overgrowth remains out of active scope)
- [x] Add a lightweight Chrome Web Store release checklist doc (`build`, smoke tests, debug-global sanity, docs pass)
- [x] Document permissions + host scope rationale for `<all_urls>` in store-facing notes
- [ ] Run manual extension playtest matrix on target page types once interactive browser session is available

### Previous Milestone: Phase 1 Verification + Bonus Clarity

- [ ] run manual verification on:
  - [ ] GitHub repo page
  - [ ] long-form article/docs page
  - [ ] form-heavy page
  - [ ] grid-heavy page
- [x] confirm no regressions in:
  - [x] coin source rules (links/buttons only)
  - [x] staged queue behavior and visible coin pressure
  - [x] specials independence from regular money
  - [x] police fairness + police `GAME OVER` flow
  - [x] post-grid/post-border readability
- [x] improve special spawn feedback (visible but not noisy)
- [x] run bonus-item clarity review:
  - [x] `GHOST` (purpose and feel)
  - [x] full-page `BLACKOUT` (readability and fairness)
- [x] brainstorm and shortlist `2-4` additional special ideas
- [x] refresh surface behavior:
  - [x] image / picture surfaces use `ice` behavior
  - [x] reactive surfaces keep `boost` behavior
- [x] sand design spike:
  - [x] decide to reject `sand` for now
  - [x] document rationale
- [x] start one world-event prototype:
  - [x] propeller plane flyover + `BON` bonus drop
- [x] document outcomes and update statuses in this plan

Session note:

- Current session continues hardening-first cleanup by extracting rendering-only runtime helpers from `src/game/Game.ts` into `src/game/gameRenderRuntime.ts` (focus layer + pickup/special/plane lane rendering) with no control or loop behavior changes.
- Current session removes one stale gameplay data branch (`collectPickups` `collectedIds`, unused) and keeps deferred overgrowth channels explicit via smoke guardrail assertion that scanned kinds stay within active runtime scope.
- Verification this session: `npm run test` (6 smoke tests), `npm run build`, and `__domRacerDebug` absence re-audited in both `src/` and `dist/`.
- Current session continues hardening-first cleanup: extracts game state contracts and pickup spawn geometry helpers out of `src/game/Game.ts` into `src/game/gameStateTypes.ts` and `src/game/pickupSpawnRuntime.ts` without changing controls or loop behavior.
- Current session closes a stale hazard-path inconsistency by aligning refresh/spawn guardrails (`applyWorld` safety reset + pickup placement blockers) to treat deferred `hazards` consistently with `deadSpots`.
- Current session extends smoke invariants with hazard refresh safety coverage and re-verifies police catch -> `GAME OVER` -> `Space` restart flow.
- Verification this session: `npm run test` (6 smoke tests) and `npm run build` pass.
- Current session extracts encounter pathing helpers and overlay renderers out of `src/game/Game.ts` into focused modules (`src/game/encounterRuntime.ts`, `src/game/gameOverlays.ts`) without changing control bindings or core loop flow.
- Current session closes overgrowth hardening as an explicit defer decision: overgrowth remains out of active runtime scope, with guard coverage added for deadSpot safety reset and empty scanner/world hazard channels.
- Current session adds release-readiness docs: `docs/release-checklist.md` and `docs/permissions-host-scope.md` (`<all_urls>` rationale).
- Current session applies a tiny event-pacing constants pass only (`ENCOUNTER_STAGGER_MS`, `PLANE_LANE_SPECIAL_STAGGER_MS`) to keep police/plane/special overlap readable.
- Cross-page manual driving on the 4 target page types is blocked in this environment (no interactive extension browser session).
- This session's regression confirmations were completed via source audit + `npm run build`.
- This pass improved HUD sound-state clarity (`M SOUND` + explicit `ON/OFF` chip), introduced tuned plane flyover/drop cues, and reworked toast overlap handling with priority-aware stacking.
- Follow-up HUD polish moved the `ON`/`OFF` sound chip left so it sits closer to `M SOUND`.
- This session adds a short-lived airplane `boost lane` prototype (no screen shake, no economy-rule changes): rare during flyovers, lightly highlighted, time-limited, and staggered against ambient specials to preserve readability.
- Current session removes page-level debug API exposure, keeps debug work in `Shift + D` sprite showcase mode, and persists production/design research notes for next passes.
- Current priority lock: hardening (tests + structure) before design polish (event pacing/tuning loops).
- Current session adds first Vitest smoke checks (scanner->world, regular coin staging/source rules, specials independence, police catch restart flow), extracts shared runtime constants/helpers from `Game.ts` into `src/game/gameRuntime.ts`, aligns scanner contract by dropping stale scanned `hazard`/`deadSpot` kinds, and adds a release build profile with sourcemaps disabled unless explicitly enabled.
- Verification this session: `npm run test` (6 smoke tests) and `npm run build` both pass.
- Next-session prompt is prepared in `NEXT_SESSION_PROMPT.md`.
- Previous commit state on `main` before this session:
  - `9528056` (HUD sound-state clarity, airplane audio polish, toast readability pass)
  - `f374289` (SOUL commit-state note refresh)

## Latest Session Progress And Learnings

Status: `done`

### Progress landed

- [x] Added adaptive sprite showcase theme selection from sampled page lightness; arrows still provide manual override
- [x] Improved magnet readability (stronger player halo/rings and fixed alpha inheritance issue)
- [x] Refined airplane sprite repeatedly (artifact cleanup, propeller readability, wing placement, bright-page contrast)
- [x] Improved police/airplane event pacing to feel like alternating encounter beats instead of stacked noise
- [x] Expanded `ice` feel with stronger handling identity and added police-on-ice behavior

### Practical learnings for future tuning

- Bright and low-contrast pages require explicit dark keylines/backplates for thin sprites
- Plane readability issues came mostly from silhouette layering and detached-looking propeller cues, not only scale
- Independent timers for major events create noisy overlap; a small encounter stagger dramatically improves readability
- Adaptive effect resolution (`BLACKOUT` -> `INVERT` on dark surfaces) should be mirrored in HUD labels and flavor text
- Surface mechanics are easier to feel when they include both handling change and tiny speed/trajectory cues

Why this first:

- it closes Phase 1 confidence gaps before new feature work
- it ensures specials are understandable and fun
- it keeps next systems grounded in a readable, stable baseline

## Success Criteria

When this roadmap is working, a good run should feel like this:

- early game: clean, readable, inviting
- mid game: more routing decisions, specials, rising police pressure
- late game: overgrown map, tighter routes, high-score tension
- failure: stylish and readable, with immediate desire to retry

## Notes For Future Models

Before making major changes:

- read `README.md`
- read this file
- inspect `src/game/Game.ts`, `src/content/domScanner.ts`, `src/content/worldBuilder.ts`, and `src/game/hud.ts`
- preserve the simple readable money language
- preserve the non-violent playful vibe
- avoid adding mechanics that make the page feel sloppy, draggy, or visually muddy
