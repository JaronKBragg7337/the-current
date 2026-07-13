# Design decisions

## ADR-001 — Separate public repository

The Current has an independent Git history, build, persistence namespace, assets, tests, and deployment. Integration with Heartbeat Observatory occurs through a configurable base path or deployment boundary.

## ADR-002 — Vite, React, and Three.js

Vite produces a static, base-path-aware build. React owns spectator UI composition. Three.js remains the rendering engine, with React Three Fiber providing lifecycle integration. Simulation code imports none of them.

## ADR-003 — Explicit worker protocol

An explicit versioned message union is preferred over transparent RPC. It makes transfer ownership, save acknowledgements, replay inputs, errors, and compatibility inspectable.

## ADR-004 — Deterministic day engine

Authoritative rules advance in integer world-day phases with seeded randomness and stable iteration. The renderer interpolates between projections. This favors auditable history and accelerated multi-generation tests over frame-coupled agent behavior.

## ADR-005 — Lightweight IndexedDB wrapper

The initial persistence layer uses the small `idb` library behind a repository interface. The first schema is intentionally compact, and migrations are explicit. Dexie was researched and remains a strong option if indexed querying and schema complexity materially grow; adopting it now would add API surface without evidence that the prototype needs it.

## ADR-006 — Procedural first visual set

The first verified runtime uses coherent project-authored procedural terrain, roads, shaped people, buildings, construction stages, crops, goods, and vehicles. This avoids shipping unreviewed raw archives. Researched CC0 character/animation packs enter only through the manifest-driven conversion and performance pipeline.

## ADR-007 — Browser-safe public data

Live third-party fetches are not part of deterministic simulation startup. A build/server ingestion tool captures observations, normalizes them, and produces versioned snapshots. Replay consumes captured inputs, never mutable upstream endpoints.

## ADR-008 — Exact compatible dependency pins

The lockfile pins every direct dependency exactly. A registry check on 2026-07-13 found every direct package current except two intentional compatibility pins: `@types/node` stays on the Node 24 line because Node 24 is the supported runtime, and TypeScript stays at 5.9.3 because `typescript-eslint` 8.63.0 declares TypeScript support from 4.8.4 through versions below 6.1.0. TypeScript 7.0.2 was therefore not forced into an unsupported lint/tooling combination merely because its registry tag was newer. Re-evaluate those two together when the ESLint toolchain declares support.
