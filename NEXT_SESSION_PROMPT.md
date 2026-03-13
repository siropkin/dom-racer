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
- `src/game/planeSprite.ts`
- `src/content/domScanner.ts`
- `src/content/main.ts`
- `src/content/worldBuilder.ts`
- `src/shared/types.ts`
- `vite.config.ts`
- `package.json`
- `tests/gameInvariants.smoke.test.ts`
- `tests/scannerWorld.smoke.test.ts`

Current known context:
- Airplane drop modes remain: bonus drop, boost lane, coin trail, spotlight, lucky wind, police delay.
- Plane drop dispatch/fallback remains in `src/game/planeDropRuntime.ts` and is retry-safe (`dispatchPlaneDropWithFallback` returns success; `Game.ts` only marks `dropped` on actual spawn).
- Lucky-wind reroute orchestration remains in `src/game/planeDropRuntime.ts` (`applyPlaneLuckyWindToPickups`).
- Coin-trail and police-delay cue lifecycles remain in `src/game/planeDropRuntime.ts`.
- Special-spawn cue lifecycle remains in `src/game/gameRenderRuntime.ts`.
- Focus-loss pause transition state orchestration remains in `src/game/gameRunStateRuntime.ts` (`shouldPauseForPageFocus`, `resolveFocusPauseTransitionState`) while `Game.ts` keeps side effects.
- Magnet pull motion orchestration is extracted to `src/game/gameEffectsRuntime.ts` (`applyMagnetPullToPickups`), behavior unchanged.
- Magnet still pulls both regular and special pickups.
- Ambient special spawn scheduling is extracted to `src/game/pickupSpawnRuntime.ts` (`resolveAmbientSpecialSpawnStep`, `getSpecialSpawnRespawnDelayMs`), behavior unchanged. `Game.ts` calls the helper and only triggers actual spawn attempts when the scheduling step says to.
- HUD active-effects panel now includes warning countdown cues: `WEE-OO` (police warning) and `NYOOM` (plane warning).
- Toggle hotkeys: `Shift + R` and alternate ``Shift + ` ``.
- Run auto-pauses immediately on focus loss (`blur` / hidden tab) and shows a pause overlay until focus returns.
- Scroll-lock preserves scrollbar gutter width to reduce page jump.
- Scanner pickup detection includes `role="link"` support.
- Airplane wing silhouette remains widened for readability (`wingSpan`, `wingAccentSpan`).
- Police chase movement still reacts to ice surfaces (smoke-tested).
- `window.__domRacerDebug` must not exist in source/build.
- Overgrowth remains intentionally deferred.
- README now includes indie/playful voice, "why this is fun" section, living roadmap table, and airplane events section.
- Smoke tests currently pass (`npm run test` -> 25 tests).
- Release build profile remains active (`npm run build`, sourcemaps off by default).

Priority lock for this session:
1) One bounded hardening extraction
2) One bounded roadmap follow-up
3) Tiny tuning only if needed after 1+2

Primary goals:
1. Hardening extraction target (pick exactly one):
   - Extract one more small orchestration slice from `Game.ts` into a focused runtime helper (no behavior change).
   - Keep run-state and encounter boundaries intact.
2. Feature target (pick exactly one bounded item):
   - Prefer readability-first follow-up on existing airplane/police beats, or
   - If gameplay feature scope is unclear, land one bounded Phase 6 presentation/docs polish item (e.g., screenshot placeholders, presentation assets).
3. Verification:
   - Confirm police catch -> GAME OVER -> Space restart still works.
   - Confirm specials remain independent from regular coin economy.
   - Confirm focus-loss pause/resume remains immediate and stable.
   - Confirm no `__domRacerDebug` in source/build.

Constraints to preserve:
- No screen shake
- No broad mechanic expansion
- Playful, readable, non-violent tone
- Keep controls/core loop stable

Before finishing:
- Run `npm run test`
- Run `npm run build`
- Re-audit `__domRacerDebug` in `src/` and `dist/`
- Update `SOUL.md` status/checklists/session note
- Update `NEXT_SESSION_PROMPT.md` for next handoff
- Stage all changed files and create a git commit summarizing the session
- Provide concise summary: changed files, hardening decision, feature decision, tuning decision, remaining risks
