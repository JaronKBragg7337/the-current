# Headless simulation verification

The authoritative simulation can be exercised without Three.js or a browser through
`scripts/run-simulation.ts`. The verifier runs the seeded civilization, samples its
state, audits structural and acceptance invariants, and—by default—runs the same seed
again with a snapshot/restore boundary. It exits nonzero if an invariant, daily digest,
restored digest, or final digest differs.

## Commands

After `npm install`:

```bash
npm run sim:150
npm exec tsx scripts/run-simulation.ts --days 500 --seed current-endurance-001 --sample-every 50 --out benchmarks/results/simulation-500d.json
```

The package script writes disposable results under `benchmarks/results/`. The committed
reference reports are:

- `benchmarks/reference/current-public-001-150d.json`
- `benchmarks/reference/current-endurance-001-500d.json`

Useful CLI controls are `--sample-every`, `--roundtrip-day`, `--no-roundtrip`, and
`--no-replay`. Use `--help` for the complete option list. Replay and snapshot roundtrip
verification are enabled by default. Input errors exit with status 2; a completed run
with failed verification exits with status 1.

## Fixed reference results

Both reports were produced with simulation engine `0.1.0`, schema `1`, and the simulation
source revision `5caab719366f685c4db125a34dba0fb3b6a8e17e`. Every one of the 23 applicable invariant
checks passed in both runs. Every replayed world day produced the same daily digest as
the primary run, and both restored runs reached the exact primary final digest.

| Measurement | 150-day public seed | 500-day endurance seed |
| --- | ---: | ---: |
| Seed | `current-public-001` | `current-endurance-001` |
| Final digest | `284d00872732149d` | `b84c03a6b63e2c11` |
| Snapshot boundary | Day 75 | Day 250 |
| Boundary snapshot digest | `52726eb2f5e5adb6` | `59eda854a00fb1be` |
| Living population | 219 | 242 |
| Externally generated people alive | 163 | 166 |
| Internally born people alive | 56 | 76 |
| Guaranteed entrants | 300 | 1,000 |
| Births | 64 | 376 |
| Deaths | 165 | 1,154 |
| Natural / early deaths | 120 / 45 | 1,109 / 45 |
| Living households | 123 | 135 |
| Relationships | 2,608 | 12,816 |
| Partnerships | 74 | 77 |
| Current pregnancies | 2 | 10 |
| Housing occupied / capacity | 219 / 252 | 242 / 306 |
| Homeless | 0 | 0 |
| Employed / unemployed adults | 209 / 0 | 230 / 0 |
| Food stock | 3,757.2452 | 4,466.4010 |
| Last-day food produced / consumed | 519.4868 / 429.0000 | 440.1043 / 473.2000 |
| Water stock | 3,629.0500 | 51,027.6500 |
| Total / median net wealth | 4,623.1383 / 8.2956 | 12,826.0666 / 50.9435 |
| Wealth Gini | 0.6305 | 0.4272 |
| Cumulative inherited value | 1,070.3787 | 43,669.9349 |
| Complete buildings | 81 | 91 |
| Leaders / follower edges | 1 / 47 | 1 / 36 |
| Breakthrough attempts / adoptions | 3 / 2 | 4 / 2 |
| Timestamped events | 9,012 | 42,236 |
| Serialized snapshot bytes | 5,363,588 | 23,595,283 |

The endurance population moved toward a resource-constrained dynamic range rather than
growing without bound:

| World day | Population | Cumulative births | Cumulative deaths | Housing capacity |
| ---: | ---: | ---: | ---: | ---: |
| 0 | 20 | 0 | 0 | 24 |
| 50 | 79 | 4 | 45 | 102 |
| 100 | 169 | 24 | 75 | 198 |
| 150 | 202 | 47 | 165 | 240 |
| 200 | 206 | 76 | 290 | 246 |
| 250 | 243 | 128 | 405 | 276 |
| 300 | 259 | 187 | 548 | 306 |
| 350 | 249 | 235 | 706 | 306 |
| 400 | 246 | 284 | 858 | 306 |
| 450 | 248 | 335 | 1,007 | 306 |
| 500 | 242 | 376 | 1,154 | 306 |

## Performance observation

The reports were generated on Node.js `v24.16.0`, Windows x64, with 32 logical CPUs and
31.71 GiB reported system memory. No hostname, user name, working directory, or private
filesystem path is recorded.

| Measurement | 150 days | 500 days |
| --- | ---: | ---: |
| Primary authoritative advance time | 2,134.922 ms | 26,365.998 ms |
| Mean advance time per world day | 14.2328 ms | 52.7320 ms |
| Simulated world-days per second | 70.26 | 18.96 |
| Replay plus roundtrip verification | 2,417.088 ms | 28,351.632 ms |
| Peak verifier RSS | 276,901,888 bytes | 575,913,984 bytes |

`primaryAdvanceMs` measures calls to the authoritative day advance only. `primaryWallMs`
also includes interval metrics and memory sampling. Replay timing is reported separately.
The verifier holds the primary world while constructing the replay world, so its peak RSS
is deliberately stricter than the memory needed for one running simulation.

## What the invariant audit covers

The audit checks:

- deterministic seed, clock, schema, snapshot digest, replay, and restore continuity;
- exactly two guaranteed entrants per world day and complete daily summaries;
- population/counter accounting, lifespan bounds, and living/dead lifecycle state;
- household, housing, employer, partner, parent/child, and relationship references;
- nonnegative finite resources, positive prices, physical building state, and live leaders;
- strictly ordered timestamped events and a render projection for every living NPC;
- after 150 days, observable births and deaths, relationships and partnerships, employment,
  food production, inheritance, physical construction, leadership, and breakthrough attempts.

The JSON contains each check and its evidence string, interval samples, final metrics,
retained event counts by type, runtime context, performance values, and replay diagnostics.

## Interpretation and caveats

- Digests and counts are deterministic for the recorded engine, configuration, and seed.
  Timing and memory measurements are observations, not cross-machine performance promises.
- These are seed-specific baseline scenarios, not a proof that every configuration reaches
  the same demographic or economic equilibrium.
- The fixed runs intentionally contain no live-data signals or observer interventions; those
  causal paths are covered separately by simulation tests.
- The 500-day last-day food flow consumed more than it produced, but the settlement retained
  4,466.401 units of food. One daily flow should not be interpreted as long-term collapse.
- `snapshotBytes` includes the save envelope; `saveApproximateBytes` in metrics estimates the
  authoritative state alone, so the values differ slightly.
- Neither reference exceeded the 50,000-event retention window. Longer runs may retain only
  the newest events while cumulative event sequence numbers continue increasing.
- This verifies the headless authoritative layer. Browser rendering, frame rate, camera modes,
  selection, responsive controls, and IndexedDB integration require their own browser tests.
