# DOM Racer Release Checklist

Lightweight pre-release pass for local and store-facing builds.

## Build And Test

- [ ] Run `npm run test`
- [ ] Run `npm run build`
- [ ] Confirm `dist/` is regenerated for this revision

## Runtime Safety

- [ ] Confirm there is no page-level debug API (`window.__domRacerDebug`) in source or build output
- [ ] Confirm debug workflow remains in-game only (`Shift + D` sprite showcase)
- [ ] Confirm police catch flow is intact (`GAME OVER` -> `Space` restart)

## Economy And Encounters Smoke

- [ ] Regular money still comes from scanned link/button anchors only
- [ ] Ambient specials remain independent from regular money staging
- [ ] Airplane, police, and special pacing still reads as separate beats (no chaotic overlap spikes)

## Docs And Packaging

- [ ] Update `SOUL.md` statuses/checklists/session note for the shipped changes
- [ ] Verify `README.md` feature and control statements still match runtime behavior
- [ ] Verify `public/manifest.json` version/description/permissions are accurate for release
