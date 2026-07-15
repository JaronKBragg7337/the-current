# Implementation status

Updated 2026-07-15. Labels mean **verified**, **partial**, or **unimplemented**. A type, interface, visual prop, or documentation paragraph is not counted as a working system by itself.

## Checkpoint summary

The Current has passed its first functional population milestone as a real deterministic simulation and a navigable Three.js spectator application. The current engine `0.2.0` fixed 150-day run passed 24/24 invariants, exact day-by-day replay, and snapshot restoration; the committed engine `0.1.0` 500-day run remains historical endurance evidence. The world kit provides proportioned citizens, construction-aware building tiers, authoritative road ribbons, visible resource yards, and stronger settlement assembly without changing simulation authority. The browser has been exercised with a real module worker, IndexedDB persistence, selection, all three camera modes, a causal intervention, environmental inspection, and exact reload of a saved state.

This is still an early civilization, not the complete master specification. It has one settlement and several causal subsystems, but not yet the breadth or depth of autonomous firms, institutions, transport, law, culture, conflict, or multi-settlement history required by the final concept.

## Verification ledger

| Area | Status | Evidence and boundary |
| --- | --- | --- |
| Separate public repository | verified | <https://github.com/JaronKBragg7337/the-current>; independent local Git history |
| Secret-safe repository baseline | verified | `.gitignore`, `SECURITY.md`, no credentials required at runtime |
| Authoritative specification | verified | `docs/MASTER_SPECIFICATION.md` |
| Dependency, data, and asset research | verified | Official-source inventories in `docs/LICENSES.md`, `docs/DATA_SOURCES.md`, and `docs/ASSETS.md`; the incorporated runtime kit is project-authored and tracked in `assets/project-assets.json` |
| Deterministic population/lifecycle loop | verified | 98 passing tests plus current 150-day and historical 500-day reports |
| Seed replay and snapshot roundtrip | verified | Engine `0.2.0` digest `8bd8572d73878c03`; exact 150-day replay, midpoint restore, and 24/24 checks |
| Worker isolation | verified | Module worker exercised in browser; in-process startup fallback and structured worker errors have tests |
| Local persistence | verified | IndexedDB autosave, retention, export/import, input records, restore, and day-three browser reload |
| Three.js spectator world | verified | WebGL render, selection, orbital/follow/first-person transitions, collision handling, distance tiers, visible economy, screenshots |
| Production/base-path builds | verified | Root, `/the-current/`, and `/worlds/the-current/` builds pass; both subpath artifacts pass static reference/fixture validation |
| Browser automation | verified | Complete serial Playwright invocation: 10 applicable cases passed, 6 project-specific skips; no failures |
| Mobile/responsive experience | verified | Pixel 7 Chromium covers worker/WebGL boot, camera transitions, and viewport containment; physical-device profiling remains future work |
| Public preview | verified | <https://jaronkbragg7337.github.io/the-current/>; gated quality, desktop, mobile, and Pages jobs passed in [run 29243877756](https://github.com/JaronKBragg7337/the-current/actions/runs/29243877756) |

See [VERIFICATION.md](VERIFICATION.md) for the recorded commands, browser evidence, and qualifications.

## 2026-07-13 session: physical integrity, hidden entropy, one shared world

| Area | Status | Evidence and boundary |
| --- | --- | --- |
| Building placement integrity | verified | `src/simulation/placement.ts` owns footprints, road corridors, setbacks (4 m), and growth rings; bootstrap and 200-day runs produce zero overlapping footprints and zero road intrusions (`placement.test.ts`) |
| Settlement growth rings | verified | When the founding district saturates, construction expands outward instead of overlapping; construction is skipped entirely rather than ever double-stacking |
| Vehicles on roads only | verified | Two lanes per authoritative road derived from centerlines; 200-day construction runs never place a building in a lane (`vehicles.test.ts`) |
| Traveler/building collision | verified | People passing an unrelated building are deflected to its footprint edge (deterministic, order-independent) |
| Reputation-based following | verified | Leadership survives the founding generation dying out (previously collapsed to zero around day 125); leaderless institutions lower their follower threshold per the specification's "lack of alternatives" |
| Layered hidden entropy | verified | `DayInputs.entropy` feeds two hash chains (surface + deep); past replays exactly from recorded inputs, future uncomputable from the seed; 6 passing tests including Postgres-jsonb key-order round-trip |
| One shared authoritative world | verified | Supabase-hosted: `the-current-tick` edge function advances the world at a fixed pace (1 world day per real hour) with cryptographic entropy per day; world row publicly readable, entropy audit table service-role only; cron every 10 minutes; world created at day 0, digest `c9e11dc317f318a5` |
| Shared spectator clients | verified locally | Production clients default to polling the shared world; time controls, save, and import are replaced by a LIVE badge; `?world=local` opts into a private local world; dev/tests default to local |
| Shared-world interventions | unimplemented | Spectator clients cannot yet submit interventions to the shared world; requires a server-side intervention queue with budgets (next action) |
| Windows-local test execution | verified | The former `act is not a function` failures no longer reproduce; all 98 tests pass locally on Windows |

