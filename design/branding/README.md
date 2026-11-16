# Rift particle identity

Approved C retains opposing arrows, rebuilt as fourteen round particles. The upper stream uses the animation's amber #f59e0b; the lower stream uses cyan #38bdf8, on #0b0b0c ground.

icon.svg is the canonical tile, mark.svg is transparent, and mono.svg is single-color. PNG exports span 16–1024px. comparison.html and comparison.png compare original C and the installed icon at small and desktop sizes. Original concepts remain unchanged.

Installed SVGs: assets/icon.svg and apps/desktop/public/icon.svg. Existing title bar and favicon references consume the public SVG. Existing Tauri bundle configuration references the regenerated PNG, ICNS and ICO files in apps/desktop/src-tauri/icons. Windows Appx assets are regenerated too.

From apps/desktop, run `bun run tauri icon ../../assets/icon.svg --output /tmp/rift-desktop-icons`, then copy only top-level files to src-tauri/icons. Generated mobile subdirectories are excluded. PNG exports use rsvg-convert.

The OS icon changes after rebuilding and launching the desktop executable or bundle. No shared components or application behavior changed.
