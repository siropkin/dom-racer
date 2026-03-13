# DOM Racer

**Your browser tab is a racetrack. You just don't know it yet.**

DOM Racer is a Chrome / Edge extension that scans whatever page you're on and turns it into a tiny top-down arcade arena. Links become loot. Text becomes walls. Images become ice. Buttons become coins. Police show up when you get too comfortable. A propeller plane drops weird gifts from the sky. The page you were reading five seconds ago is now a hostile little world, and you love it.

![Normal run on GitHub Issues page](assets/screenshot-normal-run.png)

## Every Page Plays Different

A docs page is a maze of text walls. A dashboard is a wide-open racetrack with scattered buttons. A landing page is a slippery ice rink full of hero images. You never know what the track will look like until you hit the hotkey — and that's the whole point.

The difficulty curve is simple: the longer you survive, the weirder it gets. Coins to chase. Power-ups to grab. Police cars that punish overstaying your welcome. A biplane that drops surprises across the map. Bushes that literally grow out of the walls and close off your escape routes. It starts clean. It doesn't stay clean.

## Get It Running

```bash
npm install
npm run build
```

1. Open `chrome://extensions` (or `edge://extensions`)
2. Enable **Developer Mode**
3. Click **Load unpacked** → select the `dist/` folder
4. Open any page and press **Shift + Space**

That's it. You're racing.

## Controls

| Key | What it does |
|---|---|
| `Shift + Space` / ``Shift + ` `` | Toggle the game on/off |
| `WASD` / Arrow keys | Drive |
| `R` | Restart run |
| `V` | Switch vehicle |
| `M` | Toggle sound |
| `Esc` | Quit |
| `Space` (game over) | Restart |

You can also start the game from the extension popup button.

## What Happens During a Run

**Coins everywhere.** Every link and button on the page becomes a gold coin. Drive through them. That's your score.

**Power-ups spawn in.** Nine specials drop into free space as you play — some help, some mess with you, one is a total mystery. Grab them all anyway. (See the full list below.)

**Police show up.** Stay alive long enough and a cop car spawns at the edge of the screen with flashing sirens. Outrun it or get busted. The longer your run, the longer they chase.

**A plane flies over.** A propeller biplane crosses the arena and drops one of five things: bonus pickups, a trail of coins, a spotlight on a hidden special, a lucky wind that nudges coins your way, or a brief police delay. You'll hear the drone coming.

**The page fights back.** After ~35 seconds, bushes and trees start sprouting from walls and barriers, slowly eating into your driving lanes. Small bumps become speed traps become full walls. The map tightens. Your routes get riskier.

**Goals appear.** A few seconds into a run, you get a quiet coin-collection challenge: grab N coins in X seconds. Nail it for a score bonus (+20 to +40). Miss it, no penalty — another one shows up after a cooldown.

**Near-misses feel great.** Thread the gap between your car and a wall or police cruiser and the HUD flashes — CLOSE! TIGHT! RAZOR! — with a burst of particles. No score bonus, just the thrill.

**Daily modifiers.** Every day the rules twist a little: double coins, faster police, slippery surfaces, early overgrowth, extra specials. It's the same page, but today it's different.

**Vehicles unlock.** Three designs — coupe, buggy, truck — unlocked by hitting lifetime score milestones. Swap mid-game with `V`.

## The Power-Ups

| Pickup | What happens |
|---|---|
| **BONUS** | Instant +40 points. Simple. Beautiful. |
| **MAGNET** | Pulls nearby coins and specials toward you like a vacuum |
| **INVERT** | Flips the page colors. Dark mode speedrun. |
| **GHOST** | Phase through trouble. Police can't lock on. |
| **BLUR** | CSS blur hits the page. Dreamy and disorienting. |
| **OIL SLICK** | Your car slows to a crawl. Dark oily bad times. |
| **REVERSE** | Steering is flipped. Left is right. Panic is real. |
| **MYSTERY** | Could be anything. Good or bad. Grab it if you dare. |
| **JACKPOT** | Rare golden star. +50 to +100 points. Chase it. |

Active effects show a countdown timer in the top-right HUD panel.

## How the World Is Built

This is the genuinely cool part. DOM Racer scans your visible page and translates real HTML elements into game geometry:

- **Text blocks** → wall slices (using actual visible text bounds)
- **Links & buttons** → gold coin pickups
- **Images & pictures** → ice surfaces (slippery!)
- **Fixed UI near edges** → barriers
- **SVGs & reactive surfaces** → speed boosts
- **Empty space** → where specials spawn mid-run

The result is intentionally game-ish, not pixel-perfect. The goal is to preserve the *feel* of the page while making it fun to drive through. A GitHub Issues page plays nothing like a Wikipedia article, and that's the whole point.

## Privacy

DOM Racer collects **no data** and makes **no network requests**. Zero. None.

All game state — scores, settings, run history — lives locally on your device via `chrome.storage.local`. No analytics, no telemetry, no tracking, no remote services. The extension needs `storage` permission for saving your progress and `<all_urls>` host access because the game runs on whatever page you choose.

## Project Layout

```
src/content/    Page scanning, overlay bootstrapping
src/game/       Game loop, rendering, HUD, audio, sprites
src/shared/     Types, settings, persistence
public/         Manifest, icons, popup
branding/       SVG sources + asset generator
```

## Development

```bash
npm run dev          # Watch mode
npm run build        # Production build
npm run test         # Smoke tests
npm run lint:fix     # Lint + auto-fix
npm run format       # Prettier
npm run package      # Build + Chrome Web Store ZIP
```

Built with TypeScript, Vite, Canvas 2D, and Web Audio API. No frameworks, no dependencies at runtime — just a content script and a canvas.

## Support

DOM Racer is a solo indie project. If it made you smile, consider [buying me a coffee](https://buymeacoffee.com/ivan.seredkin) ☕

## License

MIT — see [LICENSE](LICENSE).
