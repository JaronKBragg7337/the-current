# The Current — Authoritative Project Specification

This document preserves the complete governing product specification supplied at project creation. Where implementation choices are not specified, decisions must preserve NPC autonomy, causal continuity, historical identity, deterministic auditability, and the primacy of the physical 3D world.

---

# CODEX / GPT-5.6 SOL MASTER EXECUTION INSTRUCTION

Build **The Current** as an actual local project. The application will eventually be hosted through Heartbeat Observatory, but it begins as a completely new, separate public GitHub repository.

## 1. Repository and project identity

Create a brand-new public GitHub repository named `the-current` and connect the corresponding local Git repository.

Do not build this inside or directly modify the existing `heartbeat-observatory` repository. The Current is a separate application with its own simulation, rendering, assets, persistence, testing, deployment, and development history.

The intended public destination is eventually:

`https://www.heartbeatobservatory.com/worlds/the-current/`

Architect the application so it can later be hosted at that route without requiring its source code to live inside the Heartbeat Observatory repository.

If the computer is already authenticated with GitHub, create the repository, connect it, commit regularly, and push the work. If external authentication is unavailable, do not pretend the remote repository was created. Continue building locally, preserve the complete Git history, and report the exact remaining authentication obstruction at the end.

The repository must be public because multiple AIs and outside review tools will inspect it during development.

Never commit:

- Credentials
- Tokens
- API secrets
- Browser session data
- Private files
- Unnecessary personal information
- Machine-specific secrets

Create a suitable `.gitignore` immediately.

## 2. Execution authority

Permission is granted to use the local computer, terminal, browser, filesystem, Git, GitHub tooling, Blender, Node.js, Three.js tooling, installed development software, and other appropriate local tools to complete this work.

Do not reduce this assignment to a planning document, mockup, static concept page, text simulation, or tiny disposable demonstration. Build the real system as completely as the available machine, tools, time, and verified dependencies permit.

Internal phases are allowed when they improve execution, but work must not stop merely because one phase or prototype works. Continue automatically into subsequent feasible work. The specification's “first implementation target” is an acceptance floor, not a scope ceiling or stopping instruction.

Do not assume that a large specification means only a small portion should be attempted. Determine what can actually be achieved by working, testing, inspecting results, correcting problems, and continuing.

Do not ask for permission between ordinary reversible development steps. Make reasonable implementation decisions independently. When details are missing, choose a strong solution consistent with the project's governing principles and document the decision.

Add systems, safeguards, tooling, tests, UI, documentation, or architectural improvements that materially strengthen the project, even when they were not explicitly requested.

## 3. Preserve the complete concept

Population, life cycles, relationships, reproduction, leadership, power, rare polymaths, breakthroughs, historical identity, and the 3D spectator experience belong inside a larger persistent autonomous civilization simulator. Do not accidentally build only a population visualizer.

### Autonomous civilization

NPCs must independently:

- Obtain food, water, shelter, energy, tools, and transportation
- Work and develop skills
- Form households and relationships
- Produce, transport, exchange, consume, save, and waste resources
- Create businesses and institutions
- Respond to prices, scarcity, danger, opportunity, trust, and incomplete information
- Build and physically expand settlements
- Form leadership structures and influence networks
- Create laws, customs, organizations, ideologies, and social movements
- Learn from success and failure
- Inherit assets, debts, status, knowledge, relationships, and consequences
- Produce breakthroughs individually or through teams
- Migrate, cooperate, compete, organize, exploit, reform, govern, and fail

The world must operate without a player character and without viewers giving NPCs direct commands.

### Closed causal loop

Preserve this loop:

**NPC decisions
→ production and consumption
→ resource and price changes
→ new opportunities and pressures
→ institutional and social responses
→ physical changes to the world
→ new NPC decisions**

External data and observer interventions must enter this causal loop. They must not bypass it with arbitrary scripted outcomes.

## 4. Real-world information layer

The world must eventually change in response to current-world information.

Before selecting implementations, independently repeat and expand the open-source research using the browser and official sources. Do not assume prior recommendations are complete or still optimal.

Investigate current, actively maintained, legally reusable sources such as:

- GDELT
- Media Cloud
- ReliefWeb
- NASA EONET
- USGS earthquake feeds
- Open-Meteo
- National Weather Service data
- World Bank indicators
- FRED where practical
- Hacker News public data
- Other superior open-data, RSS, CC-licensed, government, scientific, humanitarian, economic, climate, technology, agriculture, energy, and public-event sources discovered during research

Prefer:

- Open data
- Public feeds
- CC0
- Permissive licenses
- Official government or institutional APIs
- Sources that do not require paid access
- Sources that do not require secret credentials
- Multiple-source corroboration

Public data APIs are acceptable. Do not make the core simulation dependent on paid language-model API credits. Local Ollama or another local model may be used optionally for classification, narration, institutional deliberation, historical summaries, or expression, but the simulation must continue functioning when no language model is available.

### Normalize incoming information

Do not make raw headlines directly control the civilization. Convert outside information into structured signals containing fields such as:

- Domain
- Geography
- Intensity
- Confidence
- Source agreement
- Novelty
- Duration
- Decay
- Timestamp
- Objective pressure
- Belief or sentiment pressure

Potential domains include:

- Economy
- Agriculture
- Climate
- Disaster
- Conflict
- Health
- Technology
- Energy
- Transportation
- Trade
- Social conditions
- Space

NPCs and institutions must interpret those pressures according to their own information, beliefs, interests, resources, and capabilities. The same signal may produce different outcomes in different settlements.

## 5. Observer intervention system

Viewers are witnesses with limited influence, not conventional players.

Implement or architect intervention categories including:

### Help

- Food
- Water
- Medicine
- Construction materials
- Emergency energy
- Education funding
- Debt relief
- Infrastructure assistance
- Useful information
- Skilled arrivals

### Spice

- Festivals
- Rumors
- Art movements
- Rare discoveries
- Strange artifacts
- New fashions
- Unexpected migrations
- Mysterious broadcasts
- Experimental technologies

