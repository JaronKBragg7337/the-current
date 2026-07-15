# Headless simulation verification

The authoritative engine runs without React, Three.js, or a browser through `scripts/run-simulation.ts`. The verifier advances a fixed seed, samples the world, checks structural and acceptance invariants, repeats the run while comparing every daily digest, and restores through a midpoint snapshot. A mismatch or failed invariant exits nonzero.

## Commands

```powershell
npm run sim:150
npm exec tsx scripts/run-simulation.ts --days 500 --seed current-endurance-001 --sample-every 50 --out benchmarks/results/simulation-500d.json
```

Disposable output belongs under ignored `benchmarks/results/`. The reviewed reports committed as evidence are:

- `benchmarks/reference/current-public-001-150d.json`
- `benchmarks/reference/current-endurance-001-500d.json`

Useful options include `--sample-every`, `--roundtrip-day`, `--no-roundtrip`, and `--no-replay`; use `--help` for all options. Verification and roundtrip are enabled by default. Invalid CLI input exits 2, and a completed run with failed verification exits 1.

## Current engine 0.2.0 checkpoint

The 2026-07-15 engine `0.2.0` 150-day run adds building-centered environmental stocks and one corresponding accounting invariant. Seed `current-public-001` passed 24/24 checks, exact day-by-day replay, and day-75 snapshot restoration. It finished with digest `8bd8572d73878c03`, 124 living people, 9 births, 205 deaths, 60 complete buildings, 88.6557% average soil fertility, 88.2217% average well water quality, 91.4509% stored drinking-water quality, 20.7696% average contamination, and 865.2172 units of localized waste. The disposable full report is regenerated with `npm run sim:150` under `benchmarks/results/`.

The reference tables below intentionally retain the prior engine `0.1.0` 150- and 500-day evidence. They are historical baselines, not current-rule outcomes.

## Fixed reference results

These reports were generated on 2026-07-13 after spatial prerequisites were added to movement, work, encounters, construction, research, care, trade, and government. Both use engine `0.1.0` and schema `1`. The report's `simulationRevision` field is `null`, so Git history—not the JSON field—must bind each file to source; regenerate both reports after any engine-rule change.

All 23 applicable checks passed in both runs. Every replayed day had the same digest as the primary run, the midpoint snapshot restored immediately to its recorded digest, and both replay worlds reached the exact primary final digest.

| Measurement | 150-day public seed | 500-day endurance seed |
| --- | ---: | ---: |
| Seed | `current-public-001` | `current-endurance-001` |
| Final digest | `f13e5fe87589ffc3` | `c54644b90116daa4` |
| Snapshot boundary | Day 75 | Day 250 |
| Boundary snapshot digest | `c990d2ddb9e67430` | `50c90fce67bc052b` |
| Living population | 175 | 184 |
| Founders/entrants alive | 165 | 163 |
| Internally born people alive | 10 | 21 |
| Guaranteed entrants | 300 | 1,000 |
| Births | 12 | 77 |
| Deaths | 157 | 913 |
| Natural / early deaths | 107 / 50 | 863 / 50 |
| Living households | 140 | 145 |
| Relationships | 5,442 | 29,288 |
| Living partnerships | 28 | 27 |
| Current pregnancies | 0 | 0 |
| Housing occupied / capacity | 175 / 210 | 184 / 222 |
| Homeless | 0 | 0 |
| Employed / unemployed adults | 173 / 0 | 182 / 0 |
| Food stock | 2,803.8507 | 31,832.5784 |
| Last-day food produced / consumed | 319.7142 / 348.2000 | 397.2485 / 366.2000 |
| Water stock | 18,649.3000 | 20,040.0500 |
| Total / median net wealth | 2,116.8015 / 0.0000 | 3,444.9602 / 5.2899 |
| Wealth Gini | 0.7519 | 0.6480 |
| Cumulative inherited value | 148.0166 | 376.3170 |
| Complete buildings | 63 | 74 |
| Leaders / follower edges | 1 / 7 | 1 / 5 |
| Breakthrough attempts / adoptions | 4 / 2 | 4 / 4 |
| Total event sequence / retained | 12,170 / 12,170 | 57,736 / 50,000 |
| Serialized snapshot bytes | 7,417,259 | 32,625,299 |

The different fixed seeds are not expected to share the same trajectory. In the endurance seed, population settled into a changing range despite two guaranteed entrants every day:

