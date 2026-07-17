# assets/

## Atlas wordmark
`Atlas Logo.png` — the original, Ryan-provided source (solid near-black
background, generous margin around the artwork), kept as source of truth
rather than deleted — same "keep the original around in case a derivative
needs regenerating" convention `docs/decisions.md`'s "Real app icon" entry
established for `app_icon.png`. Not referenced directly anywhere.

`atlas-logo.png` / `atlas-logo-light.png` — generated derivatives used as
`.topbar-logo`'s CSS `background-image` on every screen (see
`docs/decisions.md` "Atlas wordmark header"): background knocked out to
transparency and de-haloed against black, cropped to the artwork's tight
bounding box, via a one-off PowerShell + `System.Drawing` script (no
Node/Python needed, same tool that entry used for icon generation).
`-light` additionally has its achromatic (white/grey) wordmark pixels
flattened to a dark fill for contrast against the light theme's
near-white surface — the orange-to-red triangle/pulse-line accent is
untouched in both files, left exactly as supplied.

## legacy/
`body-front.svg` / `body-back.svg` — the original hand-drawn block-shape
body figures used before the heatmap switched to the
[`body-highlighter`](https://github.com/lahaxearnaud/body-highlighter)
library (2026-07-09, see `docs/decisions.md`). No longer loaded by the
app — the library brings its own anatomical SVG, fetched from a CDN. Kept
here rather than deleted since this project has no git history to fall
back on if they're needed for reference later.
