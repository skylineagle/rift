# Rift video kit

Sources: README.md, apps/desktop/src/index.css, apps/desktop/src/components, assets/icon.svg, design/branding/mark.svg. When this file and the repo disagree, the repo wins.

## The brief
- Plays: launch/demo video with sound. 16:9, 1920x1080, 30 fps. 30 s.
- Music: synth bed generated in code (`scripts/music.py`, 120 BPM, kick/hat/clap/bass/pad, final hit on bar 14, ring-out). Measured with `scripts/beats.py`.
- Must show: `rift pipe` TCP to UART (CLI), live traffic inspector (A→B amber, B→A cyan, hex dump), InjectBar, profiles + desktop app (rift.toml, macOS/Linux/Windows, self-updates).
- Ingredients: the 14-particle mark as the brand element · punchlines word by word between scenes · magic moves (particles travel into the next scene) · no cursor.
- Ending: mark + "rift" lockup, github.com/skylineagle/rift.

## Hard rules
- Casing: product name "rift" in the README and wordmark, "Rift" in the app title bar.
- Type: system-ui for UI and words, ui-monospace for data, addresses, hex and the URL (index.css `--font-mono`).
- Corners: 8 px (`--radius: 0.5rem`), pills 10 px.
- Surfaces: background `#000`; window `#0b0b0c`, panels `#111113`, selected `#18181b`/`#222226`.
- Borders: 1 px `#1e1e22` dividers, `#2b2b30` for controls. No shadows beyond the segmented control's own.
- Effects: none beyond the mark's own particles. No glows, no bouncy easing.

## Color
| Token | Value | Use |
|---|---|---|
| bg | #000000 | frame |
| surface / 2 / 3 / 4 | #0b0b0c / #111113 / #18181b / #222226 | window, panels, open row, selected |
| line / line-2 | #1e1e22 / #2b2b30 | dividers / controls |
| fg / fg-2 / fg-3 | #f4f4f5 / #a1a1aa / #6e6e77 | text |
| ab (amber) | #f59e0b | A→B, accent |
| ba (cyan) | #38bdf8 | B→A |
| ok | #22c55e | connected |

## Logo and brand element
- 14 dots: 7 amber (an arrow pointing right), 7 cyan (pointing left). `src/promo/mark.ts` copies the SVG geometry.
- One instance across the film: `src/promo/particles.ts` places every dot as a pure function of time (scatter → mark → lockup → small mark → two streams → into log rows → out of profile status dots → lockup → fade).

## Components (frame-driven twins in `src/promo/ui`)
| Need | Source | Why a twin |
|---|---|---|
| TitleBar, UpdateReadyPill | components/TitleBar.tsx, UpdateReadyPill.tsx | read stores, Tauri drag region |
| ProfileSidebar, ProfileRow, StatusDot | components/ProfileSidebar.tsx, ProfileRow.tsx, StatusDot.tsx | stores, CSS transitions, pulse keyframes |
| DataRow, PayloadText, HexDump | components/DataRow.tsx, PayloadText.tsx, HexDump.tsx | `Date.now()` fresh window, keyframe tint |
| LogToolbar, SegmentedControl | components/LogToolbar.tsx, SegmentedControl.tsx | Radix toggle group, CSS transition |
| InjectBar | components/InjectBar.tsx | Tauri API, async preview |
| BridgeStrip, SideChip, StatusPill | components/SideCard.tsx, StatusPill.tsx | compact twin of the side cards |

## Motion
- Ease `cubic-bezier(0.23, 1, 0.32, 1)` for UI, word landings `cubic-bezier(0.22, 1, 0.36, 1)`, magic moves on a spring (stiffness 150, damping 20).

## Claims
- May show: README commands and URIs verbatim, CLI log format from crates/rift-cli/src/render.rs, profile names from examples/combos/sensor-gateway.toml, injection placeholder `$PUBX,00*33\r\n` from lib/injection.ts, platforms from the README install table, update pill text from UpdateReadyPill.
- Never: performance numbers, protocols rift does not speak.

## Workspace
- `showcase/video`, own package, remotion 4.0.544 pinned, React 19.3.1, lucide-react 1.73.0. No Tailwind: twins mirror the app's classes as inline styles.
- Scripts: `music.py`, `beats.py`, `beat-sheet.ts`, `stills.ts`, `render.ts` (120 fps master, 4-subframe blur to 30 fps), `verify.py`.
