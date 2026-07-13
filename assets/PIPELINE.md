# Blender and glTF normalization pipeline

This procedure defines the canonical output expected by The Current. It is intentionally tool-oriented but does not imply that any candidate asset has been downloaded.

## Canonical coordinate and scene conventions

| Property | Required value |
| --- | --- |
| Linear unit | 1 scene/runtime unit = 1 meter |
| Up axis | +Y in runtime/glTF |
| Forward axis | -Z in runtime/glTF |
| Character root | World origin centered between the feet at ground level |
| Static object origin | Stable assembly/pivot point documented per family; normally base center or a functional hinge/axle |
| Humanoid rest pose | One documented canonical pose and bone map for the selected skeleton |
| Materials | Shared and atlased where practical; glTF PBR materials only unless a documented runtime shader is required |
| Texture coordinates | UV0 required for visible materials; UV1 only when a measured feature needs it |
| Animation naming | Lowercase semantic names with variants, for example `locomotion/walk`, `work/hammer`, `social/talk-a` |
| Collision | Simplified project-authored proxies, separate from rendering meshes |

glTF's coordinate convention is already +Y up and -Z forward. Blender's exporter performs the axis conversion; do not add a compensating 90-degree runtime rotation to “fix” an incorrectly exported file.

## Stage 0: provenance before pixels

Before opening Blender:

1. Put the untouched archive in ignored `assets/source-cache/<source-id>/`.
2. Record download date, filename, bytes, SHA-256, official source/acquisition URLs, and included license notice.
3. List exact archive-internal files selected for evaluation.
4. Confirm the intended use is permitted in an openly inspectable public repository.
5. Establish budgets: close/medium/far triangles, materials, texture dimensions/bytes, bones, clips, runtime transfer, and collision complexity.

If the included notice conflicts with the landing page, stop. Do not infer the more permissive interpretation.

## Stage 1: clean Blender import

Use the repository-documented Blender version and record it in `toolVersions`.

1. Start from a clean scene; remove default cameras and lights.
2. Import one logical family or independently licensed item at a time.
3. Inspect source dimensions before applying transforms. Determine whether the source is meters, centimeters, or arbitrary units using known references such as a door (roughly 2 m) or an adult human (roughly 1.5–2 m).
4. Set scene units to Metric with Unit Scale 1.0.
5. Correct scale and orientation on a parent/root during inspection, then apply rotation and scale to deliverable meshes/armatures.
6. Remove source cameras, lights, hidden helper geometry, duplicate objects, unused materials, orphaned data, and embedded absolute file paths.
7. Preserve original topology in ignored work files until the optimized result passes review.

Do not use invisible blockers to compensate for leaning, floating, mismatched, or inaccessible source assembly.

## Stage 2: static models

### Buildings and interiors

- Separate facade, roof, frame, wall, door, window, and interior modules at intentional assembly boundaries.
- Put door origins on their actual hinge or sliding axis. Confirm opening direction and swept volume.
- Verify story height, wall thickness, stair rise/run, ceiling clearance, doorway width/height, and floor elevation at meter scale.
- Ensure an open doorway creates a real collision/navigation opening.
- Create project-authored construction representations: site/foundation/frame/walls/roof/fit-out. Do not fake stages by uniformly scaling a finished building from the ground.
- Generate simple collision proxies and navigation bounds. Rendering geometry is never collision by default.
- Remove shader-faked interiors from any space NPCs can enter; replace them with actual reachable geometry.

### Roads

Road centerlines, intersections, surface extrusion, elevation, lane width, and navigation connectivity are produced by project code from authoritative world state. A source pack may contribute:

- curb and sidewalk profiles;
- markings and decals;
- signs, lamps, barriers, drains, and street furniture;
- bridge or tunnel visual modules that conform to the generated path.

Validate seams at arbitrary angles and grades. A tiled road kit must not dictate the simulation graph.

### Vehicles

