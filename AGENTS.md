# AGENTS.md

This repository is the independent source of **The Current**. Do not implement it inside, copy secrets from, or directly edit the neighboring Heartbeat Observatory repository.

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

## Change discipline

Use small domain modules and typed boundaries. Preserve existing user work. Commit meaningful working checkpoints; do not commit a knowingly broken generated cache. Update `docs/STATUS.md` truthfully when a system moves between unimplemented, partial, and verified.
