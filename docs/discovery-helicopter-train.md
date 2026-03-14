# Phase 16 Discovery — Helicopter & Train Encounters

## Police Helicopter

### Trigger

Use chase count per run. The 3rd police encounter becomes a helicopter. Chase count naturally maps to how deep into a run the player is — respawn timers (11–17s) mean chase #3 can't arrive before ~60–90s, matching the SOUL.md late-game pressure arc.

### Movement

- Ignores obstacles and ice (flies over everything) — the core threat escalation
- Slower base speed (~140 vs car's ~162+), higher turn inertia (blend ~6 vs car's ~18)
- Creates a "wide orbit" feel — player escapes by making sharp direction changes
- Same timed chase duration with existing escalation formula

### Visual

- Top-down helicopter silhouette: oval body (~34x18), tail boom, spinning rotor disc
- Police colors: blue/red light bar on body, reuse existing patterns
- Searchlight cone: subtle semi-transparent gradient projecting toward player (decorative only)
- Warning indicator: same edge system, label "CHOPPER", amber flash colors

### Audio

- Distinct from plane drone: higher frequency (~120-140Hz square wave), faster LFO (~22-28Hz)
- Produces "thwap-thwap-thwap" chopper sound vs plane's smooth propeller buzz
- Replaces police siren during helicopter chases

### Balance

- Ghost dismisses helicopter (thematically: player vanishes from aerial view)
- Oil Slick / Reverse / Blur don't affect helicopter (airborne)
- Plane stagger system prevents overlap — no changes needed
- Late chases (#4, #5+) are also helicopters with lengthening duration

### Implementation

Extend `PoliceChaseState` with `variant: 'car' | 'helicopter'`. Estimated ~7 files:
1. `gameStateTypes.ts` — add variant field
2. `gameConfig.ts` — helicopter speed/turn/threshold constants
3. `encounterRuntime.ts` — variant selection, skip obstacle/ice checks for helicopter
4. `Game.ts` — track chase count per run
5. `sprites/` — new helicopter sprite
6. `audio.ts` — helicopter rotor audio
7. Tests — encounter test updates

### Verdict

**Build it.** Clean, high-impact, fits in one phase session. Turns late-game from "same police but longer" into qualitative escalation.

---

## Train on Rails

### Rail Detection

Post-process `world.obstacles` for long thin rects spanning >60% of viewport. Supplement with `<hr>` element detection in scanner (currently invisible due to min dimension filter).

### Page Coverage

Estimated 15-25% of pages have usable rail candidates:
- GitHub: fixed top navbar, occasional `<hr>` separators
- Wikipedia: top navbar spans full width
- News sites: section dividers, banner containers
- SPAs/dashboards: toolbars, sidebar borders

Low coverage is acceptable — train is an environmental bonus event, not core gameplay.

### Train Behavior

- Spawns off-screen, travels along rail at ~300-350 px/s (4-4.5s crossing)
- 1.5s warning: edge indicator + horn SFX + rail flash
- ~20px tall body, ~16px collision hitbox
- Instant game over on collision
- Max one train per run, minimum 45-60s between occurrences
- Staggered with police/plane via existing encounter system

### Fairness

- Long warning window (1.5s = ~375px of player movement)
- Ghost grants immunity
- No trains before 30s of run time
- Rails must have >=60px clearance on at least one side

### Implementation

Medium scope (~comparable to plane encounter):
1. Types: `railCandidates` field in World
2. Scanner: `<hr>` detection + new `rail` kind
3. World Builder: post-process obstacles into rail candidates
4. Config: `TRAIN` section (~12 constants)
5. New `trainRuntime.ts` (~150 lines)
6. New `trainSprite.ts` (Caltrain-style multi-car)
7. Game.ts integration + audio + tests

### Verdict

**Worth building, but lower priority than helicopter.** Novel (environmental, page-dependent) but low coverage means most players rarely see it. Recommended: helicopter first, then validate rail detection on real pages before committing.

---

## Recommendation

Build helicopter as Phase 17. Spike train rail detection separately, then build full train as Phase 18 only if coverage validates.