- Normalize dimensions against real vehicle ranges.
- Separate body, each wheel, steering elements, doors, and cargo elements when motion requires it.
- Put wheel origins on axle centers with consistent local axes.
- Generate a simple body collider and optional wheel/door interaction proxies.
- Confirm passenger eye height and door/cargo access points.
- Create medium and far LODs; distant traffic should not retain detailed interiors.

### Props, tools, goods, and furniture

- Set functional pivots: handle/grip for tools, stable base for furniture, center of mass or stacking base for goods.
- Validate canonical hand-grip orientation and carried offset with representative humanoid poses.
- Use instancing-compatible geometry/materials for repeated stockpiles and cargo.
- Keep simulation units distinct from render instances: one pile may visually aggregate many inventory units, but its count comes from state.
- Validate chairs and beds against actual sit/lie animations and navigation clearance.

## Stage 3: humanoid normalization

The preferred benchmark uses the Quaternius Universal Base skeleton, but it is not canonical until an acquired file passes inspection and its exact bone map is committed.

1. Place the armature root at `(0, 0, 0)` with the mesh resting on the ground plane between the feet.
2. Face the character toward runtime -Z.
3. Freeze object transforms without baking unwanted scale into animation tracks.
4. Record every required canonical bone name, hierarchy, rest transform, and semantic mapping in machine-readable metadata.
5. Remove unused deform bones only when all accepted clips still evaluate identically.
6. Limit weights to a measured maximum, normalize them, remove zero-weight groups, and inspect shoulders, hips, knees, hands, and feet under extreme poses.
7. Put first-person eye anchors at anatomically plausible eye height. Child/elder/body variation must update that anchor.
8. Separate optional hair, clothing, and equipment using shared material families and compatible skinning.
9. Confirm mesh bounds update correctly for animations; avoid a giant conservative bound that defeats culling.

### Age and identity variants

Generate controlled derivatives rather than combining unrelated character packs:

- proportion curves for child, adolescent, adult, older adult, and elder presentation;
- height/body variation within collision and doorway limits;
- skin and hair palette variation, including gradual greying and hair-loss options;
- occupation/climate clothing modules;
- posture and movement differences driven by age, health, injury, and fatigue.

Store variation parameters separately from a person's stable identity. A visual variant cannot change sex, age, health, occupation, or possessions in authoritative simulation state.

## Stage 4: animation preparation

1. Import source animation onto its native rig.
2. Inspect frame rate, clip range, looping intent, root translation/rotation, foot contact, hand contact, and scale.
3. Retarget through an explicit source-to-canonical bone map. Do not rely on approximate name matching in production.
4. Bake accepted motion to the canonical skeleton, then remove source constraints and helper rigs from the deliverable.
5. Prefer in-place locomotion because simulation/navigation owns world displacement. Preserve root-motion variants only for an explicitly documented cinematic use.
6. Trim dead frames, normalize loop boundaries, resample only when visual error is acceptable, and remove constant tracks.
7. Validate clips with child/adult/elder proportions and representative carried tools.
8. Export animation-only GLBs where practical so one skeleton/skin can share many selectively loaded clips.

Initial clip curation should be driven by implemented behavior, not library size. Idle, walk, run, sit/stand, carry/push/pickup, hammer/build, farm/dig/fish, social gesture, injury/lie, and death are useful only when those corresponding activities exist.

## Stage 5: materials and textures

- Convert materials to glTF-compatible metallic-roughness PBR.
- Prefer a coherent project palette and shared atlases over per-object materials.
- Resize to demonstrated screen need before compression. Do not ship a 4K or 8K source because it was available.
- Pack compatible grayscale channels only when the runtime material reads the same channel convention.
- Use color-space correctly: base color/emissive are color data; normal/roughness/metalness/occlusion are linear data.
- Remove unused alpha. Test cutout vegetation for overdraw and edge quality.
- Evaluate WebP for broad compatibility and KTX2/Basis for GPU efficiency. Keep a tested fallback strategy rather than assuming every client supports the same texture path.
- Record material merging, atlas generation, resizing, color grading, channel packing, and compression in `modifications`.

