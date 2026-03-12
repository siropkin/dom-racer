# Permissions And Host Scope Rationale

This document explains why `DOM Racer` currently uses `<all_urls>` and the minimal permission set in `public/manifest.json`.

## Current Manifest Surface

- `permissions`: `["storage"]`
- `content_scripts.matches`: `["<all_urls>"]`
- No background service worker
- No network, tabs, scripting, or identity permissions

## Why `<all_urls>` Is Used

DOM Racer is a page-overlay game that maps visible DOM content into the game world at runtime. The extension must run on arbitrary pages to support the core interaction model:

- scan visible links/buttons/text/surfaces on the currently open page
- build a playable arena from that page's own layout
- let users start the game anywhere via `Shift + R`

Narrow host allowlists would break the primary product behavior (play on any page the user chooses).

## Data And Privacy Boundaries

- Data persistence is limited to local gameplay/settings state through `chrome.storage.local` (or `localStorage` fallback)
- No outbound telemetry or remote sync path is included
- No page-level debug globals are exposed; debugging stays in-game via `Shift + D`

## Future Tightening Options

If product scope changes, host access can be narrowed by:

1. moving from `<all_urls>` to a curated host allowlist
2. adding optional host permissions flow for user-selected sites
3. shipping separate channels for broad-dev builds vs narrowed-store builds

For current gameplay goals, `<all_urls>` remains intentional and required.