### Sabotage

- False information
- Counterfeit currency
- Contamination
- Theft
- Corrupt investment
- Infrastructure failure
- Crop disease
- Political scandal
- Trade obstruction
- Destructive rumors

NPCs retain agency over the consequences. Help may accidentally cause dependency, corruption, price collapse, theft, or political manipulation. Sabotage may accidentally trigger reform, cooperation, or innovation.

Do not use a simplistic permanent good/evil classification. Build the intervention system so limits, costs, cooldowns, voting, or shared intervention energy can be added or tested without redesigning the simulation.

## 6. 3D world requirement

This must be a real Three.js-based 3D spectator world, not primarily a dashboard.

The primary experience must visibly show:

- NPCs
- Terrain
- Roads
- Settlements
- Houses
- Businesses
- Farms
- Resource sites
- Construction
- Transportation
- Goods movement
- Work
- Relationships
- Social gathering
- Growth
- Decline
- Emergencies
- Birth
- Aging
- Death
- Historical change

Economic and historical data may appear in overlays, but they cannot replace the physical world.

Implement:

- Orbital world camera
- Regional and settlement-scale orbiting
- Smooth zoom from world scale to street scale
- Selectable NPCs
- Selectable buildings and vehicles
- Third-person view-only following
- First-person view-only perspective through an NPC
- Smooth camera transitions
- Optional information panels
- Camera collision and obstruction handling
- Touch/mobile controls where practical
- Desktop controls
- Responsive rendering

The viewer must never gain control over the NPC when entering first-person or third-person mode.

## 7. Visual standard

Use stylized but believable visuals.

Do not leave the finished experience dependent on:

- Permanent cube people
- Rectangular Roblox-like human blockouts
- Unshaped placeholder buildings
- Misaligned roads
- Leaning structures
- Incorrect scale
- Fake inaccessible doors
- Floating objects
- Invisible walls used to disguise assembly failures
- A flat grid pretending to be a functioning settlement

Temporary debug geometry is acceptable during implementation, but replace it wherever reusable permissive assets or procedural geometry can provide the intended visual result.

Buildings, roads, terrain, props, people, and vehicles must share a coherent scale and visual language.

## 8. Repeat and expand the open-source asset search

Search again from the local computer before finalizing the asset strategy.

Prioritize assets that support:

- GLB or reliable conversion to GLB
- Three.js
- Rigged humanoids
- Shared humanoid skeletons
- Walk, idle, work, carry, sit, social, injury, and death animations
- Animation retargeting
- Procedural clothing, hair, skin, body, age, and occupation variation
- Instancing
- LOD generation
- Texture atlases
- Low draw-call counts
- Modular buildings and roads
- Visible interiors
- Construction stages
- Terrain and nature
- Tools, resources, furniture, agriculture, industry, transportation, and commerce

Previously identified candidates include:

- Quaternius
- Kenney
- KayKit
- MakeHuman/MPFB
- Poly Haven
- ambientCG

Do not limit the search to those sources. Replace or supplement them when a better-maintained, simpler, more compatible, or more complete option is found. Verify licenses from official pages, repositories, or included license files.

Prioritize:

- CC0
- MIT
- BSD
- Apache-2.0
- Other clearly permissive licenses compatible with a public repository and public website

Avoid assets whose reuse rights are unclear.

For every incorporated external asset or library, record:

- Name
- Creator
- Original URL
- License
- Download date
- Modifications
- Runtime files derived from it
- Attribution requirements
- Any redistribution restrictions

Store this in committed machine-readable manifests and human-readable documentation.

## 9. Asset repository policy

Do not blindly commit every raw archive or source package.

**Original downloaded archives:** keep in a local source cache unless redistribution is useful and licensed.

**Optimized runtime assets:** commit when reasonably sized.

**Large necessary tracked binaries:** use Git LFS when appropriate.

**Source URLs, license files, manifests, hashes, and conversion scripts:** always commit.

**Generated temporary files and caches:** do not commit.

Prefer a reproducible asset pipeline. Use Blender automation, glTF Transform, Meshopt, texture compression, atlas generation, skeleton normalization, and other appropriate tools.

Normalize:

- Units: 1 unit = 1 meter
- Up axis: +Y
- Forward axis: one canonical direction
- Character root: centered between feet at ground level
- Rig: canonical humanoid bone map
- Materials: shared and atlased where practical
- Animations: named, tagged, validated and reusable
- Collisions: simplified proxies
- LOD levels: close, medium, far and orbital where useful

Create automated validation where practical.

## 10. Runtime and library research

Independently verify the latest stable and compatible versions of all dependencies before installing them.

Investigate and use appropriate tools such as:

- Three.js
- `InstancedMesh`
- `BatchedMesh`
- Three.js `LOD`
- `SkeletonUtils`
- InstancedMesh2 or a better current alternative
- Recast Navigation JS or a better current alternative
- Three Mesh BVH
- glTF Transform
- Meshoptimizer / gltfpack
- Web Workers
- IndexedDB
- A suitable deterministic simulation and persistence architecture
- A suitable test framework
- A suitable performance benchmark system

Do not force a library into the project merely because it appeared in prior research. Benchmark important choices and substitute better options when justified.

Avoid assigning one expensive full-detail animation system to every distant NPC. Use rendering tiers such as:

- Selected and nearby NPCs: full skinned characters
- Medium distance: reduced-detail or instanced animated characters
- Far distance: low-detail instanced population
- Orbital distance: simplified population representation
- Outside active rendering: simulation-only entities

The authoritative simulation must not depend on whether an entity is rendered.

## 11. Architecture

Maintain a strong separation between:

**Authoritative deterministic simulation
→ persistent event history and snapshots
→ synchronization/state projection
→ Three.js presentation
→ spectator cameras and UI**

The simulation must be able to run:

- With rendering enabled
- Headlessly
- At normal speed
- Accelerated
- Through long deterministic tests
- From a saved seed
- From saved snapshots
- Across missed time where practical

World-day duration must be configurable. Every important event must be timestamped. Support deterministic replay where feasible. Use workers or other isolation so expensive simulation work does not freeze the renderer.

