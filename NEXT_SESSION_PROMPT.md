# DOM Racer - Next Session Prompt

Continue work on the DOM Racer browser extension in `/Users/ivan.seredkin/_projects/dom-racer`.

First, read:
- `README.md`
- `SOUL.md`
- `NEXT_SESSION_PROMPT.md`
- `docs/release-checklist.md`
- `docs/permissions-host-scope.md`
- `src/game/Game.ts`
- `src/game/gameRuntime.ts`
- `src/game/gameStateTypes.ts`
- `src/game/gameRunStateRuntime.ts`
- `src/game/pickupSpawnRuntime.ts`
- `src/game/encounterRuntime.ts`
- `src/game/gameRenderRuntime.ts`
- `src/game/gameOverlays.ts`
- `src/content/domScanner.ts`
- `src/content/worldBuilder.ts`
- `src/shared/types.ts`
- `vite.config.ts`
- `package.json`
- `tests/gameInvariants.smoke.test.ts`
- `tests/scannerWorld.smoke.test.ts`

Current known context:
- Airplane event now supports three drop modes: `bonus drop`, short-lived `boost lane`, and short-lived `coin trail`.
- Page-level debug API must remain absent (`window.__domRacerDebug` must not return).
- Debug workflow is in-game only via `Shift + D` sprite showcase mode.
- Hybrid session mode is active: one bounded hardening extraction + one bounded roadmap feature in the same pass.
- Overgrowth remains intentionally out of active runtime scope; guardrails remain in place.
- Baseline smoke tests are in place and currently passing (`npm run test` -> 7 tests).
- Release build profile is set with sourcemaps disabled by default (`npm run build`).
- `Game.ts` was split further with state-contract, pickup-spawn, encounter, overlay, and render-runtime helper extraction.
- Plane/police encounter transition math was further extracted into `src/game/encounterRuntime.ts`; `Game.ts` now keeps encounter side-effect orchestration.
- `Game.ts` now also delegates effect/combo timer + HUD active-effect assembly to `src/game/gameEffectsRuntime.ts`.
- Begin/caught/showcase run-state transition snapshots are now extracted to `src/game/gameRunStateRuntime.ts`; `Game.ts` keeps side-effect sequencing.
- Regular coin queue/refill scheduling was extracted from `Game.ts` into `src/game/pickupSpawnRuntime.ts`.
- Input/control key dispatch was extracted from `Game.ts` into `src/game/gameInputRuntime.ts` while keeping key bindings and swallowed-space behavior unchanged.
- Stale internal debug-only hooks were removed from runtime (`setDebugInput`, `triggerJump`, `getDebugSnapshot`, debug-event plumbing), while in-game `Shift + D` showcase remains intact.
- Stale pickup collection branch state (`collectedIds`) was removed; scanner smoke now asserts active kind allowlist while `hazards`/`deadSpots` remain deferred-empty.
- Regular pickup toast flow was hardened to coin-only path (`spawnCoinPickupMessage`), with specials still handled via dedicated effect flow.
- Airplane `coin trail` is implemented as a readable temporary route: spawned in a line, expires quickly, and uses ambient-special stagger to reduce overlap noise.
- Future idea backlog includes optional spinner-based money anchors (`id="spinner"` or class containing `spined`) for a later scanner pass.
- `__domRacerDebug` was re-audited absent in both source and production build output.
- Latest pass changed airplane event mode selection to include `coin trail`; no screen shake and no broad mechanic expansion.

Priority lock for this session:
1) Deliver one bounded hardening extraction
2) Deliver one bounded roadmap feature (next Phase 3 airplane candidate)
3) Tiny tuning polish only if needed after both

Primary goals:
1. Hardening extraction target:
   - keep reducing `src/game/Game.ts` by subsystem boundary (safe extractions only)
   - pick exactly one remaining extraction target (tick pickup/economy block OR HUD/audio assembly) and move it to a focused runtime helper
   - keep run-state orchestration centralized through `src/game/gameRunStateRuntime.ts`
   - keep encounter behavior centralized through `src/game/encounterRuntime.ts` helpers; avoid re-inlining
   - avoid behavior changes and preserve controls/core loop
2. Feature target:
   - implement one bounded follow-up airplane feature from remaining roadmap candidates (prefer `lucky wind` or `spotlight`)
   - keep feature readability-first and short-lived (route opportunity, not chaos)
   - keep specials independent from regular coin economy semantics
   - keep no screen shake and avoid chaotic overlap with police/plane warning beats
3. Follow-up hardening:
   - audit remaining stale gameplay branches (especially deferred channels) and keep guard behavior coherent
   - keep internal debug surface lean (no hidden callback/debug snapshot branches unless intentionally required)
   - if overgrowth stays deferred, keep that decision explicit in docs/tests
4. Verification hardening:
   - confirm no page-level debug globals in source/build (`__domRacerDebug`)
   - keep police catch -> game over -> `Space` restart flow intact
5. Only after goals 1+2:
   - tiny pacing/constants pass if needed (no mechanic expansion)
   - keep airplane/police/special overlap readable and non-chaotic

Constraints to preserve:
- police catch -> `GAME OVER` -> `Space` restart behavior remains intact
- regular money rules stay simple and obvious
- specials remain independent from regular money
- no screen shake
- playful, readable, non-violent tone
- no broad mechanic expansion

Before finishing:
- run `npm run test`
- run `npm run build`
- update `SOUL.md` statuses/checklists and session note
- update `NEXT_SESSION_PROMPT.md` for the following handoff
- provide concise summary: changed files, hardening decisions, tuning decisions, remaining risks
