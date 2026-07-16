# Era One readiness audit

## Era Zero disposition

The accelerated shared test was frozen on 2026-07-16 at world day 66, engine
`0.2.0`, digest `3cb7c76b5ee1d679`. Its authoritative snapshot and all 66 entropy
inputs are retained in the service-role-only `the_current_era_archives` and
`the_current_era_entropy` tables. The cron job remains present but inactive.
Nothing from Era Zero may be silently rewritten or used as the starting economy
for Era One.

## Observed failures

- The host advanced one world day per real hour although the intended public
  chronology is one world day per 24 elapsed hours.
- Two entrants were guaranteed every day. At retirement, the population equation
  was correct (`20 + 132 + 2 - 37 = 117`), but the input assumption forced growth
  and made migration predictable rather than responsive.
- `Relationships` combined every retained social edge. Of 1,261 records, 976
  joined living residents, 217 joined a living and deceased resident, and 68
  joined two deceased residents. It also combined acquaintances, coworkers,
  friends, romantic interests, and partners. The label did not describe the data.
- Attraction only accumulated during cooperative encounters. This produced 396
  romantic-interest edges, while 30 partnerships had ever formed and 20 remained
  active. Chemistry, preference, rejection, fading, and ended relationships were
  not represented.
- Twenty-four of 37 deaths were caused by dehydration. The construction planner
  then repeatedly reacted to current stock, commissioning six additional wells
  without forecasting completed capacity. Era Zero ended with 7,322 water and
  zero wood, stone, tools, and stored energy.
- Daily production at retirement included 12.48 wood, 7.80 stone, 2.31 tools,
  and 68.31 energy. Construction deliveries were subtracted from inventory but
  omitted from the consumption ledger; energy was produced and immediately
  distributed until record order exhausted it.
- Resource pressure omitted ordinary stock scarcity. The energy pressure could
  report zero while energy stock was zero.
- Food, water, medicine, and transport had no authoritative storage capacity,
  leakage, spoilage, or overflow. Surpluses could grow without a physical place
  to exist.
- People moved only inside the daily engine call. The renderer animated limbs from
  task labels after the person had already arrived, creating walking in place.
  Vehicles were illustrative route loops rather than saved logistics entities.
- Construction choice was a centralized priority chain. Residents did not form,
  contest, fund, cancel, or revise proposals from incomplete beliefs.
- Exact replay was correctly tested, but the acceptance suite also enshrined exact
  daily immigration and one fixed future-shaped reference run. Those are not valid
  emergence requirements.

## Required Era One properties

1. The public clock advances one world day per 86,400,000 elapsed milliseconds.
2. Biological age and time spent in the settlement are separate and honestly
   labeled. Live defaults use real day units; accelerated lifecycle settings are
   permitted only in isolated verification worlds.
3. Migration is probabilistic and causally affected by housing, safety, health,
   resource coverage, opportunity, information delay, and outside conditions.
4. Scarce pooled essentials are allocated simultaneously by an explicit policy,
   never by object or identifier order.
5. Every stock has physical capacity and declared loss/overflow behavior. Every
   production, transfer, construction delivery, loss, and use appears in a ledger.
6. Construction evaluates projected demand and completed/queued capacity. A named
   resident or institution must propose it, alternatives compete, and stalled or
   obsolete work can be cancelled.
7. Social metrics distinguish active ties, historical ties, current partnerships,
   lifetime partnerships, and deceased residents. Romantic state requires durable
   mutual chemistry rather than generic cooperation.
8. Travel has an authoritative schedule. Presentation interpolates that schedule;
   work and encounters depend on arrival rather than animation state.
9. Future entropy is unavailable before the decision boundary. Recorded inputs
   replay exactly after the fact. Verification checks laws and distributions over
   many entropy streams rather than asserting one public future.
10. Era Zero survives only as immutable history and a bounded set of physical
    archaeological evidence. Era One residents receive no automatic knowledge of
    its meaning.

## Release gate

Era One must not replace the shared row until the multi-seed checks, exact replay,
resource conservation, population accounting, migration bounds, relationship
accounting, movement prerequisites, full unit suite, production build, and desktop
and mobile browser smoke tests all pass. The replacement transaction must set a
fresh genesis timestamp, day zero, a new seed, and `world_day_ms = 86400000` before
the scheduler is reactivated.

## Implemented candidate

Engine `0.3.0`, schema `2` implements the first Era One correction set:

- real-year biological defaults and a 24-hour host constant;
- attraction-driven stochastic migration with zero-arrival days and a hard daily cap;
- simultaneous essential-resource rationing, storage capacities, spoilage, complete
  construction ledgers, production curtailment, and emergency sanitation response;
- competing construction proposals that forecast completed and queued capacity;
- stable chemistry, fading ties, and separate active/historical/romantic/partnership
  metrics;
- authoritative previous/current positions exposed as staggered visible journeys;
- three physical Era Zero remains whose meaning must be discovered and studied by
  residents before they affect knowledge; and
- a twelve-future 365-day distribution gate in
  `scripts/audit-era-one-distribution.ts` alongside exact replay.

This list is not a claim that the complete master specification exists. Vehicles
remain presentation projections of aggregate transport, pedestrians do not yet
use a road/navmesh graph, and laws, businesses, disease transmission, ecology,
crime, and multiple settlements remain incomplete or unimplemented.