Choose the actual repository structure after inspecting the project requirements, but preserve modular boundaries for:

- World simulation
- Population
- Economy
- Relationships
- Institutions
- Leadership and influence
- Breakthroughs
- Construction
- Navigation
- Rendering
- Asset processing
- Real-world data ingestion
- Observer interventions
- Persistence
- Historical replay
- UI
- Testing

## 12. Public hosting readiness

The application will eventually be connected to Heartbeat Observatory. Prepare it for `/worlds/the-current/` using relative or configurable asset paths and a configurable base URL.

Do not modify the live Heartbeat Observatory repository unless specifically necessary and safely isolated. The Current must be capable of independent development and deployment.

If the computer already has a safely authenticated deployment environment and creating a public preview is feasible, create one and document it. Do not expose credentials or destabilize existing live applications.

The world must remain usable as a local application even if no external hosting or live-data connection is available.

## 13. Documentation required

Commit documentation that allows another AI or developer to understand and continue the project.

At minimum include:

- `README.md`
- `AGENTS.md`
- Architecture documentation
- Simulation-rules documentation
- Asset-source inventory
- License inventory
- Data-source inventory
- Setup instructions
- Local development instructions
- Build instructions
- Test instructions
- Deployment instructions
- Controls
- Known limitations
- Performance notes
- Completed systems
- Partially completed systems
- Unimplemented systems
- Important design decisions
- Exact next technical opportunities

Place the complete attached specification into the repository as authoritative project documentation rather than leaving it only in the chat transcript.

## 14. Verification requirements

Do not equate code existence with working behavior.

Run and verify:

- Installation
- Type checking
- Linting
- Unit tests
- Deterministic simulation tests
- Long-duration population tests
- Build
- Local application startup
- Browser rendering
- Camera transitions
- NPC selection
- Navigation
- Animation
- Persistence
- Save and reload
- Seed reproducibility
- Population entry
- Aging
- Relationships
- Reproduction
- Death
- Inheritance
- Economy
- Construction
- Historical events
- Leadership emergence
- Rare individuals
- Performance at multiple population sizes
- Mobile/responsive behavior where available

Use screenshots, automated browser testing, logs, metrics, saved simulation summaries, or other evidence where appropriate. Correct failures rather than merely listing them.

Test at accelerated world speeds. Run the population for at least the requested 150 simulated days, and run longer tests if the implementation supports them.

Report measurable results such as:

- Population over time
- Births
- Deaths
- Daily entrants
- Households
- Relationships
- Food production and consumption
- Housing
- Employment
- Wealth distribution
- Inheritance
- Leaders and influence networks
- Breakthrough attempts and adoption
- Frame rate
- Draw calls
- Active rendered NPCs
- Simulation tick duration
- Save size
- Reload correctness

## 15. Scope interpretation

The attached specification contains minimum examples and initial values. Treat them as configurable starting parameters where appropriate, not arbitrary hardcoded universal truths.

Do not remove complexity merely because it is difficult. Do not fake complexity with random text, cosmetic labels, or unconnected statistics.

A visible activity should correspond to simulation state. A reported decision should correspond to a real decision process. A shortage should produce observable consequences. A building should require labor, materials, time, and location. A leader should require influence or followers. A breakthrough should require ability, knowledge, resources, experimentation, and adoption. A relationship should emerge from encounters and history. A death should alter households, assets, labor, memory, and institutions.

Use procedural systems and reusable components rather than individually scripting every result.

## 16. Git discipline

Use Git as an active safety and development system.

- Make an initial baseline commit.
- Commit meaningful working checkpoints.
- Use descriptive commit messages.
- Do not commit broken generated caches.
- Preserve reversibility.
- Push checkpoints to the public repository when possible.
- Do not rewrite useful history merely to make it look cleaner.
- Tag or document major working milestones where useful.

Do not stop after creating scaffolding and documentation.

## 17. Final report

At the end of the available execution, provide a precise report containing:

1. Public GitHub repository URL
2. Local repository path
3. Live preview URL, if created
4. How to run the project
5. What was actually built and verified
6. What open-source assets and libraries were used
7. Their licenses
8. Important architectural decisions
9. Test results
10. Performance results
11. Screenshots or other verification artifacts
12. Current limitations
13. Anything partially implemented
14. Anything not implemented
15. Any external obstruction that genuinely prevented further work
16. The strongest next actions another AI could perform

Do not describe an intended system as completed when only interfaces, placeholders, or documentation exist. Do not minimize completed work either. Clearly identify everything that genuinely functions.

## Governing execution principle

Build as much of the real autonomous 3D civilization as this environment permits.

Research before choosing dependencies. Reuse strong open-source work rather than rebuilding solved infrastructure. Keep the simulation causal, inspectable, persistent, deterministic where practical, and independent from rendering. Preserve NPC autonomy. Maintain visual quality. Test continuously. Continue beyond the first successful prototype whenever further verified implementation is feasible.

---

# THE CURRENT — Population, Life Cycle, and 3D Spectator Expansion

## 1. Time model

All population rules operate in world days.

A world day can later be configured as:

- One real day
- Several real hours
- An accelerated testing interval
- A compressed development mode

For the public persistent world, the default can be one world day per real day, allowing viewers to recognize individuals, watch relationships form, and observe generations change over several months.

Every event is timestamped so the complete history can be replayed.

## 2. Migration is causal, limited, and uncertain

No person is created merely because another day passed. Each world day can produce zero or more autonomous entrants within a small configured limit. The probability responds to the settlement's housing, food, water, safety, health, public trust, delayed reputation, travel conditions, and pressures outside the observed boundary.

They are not controlled by observers and are not automatically assigned to an existing settlement.

Each entrant receives a procedurally generated identity.

### Entry characteristics

Each new person receives:

