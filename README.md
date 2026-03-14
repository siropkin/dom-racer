# DOM Racer

```
       ████    ███   █   █
       █   █  █   █  ██ ██
       █   █  █   █  █ █ █
       █   █  █   █  █   █
       ████    ███   █   █

████    ███    ████  █████  ████
█   █  █   █  █      █      █   █
████   █████  █      ████   ████
█  █   █   █  █      █      █  █
█   █  █   █   ████  █████  █   █
```

**Your browser tab is a racetrack. You just don't know it yet.**

DOM Racer is a Chrome / Edge extension that scans any webpage and turns it into a top-down arcade arena. Links and buttons become coins. Text slows you down. Form fields grow weeds. Police show up, a biplane drops gifts from the sky, and the page you were reading is now a hostile little world.

![Normal run on GitHub Issues page](assets/screenshot-normal-run.png)

## Every Page Plays Different

A docs page is a maze of slow zones. A dashboard is a wide-open track with scattered coins. A landing page is a slippery ice rink full of hero images. You never know what the track will look like until you hit the hotkey.

The longer you survive, the weirder it gets. Power-ups to grab. Police that punish overstaying. A biplane dropping surprises. Grass that grows into bushes and trees, closing off your escape routes. It starts clean. It doesn't stay clean.

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
| `Space` | Nitro boost (3s cooldown) |
| `V` | Switch vehicle (each drives differently!) |
| `M` | Toggle music |
| `R` | Restart run |
| `Esc` | Quit |
| `Space` (game over) | Restart |

You can also start the game from the extension popup button.

## What Happens During a Run

- Every link and button becomes a gold coin — drive through them for score
- Nine power-ups spawn into open space as you play — some help, some hurt, one is a mystery
- Police show up after a while with flashing sirens — outrun them or get busted. Survive enough chases and they send a helicopter
- A propeller biplane crosses the arena dropping bonus pickups, coin trails, or lucky wind
- After ~35s, grass sprouts from obstacles, grows into bushes, then trees — your lanes shrink
- Coin-collection goals appear mid-run — hit them for +20 to +40 bonus points
- Thread the gap near walls or police for a near-miss flash (no score, just style)
- Daily modifiers twist the rules: double coins, faster police, slippery surfaces, and more
- Hit `Space` for a nitro burst — cooldown varies by vehicle

**Three vehicles, three feels.** Unlocked by hitting lifetime score milestones. Swap mid-game with `V`.

| | Coupe | Buggy | Truck |
|---|---|---|---|
| **Feel** | Balanced | Nimble dart | Freight train |
| **Speed** | Medium | Slower, but... | Fastest |
| **Turning** | Normal | Sharp and snappy | Sluggish |
| **Nitro** | 3.0s cooldown | 2.2s cooldown | 3.8s cooldown |
| **Unlock** | Default | 500 lifetime score | 1500 lifetime score |

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

DOM Racer scans your visible page and translates real HTML elements into game geometry:

- **Text blocks** → slow zones (car slows down)
- **Links & buttons** → gold coin pickups
- **Form controls** (inputs, textareas, selects) → slow zones + overgrowth surfaces
- **Images, video, canvas** → ice surfaces (slippery!)
- **Fixed UI near edges** → barriers
- **SVGs & colorful surfaces** → speed boosts
- **Empty space** → where specials spawn mid-run

The result is intentionally game-ish, not pixel-perfect. A GitHub Issues page plays nothing like a Wikipedia article, and that's the whole point.

## Tips

- **Try different websites** — every page generates a unique track
- **The buggy** turns fast and recharges nitro quickly — great for tight pages
- **The truck** has raw speed but turns like a boat — best for open stretches
- **Listen for the airplane** — follow the propeller drone to the drop
- **After ~35s**, overgrowth closes off routes — plan your lanes early

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
