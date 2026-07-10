# assets/

## legacy/
`body-front.svg` / `body-back.svg` — the original hand-drawn block-shape
body figures used before the heatmap switched to the
[`body-highlighter`](https://github.com/lahaxearnaud/body-highlighter)
library (2026-07-09, see `docs/decisions.md`). No longer loaded by the
app — the library brings its own anatomical SVG, fetched from a CDN. Kept
here rather than deleted since this project has no git history to fall
back on if they're needed for reference later.

## Still to add
- Tabler outline icon set (`ti-flame`, `ti-plus-circle`, `ti-list-search`, `ti-calendar-stats`) — currently text labels in the bottom nav
- App icons (for the PWA manifest, once that's added)