- A unique name
- Male or female biological sex, randomly selected
- Physical appearance
- Height and body proportions
- Facial characteristics
- Voice profile
- Temperament
- Risk tolerance
- Empathy
- Ambition
- Curiosity
- Aggression
- Patience
- Sociability
- Initial health
- Natural aptitudes
- Starting possessions
- Starting knowledge
- Personal desires
- Fears
- Moral tendencies
- Political tendencies
- Relationship preferences
- Trust threshold
- Adaptability
- Hidden natural lifespan
- A small amount of imperfect information about the world

The random generation must use a saved seed. That means the world can be audited or replayed without changing who entered on a particular day.

### Biological sex selection

The default selection is approximately:

50% male
50% female

It should be probabilistic rather than forcing one male and one female each day. Some days could produce:

- Male + Male
- Female + Female
- Male + Female

Over time, the distribution should generally approach balance without being artificially corrected every day.

## 3. What they emerge as

New entrants do not all arrive as blank, identical citizens.

Each has an initial emergence profile representing the abilities and tendencies they possess when entering the world.

Possible emergence profiles include:

- Builder
- Farmer
- Hunter
- Researcher
- Trader
- Healer
- Mechanic
- Artist
- Teacher
- Organizer
- Explorer
- Laborer
- Inventor
- Caregiver
- Opportunist
- Political thinker
- Religious thinker
- Criminally inclined
- Militarily inclined
- Unskilled generalist

These are not permanent classes.

A person may enter with agricultural aptitude but never become a farmer. A naturally gifted engineer may grow up in an isolated settlement without access to tools or education. A person with little initial aptitude may become highly skilled through repetition, teaching, and necessity.

The emergence profile influences the beginning of a life. It does not dictate the ending.

## 4. Where they go changes who they become

The environment must continuously reshape each NPC.

A person’s development is produced by both:

**Initial traits + lived environment + accumulated decisions**

Where someone settles can change:

- Occupation
- Skills
- Clothing
- Wealth
- Education
- Health
- Political beliefs
- Religious beliefs
- Social attitudes
- Language patterns
- Relationships
- Trust
- Risk tolerance
- Understanding of technology
- Opinion of other settlements
- Response to outsiders
- Likelihood of cooperation or violence

### Example

A curious person entering near a research city may become an engineer.

The same person entering a starving agricultural settlement may become:

- A farm worker
- A water-system designer
- A trader
- A thief
- A migration organizer
- A political revolutionary

The simulation must never assume that the same starting person would have the same life in every location.

## 5. Entry into the physical world

Any migrants who do arrive should visibly enter rather than silently appearing in the database.

Possible entry locations include:

- A coastal arrival point
- A wilderness boundary
- A road entering the map
- A railway station
- A migration camp
- A mysterious emergence structure
- An observer-created entry portal
- A settlement immigration center

Entrants decide where to travel based on:

- Visible roads
- Available food
- Housing prices
- Employment opportunities
- Safety
- Existing social connections
- Rumors
- Government incentives
- Personal preferences
- Information received from other NPCs

They can make poor decisions.

An entrant may travel toward a city that was prosperous several days earlier but is now collapsing because their information is outdated.

## 6. Lifespan system

Every person receives a hidden natural lifespan when created.

**Natural lifespan = random whole number from 65 to 100 years, represented as 365-day years**

The lifespan is calculated from birth, including for people who arrive as adults. An entrant therefore records both age on arrival and time lived in the current settlement; those values must never be presented as the same fact.

### Natural death

When the assigned day arrives, the NPC dies naturally if they have not already died from another cause.

The natural death date should normally remain hidden. Other NPCs and viewers can only estimate age, health, and probable remaining life.

### Early death

A person can die before their assigned natural lifespan because of:

- Starvation
- Dehydration
- Disease
- Environmental exposure
- Workplace accident
- Transportation accident
- Natural disaster
- Violence
- War
- Sabotage
- Medical failure
- Dangerous experimentation
- Infrastructure collapse

The assigned lifespan is therefore the maximum natural life duration, not guaranteed survival.

### Death must remain economically meaningful

Death affects:

- Household income
- Business ownership
- Employment
- Inheritance
- Housing availability
- Debt
- Skill availability
- Political leadership
- Relationships
- Population structure
- Institutional memory
- Grief and mental state
- Future decisions by surviving NPCs

A highly skilled engineer dying can delay a project.

A business owner dying without a succession plan can cause the company to:

- Transfer to family
- Transfer to employees
- Be sold
- Be seized by creditors
- Collapse
- Split into competing businesses

## 7. Aging must be visible

NPCs should visibly change throughout their lives.

Possible visual stages:

1. Child
2. Adolescent
3. Young adult
4. Adult
5. Older adult
6. Elder

Changes can include:

- Height
- Body proportions
- Hair color
- Hair loss
- Skin appearance
- Movement speed
- Posture
- Clothing
- Voice
- Strength
- Health
- Work capacity

These transitions should be gradual rather than changing the model instantly at fixed milestones.

The world should physically contain multiple generations at once.

## 8. Relationships

NPCs form relationships through actual contact and shared history.

Relationship types include:

- Acquaintance
- Friend
- Close friend
- Romantic interest
- Partner
- Spouse
- Parent
- Child
- Sibling
- Mentor
- Student
- Coworker
- Business partner
- Rival
- Enemy
- Political ally
- Community leader
- Caregiver

### Relationship development

Relationships are influenced by:

- Time spent near one another
- Shared employment
- Shared housing
- Similar beliefs
- Compatible personalities
- Attraction
- Trust
- Cooperation
- Conflict
- Betrayal
- Financial dependence
- Shared danger
- Observer interventions
- Migration
- Family relationships
- Social reputation

Relationships should not be determined by one compatibility number.

Two incompatible people might remain together because they share a business, children, housing, political power, or survival needs. Two highly compatible people may never meet.

### Relationship memory

Each person remembers important relationship events:

- First meeting
- Gifts
- Assistance
- Arguments
- Betrayals
- Shared disasters
- Business failures
- Births
- Deaths
- Migration
- Marriage or partnership
- Separation

These memories affect later decisions.

## 9. Reproduction and internally generated population

External migration is an uncertain population source, not a guaranteed spawn rule.

