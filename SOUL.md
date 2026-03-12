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
- police warning + chase
- police `GAME OVER` screen with explicit `Space` restart
- sound toggle and vehicle toggle
- extension/store branding assets
- debug API for autopilot / reports

### Current Controls

- `Shift + R`: toggle game
- `WASD` / arrow keys: drive
- `R`: restart run
- `V`: switch vehicle
- `M`: toggle sound
- `Esc`: quit
- on police `GAME OVER`: `Space` restart, `Esc` quit

### Current Architecture Map

- `src/content/`: page integration, scanning, overlay bootstrapping, debug API
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
- Avoid mechanics that make the whole page feel slippery, draggy, or confusing.

## Known Production Risks

These are already identified and should be addressed in the hardening phase.

- `deadSpot` / `hazard` branches still exist in runtime logic but are not currently produced by the scanner
- debug autopilot still thinks it can “boost” out of stuck states, but manual boost was removed
- autopilot does not stop cleanly on police `GAME OVER`
- there is little to no automated coverage for scanner -> world -> gameplay transitions

## North Star

Keep `DOM Racer` readable, funny, and instantly playable: simple money rules, random power-up surprises, and a difficulty curve that slowly turns a familiar webpage into a hostile little indie arena.

## Phase Overview

| Phase | Status | Goal |
|---|---|---|
| Phase 1 | `in progress` | Clean up the core money loop |
| Phase 2 | `planned` | Add overgrowth difficulty with trees and bushes |
| Phase 3 | `planned` | Add airplane world-event prototype |
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
- [ ] Verify the map still reads quickly without adding visual noise

### 7. Verification Pass

Status: `planned`

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

### 8. Bonus Item Review (When Core Loop Is Stable)

Status: `in progress`

Goal: review power-up clarity and keep only specials that are fun and instantly understandable.

- [ ] Run a focused review of current bonus items after Phase 1 verification
- [x] Re-evaluate `GHOST` clarity (what it does, when it helps, whether players feel it)
- [x] Re-evaluate full-page `BLACKOUT` readability and fairness
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

## Phase 2: Overgrowth Difficulty

Status: `planned`

Goal: create a visible mid-to-late-run difficulty ramp.

### Trees And Bushes System

- [ ] Add `bush` blockers that grow out of border / obstacle-adjacent elements
- [ ] Add `tree` blockers as larger variants
- [ ] Grow over time in waves instead of instantly
- [ ] Make them collide with:
  - [ ] player
  - [ ] police car
- [ ] Bias growth toward edges / existing structure
- [ ] Keep early growth sparse and readable
- [ ] Tune late-game density so it becomes harder, not impossible

Definition of done:

- early game feels open
- late game feels overgrown
- players must route around growth instead of driving straight through

## Phase 3: Airplane Event

Status: `planned`

Goal: add a rare, stylish world event that changes the map in a playful way.

### Airplane Design Rules

- [ ] Airplane should feel whimsical, not military
- [ ] Do not use bombs
- [ ] Event should be readable at a glance
- [ ] Event should create opportunity, not random punishment

### Candidate Effects

- [ ] `Coin trail`: airplane leaves a short line of coins across the map
- [ ] `Boost lane`: airplane paints a temporary speed strip
- [ ] `Lucky wind`: airplane gently nudges nearby coins into a route
- [ ] `Spotlight`: airplane reveals or highlights a special
- [ ] `Garden trim`: airplane cuts back bushes / trees and opens a lane
- [ ] `Police delay`: airplane disrupts police timing briefly

### Recommended First Prototype

Status: `planned`

- [ ] Implement airplane flyover visual
- [ ] Implement `coin trail`
- [ ] Implement temporary `boost lane`
- [ ] Add cooldown / rarity rules

Definition of done:

- players immediately notice the airplane event
- the airplane creates a fun go-there-now moment

## Phase 4: Indie Juice Research Pass

Status: `planned`

Goal: add cool indie flavor without bloating the rules.

### Candidate Systems To Research / Prototype

- [ ] near-miss bonus around police / overgrowth
- [ ] risk-lane high-value opportunity
- [ ] page mood variants like `night shift`, `office panic`, `focus mode`
- [ ] micro-objectives during a run
- [ ] rare jackpot event
- [ ] daily or per-page modifiers for replay value

Rule:

- [ ] only keep additions that strengthen `action -> reward -> expansion`
- [ ] reject anything that makes the page harder to read without adding meaningful decisions

## Phase 5: Production Hardening

Status: `in progress`

Goal: make the game safe to share more widely.

### Code / Logic Fixes

- [ ] Resolve scanner/runtime drift for `deadSpot` and `hazard`
- [ ] Fix autopilot stuck-recovery path after manual boost removal
- [ ] Make autopilot terminate correctly on police `GAME OVER`
- [ ] Audit remaining stale gameplay branches

### Test Coverage

- [ ] Add smoke coverage for DOM scan -> world build
- [ ] Add coverage for staged coin spawning
- [ ] Add coverage for special item spawning
- [ ] Add coverage for police catch -> game over -> restart
- [ ] Add coverage for overgrowth collision with player and police

### Final Tuning

- [ ] spawn cadence
- [ ] police frequency
- [ ] overgrowth speed
- [ ] visible coin cap

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

1. Complete Phase 1 verification pass across page types
2. Improve special spawn feedback and bonus-item clarity (`GHOST`, `BLACKOUT`)
3. Run a small special-ideas pass and shortlist prototypes
4. Fix production-hardening issues in debug/autopilot paths
5. Build trees / bushes overgrowth prototype
6. Build airplane prototype
7. Run research-driven indie juice pass
8. Polish README and presentation assets

## Immediate Next Build Target

Status: `in progress`

### Milestone: Phase 1 Verification + Bonus Clarity

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
- [x] document outcomes and update statuses in this plan

Session note:

- Cross-page manual driving on the 4 target page types is still pending in this environment.
- This session's regression confirmations were completed via source audit + `npm run build`.

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
