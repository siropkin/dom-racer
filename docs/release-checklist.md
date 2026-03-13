# DOM Racer Release Checklist

Lightweight pre-release pass for local and store-facing builds.

## Build And Test

- [ ] Run `npm run test`
- [ ] Run `npm run build`
- [ ] Run `npm run lint`
- [ ] Run `npm run format:check`
- [ ] Confirm `dist/` is regenerated for this revision

## Runtime Safety

- [ ] Confirm there is no page-level debug API (`window.__domRacerDebug`) in source or build output
- [ ] Confirm debug workflow remains in-game only (`Shift + D` sprite showcase)
- [ ] Confirm police catch flow is intact (`GAME OVER` -> `Space` restart)

## Economy And Encounters Smoke

- [ ] Regular money still comes from scanned link/button anchors only
- [ ] Ambient specials remain independent from regular money staging
- [ ] Airplane, police, and special pacing still reads as separate beats (no chaotic overlap spikes)

## Late-Run Systems Smoke

- [ ] Overgrowth spawns from barriers after ~35s, grows through three stages, large stage blocks movement
- [ ] Near-miss bonus triggers on close calls with obstacles/police, awards +3-5 score with cooldown
- [ ] Micro-objectives: coin-collection goals with x2/x3/x4 multiplier tiers, completion awards scaled bonus
- [ ] Jackpot pickup appears rarely (~6%), awards +50-100 score on collection
- [ ] Daily modifier applied on run start (visible in "TODAY: X" toast), affects gameplay per modifier kind

## Docs And Packaging

- [ ] Update `SOUL.md` statuses/checklists/session note for the shipped changes
- [ ] Verify `README.md` feature and control statements still match runtime behavior
- [ ] Verify `public/manifest.json` version/description/permissions are accurate for release