Existing NPCs can create additional people through relationships after the necessary conditions are met.

### Reproductive eligibility

A pair becomes eligible after:

- Both have reached the adult life stage.
- They have a biologically compatible reproductive pairing.
- They have maintained a sufficiently developed relationship for a configurable minimum period.
- They have had enough interaction to make the decision.
- Neither is already within a reproductive cooldown.
- The simulation determines that conception occurs.

Era One begins with:

- Minimum mature relationship period: 30 world days
- Gestation period: 260–294 world days
- Post-birth reproductive cooldown: 365–1,095 world days

These are model parameters, not promises that conception or birth will occur.

### Reproduction is not automatic

The decision and probability should respond to:

- Relationship stability
- Available housing
- Food security
- Household wealth
- Employment
- Health
- Personal desire for children
- Existing children
- Government incentives
- Cultural expectations
- War
- Disease
- Local safety
- Population density
- Access to care

A wealthy society may experience lower birth rates because citizens prioritize careers or education.

A poor society may experience either higher or lower birth rates depending on culture, security, and resource conditions.

### Birth

A child receives:

- A unique identity
- Male or female biological sex
- Inherited physical traits
- Mixed personality tendencies
- Genetic variation
- Possible health conditions
- Family relationships
- Household status
- Citizenship or settlement membership
- Cultural influence
- No predetermined profession

Children are internally generated NPCs and remain distinct from condition-driven migrants.

### Development

Children grow through visible stages and learn from:

- Parents
- Extended family
- Schools
- Work
- Friends
- Local culture
- Institutions
- Historical events
- Personal observation

A child born into the world has a fundamentally different starting condition from a daily entrant.

Entrants arrive with generated background traits. Children inherit an actual history.

## 10. Population growth remains emergent

The world should not use a simple hard population cap.

Growth is constrained by actual conditions:

- Food
- Water
- Housing
- Medical capacity
- Employment
- Land
- Energy
- Transportation
- Sanitation
- Government policy
- Conflict
- Environmental damage

When the population exceeds local carrying capacity, the result can be:

- Higher prices
- Homelessness
- Migration
- Disease
- New construction
- Urban density
- Political conflict
- Colonial expansion
- New settlements
- Crime
- Innovation
- Public infrastructure
- Population decline

The simulation should let the civilization solve or fail to solve these pressures.

## 11. Inheritance and generational change

When NPCs die, their assets do not disappear.

Possible inherited assets include:

- Currency
- Land
- Houses
- Businesses
- Tools
- Vehicles
- Debt
- Political status
- Intellectual property
- Personal records
- Social obligations

Inheritance can produce:

- Family wealth
- Economic inequality
- Dynasties
- Nepotism
- Business continuity
- Family conflict
- Property disputes
- Charitable foundations
- Government seizure
- Wealth redistribution

Children should also inherit social advantages and disadvantages.

A child of a respected doctor may have access to education and mentors. A child of a convicted criminal may experience distrust despite committing no offense.

## 12. Population equilibrium

There is no fixed population target or guaranteed equilibrium. Migration, births, deaths, housing, public health, food, water, care, relationships, and the town's reputation interact. Distribution tests must bound physically impossible behavior without asserting one expected history.

This creates a naturally changing structure:

**Condition-driven arrivals
+ births
− natural deaths
− accidental or violent deaths
± migration between settlements**

Population expansion should therefore be visible without requiring endless artificial spawning.

## 13. Required 3D presentation

The entire civilization must exist in a real, navigable 3D world.

It cannot be presented primarily as:

- A spreadsheet
- A flat map
- A text simulation
- A collection of menus
- A 2D city builder

Economic data can appear as optional overlays, but the primary experience is watching actual people and infrastructure operate in a physical environment.

### Visible activities

Viewers should be able to see NPCs:

- Walking
- Traveling
- Working
- Farming
- Building
- Trading
- Carrying supplies
- Driving vehicles
- Teaching
- Repairing equipment
- Socializing
- Arguing
- Voting
- Moving homes
- Caring for children
- Responding to emergencies
- Aging
- Dying
- Holding funerals

Goods should visibly move through the world when practical.

A shortage should not exist only as a number. The viewer should see:

- Empty shelves
- Longer market lines
- Slower factories
- Idle vehicles
- Abandoned construction
- Increased theft
- NPCs traveling farther for supplies

## 14. Primary orbital perspective

The default experience is an orbital spectator camera.

The viewer can:

- Orbit around the entire world
- Rotate around settlements
- Zoom from continental scale to street level
- Pan across terrain
- Follow roads and trade routes
- Select buildings
- Select vehicles
- Select individual NPCs
- View economic overlays
- Jump to major events

The camera must move smoothly between scales.

**World orbit
→ regional orbit
→ city orbit
→ neighborhood orbit
→ selected NPC**

At the widest distance, the viewer sees settlement growth, roads, agriculture, environmental changes, and migration.

At close distance, the viewer sees individual behavior.

## 15. Third-person follow mode

Selecting an NPC provides a third-person spectator camera.

The camera follows behind or above the selected person while still allowing the viewer to orbit around them.

Available third-person options:

- Close shoulder view
- Standard follow view
- Elevated follow view
- Wide environmental follow view
- Automatic cinematic view

The viewer may rotate and zoom the camera but cannot steer the NPC.

The NPC continues making its own decisions.

### Information panel

While following a person, an optional panel can display:

- Name
- Age in world days
- Household
- Occupation
- Current task
- Destination
- Physical condition
- Emotional state
- Money
- Relationships
- Current concerns
- Recent memories
- Beliefs
- Decision explanation

The panel must be optional so the world can also be watched without interface clutter.

## 16. First-person spectator mode

The viewer can enter the visual perspective of any selected NPC.

This is a view-only first-person camera.

The viewer cannot:

- Move the NPC
- Change its destination
- Speak for it
- Control its hands
- Purchase anything
- Select its decisions
- Alter its relationships

The viewer sees and hears what the NPC experiences while the NPC remains autonomous.

### First-person limitations

The first-person camera should respect the NPC’s circumstances.

