# The Current

The Current is a local-first, deterministic civilization simulation presented as a Three.js spectator world. Its inhabitants enter, move, work, meet, form households and relationships, reproduce, build, lead, experiment, inherit, and die without a player character. An observer can watch from orbit, follow an NPC, or see through an NPC's eyes, but cannot steer that person.

This is a working first implementation, not the finished civilization described by the specification. The population loop, persistence, worker isolation, causal inputs, and 3D spectator experience run today. Businesses, laws and ideologies, multiple settlements, road-based navigation, authoritative vehicles and goods, long-form historical replay, and a shared public-world backend remain future work. See [the exact implementation status](docs/STATUS.md).

![The Current's procedural settlement in orbital view](docs/screenshots/orbital-world-final.png)

## Repository

- Public source: <https://github.com/JaronKBragg7337/the-current>
- Authoritative specification: [docs/MASTER_SPECIFICATION.md](docs/MASTER_SPECIFICATION.md)
- This repository is separate from Heartbeat Observatory and can be deployed independently at `/`, `/the-current/`, or `/worlds/the-current/`.

## Run locally

Requirements: Node.js 24 or newer, npm 11, and a WebGL2-capable browser.

```powershell
git clone https://github.com/JaronKBragg7337/the-current.git
cd the-current
npm ci
npm run dev
```

Open the URL printed by Vite. The simulation starts paused. It works without live network data after the application files load.

This repository was developed on a Google Drive virtual filesystem, where dependency extraction can corrupt `node_modules`. If installation there fails, use the committed NTFS-cache runner:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\run-from-local-cache.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\run-from-local-cache.ps1 -Script test
```

The runner keeps the Git worktree in place, mirrors source without secrets or generated caches, and installs dependencies in a managed local NTFS cache. Full setup details are in [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md).

## What works now

- A seeded authoritative simulation with 20 initial people and exactly two entrants per world day.
- Lifespans, visible life stages, needs, food and water, employment assignments, prices, relationships, reproduction, births, early and natural deaths, inheritance, construction, institutions, influence, leaders, followers, and rare breakthrough attempts.
- Spatial prerequisites: NPCs travel before working, building, researching, governing, trading, caring, or meeting; encounters require proximity or a shared home/worksite.
- Timestamped events, deterministic snapshots and replay, 150-day acceptance and 500-day endurance runs.
- A module-worker runtime with an in-process startup fallback, throttled projections, single-flight/coalesced IndexedDB autosaves, snapshot retention, JSON export, and queue-barrier-protected import.
- Causal observer interventions and normalized external signals. The bundled signal fixture is offline and deterministic; credential-free ingestion adapters run outside the browser.
- A procedural Three.js island settlement with terrain, water, roads, farms, staged buildings with door openings and simple interiors, articulated stylized NPCs, instanced far population, resource sites, event markers, and presentation-layer traffic.
- Orbital, third-person follow, and view-only first-person cameras with smooth transitions, obstruction handling, selection, inspections, controls, and responsive UI.

The fixed 150-day seed finished with 175 living people, 12 births, 157 deaths, 28 partnerships, 63 completed buildings, two adopted breakthroughs, and an exact replay digest. The 500-day seed finished with 184 living people after 1,000 entrants, 77 births, and 913 deaths. Both passed all 23 structural and acceptance checks. Detailed results and caveats are in [docs/HEADLESS_RESULTS.md](docs/HEADLESS_RESULTS.md).

## Controls

- Drag to orbit; right-drag or Shift-drag to pan; wheel or pinch to zoom.
- Click or tap an entity to select it; double-click an NPC to follow.
- `1`, `2`, `3`: orbital, third-person, and first-person spectator views.
- `Space`: pause/resume. `[` / `]`: change speed.
- `H`: hide/show UI. `Escape`: close a panel or return toward orbit.

Camera modes remain observational. Complete desktop and touch controls are in [docs/CONTROLS.md](docs/CONTROLS.md).

## Verify

```powershell
npm run lint
npm run typecheck
npm run test
npm run assets:validate
npm run licenses:validate
npm run build
npm run sim:150
npm run test:e2e
```

The recorded checkpoint has 59 passing Vitest tests across 16 files. The complete Playwright matrix has 10 applicable passing cases across desktop and Pixel 7 Chromium, with 6 intentional project-specific skips. Deterministic replay, browser evidence, and screenshots are cataloged in [docs/VERIFICATION.md](docs/VERIFICATION.md).

## Architecture and operations

- [Architecture and authority boundaries](docs/ARCHITECTURE.md)
- [Simulation rules](docs/SIMULATION_RULES.md)
- [Development and test commands](docs/DEVELOPMENT.md)
- [Deployment and base paths](docs/DEPLOYMENT.md)
- [Performance measurements](docs/PERFORMANCE.md)
- [Data-source research and ingestion](docs/DATA_SOURCES.md)
- [Asset research, pipeline, and provenance](docs/ASSETS.md)
- [Library and asset licenses](docs/LICENSES.md)
- [Design decisions](docs/DECISIONS.md)
- [Instructions for future agents](AGENTS.md)

## Important limitations

The current economy is a causal prototype, not yet a complete market: prices respond to scarcity, but households do not bid for rationed inventory, resource allocation is pooled, and an adult can be counted as employed without a concrete employer. Buildings can produce baseline output without a labor roster. There are no autonomous businesses, debt contracts, laws, ideologies, crime organizations, or multiple settlements yet.

Roads and vehicles are presently presentation systems. NPC movement uses straight-line daily travel rather than the rendered roads, and traffic/cargo is derived from aggregate transport resources rather than authoritative vehicle inventories. Procedural appearance is renderer-derived rather than a saved inheritable genome, and death has no body or funeral sequence. The UI shows recent history but does not yet provide full historical replay.

Browser saves are per-origin IndexedDB data. Intervention energy and cooldowns are client-local UI state, not shared public authority. Live inputs are manually ingested snapshots; there is no scheduled public feed or server-authoritative multi-viewer world. These boundaries are intentional and documented so visible polish is not mistaken for simulated depth.

## Safety and license

Never commit credentials, tokens, browser profiles, local saves, or raw source-asset caches. See [.gitignore](.gitignore) and [SECURITY.md](SECURITY.md).

Project source is MIT licensed. The current runtime art is original procedural geometry; researched third-party asset packs have not been incorporated. Every future asset must be recorded with source, license, hash, modifications, and runtime derivatives before use.
