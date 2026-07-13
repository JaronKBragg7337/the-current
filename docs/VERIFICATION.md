# Verification record

Updated 2026-07-13. This record separates automated evidence, manual browser evidence, and checks that remain open. Results describe the recorded implementation checkpoint; rerun the commands after changing simulation rules, persistence, rendering, dependencies, or deployment configuration.

## Automated checks

| Check | Recorded result | Scope |
| --- | --- | --- |
| `npm run lint` | pass, zero warnings | ESLint over source, tests, scripts, and configuration |
| `npm run typecheck` | pass | TypeScript project references |
| `npm run test` | 59 passed, 16 files | Simulation, spatial causality, persistence coordination, worker hosts/errors, data normalization/adapters, UI lifecycle, render tiers, inspections, and camera correctness |
| `npm run assets:validate` | pass | 0 incorporated external assets, 0 runtime asset files, 28 researched candidates; manifests/schema valid |
| `npm run licenses:validate` | pass | 564 resolved lockfile package paths match the committed machine-readable license inventory |
| `npm audit --omit=dev` | pass | 0 known runtime vulnerabilities reported by npm on 2026-07-13 |
| 150-day verifier | pass, 23/23 checks, 150 replayed days | Seed `current-public-001`, midpoint restore at day 75, digest `f13e5fe87589ffc3` |
| 500-day verifier | pass, 23/23 checks, 500 replayed days | Seed `current-endurance-001`, midpoint restore at day 250, digest `c54644b90116daa4` |
| Production/base-path builds | pass at final integration | Root, `/the-current/`, and `/worlds/the-current/`; 699 modules transformed; both subpaths passed the committed static reference/fixture verifier |
| Full Playwright matrix | 10 passed, 6 skipped, 0 failed | One frozen-tree invocation, one WebGL worker at a time; desktop Chromium and emulated Pixel 7 |

Vitest has focused coverage for:

- identical seeds/daily digests, snapshot restoration, exact daily entrants, lifecycle accounting, 150-day acceptance behavior, and malformed configuration;
- spatial movement before work/build/research/care/trade/government, proximity-required encounters, stable construction assignment, birth location, and follower association;
- causal signals/interventions, resource/price/economy behavior, construction, inheritance, leadership, rare individuals, and breakthrough adoption;
- IndexedDB snapshot retention, same-day replacement, event/input storage, validated export/import, worker/in-process host parity, and structured asynchronous worker errors;
- external adapter bounds, schema validation, deduplication/corroboration, confidence/novelty/decay, and conversion to simulation pressure;
- selected-person refresh, rare-evidence thresholds, orbital FOV restoration, follow collision, obstacle ancestry, and targets inside buildings.

The reference report files are [the 150-day result](../benchmarks/reference/current-public-001-150d.json) and [the 500-day result](../benchmarks/reference/current-endurance-001-500d.json). Their metrics and caveats are summarized in [HEADLESS_RESULTS.md](HEADLESS_RESULTS.md).

## Browser verification

A production-capable Vite session was opened in Chromium with a real WebGL canvas and module worker. The following paths were exercised:

1. A fresh profile created the deterministic day-zero world, reported worker mode, rendered terrain/buildings/people, and saved its initial snapshot.
2. Simulation was resumed through world day 3 and paused.
3. NPC selection opened the authoritative person inspection and enabled follow/first-person modes. Building and presentation-vehicle selection handlers exist, but this checkpoint did not retain separate manual assertions for both of those entity types.
4. Orbital → third-person follow → first-person spectator → third-person → orbital transitions were exercised. The NPC continued its task; no movement controls were exposed. Follow collision remained outside obstacle geometry, and orbital FOV returned to 48° after first person.
5. A Food help intervention was submitted. The world digest changed from the pre-input day-three state (`9076…`) to the persisted post-input state (`ff414b…`) through the normal input/snapshot path.
6. Closing and reopening the intervention panel preserved its local energy/cooldown state.
7. Reload restored world day 3, the exact post-intervention digest, and the persisted intervention input instead of resetting or duplicating it.
8. No application error was recorded. Chromium logged a dependency deprecation warning concerning Three.js `Clock`; this was not a simulation or render failure.

