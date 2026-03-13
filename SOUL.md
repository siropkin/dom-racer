# DOM Racer

## What It Is

A Chrome / Edge extension that turns the visible DOM of the current page into a playable top-down arcade racer. The game runs as a content-script overlay on top of real websites.

## Core Fantasy

- the page becomes the track
- visible UI becomes loot and geometry
- the run starts clean and readable
- over time the page becomes stranger, denser, and more dangerous
- the player chases score, specials, and survival

## Vibe

Playful, weird, stylish. Light indie-arcade energy — more "cool coding waiting-room toy" than serious action game. Not a war game, not violent, not destructive.

## What Exists

- Three vehicle designs (coupe, buggy, truck) with score-gated unlocks
- Page scanning: text → walls, images → ice, links → coins, SVG → boost
- HUD: POWER panel (top-right), GOAL panel (bottom-center), score/time (top-left), bests (bottom-left)
- Nine power-ups: `BONUS`, `MAGNET`, `INVERT`, `GHOST`, `BLUR`, `OIL_SLICK`, `REVERSE`, `MYSTERY`, rare `JACKPOT`
- Police chases with escalating duration and siren flash
- Airplane flyovers with five drop modes
- Overgrowth: bushes/trees grow from barriers after ~35s, narrowing routes
- Near-miss bonus for grazing obstacles
- Coin-collection goals with x2/x3/x4 multiplier tiers and countdown timers
- Daily modifier (5 rule twists, deterministic from date)
- Simplified game-over screen (score, run number, restart/quit)
- VFX particles, page-reactive tint, celebration animations
- Viewport-proportional scaling for effect durations and police chase timers
- Global sound/vehicle preferences via chrome.storage.local
- Adaptive sprite contrast: dark outlines on bright pages, light glow on dark pages
- Extension popup with game info, controls, power-ups, and Buy Me a Coffee link
- Propeller biplane sprite with spinning blades and continuous drone audio
- Increased master audio gain (0.68) with punchier plane drop SFX
- Sound enrichment, auto-pause, first-play hint, run counter, lifetime milestones

## Controls

`Shift+R` toggle | `WASD`/arrows drive | `R` restart | `V` vehicle | `M` sound | `Esc` quit | `Shift+D` sprite showcase | Game over: `Space` restart

## Architecture

```
src/content/         Page scanning, overlay bootstrapping
src/game/            Game loop, rendering, HUD, audio, runtime helpers
src/game/sprites/    Player, police, plane, pickup renderers + shared helpers
src/game/gameConfig.ts  Centralized tuning constants (13 sections)
src/shared/          Types, settings, persistence, utilities
src/popup/           (none — popup is static HTML in public/)
public/              Manifest, icons, popup.html
branding/            SVG sources + PNG generator
```

## Design Rules

- Keep readable within seconds
- Simple money rules — collect coins, get score
- Surprising specials, not noisy
- Escalating route pressure over raw chaos
- Humorous/stylish, not violent
- No mechanics that make the page uniformly slippery or visually muddy
- GOAL and POWER panels use same pattern: one title, stacked bar rows
- All coins are gold — no combo/streak systems

## Key Technical Decisions

- `window.__domRacerDebug` must never exist in source or build
- All tuning constants live in `gameConfig.ts`, grouped by system
- Runtime modules are pure functions that take state and return mutations
- Game.ts is orchestration only — logic lives in `*Runtime.ts` helpers
- Sprite files in `sprites/` subdirectory with barrel export
- ESLint (flat config, typescript-eslint) + Prettier enforced
- 81 smoke tests across 8 focused test files

## Research References

- **Telegraphing (Mike Stout):** Pre-cues with response windows. Difficulty from route pressure, not hidden state.
- **MDA Framework:** Police = pressure, airplane = opportunity, coins = economy.
- **Game Feel (Vlambeer):** Maximum output for minimum input. Additive but controlled feedback.
- **UI Hierarchy:** Score/time/effects/warnings are primary reads. Contrast over decoration.

## North Star

Keep DOM Racer readable, funny, and instantly playable: simple money rules, random power-up surprises, and a difficulty curve that slowly turns a familiar webpage into a hostile little indie arena.
