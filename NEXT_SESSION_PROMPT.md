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
- Airplane `boost lane` prototype exists; `coin trail` is still not implemented.
- Page-level debug API must remain absent (`window.__domRacerDebug` must not return).
- Debug workflow is in-game only via `Shift + D` sprite showcase mode.
- Hardening-first lock is active before any broader design/system expansion.
- Overgrowth remains intentionally out of active runtime scope; guardrails remain in place.
- Baseline smoke tests are in place and currently passing (`npm run test` -> 6 tests).
- Release build profile is set with sourcemaps disabled by default (`npm run build`).
- `Game.ts` was split further with state-contract, pickup-spawn, encounter, overlay, and render-runtime helper extraction.
- Stale pickup collection branch state (`collectedIds`) was removed; scanner smoke now asserts active kind allowlist while `hazards`/`deadSpots` remain deferred-empty.
- `__domRacerDebug` was re-audited absent in both source and production build output.

Priority lock for this session:
1) Hardening and structure
2) Then tiny tuning polish only

Primary goals:
1. Continue structural cleanup:
   - keep reducing `src/game/Game.ts` by subsystem boundary (safe extractions only)
   - avoid behavior changes and preserve controls/core loop
2. Follow-up hardening:
   - audit remaining stale gameplay branches (especially deferred channels) and keep guard behavior coherent
   - if overgrowth stays deferred, keep that decision explicit in docs/tests
3. Verification hardening:
   - confirm no page-level debug globals in source/build (`__domRacerDebug`)
   - keep police catch -> game over -> `Space` restart flow intact
4. Only after hardening:
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