The final Playwright invocation exercised the configured `/the-current/` base path, WebGL and module-worker boot, exact day advance, keyboard controls, panels, same-origin external signals, causal observer intervention with durable event history, NPC selection, orbital/follow/first-person transitions, current-snapshot IndexedDB save/reload, and Pixel 7 viewport containment. Ten applicable cases passed in 4.8 minutes; six desktop-only/mobile-only duplicates were intentionally skipped by project guards. The only browser console output was the upstream Three.js `Clock` deprecation warning.

## Visual evidence

| View | Artifact | What it demonstrates |
| --- | --- | --- |
| Welcome | [welcome.png](screenshots/welcome.png) | Primary 3D world behind the start/identity overlay |
| Orbital | [orbital-world-final.png](screenshots/orbital-world-final.png) | Terrain, water, settlement, farms, roads, buildings, people, UI |
| Third person | [third-person-follow-fixed.png](screenshots/third-person-follow-fixed.png) | Autonomous selected-NPC follow framing after collision fixes |

Screenshots establish visual state, not simulation causality or frame-rate performance. First-person behavior and all camera transitions are covered by the browser assertions above; the corresponding authoritative behavior is checked through projections, inspections, digests, and event/state assertions.

## Data-ingestion probes

The deterministic offline ingestion completed with 5 observations normalized to 4 signals. A credential-free live probe completed with 211 observations and 187 normalized signals:

- USGS earthquakes: 100 observations;
- NASA EONET: 100 observations;
- NOAA SWPC: 1 observation; and
- Hacker News metadata: 10 observations.

All four adapters completed in that probe. Live results are intentionally uncommitted review artifacts; endpoint availability and terms can change. The browser does not call these providers. Source policy and operational qualifications are in [DATA_SOURCES.md](DATA_SOURCES.md).

## Browser performance observation

Renderer diagnostics in the automated Chromium environment sampled about 727 calls / 99,048 triangles / 282 geometries / 47 fps at the fresh orbital view, and about 781 calls / 103,300 triangles / 350 geometries / 45 fps at day 3. Software rendering and capture overhead may apply; see [PERFORMANCE.md](PERFORMANCE.md). These values do not meet a production draw-call budget.

## Acceptance coverage

| Requested behavior | Evidence | Qualification |
| --- | --- | --- |
| 20 initial NPCs; two daily entrants | verifier accounting and per-day entrant invariant | verified |
| Aging, birth, death, relationships, inheritance | unit tests, events, 150/500-day metrics | verified in the current abstract daily model |
| Food, housing, employment, prices | unit tests and long-run metrics | causal but economically shallow; see `STATUS.md` |
| Construction and physical change | state/event tests and staged 3D buildings | site/nav/ownership rules incomplete |
| Leadership, influence, rare people, breakthroughs | focused tests and both long runs | basic networks/adoption work; teams/rivalry/legacy shallow |
| Persistent saving and exact reload | persistence tests and day-three browser reload | local IndexedDB only |
| Orbital/follow/first-person cameras | focused camera tests and browser/screenshots | full mobile/device matrix open |
| Every living NPC projected/inspectable | 175/175 and 184/184 projection invariants | renderer still creates a detailed component for every NPC |
| Simulation continues when detail is hidden | headless runs and camera-independent worker | no geographic simulation aggregation is needed yet at this scale |
| Current-world data enters causal loop | normalization tests, ingestion probes, browser signal path | no scheduled production collector |
| Observer intervention retains NPC agency | causal tests and persisted browser intervention | limits are local, not shared authority |

## Remote release and next checks

- The gated GitHub workflow passed quality, desktop Chromium, Pixel 7 Chromium, and Pages publication in [run 29243877756](https://github.com/JaronKBragg7337/the-current/actions/runs/29243877756). The live preview and all six referenced JS/CSS assets returned HTTP 200, and a separate post-deploy Playwright smoke verified module-worker/WebGL boot and exact day advancement at <https://jaronkbragg7337.github.io/the-current/>.
- Mount or proxy the independently built artifact at `/worlds/the-current/` when Heartbeat Observatory integration is authorized; the route-specific build already passes static reference validation.
- Profile p50/p95 frame time on representative hardware, not only automated Chromium.
- Exercise export to disk and import through the visible UI in a clean browser profile; the storage layer itself has automated roundtrip tests.
- Add an explicit accessibility/keyboard focus audit and real touch-device check.
- Add schema-migration tests before any persisted schema version changes.
