# Simulation rules

## Time and identity

- The default world begins with 20 adults in one settlement.
- Exactly two external entrants are created at the configured daily entry phase.
- Biological sex is sampled independently for each person; no daily balancing is imposed.
- Every generated identity is derived from the saved world seed and deterministic stream state.
- A natural lifespan is an integer from 65 through 100 world days after arrival or birth and remains hidden from the ordinary spectator panel.
- Children are internally generated people with real parents and household history, not reskinned entrants.

## Daily causal order

The engine uses an explicit stable daily phase order so replay is inspectable:

1. Apply and decay captured signals, then resolve due interventions through settlement systems.
2. Advance aging and natural death, deliver due births, and admit two entrants at the physical entry point.
3. Assign housing and employment against the resulting living population.
4. Commission construction from measured food, water, housing, and civic pressure.
5. Select needs-driven tasks and physical destinations from locally available sites.
6. Move people toward those destinations using the authoritative position state.
7. Permit production, care, trade, government, research, and construction effects only for people who reached the appropriate site; then consume resources and update health.
8. Resolve physically plausible encounters, relationship memories, partnerships, and reproduction decisions.
9. Deliver construction materials and labor from builders present at their assigned projects, advancing visible stages.
10. Update follower networks, elections, policy, institutional response, experiments, adoption, skills, and historical significance.
11. Update prices and environment, reconcile housing, prune bounded history, and emit the daily result.

Adding a subsystem must not silently change this order without a documented simulation-version change.

## Agency

People act from needs, traits, skills, beliefs, relationships, owned resources, incomplete observations, and available opportunities. An emergence profile supplies prior aptitudes, not a permanent class. Decisions include a machine-readable explanation listing decisive pressures and rejected alternatives where practical.

## Relationships and reproduction

Relationships require physical proximity or simultaneous presence at the same home or productive worksite. A shared occupation, institution, intended destination, or prior relationship cannot create a nonlocal encounter. Familiarity, trust, affection, attraction, dependence, conflict, and remembered events evolve separately. Partnership requires history rather than one compatibility roll.

Conception additionally requires adult stages, biological compatibility, a mature pair relationship, sufficient interaction, cooldown eligibility, and a probabilistic decision affected by housing, food, health, safety, wealth, work, culture, existing children, and personal desire. Gestation and cooldown are configurable.

## Economy and construction

Resources are conserved except for declared production, consumption, spoilage, damage, and outside transfers. Prices respond to stock coverage and recent unmet demand. Employment is a relationship between a person and a productive organization, not a cosmetic label.

A building begins as an authorized project with a location and bill of materials. Builders are assigned to stable project destinations; only builders who arrive within the site radius may recover local material, deliver inventory, earn construction wages, or add labor. Foundation, frame, walls, roof, fitting, utility, and occupancy stages are historical state. A shortage or an absent workforce can stall the site.

## Death and inheritance

Natural death occurs on the hidden lifespan day unless the person died earlier. Early-death risks must be causally tied to health, deprivation, accident, disaster, conflict, sabotage, or failed care. Death removes labor and leadership, creates grief memories, changes housing, and executes a succession/inheritance policy. Assets and debts never disappear without a recorded legal or loss event.

## Leadership and breakthroughs

Influence is multidimensional and network-derived. Each institutional follower retains both loyalty and the candidate they support between elections. Supporters of a losing candidate remain connected to that candidate rather than being reassigned to the winner. Formal office, economic control, technical trust, and cultural reach remain distinct.

Rare traits only create potential. A breakthrough needs a real problem, cross-domain ability, knowledge, tools, resources, time, motivation, attempts, failures, demonstration, and adoption. Historical significance is calculated after consequences and never drives behavior.

## Outside pressure and intervention

Normalized signals contain domain, geography, intensity, confidence, source agreement, novelty, duration, decay, timestamp, objective pressure, belief pressure, and evidence lineage. Institutions and people receive delayed and trust-weighted interpretations.

Help, spice, and sabotage are input categories rather than moral labels. Every intervention has budget/cooldown metadata and enters ordinary inventories, information, disease, infrastructure, migration, finance, or institutional processes. Outcomes can be mixed or contrary to intent.