## Stage 6: LOD and instancing

Create LODs from the same visual family and compare silhouettes, UVs, normals, skin weights, and animation deformation.

Initial humanoid hypotheses:

- LOD0 selected/near: approximately 13k triangles if the source candidate matches its advertised average;
- LOD1 medium: approximately 4k–6k;
- LOD2 far: approximately 800–1,500, suitable for reduced skinning or an instanced animation technique;
- LOD3 orbital: below 200 triangles, impostor, or point representation.

Nature, buildings, props, goods, and vehicles also receive measured close/medium/far variants where their projected screen size warrants them. An LOD is accepted by visual and performance evidence, not triangle count alone.

For instanced families:

- keep mesh/material pairs identical;
- move palette/identity variation into compact instance data or atlas selections;
- avoid unique texture clones;
- preserve stable entity-to-instance mapping for selection;
- keep rendering-tier changes out of authoritative simulation.

## Stage 7: GLB export

Export one logical, lazy-loadable unit per file or bundle:

- selected base skin/skeleton;
- animation families;
- coherent prop/material families;
- building module families;
- vehicle families;
- region-specific nature where appropriate.

Blender export expectations:

- glTF 2.0 binary (`.glb`);
- selected objects only;
- +Y up/-Z forward as produced by the glTF exporter;
- no cameras or lights unless the asset explicitly requires and documents them;
- animations exported only for intended armatures/actions;
- custom properties only when the runtime consumes documented metadata;
- no absolute texture paths or external source references;
- deterministic object/action naming.

Export first to ignored `assets/generated/`, never directly over a reviewed runtime artifact.

## Stage 8: glTF optimization

The installed glTF Transform CLI and meshoptimizer are the intended reproducible optimization tools. Record their exact versions and the exact command in the asset-specific provenance note.

A typical starting point, to be adjusted after inspecting `gltf-transform optimize --help` for the pinned version, is:

```sh
npx gltf-transform optimize \
  assets/generated/source.glb \
  assets/generated/source.optimized.glb \
  --compress meshopt \
  --texture-compress webp
```

Do not blindly run a generic optimizer across animation, morph targets, collision metadata, or carefully shared materials. Confirm that the result preserves:

- skeleton hierarchy and inverse bind matrices;
- clip count, names, duration, loop boundaries, and contact poses;
- normals/tangents and UV seams;
- alpha mode and texture color space;
- node names or extras consumed at runtime;
- collision and assembly metadata;
- visual appearance at all LODs.

Useful operations include deduplication, pruning, welding where safe, animation resampling, meshopt compression, and texture conversion. Draco is not selected by default; compare decoder/download/runtime costs before adding another path.

## Stage 9: validation and promotion

Before moving a file into `assets/runtime/`:

1. Run Khronos glTF Validator when available; accept no unexplained errors.
2. Load the GLB in an isolated Three.js inspection scene.
3. Verify bounding boxes, physical dimensions, origin, axes, material count, triangle count, texture bytes, and draw calls.
4. Exercise every accepted clip and LOD transition.
5. Verify collision proxies, door openings, wheel pivots, hand grips, and seats where applicable.
6. Test the real application under root and configured base paths.
7. Test a missing/unloaded asset: simulation must continue and presentation must degrade safely.
8. Measure transfer size, decode time, GPU memory, frame rate, and draw calls in the target scenario.
9. Move only approved files to `assets/runtime/`.
10. Add exact byte counts and SHA-256 values to `manifest.json`, create the local license evidence, remove the candidate record, and run:

```sh
npm run assets:validate
npm run typecheck
npm run build
```

The first external asset is not incorporated until all three documents—the runtime file, manifest record, and asset-specific license evidence—land together and validation passes.
