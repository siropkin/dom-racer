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
- `src/game/gameEconomyRuntime.ts`
- `src/game/pickupSpawnRuntime.ts`
- `src/game/encounterRuntime.ts`
- `src/game/planeDropRuntime.ts`
- `src/game/gameRenderRuntime.ts`
- `src/game/gameOverlays.ts`
- `src/game/gameHudAudioRuntime.ts`
- `src/game/gameInputRuntime.ts`
- `src/game/gameEffectsRuntime.ts`
- `src/content/domScanner.ts`
- `src/content/main.ts`
- `src/content/worldBuilder.ts`
- `src/shared/types.ts`
- `vite.config.ts`
- `package.json`
- `tests/gameInvariants.smoke.test.ts`
- `tests/scannerWorld.smoke.test.ts`

Current known context:
- Airplane event now supports six drop modes: `bonus drop`, short-lived `boost lane`, short-lived `coin trail`, short-lived `spotlight`, short-lived `lucky wind`, and short-lived `police delay`.
- `spotlight` highlights an existing special pickup via cue; if no special exists at drop time, it safely falls back to `bonus drop`.
- `lucky wind` gently reroutes nearby existing regular coins into a readable lane; if not enough safe candidates exist, it safely falls back to `bonus drop`.
- `police delay` briefly pushes back police spawn timing; if not applicable at drop time, it safely falls back to `bonus drop`.
- Airplane drop-mode dispatch/fallback is extracted from `Game.ts` into `src/game/planeDropRuntime.ts` (`dispatchPlaneDropWithFallback`).
- Plane coin-trail expiry/tick orchestration is extracted from `Game.ts` into `src/game/planeDropRuntime.ts` (`advancePlaneCoinTrailState`).
- Police-delay cue timer lifecycle is extracted from `Game.ts` into `src/game/planeDropRuntime.ts` (`createPoliceDelayCueState`, `advancePoliceDelayCueState`).
- Lucky-wind coin-reroute orchestration is extracted from `Game.ts` into `src/game/planeDropRuntime.ts` (`applyPlaneLuckyWindToPickups`).
- Plane drop dispatch now returns spawn success so `Game.ts` keeps `planeBonusEvent.dropped` false until an actual drop spawn succeeds (retry-safe in-frame failure handling).
- Special-spawn cue timer lifecycle is extracted from `Game.ts` into `src/game/gameRenderRuntime.ts` (`advanceSpecialSpawnCues`).
- Police-delay now includes a short-lived HUD readability cue (`HOLD-UP`) that does not change police/coin mechanics.
- While police-delay cue is active, HUD flavor text now surfaces a short breathing-room message for readability only.
- Police pre-chase warning now has a dedicated readability flavor-text beat (`Sirens warming up`) without changing police timing semantics.
- Airplane now has dedicated readability flavor-text beats for warning/flyover states (`Nyoom inbound`, `Flyover live`) with no encounter/economy semantic changes.
- Magnet now pulls both regular coins and specials (`bonus` included), without changing score/effect semantics.
- Scanner pickup detection now also treats `role="link"` as a valid link pickup source to improve app-page world generation.
- Page-level debug API must remain absent (`window.__domRacerDebug` must not return).
- Debug workflow is in-game only via `Shift + D` sprite showcase mode.
- Toggle now supports `Shift + R` and alternate ``Shift + ` `` for pages where site shortcuts intercept.
- Active-page scroll lock now preserves scrollbar gutter width to reduce layout jumps when starting/stopping a run.
- Run now auto-pauses immediately when page focus is lost (`blur`/hidden tab) and shows a dedicated pause overlay until focus returns.
- Focus-loss pause transition state orchestration is extracted from `Game.ts` into `src/game/gameRunStateRuntime.ts` (`shouldPauseForPageFocus`, `resolveFocusPauseTransitionState`); `Game.ts` still owns audio/input side effects on pause transitions.
- Airplane sprite wings were widened (`wingSpan`, `wingAccentSpan`) for clearer silhouette readability; behavior/mechanics unchanged.
- README now includes a bounded Phase 6 store-friendly pitch block.
- Hybrid session mode is active: one bounded hardening extraction + one bounded roadmap feature in the same pass.
- Overgrowth remains intentionally out of active runtime scope; guardrails remain in place.
- Baseline smoke tests are in place and currently passing (`npm run test` -> 22 tests).
- Release build profile is set with sourcemaps disabled by default (`npm run build`).
- `Game.ts` was split further with state-contract, pickup-spawn, encounter, overlay, and render-runtime helper extraction.
- Plane/police encounter transition math was further extracted into `src/game/encounterRuntime.ts`; `Game.ts` now keeps encounter side-effect orchestration.
- `Game.ts` now also delegates effect/combo timer + HUD active-effect assembly to `src/game/gameEffectsRuntime.ts`.
- HUD state construction and drive-input audio assembly were extracted from `Game.ts` into `src/game/gameHudAudioRuntime.ts` while side-effect calls remain in `Game.ts`.
- Begin/caught/showcase run-state transition snapshots are now extracted to `src/game/gameRunStateRuntime.ts`; `Game.ts` keeps side-effect sequencing.
- Regular coin queue/refill scheduling was extracted from `Game.ts` into `src/game/pickupSpawnRuntime.ts`.
- Input/control key dispatch was extracted from `Game.ts` into `src/game/gameInputRuntime.ts` while keeping key bindings and swallowed-space behavior unchanged.
- Tick pickup/economy collection orchestration was extracted from `Game.ts` into `src/game/gameEconomyRuntime.ts` while side-effect sequencing remains in `Game.ts`.
- Stale internal debug-only hooks were removed from runtime (`setDebugInput`, `triggerJump`, `getDebugSnapshot`, debug-event plumbing), while in-game `Shift + D` showcase remains intact.
- Stale pickup collection branch state (`collectedIds`) was removed; scanner smoke now asserts active kind allowlist while `hazards`/`deadSpots` remain deferred-empty.
- Regular pickup toast flow was hardened to coin-only path (`spawnCoinPickupMessage`), with specials still handled via dedicated effect flow.
- Airplane `coin trail` is implemented as a readable temporary route: spawned in a line, expires quickly, and uses ambient-special stagger to reduce overlap noise.
- Airplane `spotlight` mode is implemented as a short-lived special highlight moment and does not alter regular coin staging semantics.
- Airplane `lucky wind` keeps special-vs-regular economy separation intact by re-routing existing regular coins only (no new special economy coupling).
- Future idea backlog includes optional spinner-based money anchors (`id="spinner"` or class containing `spined`) for a later scanner pass.
- `__domRacerDebug` was re-audited absent in both source and production build output.
- Latest pass extracted special-spawn cue lifecycle orchestration from `Game.ts` and added a bounded police-warning flavor-text readability cue, while keeping no-screen-shake/no-chaos guardrails intact.

Priority lock for this session:
1) Deliver one bounded hardening extraction
2) Deliver one bounded roadmap follow-up (readability-first airplane/police polish or one Phase 6 docs/presentation item)
3) Tiny tuning polish only if needed after both

Primary goals:
1. Hardening extraction target:
   - keep reducing `src/game/Game.ts` by subsystem boundary (safe extractions only)
   - pick exactly one remaining extraction target (now prefer one small post-encounter or post-render orchestration slice) and move it to a focused runtime helper
   - keep run-state orchestration centralized through `src/game/gameRunStateRuntime.ts`
   - keep encounter behavior centralized through `src/game/encounterRuntime.ts` helpers; avoid re-inlining
   - avoid behavior changes and preserve controls/core loop
2. Feature target:
   - implement one bounded roadmap follow-up while overgrowth remains deferred (do **not** expand mechanics broadly)
   - `garden trim` remains blocked unless overgrowth scope is explicitly re-activated
   - prefer readability-first polish or docs/presentation roadmap progress (e.g., README voice/pitch block) if gameplay feature scope is unclear
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
- provide concise summary: changed files, hardening decision, feature decision, tuning decision, remaining risks
