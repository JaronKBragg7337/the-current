# Performance and scale

Measurements below are checkpoint observations, not hardware-independent promises. Headless values come from the committed fixed-seed JSON reports; browser values are one diagnostic sample from automated Chromium in this development environment.

## Headless simulation

Reference machine: Node.js `v24.16.0`, Windows x64, 32 logical CPUs, 31.71 GiB reported memory.

| Measurement | 150-day seed | 500-day seed |
| --- | ---: | ---: |
| Final living population | 175 | 184 |
| Relationship records | 5,442 | 29,288 |
| Total event sequence | 12,170 | 57,736 |
| Authoritative advance time | 5,693.755 ms | 54,138.875 ms |
| Mean advance per world day | 37.9584 ms | 108.2777 ms |
| Simulated days per second | 26.34 | 9.24 |
| Serialized final snapshot | 7,417,259 bytes | 32,625,299 bytes |
| Peak verifier RSS | 323,678,208 bytes | 710,381,568 bytes |

The 500-day seed is slower despite a similar final living population because the engine retains substantially more relationship, person-history, and event state. The first optimization target is therefore social/history indexing and bounded detail, not a hard living-population cap. Full methodology and demographic samples are in [HEADLESS_RESULTS.md](HEADLESS_RESULTS.md).

The public runtime throttles render projections at high day speeds (`ceil(daysPerSecond / 16)`) while continuing to simulate every authoritative day. This reduces main-thread transfer/render churn but does not reduce engine work.

## Browser rendering sample

The built-in renderer diagnostics reported approximately:

| Scene | WebGL calls | Triangles | Geometries | Observed fps |
| --- | ---: | ---: | ---: | ---: |
| Fresh day-0 orbital view, 20 people | 727 | 99,048 | 282 | 47 |
| Day-3 orbital view, 26 people | 781 | 103,300 | 350 | 45 |

These readings came from headless/automated Chromium where software rendering and capture overhead may apply. They are useful for regression direction, not representative-GPU certification. Frame rate is a short UI diagnostic sample rather than p50/p95 telemetry. Follow and first-person modes were visually exercised, but no stable cross-mode frame benchmark is claimed.

The original sub-250 settlement / sub-120 orbital draw-call aspiration is not met. The current settlement renders procedural buildings and detailed people as many independent meshes. Visual functionality is verified; render efficiency is not production-ready.

## Current scaling behavior

- Simulation authority is independent of camera mode and runs in a worker when available.
- Every living person is included in each render projection so any NPC can be selected and inspected.
- Near/selected people use articulated procedural mesh groups. Hidden detailed figures skip interpolation and pose work at or beyond 60 metres.
- Far, non-selected people use two instanced batches (body/head) from 60 metres outward. Instance matrices are marked dirty only when projection/tier visibility changes.
- Every person still owns a detailed React component and frame callback, even when hidden; there is no separate medium tier or region-level projection culling.
- Buildings are individual procedural components. Roads, event markers, nature, and illustrative traffic add separate calls.
- Adaptive device pixel ratio reduces resolution during pressure, but this does not address draw-call or React-component cost.

## Persistence cost

The browser writes a day-zero snapshot and queues the newest projected day for autosave. Autosaves are single-flight, collapse intervening projections to the latest day, and start no more often than every two seconds; pause/background transitions also request a save. Retention keeps day zero, every 25-day milestone, and the latest snapshot; a newer same-day save replaces the old latest variant. Writes are asynchronous, but serialization and clone costs still grow with world state.

At the fixed references, one serialized snapshot is about 7.4 MB on day 150 and 32.6 MB on day 500. A long-running public world needs delta/chunk compression, bounded memory detail, archival history, and explicit quota/latency telemetry before relying on browser-only persistence.

## Next performance work

1. Profile relationship encounter/search and history serialization with p50/p95 day timings at several seeds and populations.
2. Add bounded/indexed social memory while preserving auditable aggregate history and deterministic replay.
3. Eliminate per-person hidden `useFrame` callbacks; introduce camera-region projection culling and a genuine medium-distance tier.
4. Share/instance character geometry and materials, batch compatible building shells/props, and add shadow/geometry LOD.
5. Add repeatable browser benchmark scenes for orbital, settlement, follow, and first-person modes on real desktop and mobile GPUs.
6. Measure projection payload bytes, worker transfer duration, snapshot encode/write latency, IndexedDB quota, and reload time as the world ages.

Performance goals for the next milestone should be set from those representative measurements. Until then, 60 fps desktop, 30 fps mobile, and specific draw-call limits remain goals rather than claims.
