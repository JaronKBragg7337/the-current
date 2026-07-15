# Architecture

## Authority and causal pipeline

```text
reviewed observations        observer interventions
          \                         /
           normalized, versioned inputs
                       ↓
          deterministic simulation engine
                       ↓
       timestamped events + world snapshots
                       ↓
              render projection
                       ↓
      Three.js world + cameras + inspection UI
```

The simulation is authoritative for people, births, deaths, households, relationships, pooled resources, prices, jobs, construction, building-centered environmental patches, sanitation, drinking-water quality, institutions, influence, and breakthroughs. Three.js visualizes projections of that state. Camera distance and frame rate do not change simulation decisions.

That boundary is not yet universal for every visible object. Roads are presentation geometry rather than the authoritative movement graph. Vehicles, cargo descriptions, and route progress are derived from aggregate transport state and world day; they are not saved simulation entities. Those limitations are called out in the UI/documentation instead of being represented as completed logistics.

## Repository modules

| Boundary | Current implementation |
| --- | --- |
| Simulation | `src/simulation/`: config, seeded RNG, canonical digest, world types, and daily engine |
| Browser host | `src/worker/`: versioned command protocol, module worker, in-process host, metrics, structured errors |
| Persistence | `src/persistence/`: IndexedDB schema, validation, snapshots, event chunks, external inputs, export/import |
| Data ingestion | `src/data/` and `scripts/ingest-signals.ts`: bounded adapters, schemas, normalization, offline fixture |
| Presentation | `src/world/`: terrain, buildings, people, roads, traffic, events, cameras, renderer diagnostics |
| Spectator UI | `src/ui/` and `src/App.tsx`: selection, inspection, timeline, resources, signals, interventions, controls |
| Asset pipeline | `scripts/assets/`, `assets/`, and `docs/ASSETS.md`: provenance-first research and validation |
| Verification | `tests/`, colocated `*.test.*`, `scripts/run-simulation.ts`, and Playwright configuration |

The engine has no React, DOM, WebGL, IndexedDB, wall-clock, or network dependency. `scripts/run-simulation.ts` imports it directly for accelerated deterministic tests.

## Determinism boundary

Authoritative time advances in integer world days, with timestamped event ticks within each day. Random choices use serialized seeded streams and stable entity ordering. The core does not use `Math.random`, current dates, animation frames, browser state, or renderer collision results. Canonical serialization and explicit rounding produce a digest for every snapshot.

The guarantee is scoped to simulation engine `0.2.0`, schema `1`, a saved seed/configuration, and the same ordered external inputs. The reference verifier compares every daily digest on a second run and restores through a midpoint snapshot. Schema 1 snapshots are validated, including their content digest and RNG restoration. Additive legacy schema-1 snapshots are migrated only after their incoming digest is verified: missing environmental patches, localized waste, drinking-water quality, and daily cleanup totals receive deterministic backfills. Unsupported schema versions still fail explicitly.

## Daily simulation order and spatial causality

At a high level, the engine applies queued inputs, creates the two scheduled entrants, updates movement and needs, resolves work/economy/social/lifecycle systems, advances construction/institutions/breakthroughs, then emits a daily summary and projection. The exact rule order is documented in [SIMULATION_RULES.md](SIMULATION_RULES.md).

People have authoritative positions, destinations, homes, and job/project assignments. Movement occurs before effects. Work, trade, research, care, governance, and construction require arrival at the relevant building/site. Encounters require physical proximity or a shared home/worksite. Births occur at the mother/home position. A person can travel at most 140 metres per world day and currently moves directly toward the destination; rendered roads do not yet constrain the path.

This is a stronger causal model than globally applying jobs or friendships, but it is not local navigation. There is no navmesh, collision-aware pedestrian path, congestion, transit schedule, or authoritative vehicle ride.

## Local environmental patches

Every non-road building owns the condition of its surrounding land: fertility, water quality, contamination, and a physical waste stock. Household waste begins at occupied homes or public sites; tool-production waste begins at workshops; most remains at its source and a bounded share reaches nearby patches. Contamination diffusion is calculated from a frozen prior-day copy, so building record order cannot change the result.

Laborers choose sanitation only when accumulated waste justifies it, travel to a named high-severity site, and remove waste only after arriving and succeeding at the task. Energy strengthens collection and transport provides durable capacity rather than being destroyed as fuel. New construction inherits nearby soil, water, and contamination instead of creating pristine land. Farms, wells, workshops, and power stations consume declared inputs; output and waste are attributed to the named producing site before its condition changes. Well production is mixed with stored water to persist an authoritative drinking-water quality whose health effect is scaled by the amount each resident actually receives.