## 2026-07-15 session: local environmental feedback

| Area | Status | Evidence and boundary |
| --- | --- | --- |
| Building-centered environment | verified | Every site persists bounded fertility, water quality, contamination, and local waste; updates and neighbor diffusion are deterministic and projection-visible |
| Causal facility operation | verified | Farms, workshops, and power stations consume declared scarce inputs with shared per-resource ratios; farm/well/industrial output responds to the site's condition |
| Drinking-water quality | verified | Well output is quality-weighted into stored water and affects resident health plus future water/health pressure |
| Physical sanitation | verified | Laborers choose a named waste site, must arrive and succeed, use energy and durable transport capacity, remove only local waste, and emit cleanup history |
| Environmental inspection | verified | System metrics, exact building facts, and a selectable instanced soil/water/contamination layer expose authoritative values without changing them |
| Save compatibility | verified | Digest-first schema-1 backfill localizes legacy global waste and adds missing water/environment fields deterministically; resumed futures match |
| Ecological breadth | partial | Facility-centered patches model local feedback but not continuous terrain, watersheds, weather, species, pathogens, sewage networks, or material-specific toxins |

## Systems that function

### Authoritative simulation

- Seeded identities, traits, aptitudes, rare potential, hidden 65–100-day natural lifespans, 20 founders, and exactly two daily entrants.
- Daily needs, pooled resources, scarcity-responsive prices, job assignments, learning, health damage, aging, natural and early deaths.
- Spatial movement and prerequisites for work, trade, construction, research, care, government, and encounters.
- Contact-based relationships, partnership formation, conception, gestation, births, children, parent links, and reproduction cooldowns.
- Households, homes, staged construction using labor/materials, death-driven inheritance, and timestamped memories/events.
- Institutions, periodic leadership selection, domain-specific influence, persistent follower associations, rare polymaths, breakthrough attempts, progress, failure, and adoption.
- Normalized signals and help/spice/sabotage interventions enter the normal causal loop rather than editing outcomes directly.
- Local soil, groundwater, contamination, waste generation/spread, site-specific sanitation, mixed drinking-water quality, facility inputs, and exposure-driven health pressure.

### Runtime and presentation

- Headless, accelerated, worker-hosted, and in-process execution from a seed or validated snapshot.
- Day-zero and coalesced latest-day autosaves, pause/background saves, milestone retention, IndexedDB event/input records, JSON export, queue-barrier-protected import, and catch-up over persisted event/input days.
- Procedural terrain, water, nature, buildings, construction stages, door openings/interiors, farms, roads, landmarks, resource sites, NPC activity, event markers, and illustrative traffic.
- Selectable NPCs, buildings, and vehicles; current-person inspection; orbital, third-person, and first-person spectator cameras; camera collision and FOV restoration.
- Optional panels for resources, history, system diagnostics, external signals, interventions, and selected entities.
- Locally bundled, Meshopt-compressed project-authored GLB for market, water, timber, stone, energy, street, farm, and transport props; reproducible Blender source and export/optimization scripts.
- Deterministic citizen appearance and task poses; construction-aware detailed/far buildings; roads and presentation vehicles derived from the same authoritative corridors.

## Partial systems and important caveats