Examples:

- A short NPC has a lower viewpoint.
- A child has a child-height viewpoint.
- An injured NPC may move unevenly.
- Darkness reduces visibility.
- A visually impaired NPC may have altered perception.
- Indoor walls properly block vision.
- Distance limits sound.
- Crowds obstruct the view.

The viewer should not receive omniscient information while inside first-person mode unless an overlay is intentionally enabled.

### Perspective switching

Camera transitions should support:

**Orbital world view
→ third-person NPC follow
→ first-person NPC view
→ third-person follow
→ orbital world view**

Transitions should animate smoothly rather than teleporting abruptly.

## 17. No player avatar

The observer does not possess a body inside the world.

There is no conventional player character.

The observer exists through:

- Cameras
- Data inspection
- Timeline review
- Limited intervention drops
- Voting on intervention use

This prevents the project from becoming a normal open-world game.

The NPCs remain the inhabitants. Humans remain the witnesses.

## 18. 3D technical architecture

The simulation and rendering systems should remain separate.

```text
Authoritative simulation
        ↓
World-state snapshots
        ↓
3D representation layer
        ↓
Orbital, third-person, and first-person cameras
```

### Simulation layer

Responsible for:

- Economy
- Population
- Lifespans
- Relationships
- Births
- Deaths
- Businesses
- Institutions
- News-derived pressure
- Observer interventions
- Long-term history

### Three.js presentation layer

Responsible for:

- Terrain
- Buildings
- NPC models
- Animation
- Vehicles
- Weather
- Construction visualization
- Camera systems
- Lighting
- Audio
- User selection
- Data overlays

The simulation must not depend on whether an NPC is currently rendered.

## 19. Scaling the visible population

As the population grows, the viewer should still be able to see a functioning 3D world.

Use several simulation and rendering levels.

### Near the camera

NPCs receive:

- Full 3D models
- Detailed animation
- Facial direction
- Visible equipment
- Accurate local navigation
- First-person compatibility

### Medium distance

NPCs use:

- Simplified animation
- Lower-detail models
- Reduced update frequency

### Far distance

NPCs use:

- Instanced models
- Aggregate movement
- Simplified path updates
- No facial processing

### Outside the rendered region

NPCs remain active in the simulation but are not individually rendered.

Their actions continue through the authoritative world state.

This allows the civilization to grow without requiring every person to consume full graphical resources simultaneously.

## 20. Visual quality requirement

The project should follow the Heartbeat Observatory visual standard:

- Stylized but believable
- Proper human silhouettes
- Shaped heads, torsos, arms, and legs
- No permanent Roblox-like block characters
- Real building forms
- Correctly aligned roads
- Functional doors and interiors
- Coherent town layouts
- Visible construction stages
- Correct object scale
- Validated collision
- No leaning placeholder cities
- No invisible-wall dependence

Prototype geometry can be used temporarily during systems testing, but it cannot become the final visual language.

## 21. Construction must physically change the world

When NPCs build, the viewer should see the process.

A completed building should not instantly appear.

Construction can include:

1. Site selection
2. Land purchase or authorization
3. Material delivery
4. Foundation work
5. Structural framing
6. Wall construction
7. Roofing
8. Interior equipment
9. Utility connection
10. Occupation

Construction speed depends on:

- Labor
- Skills
- Tools
- Weather
- Money
- Material availability
- Transportation
- Government permits
- Sabotage
- Local technology

The world’s history therefore remains physically visible in its architecture.

## 22. Historical identity

Every NPC should contribute to an accumulating historical record.

The system records:

- Birth
- Arrival
- Family
- Homes
- Employment
- Relationships
- Businesses founded
- Inventions
- Political actions
- Crimes
- Property
- Major decisions
- Migrations
- Observer interventions experienced
- Death
- Descendants
- Lasting influence

A viewer should be able to select an old building and discover:

- Who commissioned it
- Who built it
- Where the materials came from
- Who owned it
- What events occurred there
- How it changed over time

A civilization becomes meaningful when its present is made from remembered lives.

## 23. First implementation target

The first functional population prototype should contain:

- 20 initial NPCs
- Two new entrants per world day
- Random male/female selection
- 65–100-year hidden lifespan measured from birth
- Basic aging
- Attraction and friendship
- Pair relationships
- Births
- Children
- Inheritance
- Food
- Housing
- Employment
- Death
- One settlement
- One construction system
- Orbital camera
- Third-person NPC follow camera
- First-person spectator camera
- Complete persistent saving

The world should then run for at least 150 simulated days.

The test should answer:

- Does the population survive?
- Do relationships form naturally?
- Does reproduction occur?
- Does the age distribution make sense?
- Does housing expand?
- Does food production adapt?
- Does accumulated wealth transfer between generations?
- Can viewers understand why population changes occurred?
- Can every living NPC be selected and viewed in third or first person?
- Can the simulation continue when most NPCs are not rendered?

Only after this population loop works should broad live-news pressure be connected.

## Governing principle

Every person enters with possibilities, not a destiny.

Their origin influences them. Their location changes them. Their relationships reshape them. Their economy constrains them. Their memories remain with them. Their descendants inherit both what they built and what they damaged.

The observer can watch from above, follow behind, or see through their eyes—but can never become them.

---

# THE CURRENT — Rare Leadership, Power, and Breakthrough Individuals

## 1. Rare high-impact individuals

Most NPCs should live ordinary but meaningful lives.

A small percentage should emerge with unusually strong combinations of traits that allow them to reshape settlements, institutions, economies, technologies, or entire historical periods.

These NPCs are not automatically important.

They possess high-impact potential, but whether that potential develops depends on:

- Where they emerge
- Their education
- Their relationships
- Available resources
- Social conditions
- Political stability
- Economic opportunity
- Whether others trust them
- Whether they survive long enough
- Whether institutions suppress or support them
- Whether they make good decisions

A potentially transformative person can remain unknown, fail, become corrupted, die early, or emerge only after a major crisis.

## 2. Leadership potential

Some NPCs should occasionally emerge with an unusually strong desire or ability to lead.

