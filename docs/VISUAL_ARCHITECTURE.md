# Visual architecture

Updated 2026-07-13.

The simulation remains authoritative. This layer turns projections into a coherent settlement without feeding presentation state back into the world.

## Projection flow

`WorldProjection` supplies stable person IDs, age stages, sex, occupation, task, health, building type/stage/footprint, road centerlines, vehicle presentation state, and resource ledgers. Rendering derives only repeatable visual choices from those fields:

- citizen palette, hair, clothing, proportions, tools, posture, and task pose are deterministic from identity and projected state;
- buildings use the simulation footprint table and actual construction stage;
- road ribbons and traffic lanes share `MAIN_ROADS`;
- food, water, wood, stone, and energy stocks map to four aggregate visual tiers;
- optional authored GLB props are presentation only and have a procedural/no-op fallback.

No render random number changes a person or building on reload. No mesh position becomes simulation authority.

## Citizen tiers

- **Near/selected:** articulated 1.72 m baseline bodies with shaped head, torso, pelvis, arms, hands, legs, feet, hair, occupation color, equipment, age/health posture, and task motion.
- **Far/orbital:** two instanced batches preserve body/head silhouette and identity color while avoiding per-limb draw calls.
- **First person:** the selected render figure is hidden while the camera uses projected eye height, preventing head obstruction. The person remains autonomous.

Point-like authoritative work and home coordinates can contain several people. The render projection gives exactly co-located citizens a stable ID-sorted formation inside the same footprint; authoritative positions and destinations are untouched. Non-selected bodies inside the camera's personal space are culled, and follow mode opens a temporary roof/wall cutaway only for the structure containing the observed person.

The next tiering milestone is a shared-geometry medium citizen and removal of hidden per-person frame callbacks.

## Settlement assembly

Authoritative rectangular footprints still govern placement. Buildings face the main settlement corridor without changing footprint dimensions. Foundations, real door openings, entry steps, windows, merged corner trim, roof forms, chimneys, interiors, and construction stages strengthen their purpose and ground contact.

Road surfaces are upward-wound ribbons over the authoritative polylines, with shoulders, center markings, access approaches, and a civic plaza. Vehicles use the same lane paths. Economy yards search deterministic candidate positions that clear both road corridors and building footprints.

## Blender and runtime assets

The project-authored Confluence kit contains nine grounded roots for market, water, timber, stone, energy, street furniture, farm stock, and cargo transport. Blender joins each asset's parts before GLB export. glTF Transform then welds, simplifies, quantizes, and meshopt-compresses the result.

Run the source generator with Blender 5.1.2:

```powershell
& 'C:\Program Files\Blender Foundation\Blender 5.1\blender.exe' --background --python tools/blender/generate_confluence_kit.py
```

Then optimize the ignored raw export:

```sh
npm run assets:world-kit:optimize
```

Exact roots, hashes, sizes, tools, and transformations are recorded in [`assets/project-assets.json`](../assets/project-assets.json). The external-asset manifest remains empty because no third-party art was incorporated.

## Failure and cost boundaries

`ConfluenceAsset` loads through Suspense and an error boundary; a missing optional GLB does not stop the simulation or procedural buildings. Geometry and materials are shared between clones. Kit meshes receive but do not cast shadows, avoiding a duplicate shadow submission for small prop parts. Detailed evidence and current measurements are in [`VERIFICATION.md`](VERIFICATION.md) and [`PERFORMANCE.md`](PERFORMANCE.md).
