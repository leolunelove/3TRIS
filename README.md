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

## Shared top-10 leaderboard

The leaderboard runs in the existing free `shared-memo` Supabase project. Dedicated `tris_scores` and `tris_run_tickets` tables support the `tris-leaderboard` Edge Function. The schema is in `leaderboard.sql`; the deployed function source is `leaderboard-edge.ts`.

Only the best 10 results per mode are retained (20 score rows maximum). A submission transaction removes any result below tenth place. Endless ranks by score descending; Sprint ranks completed runs by time ascending. Ties favor the earlier result. Each browser identity can hold one place per mode. Local personal bests remain on the device even when a shared result is discarded.

Players choose a public nickname when posting a finished run. A random browser token identifies repeat players; clearing browser storage creates a new identity. Run tickets are temporary and expire after 24 hours, with expired tickets removed when another run starts. No existing local history is uploaded automatically. Scores are client-reported with timing/plausibility checks, rate limits, and duplicate protection; this is not replay-verified competitive anti-cheat.

Database tables and submission functions are restricted to the server role. The Edge Function checks its own public 3TRIS app identifier, so gateway JWT verification is disabled. The frontend config grants no direct Supabase database access and contains no server credentials. RLS without policies is intentional: all direct client table access is denied.

Validation: `pnpm test` covers the engine and HTTP API. Database integration tests verify ranking, duplicate protection, mode separation, denied direct client access, and the ten-row storage cap, inside rolled-back transactions.
