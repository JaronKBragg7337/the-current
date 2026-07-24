# AGENTS.md

This repository is the independent source of **The Current**. Do not implement it inside, copy secrets from, or directly edit the neighboring Heartbeat Observatory repository.

## Observe the owner's live world

**Any agent working on this project with the owner must observe the owner's
existing live shared world.** It is the default in development and in
production. Never spin up a fresh local world and treat it as the real one — a
day-0 private world is not this project's world, and reviewing or reporting on
one produces conclusions about a world that does not exist.

- `npm run dev` loads the shared live world, exactly as the deployed site does.
  There is no development exception, and there must never be one again.
- `?world=local` (alias `?world=new`) is **only** for an outsider who wants to
  fork a private world of their own, and for the browser test suite, which must
  opt in explicitly. It is never how the owner or a collaborating agent looks at
  this project.
- If the shared world cannot be reached, the client says so. It does not
  silently substitute a new local world. Treat that error as a blocker to
  investigate, not as a reason to add `?world=local`.

Confirm you are on the live world before drawing any conclusion from it:

1. The top bar shows the **`LIVE — ONE SHARED WORLD`** badge. A private fork
   instead shows `Private fork — not the shared world`.
2. The current world day matches the deployed site at
   <https://jaronkbragg7337.github.io/the-current/>. The authoritative head is
   also readable directly from the `the_current_world` row referenced by
   `public/shared-world.json`.

If the badge says private fork, or the day disagrees with the live site, stop
and fix that before reporting anything about the world's state.

## Time is a property of the world

Every world runs on the real clock: one world day per real day, measured from
that world's genesis (`genesis_at` + `world_day_ms` for the shared world, the
creation timestamp for a private fork). There are no pause, speed, or
manual-day-advance controls anywhere, in any mode, and none may be added. An
outsider's private fork is bound by the real clock exactly as the shared world
is. Do not reintroduce a UI, keyboard shortcut, or runtime method that lets a
viewer reposition time.

## Governing constraints

1. NPCs are autonomous. Camera modes and observer interventions never grant direct control.
2. Authoritative behavior lives in `src/simulation` and must not import React, Three.js, browser storage, wall-clock time, or nondeterministic randomness.
3. External observations and interventions enter as timestamped inputs. They may alter pressure, information, availability, or incentives; they may not directly script outcomes.
4. Rendering is a projection. An entity continues to exist and act when it is not rendered.
5. Important state transitions produce historical events. Save/reload and replay must preserve the same digest for the same engine version.
6. Keep coordinates in meters, +Y up, and -Z forward for authored assets.
7. Never commit credentials, browser state, raw source archives, local saves, or generated caches.
8. Record every incorporated external asset and dataset in the relevant machine-readable manifest and human-readable inventory.

## Repository map

- `src/simulation/` — deterministic authoritative civilization
- `src/worker/` — versioned worker protocol and simulation host
- `src/persistence/` — world/event/snapshot storage
- `src/data/` — external observation normalization
- `src/world/` — Three.js world projection and procedural presentation
- `src/ui/` — spectator interface
- `scripts/` — headless simulation, ingestion, and asset tooling
- `tests/` — unit, deterministic, persistence, and browser verification
- `assets/` — manifests, licenses, transforms, and committed runtime derivatives
- `docs/` — specification, architecture, decisions, status, and inventories

## Required checks

Run the smallest relevant checks while iterating, then before a checkpoint run:

```powershell
npm run lint
npm run typecheck
npm run test
npm run build
```

For simulation changes, also run `npm run sim:150`. For UI/camera changes, run the Playwright suite and inspect the fixed-seed browser scene. Do not update a deterministic digest or screenshot simply to hide an unexplained change.

## CI and delivery policy

- `Lint, test, build, and simulate` plus the desktop and mobile browser smoke checks are the required release gates. `Browser extended · desktop-chromium` is manual diagnostic coverage and is deliberately not a deployment blocker.
- The smoke test exercises a real worker-backed WebGL world, verifies rendering, and advances a deterministic day. Do not remove or weaken it to make CI green.
- The extended desktop suite renders the full Three.js world continuously under software WebGL on a constrained GitHub runner. If that manual suite fails while required checks pass, inspect its logs and retained artifacts first. Do not repeatedly change simulation rules, rendering behavior, test interactions, or timeout values unless there is evidence of a reproducible product regression.
- When the user asks to take a change through delivery, run the relevant checks, open a focused ready-for-review PR (never a draft), wait for required CI, merge it, and verify the post-merge deployment. A ready PR is part of the normal delivery path for this repository so GitHub Pages receives the update after its checks pass.

## Change discipline

Use small domain modules and typed boundaries. Preserve existing user work. Commit meaningful working checkpoints; do not commit a knowingly broken generated cache. Update `docs/STATUS.md` truthfully when a system moves between unimplemented, partial, and verified.
