# Simulation rules

## Time and identity

- The default world begins with 20 adults in one settlement.
- External migration is stochastic and responds to housing, food, water, safety, trust, health, and incomplete outside conditions. No arrival is guaranteed.
- Biological sex is sampled independently for each person; no daily balancing is imposed.
- Every generated identity is derived from the saved world seed and deterministic stream state.
- A natural lifespan is an integer from 65 through 100 real years, measured in 365-day years from birth, and remains hidden from the ordinary spectator panel.
- Children are internally generated people with real parents and household history, not reskinned entrants.

## Daily causal order

The engine uses an explicit stable daily phase order so replay is inspectable:

1. Apply and decay captured signals, then resolve due interventions through settlement systems.
2. Advance aging and natural death, deliver due births, and evaluate possible migration at the physical entry point.
3. Assign housing and employment against the resulting living population.
4. Commission construction from measured food, water, housing, and civic pressure.
5. Select needs-driven tasks and physical destinations from locally available sites.
6. Move people toward those destinations using the authoritative position state.
7. Plan shared facility inputs without record-order priority; permit production, care, trade, government, research, and construction effects only for people who reached the appropriate site; perform arrived sanitation work; then consume resources and update health.
8. Resolve physically plausible encounters, relationship memories, partnerships, and reproduction decisions.
9. Deliver construction materials and labor from builders present at their assigned projects, advancing visible stages.
10. Update follower networks, elections, policy, institutional response, experiments, adoption, skills, historical significance, and evidence-based study of discovered legacy artifacts.
11. Deposit the day's waste at named source patches, synchronously spread and recover local conditions, update prices and disease pressure, reconcile housing, prune bounded history, and emit the daily result.

Adding a subsystem must not silently change this order without a documented simulation-version change.

## Agency

People act from needs, traits, skills, beliefs, relationships, owned resources, incomplete observations, and available opportunities. An emergence profile supplies prior aptitudes, not a permanent class. Decisions include a machine-readable explanation listing decisive pressures and rejected alternatives where practical.

## Relationships and reproduction

Relationships require physical proximity or simultaneous presence at the same home or productive worksite. A shared occupation, institution, intended destination, or prior relationship cannot create a nonlocal encounter. Familiarity, trust, affection, attraction, dependence, conflict, and remembered events evolve separately. Partnership requires history rather than one compatibility roll.

Conception additionally requires adult stages, biological compatibility, a mature pair relationship, sufficient interaction, cooldown eligibility, and a probabilistic decision affected by housing, food, health, safety, wealth, work, culture, existing children, and personal desire. Gestation and cooldown are configurable.

## Economy and construction

Resources are conserved except for declared production, consumption, spoilage, damage, and outside transfers. Physical capacity bounds every store; facilities curtail ordinary output that expected daily use plus available storage cannot accept. Prices respond to stock coverage and recent unmet demand. Employment is a relationship between a person and a productive organization, not a cosmetic label.

A building begins as an authorized project with a location and bill of materials. Builders are assigned to stable project destinations; only builders who arrive within the site radius may recover local material, deliver inventory, earn construction wages, or add labor. Foundation, frame, walls, roof, fitting, utility, and occupancy stages are historical state. A shortage or an absent workforce can stall the site.

## Environment, sanitation, and water

Environmental conditions belong to named building-centered land patches. Waste is conserved as the sum of local `wasteLoad` stocks; the settlement total is a cached aggregate, never a second independent source. Household and industrial waste begins at causal source sites and may spread only to bounded neighbors. Contamination diffusion uses a prior-day snapshot so iteration order cannot alter outcomes.

Sanitation is physical work. An assigned resident must choose the task, travel to the assigned dirty site, succeed, and have settlement energy and transport capacity available. Severe waste can trigger a broader community cleanup instead of allowing a narrow occupation bottleneck to poison the town. Cleanup removes only that site's waste and emits one target-level event. Transport is durable capacity and is not consumed as if the cart itself were fuel.

Facility inputs sharing a resource receive the same scarcity ratio. Farm fertility and water, well water quality, and industrial contamination affect output at the named producing site. Produced well water mixes with stored water by volume; consuming water does not change its quality. Drinking-water quality harms health only in proportion to water a person actually receives and raises future water pressure; conditions around a person's reached home or workplace and settlement contamination/waste contribute local and systemic health pressure.

New buildings inherit nearby soil, water, and contamination. A new well beside polluted land cannot create clean groundwater merely by being commissioned. A stalled construction plan has no environmental effect unless workers actually reach it.

## Death and inheritance

Natural death occurs on the hidden lifespan day unless the person died earlier. Early-death risks must be causally tied to health, deprivation, accident, disaster, conflict, sabotage, or failed care. Death removes labor and leadership, creates grief memories, changes housing, and executes a succession/inheritance policy. Assets and debts never disappear without a recorded legal or loss event.

## Leadership and breakthroughs

Influence is multidimensional and network-derived. Each institutional follower retains both loyalty and the candidate they support between elections. Supporters of a losing candidate remain connected to that candidate rather than being reassigned to the winner. Formal office, economic control, technical trust, and cultural reach remain distinct.

Rare traits only create potential. A breakthrough needs a real problem, cross-domain ability, knowledge, tools, resources, time, motivation, attempts, failures, demonstration, and adoption. Historical significance is calculated after consequences and never drives behavior.

## Outside pressure and intervention

Normalized signals contain domain, geography, intensity, confidence, source agreement, novelty, duration, decay, timestamp, objective pressure, belief pressure, and evidence lineage. Institutions and people receive delayed and trust-weighted interpretations.

Help, spice, and sabotage are input categories rather than moral labels. Every intervention has budget/cooldown metadata and enters ordinary inventories, information, disease, infrastructure, migration, finance, or institutional processes. Outcomes can be mixed or contrary to intent.