The renderer receives these values through `BuildingProjection.environment`. `EnvironmentOverlay` draws one selected site metric in one instanced call and cannot affect picking or simulation state. These facility-centered samples do not claim continuous terrain precision; a terrain grid, watershed, weather, species ecology, and industrial material chemistry remain future systems.

## Worker runtime

The browser normally creates a module worker that owns the live simulation. The main thread sends versioned initialize/load, advance, speed, inspect, signal, intervention, export, and stop commands. The worker emits projections, event batches, snapshots, performance metrics, inspections, and structured errors.

Fast simulation speeds reduce projection frequency while preserving every authoritative day. Expensive day advances therefore do not execute on the render thread. If `Worker` is unavailable or construction throws, startup uses the same protocol against an in-process host. If a worker fails asynchronously after startup, the host reports the error; automatic state-preserving replacement is not implemented.

## Persistence and recovery

The application uses an independent IndexedDB database. It stores:

- world metadata and latest snapshot identity;
- a day-zero snapshot, 25-day milestone snapshots, and the latest completed-day snapshot;
- ordered event chunks;
- normalized signals and observer interventions with their queued/effective day; and
- optional user preferences.

Projected world days queue a latest-day autosave. Only one automatic export may be in flight, busy projections collapse to the newest day, and starts are throttled to two seconds so accelerated time cannot flood the main thread with full snapshots. Pausing and hiding the page also request a snapshot. Input submission first persists the input, posts it to the host, and waits for a same-day snapshot with a bounded waiter. On startup the app validates and loads the latest snapshot, replays later persisted inputs in deterministic order, and advances through the latest durable event or queued-input day. Same-day saves replace an older latest snapshot rather than accumulating variants. Import aborts queued autosaves, gates host mutations, waits for a correlated worker `PAUSE` barrier, drains prior writes, replaces persistence, and awaits correlated `LOAD` before reopening the host.

Exports are canonical JSON documents with format/schema versions and a digest covering metadata, retained snapshots, event chunks, and external inputs. Imports validate structure, entity snapshot restoration, and digest before replacement. Browser storage remains origin-local and best-effort; it is not a shared public-world database.

## External data and intervention boundary

Browser code consumes a same-origin, reviewed signal snapshot. The optional CLI performs bounded server-side collection from credential-free sources and converts observations into domain/geography, intensity, confidence, agreement, novelty, duration/decay, and separate objective/belief pressures. Raw headlines never become direct simulation commands.

Signals and interventions are queued into the engine and modify ordinary pressures/resources; NPC tasks, access, institutions, and subsequent events determine consequences. The intervention UI's energy and cooldown rules are intentionally replaceable, but currently live in local browser state. They are a spectator limit, not authenticated shared authority.

## Render projection and tiers

The projection includes every living NPC and every simulated building. The current renderer has two mutually exclusive person representations:

- Closer than 60 metres (or when selected), each NPC uses an articulated procedural figure with task pose, age/height scale, selection, and a first-person eye anchor.
- At 60 metres and beyond, non-selected bodies and heads use two `InstancedMesh` batches with reduced silhouette detail.

The shared boundary avoids both gaps and duplicate bodies. Hidden detailed figures skip pose work, but every living person still owns a detailed React component and frame callback. There is no separate medium tier, projection-region culling, or simulation-only population outside an active rendered region yet. Buildings are individual procedural components rather than an instanced/BatchedMesh system.

NPC appearance colors and body variation are deterministically derived from IDs in the renderer. Life stage and height come from authoritative state, but a persistent/inheritable visual genome is not yet modeled. No external rigged art or animation pack is incorporated.

## Spectator cameras

The camera state machine supports orbital, third-person follow, and view-only first-person modes. Transitions damp toward their target rather than teleport. Once an orbital transition settles, its target belongs to OrbitControls so desktop and touch panning are not pulled back to the settlement center. Follow/first-person track authoritative projected positions and cannot emit movement commands. Collision probes terrain and marked obstacle geometry, handles a target inside a building, and restores the orbital field of view after leaving first person.

Selection, details-card visibility, and camera state are independent presentation concerns and are excluded from world snapshots. Dismissing the card therefore leaves the selected subject and active follow/first-person camera intact; the camera dock can reopen Details. Inspection requests return the full current authoritative person record; the selected person's inspection refreshes as projections advance.

## Deployment isolation

Vite owns the base path, and bundled resources are imported or use the configured base URL. The same source builds for:

- `/` with `npm run build`;
- `/the-current/` with `npm run build:github`; and
- `/worlds/the-current/` with `npm run build:heartbeat`.

Heartbeat Observatory can later serve or proxy the independent build without moving this source into its repository. A shared persistent deployment will require a separate service for authoritative scheduling, ordered inputs, synchronization, moderation, and migration; static hosting only preserves each browser's local world.