Leadership potential can come from several separate traits:

- Ambition
- Confidence
- Charisma
- Strategic thinking
- Social intelligence
- Organization
- Persuasion
- Courage
- Patience
- Risk tolerance
- Emotional control
- Ability to gain trust
- Ability to inspire loyalty
- Ability to exploit fear
- Desire for recognition
- Desire for responsibility
- Desire for control
- Desire for status
- Desire for power

These traits should not always appear together.

One NPC may be highly charismatic but strategically weak.

Another may be an excellent planner but unable to gain followers.

Another may not want leadership but may be pushed into it because others trust their judgment.

Another may strongly desire authority despite being incompetent.

## 3. Different kinds of leaders

Leadership should emerge in multiple forms.

### Community leaders

These NPCs gain influence because they:

- Solve local problems
- Organize food distribution
- Protect vulnerable residents
- Mediate conflicts
- Coordinate rebuilding
- Earn long-term trust

They may never hold an official title.

### Political leaders

These NPCs seek or receive formal authority through:

- Elections
- Appointment
- Succession
- Coalition-building
- Popular movements
- Emergency powers
- Inheritance
- Institutional promotion

### Economic leaders

These NPCs accumulate influence through:

- Business ownership
- Control of employment
- Control of transportation
- Banking
- Land ownership
- Essential resources
- Technological monopolies
- Investment networks

They may possess more practical power than the official government.

### Ideological leaders

These NPCs organize people around:

- Religion
- Political philosophy
- National identity
- Economic doctrine
- Environmental beliefs
- Anti-government beliefs
- Scientific thinking
- Social reform
- Cultural identity

### Military or security leaders

These NPCs gain authority through:

- Defense
- Crisis response
- Armed organizations
- Police institutions
- Militias
- Rebellion
- Personal loyalty from fighters

### Reluctant leaders

Some NPCs should actively avoid leadership but become leaders because:

- They are highly competent.
- Others repeatedly seek their advice.
- Existing leadership collapses.
- A crisis leaves no acceptable alternative.
- Their family or institution pressures them.
- Their reputation creates responsibility.

## 4. Power-seeking individuals

A smaller and rarer subset should strongly desire influence, domination, control, or authority.

Their internal goals may include:

- Controlling institutions
- Controlling land
- Controlling information
- Controlling money
- Controlling trade
- Controlling security
- Controlling public opinion
- Controlling another individual
- Establishing a family dynasty
- Becoming indispensable
- Preventing rivals from gaining influence
- Reshaping society according to their beliefs

Power-seeking should not automatically mean evil.

A power-seeking NPC may believe that centralized control is necessary to:

- Prevent famine
- Stop corruption
- End conflict
- Build infrastructure
- Protect the settlement
- Accelerate scientific progress
- Preserve stability

However, the same traits can also produce:

- Authoritarian rule
- Manipulation
- Censorship
- Patronage
- Corruption
- Coercion
- Political purges
- Economic monopolies
- Personality cults
- Dynastic succession
- Surveillance
- Exploitation

The system should evaluate actions and consequences rather than assigning a permanent good or evil label.

## 5. Rare generation frequency

These high-impact traits should be uncommon.

A possible starting distribution:

- Ordinary leadership potential: 8–15% of NPCs
- Strong leadership potential: 2–5%
- Strong desire for authority: 1–3%
- Strong desire for control: 0.5–1.5%
- Extreme power-seeking combination: 0.1–0.5%
- Rare transformative polymath potential: 0.1–0.4%
- Exceptional civilization-changing combination: below 0.1%

These rates should be tested and adjusted.

The world should not guarantee that a rare individual appears on a schedule.

Several generations may pass without one.

More than one may occasionally emerge close together, creating:

- Rival leadership movements
- Competing inventions
- Political conflict
- Economic competition
- Ideological division
- Alliances between exceptional individuals
- A period of unusually rapid progress

## 6. Potential is not destiny

Rare traits must not create automatic success.

A person with extraordinary leadership potential may:

- Be born into poverty
- Lack education
- Be ignored
- Be distrusted
- Become ill
- Die before gaining influence
- Make a disastrous early decision
- Become trapped in debt
- Be imprisoned
- Be manipulated by another person
- Choose family over public life
- Use their abilities only inside a small business
- Never realize their own potential

Likewise, an ordinary NPC can become historically important because circumstances place them at the center of a crisis.

The system must preserve both:

**Exceptional people can fail.**

**Ordinary people can become exceptional through experience.**

## 7. Multi-domain NPCs

Most NPCs should have one or two stronger interests.

A rare NPC should be capable of developing deep ability across multiple fields simultaneously.

Possible combinations include:

- Engineering and economics
- Agriculture and biology
- Politics and logistics
- Medicine and chemistry
- Architecture and social organization
- Computing and manufacturing
- Energy and transportation
- Art and political communication
- Mathematics and finance
- Education and institutional design

These NPCs should not simply receive higher numbers in every category.

Their importance comes from connecting domains that normally remain separate.

## 8. Cross-domain reasoning

Rare multi-domain NPCs can recognize relationships others miss.

Examples:

- A farmer with engineering knowledge creates automated irrigation.
- A doctor with logistics experience redesigns emergency supply systems.
- An architect with political skill creates a new public-housing institution.
- A merchant with mathematical ability develops insurance.
- A mechanic with agricultural experience designs new harvesting equipment.
- A teacher with technological knowledge creates scalable technical education.
- A politician with infrastructure knowledge reorganizes transportation around economic need.
- An artist with social insight creates a movement that changes political identity.

Breakthroughs should often emerge from bridges between fields, not simply from having the highest intelligence score.

## 9. Breakthrough conditions

A rare NPC does not create a breakthrough merely because they exist.

A major breakthrough requires a combination of:

**Ability
+ knowledge
+ available tools
+ time
+ resources
+ motivation
+ unresolved problem
+ experimentation
+ institutional support or personal freedom**

The NPC must usually:

