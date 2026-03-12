# DOM Racer - Next Session Prompt

Continue work on the DOM Racer browser extension in `/Users/ivan.seredkin/_projects/dom-racer`.

First, read:
- `README.md`
- `SOUL.md`
- `NEXT_SESSION_PROMPT.md`
- `src/game/Game.ts`
- `src/game/gameRuntime.ts`
- `src/content/domScanner.ts`
- `src/content/worldBuilder.ts`
- `src/shared/types.ts`
- `vite.config.ts`
- `package.json`

Current known context:
- Airplane `boost lane` prototype exists; `coin trail` is still not implemented.
- Page-level debug API must remain absent (`window.__domRacerDebug` must not return).
- Debug workflow is in-game only via `Shift + D` sprite showcase mode.
- Hardening-first lock is active before any broader design/system expansion.
- Baseline smoke tests are in place (`npm run test`) and currently passing.
- Release build profile is set with sourcemaps disabled by default (`npm run build`).

Priority lock for this session:
1) Hardening and structure
2) Then small tuning polish only

Primary goals:
1. Continue structural cleanup:
   - split `src/game/Game.ts` further by subsystem boundaries
   - avoid behavior changes and preserve existing controls/core loop
2. Follow-up hardening:
   - add/close remaining coverage for overgrowth collision behavior
   - if overgrowth is still intentionally out of active scope, document explicit defer/removal decision
3. Release readiness:
   - add lightweight release checklist doc
   - add permissions/host-scope rationale doc for `<all_urls>`
4. After hardening tasks:
   - do a tiny event-pacing constants pass only
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
- provide concise summary: changed files, hardening decisions, tuning decisions, remaining risks
