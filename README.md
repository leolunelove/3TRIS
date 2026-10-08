# 3TRIS

[Play 3TRIS](https://leolunelove.github.io/3TRIS/)

A falling block game with Endless survival and a 40-line Sprint. Runs entirely in the browser; settings and records are stored locally on your device.

## Play

Arrow keys or WASD move, Z/X rotate, Q rotates 180°, C holds, Space drops, R restarts, and Escape pauses. Large touch controls appear on phones and touchscreens.

Endless gets faster as you clear lines. Sprint keeps a steady speed and ends when you clear at least 40 lines; the clock stops on the final placement. Each mode keeps its own records, and completed sprints compete for the fastest time. Line-clear flashes, combo labels, and landing impacts respect reduced-motion settings.

## Develop

Requires Node.js 24 and pnpm. Run `pnpm install` followed by `pnpm dev`. Run `pnpm test` for game and record regression tests, `pnpm typecheck` for TypeScript checks, and `pnpm build:pages` for the tested deployment build.

## Deploy

Push to `main`. The GitHub Actions workflow builds the static game and deploys it to GitHub Pages. Enable Pages with **GitHub Actions** as its source in repository settings.