1. Encounter a meaningful problem.
2. Understand multiple parts of it.
3. Form a new hypothesis or design.
4. Acquire materials or funding.
5. Test the idea.
6. Experience failures.
7. Improve the design.
8. Demonstrate value.
9. Convince others to adopt it.
10. Build systems capable of spreading it.

A discovery that nobody adopts should remain a historical curiosity rather than instantly transforming the world.

## 10. Types of breakthroughs

Rare individuals or teams may produce progress in:

- Agriculture
- Water systems
- Energy
- Medicine
- Transportation
- Construction
- Manufacturing
- Communication
- Computing
- Education
- Finance
- Governance
- Law
- Environmental restoration
- Disaster response
- Scientific understanding
- Social organization

Breakthroughs can also be harmful or mixed.

Examples:

- A powerful energy system creates pollution.
- A banking innovation expands investment but also debt.
- A transportation breakthrough improves trade while spreading disease.
- A political reform increases efficiency while concentrating authority.
- A medical discovery extends life but increases population pressure.
- A communication network spreads education and propaganda simultaneously.

## 11. Breakthrough teams

Major progress should not always come from one genius.

Rare NPCs may create unusual teams where their abilities combine.

For example:

**Inventor
+ financier
+ builder
+ political organizer
+ teacher
= technology that can actually spread**

One NPC may discover an idea.

Another may fund it.

Another may manufacture it.

Another may persuade government to adopt it.

Another may teach the population how to use it.

The historical record should preserve all contributors rather than attributing everything to one famous individual.

## 12. Rival exceptional individuals

Rare high-impact NPCs should sometimes oppose each other.

Possible conflicts include:

- Two leaders competing for control
- An inventor and a traditional institution
- A reformer and a wealthy landowner
- A scientist and a religious movement
- Two businesses racing to control a new technology
- A democratic organizer and an authoritarian strategist
- A humanitarian leader and a security-focused leader
- Two polymaths proposing incompatible solutions

These conflicts can determine the direction of an era.

The better idea should not always win.

Outcomes can depend on:

- Reputation
- Wealth
- Timing
- Political alliances
- Public fear
- Communication
- Evidence
- Corruption
- Institutional inertia
- Observer intervention

## 13. Influence networks

Leadership and power should be modeled as networks rather than one number.

Each NPC can possess different forms of influence:

- Social influence
- Political influence
- Economic influence
- Technical influence
- Cultural influence
- Religious influence
- Military influence
- Informational influence

An NPC may be powerful in one network and weak in another.

A mayor may control policy but depend economically on factory owners.

A scientist may have no formal authority but shape every major infrastructure decision.

A religious figure may influence public behavior without controlling laws.

A wealthy merchant may quietly finance several political factions.

## 14. Followers and loyalty

Leaders require followers.

NPCs decide whether to follow someone based on:

- Trust
- Fear
- Shared beliefs
- Past success
- Material benefit
- Family ties
- Charisma
- Propaganda
- Social pressure
- Personal loyalty
- Lack of alternatives
- Protection
- Employment dependence

Followers can:

- Become more loyal
- Become disillusioned
- Defect
- Form factions
- Betray the leader
- Replace the leader
- Continue the leader’s ideology after death
- Turn the leader into a historical symbol

## 15. Power changes the person

Leadership and authority should affect personality and decision-making over time.

Power can produce:

- Increased confidence
- Increased risk-taking
- Greater responsibility
- Paranoia
- Isolation
- Reduced empathy
- Greater generosity
- Stronger desire for legacy
- Fear of losing control
- Dependence on advisers
- Corruption
- Moral compromise
- Institutional maturity

A leader’s behavior should evolve based on:

- Success
- Failure
- Opposition
- Betrayal
- Public approval
- Wealth
- Crisis
- Age
- Family
- Historical memory

A cooperative leader can become controlling.

A selfish leader can become responsible.

A reluctant leader can become addicted to authority.

## 16. Succession and legacy

Rare individuals should leave consequences after death.

Their influence may survive through:

- Children
- Students
- Political parties
- Businesses
- Religious movements
- Laws
- Institutions
- Technologies
- Monuments
- Books
- Myths
- Enemies
- Unresolved conflicts

A founder’s organization can continue, improve, decay, or betray the founder’s original purpose.

A breakthrough can be:

- Expanded
- Forgotten
- Suppressed
- Stolen
- Misused
- Rediscovered
- Turned into a monopoly
- Made public
- Weaponized
- Reinterpreted by later generations

## 17. Viewer visibility

Rare individuals should not be labeled immediately as:

- Future dictator
- Great inventor
- Chosen leader
- Civilization-changing genius

The observer should discover their significance through behavior.

The system can show subtle indicators such as:

- Unusual skill growth
- Strong influence growth
- Wide range of interests
- Repeated successful problem-solving
- Increasing follower network
- High strategic ambition
- Multiple institutional connections
- Unusual experimentation
- Persistent long-term planning

Only after enough evidence exists should the historical system classify them as a major figure.

## 18. Historical significance score

The system may calculate historical significance after events occur.

Possible factors:

**Population affected
× duration of influence
× geographic reach
× institutional change
× technological impact
× cultural impact
× economic impact
× number of descendants or followers**

This score should never control behavior.

It exists only to help the viewer understand history.

## 19. Rare-event principle

The world should not manufacture a great leader or genius simply because the simulation has been quiet.

Periods without major figures are valid.

Some eras may be stable and ordinary.

Other eras may contain several extraordinary people whose interactions rapidly transform the world.

The simulation should permit:

- Quiet generations
- Lost potential
- Sudden reform
- Long stagnation
- Golden ages
- Authoritarian periods
- Scientific revolutions
- Failed revolutions
- Economic renaissances
- Civilizational collapse

## Governing principle

Rare people do not receive guaranteed greatness.

They receive unusual combinations of desire, ability, perception, and opportunity.

Some will seek leadership.

Some will seek control.

Some will seek power.

Some will connect fields that nobody else thought to combine.

Some will create breakthroughs.

Some will cause damage on a scale ordinary NPCs could never achieve.

The world determines which possibilities become history.