| World day | Population | Cumulative births | Cumulative deaths | Housing capacity | Food stock |
| ---: | ---: | ---: | ---: | ---: | ---: |
| 0 | 20 | 0 | 0 | 24 | 420.0000 |
| 50 | 73 | 3 | 50 | 102 | 1,601.9354 |
| 100 | 152 | 10 | 78 | 174 | 1,719.7615 |
| 150 | 176 | 16 | 160 | 204 | 5,004.4427 |
| 200 | 169 | 22 | 273 | 210 | 8,785.5917 |
| 250 | 168 | 25 | 377 | 210 | 12,400.5565 |
| 300 | 171 | 35 | 484 | 210 | 16,432.7837 |
| 350 | 180 | 43 | 583 | 216 | 19,981.8474 |
| 400 | 177 | 53 | 696 | 216 | 23,582.9733 |
| 450 | 184 | 66 | 802 | 216 | 28,682.1709 |
| 500 | 184 | 77 | 913 | 222 | 31,832.5784 |

The 150-day seed temporarily reached 180 living people on day 135 and finished at 175. Its food stock declined from 4,369.3074 on day 105 to 2,803.8507 on day 150 while last-day consumption exceeded production. This is a real pressure in that seed, not a scripted population target; the run still had food remaining and no homelessness at day 150.

## Performance observation

The reports were generated on Node.js `v24.16.0`, Windows x64, with 32 logical CPUs and 31.71 GiB reported memory. They contain no host name, user name, private path, or browser profile.

| Measurement | 150 days | 500 days |
| --- | ---: | ---: |
| Primary authoritative advance time | 5,693.755 ms | 54,138.875 ms |
| Primary wall time | 5,968.852 ms | 55,566.797 ms |
| Mean authoritative advance per day | 37.9584 ms | 108.2777 ms |
| Simulated world-days per second | 26.34 | 9.24 |
| Replay + midpoint roundtrip time | 4,756.025 ms | 48,175.776 ms |
| Peak verifier RSS | 323,678,208 bytes | 710,381,568 bytes |
| Final verifier RSS | 323,764,224 bytes | 710,610,944 bytes |

`primaryAdvanceMs` measures authoritative day-advance calls. `primaryWallMs` also includes metric and memory sampling. The replay runs while the primary result remains in memory, making verifier peak RSS stricter than one live world. Timings are single-machine observations, not cross-machine promises.

The superlinear slowdown between 150 and 500 days primarily reflects growing relationship/event/history state, not living population alone: the final living populations are similar, while total relationships grow from 5,442 to 29,288 and total event sequence from 12,170 to 57,736.

## What the invariant audit covers

The historical engine `0.1.0` reports contain 23 checks. Engine `0.2.0` adds a 24th check that reconciles every site's local waste with the cached settlement stock and bounds stored drinking-water quality. Collectively the checks cover:

- seed, clock, schema, snapshot digest, daily replay, and midpoint restoration;
- exactly two guaranteed entrants for every completed day and continuous daily summaries;
- founder + entrant + birth − death population accounting and counter/record consistency;
- lifespan bounds, live/dead state, partner symmetry, parent/child reciprocity, and valid person/relationship references;
- housing occupancy, finite nonnegative resources, positive prices, valid physical building state, and live institution leaders;
- strictly ordered timestamped events and a render projection for every living NPC; and
- at/after day 150, observable births, deaths, relationships, partnerships, employment, food production, inheritance, construction, leadership, and breakthrough attempts.

Each JSON report preserves every check and evidence string, interval samples, final metrics, event-window counts, performance/runtime context, and replay diagnostics.

## Interpretation and caveats

- A passing fixed seed proves reproducibility and the audited invariants for this engine/configuration. It does not prove every seed, configuration, or policy reaches a desirable equilibrium.
- The reports have no external signals or observer interventions. Those causal paths are covered by focused tests and separate browser verification.
- `employed` currently means the adult has a non-unemployed occupation; it does not guarantee a valid employer, paid hours, or staffed production. It must not be read as a real-world labor statistic.
- Food, water, and other resources are pooled settlement stocks. Prices respond to scarcity but do not yet ration access through bids or household purchasing power.
- Relationship records are pair histories, not a count of active friendships. The 500-day run's high count is a performance signal as well as a social-history measure.
- The 500-day event window retains only the latest 50,000 events; cumulative event sequence remains 57,736. Milestone snapshots preserve state, not a complete unbounded event log.
- `snapshotBytes` includes the save envelope. `saveApproximateBytes` estimates state alone and differs slightly.
- This is headless engine evidence. It does not verify WebGL appearance, camera transitions, browser frame rate, touch behavior, or IndexedDB integration; those are tracked separately in [VERIFICATION.md](VERIFICATION.md).