- **Economy:** scarcity changes prices and resource pressure changes behavior, but prices do not yet ration access. Payments are capped, resources are pooled, and household inventories/possessions are mostly unused. Adults may be counted as employed when no employer has capacity; baseline buildings can produce without a staffed labor roster.
- **Production and enterprise:** occupations and building output exist, but autonomous firms, ownership transfers, debt, savings decisions, contracts, competitive markets, and physically tracked supply chains do not.
- **Construction:** projects consume materials and labor over visible stages. Footprint overlap, road-corridor clearance, setbacks, and outward growth rings are authoritative; explicit parcel ownership, terrain grading, and guaranteed door-to-road access are not.
- **Institutions and politics:** six institution types, influence networks, followers, and leadership changes exist. Laws, elections with constituencies, parties, ideology, religion, movements, corruption, coercion, security organizations, and succession institutions do not.
- **Breakthroughs:** ability, knowledge, resources, support, experimentation, and adoption are represented, but team formation, finance/manufacture/teaching roles, rival proposals, harmful side effects, intellectual property, and broad diffusion are shallow or absent.
- **Rendering tiers:** near articulated figures, a far instanced population representation, and detailed/far building tiers exist. There is no distinct NPC medium tier or camera-region projection culling; every living NPC and building still owns a React component and frame callback even when hidden.
- **Navigation and transport:** authoritative people move toward destinations with a 140-metre-per-world-day straight-line budget. Rendered roads are not their navigation graph. Vehicles, cargo labels, and route progress are derived presentation, not authoritative entities or inventories.
- **Appearance, animation, and mortality:** people have proportioned bodies, persistent ID-derived variation, occupation tools, simple idle/walk/work/social/carry poses, age scaling, posture, and elder hair, but renderer-derived appearance is not saved or inherited. There are no canonical rigged humanoids, retargeted clips, voice/audio, bodies, funerals, or crowd occlusion/perception effects.
- **History:** events, memories, snapshots, ownership, and recent-event inspection exist. The UI does not yet expose complete timeline replay, building provenance, descendants, durable biographies, or post-hoc significance classification.
- **Persistence resilience:** unsupported worker construction falls back in-process; asynchronous worker crashes surface an error and reject bounded pending waits. Imports gate host mutations, pause at a correlated queue barrier, drain prior writes, and then load. An already-running worker is not automatically replaced after a crash. Schema version 1 is validated; additive legacy schema-1 environment fields are migrated after digest verification, while unsupported schema versions are not.
- **Environment:** the working model uses building-centered land patches. It does not yet model a continuous terrain grid, watershed flow, rainfall, seasons, species, sewage pipes, pathogens, material-specific emissions, or soil ownership.
- **Observer authority:** intervention effects are authoritative simulation inputs, but energy/cooldowns are localStorage UI limits that a viewer can clear. They are not shared, voted, authenticated, or server-authoritative.
- **Real-world information:** offline and live ingestion tools normalize data successfully, but the browser uses a reviewed same-origin snapshot. There is no scheduled collector, multi-source production corroboration service, signed feed, or automatic missed-time ingest.

## Unimplemented breadth

- Multiple settlements, migration between them, settlement founding, colonial expansion, and distinct local interpretations of the same signal.
- Autonomous businesses, banks, credit/debt inheritance, land markets, taxes, public budgets, monopolies, and transport logistics.
- Laws, customs, ideologies, religions, social movements, crime, policing, war, organized violence, and person-to-person disease transmission.
- Authoritative person pathfinding/navmesh, personal authoritative tools and vehicles, inventories, goods delivery, queues, traffic failures, and industrial processes. Road rendering and presentation vehicles now share the authoritative road corridors, and aggregate resource tiers are visible.
- Schools as scheduled learning institutions, language/culture transmission, communication networks, journalism, propaganda, voting, protests, and public ceremonies.
- Weather, daylight/night perception, sound, accessible full interiors, detailed construction labor, full sitting/injury/death clips, and a production canonical rigged character library.
- A synchronized persistent public world, moderation, intervention voting/cost service, scheduled live-data operations, historical API, or server-side missed-time execution.

## Strongest next technical opportunities

1. Shared-world interventions: a public `the_current_interventions` queue with budgets/cooldowns that the tick function feeds into `DayInputs`, so spectators can influence the one world within limits.
2. Delta sync for spectators: publish per-day event deltas beside the snapshot so clients stop re-downloading the full (multi-MB at scale) world row every change.
3. Add a canonical rigged humanoid and compatible animation library through the documented asset pipeline, replacing the now-proportioned procedural near people while preserving their deterministic visual traits.
4. Make work and exchange economically real: employer capacity, wages, household inventories, price-constrained purchases, staffed building output, businesses, ownership, debt, and auditable goods transfers.
5. Replace straight-line travel and decorative traffic with one authoritative road/nav graph, vehicles, cargo inventories, travel time, delivery events, and congestion/failure consequences (vehicle lanes now derive from authoritative roads; cargo and inventories remain presentational).
6. Add a second settlement so information, prices, migration, trade, institutions, and interventions can diverge under the same world signal.
7. Add historical projections and replay controls built from retained events/milestone snapshots, including building provenance and complete life records; the shared world's entropy audit table already preserves exact replayability.
8. Reduce rendering cost with real medium/far tiers, shared geometry/materials, component culling, shadow LOD, and benchmarks on representative desktop/mobile GPUs.
