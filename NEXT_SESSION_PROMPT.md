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

## Current State

All bounded hardening extraction and most presentation tasks are complete. Actionable next items:

1. **Branding refresh (Phase 6, new):** Redesign `branding/` SVGs (icon, store tile, store cover) to use the actual in-game blue coupe sprite instead of the generic pink placeholder car. See `src/game/playerSprite.ts` for the real vehicle designs. Update `generate_assets.py` and regenerate PNGs via `npm run brand`.
2. **Blocked on interactive browser session:** Manual scanner/gameplay verification on real page types (GitHub, docs, forms, grids), remaining screenshot/GIF captures.
3. **Explicitly deferred:** Phase 2 overgrowth system, Phase 4 indie juice candidates, Phase 1 new special prototypes.

## Current Known Context

- Airplane drop modes remain: bonus drop, coin trail, spotlight, lucky wind, police delay (boost lane removed as confusing).
- Plane drop dispatch/fallback remains in `src/game/planeDropRuntime.ts` and is retry-safe.
- Plane drop coordinates center directly under the airplane (no y-offset).
- Plane flyover sound plays when the plane enters the viewport (`flyoverSoundPlayed` flag), not at encounter creation.
- All encounter/effect/spawn orchestration is extracted to focused runtime helpers.
- `Game.ts` retains only side-effect orchestration, core loop, and render assembly.
- Police car wheels match player car style (black boxes with white border).
- Police car body and airplane contours have white borders for bright-page visibility.
- Airplane sprite: narrower wings (wingSpan 28), wider body (bodyWidth 12, bodyLength 28), wider tail (tailWidth 8, tailHeight 8).
- Scanner classifies `img`, `picture`, `video`, `canvas` as `ice`; `svg` remains `boost`.
- Scanner detects YouTube/Vimeo iframes via `src` URL match and classifies them as `ice`.
- `window.__domRacerDebug` must not exist in source/build.
- Overgrowth remains intentionally deferred.
- README includes indie/playful voice, "why this is fun" section, living roadmap table, airplane events section, and screenshots & motion placeholder section.
- Smoke tests currently pass (`npm run test` -> 32 tests).
- Release build profile remains active (`npm run build`, sourcemaps off by default).

## Constraints To Preserve

- No screen shake
- No broad mechanic expansion
- Playful, readable, non-violent tone
- Keep controls/core loop stable

## Before Finishing Any Future Session

- Run `npm run test`
- Run `npm run build`
- Re-audit `__domRacerDebug` in `src/` and `dist/`
- Update `SOUL.md` status/checklists/session note
- Update `NEXT_SESSION_PROMPT.md` for next handoff
- Stage all changed files and create a git commit summarizing the session
