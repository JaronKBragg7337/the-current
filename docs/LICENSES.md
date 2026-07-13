# License inventory and provenance policy

Last reviewed: 2026-07-13

This document separates software licensing, incorporated asset licensing, and candidate-source research. A source appearing here does **not** mean its files are present in the repository.

## Current license state

- The Current source code is released under the repository's [MIT License](../LICENSE).
- **Incorporated external assets: none.** [`assets/manifest.json`](../assets/manifest.json) has an empty `externalAssets` array.
- **Redistributed external runtime files: none.** No candidate archive or derivative is committed under `assets/runtime/`.
- **Research candidates: 28, all not downloaded.** They are tracked separately in [`assets/source-catalog.json`](../assets/source-catalog.json).
- Procedural runtime geometry authored in this repository is part of The Current's MIT-licensed source/output unless a future file explicitly documents another origin.

The validator rejects a candidate that claims to be incorporated, has a download date or archive hash, contains runtime files, duplicates an incorporated ID, or uses a license outside the reviewed runtime allowlist.

## Incorporated asset inventory

There are no incorporated external assets at this checkpoint, so there are no asset-specific attribution notices or redistribution restrictions to display.

When the first external asset is incorporated, its manifest entry must contain:

- name and creator;
- official homepage and exact acquisition URL;
- SPDX identifier and human-readable license name;
- official license-proof URL and a committed local evidence file;
- whether attribution is required and the exact attribution text if it is;
- whether redistribution is allowed and any restrictions;
- download date, original archive filename, byte count, and SHA-256;
- selected source files, modifications, canonicalization decisions, and exact tool versions;
- every committed runtime file, byte count, role, and SHA-256.

## Candidate-source license research

All sources in this section remain research candidates. The license conclusion must be reconfirmed against the downloaded archive or individual item before incorporation.

### CC0 pack ecosystems

| Source family | Official license evidence | Research conclusion | Attribution/redistribution note |
| --- | --- | --- | --- |
| Quaternius | Each official pack page, for example [Universal Base Characters](https://quaternius.com/packs/universalbasecharacters.html) and [Universal Animation Library](https://quaternius.com/packs/universalanimationlibrary.html) | Relevant researched packs are labeled CC0 | Attribution not required; keep creator/source records anyway; do not mirror entire archives without purpose |
| KayKit by Kay Lousberg | Official creator pages, for example [Character Animations](https://kaylousberg.com/game-assets/character-animations) and [RPG Tools](https://kaylousberg.com/game-assets/rpg-tools) | Relevant researched packs are labeled CC0 | Attribution not required; creator asks users not to resell unmodified packs or claim authorship, which this project will honor |
| Kenney | [Official support/license page](https://kenney.nl/support) | Asset-page game assets are stated to be CC0/public domain | Commercial use and redistribution allowed; attribution optional; do not use Kenney's logo as if it endorsed the project |
| ambientCG | [Official license documentation](https://docs.ambientcg.com/license/) | Downloadable asset files and preview renders are CC0 | Commercial use, modification, and raw inclusion allowed; exact selected asset still receives its own record |
| The Base Mesh | [Official FAQ](https://www.thebasemesh.com/faq) | Library is described as CC0 | Commercial use and no attribution; preserve item-level creator/source evidence and avoid unnecessary bulk import |
| @pmndrs/assets | [Official repository](https://github.com/pmndrs/assets) | Repository describes its content as CC0 | Pin the commit and retain upstream provenance for selected derivatives |

CC0 removes the legal attribution requirement; it does not remove the project's provenance requirement. The Current records names, creators, source URLs, license proof, dates, hashes, and transformations for auditability and respect.

### Poly Haven scope boundary

[Poly Haven's official license page](https://polyhaven.com/license) places its downloadable HDRIs, textures, and 3D models under CC0. It explicitly allows raw redistribution. Website copy, thumbnails, and metadata are outside that asset grant and must not be copied as if they were CC0 assets.

[Poly Haven's API page](https://polyhaven.com/our-api) describes separate conditions for API use, including a commercial-use boundary. The asset license and API access conditions are different issues. The Current's proposed approach is manual or otherwise license-compliant build-time acquisition of a small pinned selection; the application will not call the API at runtime.

### MakeHuman and MPFB scope boundary

- [MakeHuman licensing overview](https://static.makehumancommunity.org/about/license.html): graphical core assets are CC0; MakeHuman software is AGPL; MPFB software is GPL.
- [Exported-model FAQ](https://static.makehumancommunity.org/makehuman/faq/can_i_sell_models_created_with_makehuman.html): exported models are documented as CC0 and may be modified and redistributed.
- [Asset-pack catalog](https://static.makehumancommunity.org/assets/assetpacks.html): community clothing, hair, and other packs can use different licenses, including attribution licenses.

Using GPL/AGPL software as an offline tool does not automatically impose that software license on documented CC0 output. However, every non-core input asset must be reviewed separately. A future MPFB experiment must record the exact Blender, MPFB, MakeHuman, body, rig, clothing, hair, target, and material inputs used.

### Smithsonian Open Access scope boundary

[Smithsonian Open Access guidance](https://www.si.edu/openaccess/faq) permits broad reuse of content specifically designated CC0. The designation is item-specific. Only a 3D object's own CC0-marked page is sufficient evidence; a collection landing page alone is not. Collection, creator, title, catalog identifier, item URL, and any contextual note must remain in the provenance record even when legal attribution is not required.

### Attribution-license policy

`CC-BY-4.0` is in the manifest's reviewed runtime allowlist, but no CC-BY asset is incorporated. Before accepting one, the project must document:

1. the exact required attribution wording;
2. where the attribution appears in the running application and repository;
3. whether derivatives must be identified;
4. whether the source's additional site terms conflict with public redistribution;
5. how the attribution remains attached if an asset is copied into a lazy-loaded bundle.

An SPDX identifier appearing in the allowlist is not automatic approval of a particular download. Item and site terms still require review.

## Software library and tool boundary

Software packages are not external art assets and do not belong in `assets/manifest.json`. Their license texts remain in their installed packages and upstream repositories. The following are especially relevant to the asset pipeline:

| Tool or library | License family | Role and boundary |
| --- | --- | --- |
| [Blender](https://www.blender.org/about/license/) | GNU GPL | Offline conversion, retargeting, LOD, collision, atlas, and GLB export; project-authored or permissively licensed outputs remain governed by their inputs, not automatically by Blender's GPL |
| [glTF Transform](https://github.com/donmccurdy/glTF-Transform) | MIT | Deterministic glTF pruning, deduplication, optimization, and compression |
| [meshoptimizer](https://github.com/zeux/meshoptimizer) | MIT | Geometry and meshopt compression pipeline/runtime support |
| [Three.js](https://github.com/mrdoob/three.js) | MIT | Runtime rendering and glTF consumption |
| [Khronos glTF Validator](https://github.com/KhronosGroup/glTF-Validator) | Apache-2.0 | Structural validation of generated glTF/GLB files when installed in CI/tooling |
| [Mesh2Motion](https://github.com/Mesh2Motion) | MIT application code; included art/animations described as CC0 | Optional interactive rig/retarget QA, not pipeline authority; Blender headless output remains the reproducible path |

The complete JavaScript dependency inventory is governed by exact package metadata and the lockfile. It should be audited with a package-license scanner before release; this asset document does not substitute for that audit.

## Sources not approved for initial incorporation

These exclusions are conservative public-repository decisions, not allegations about the providers.

| Source | Reason not approved |
| --- | --- |
| Mixamo | [Adobe's FAQ permits game use](https://helpx.adobe.com/creative-cloud/faq/mixamo-faq.html), but Adobe licensing guidance prohibits distributing raw character/animation files. Separable GLBs in a public repository are therefore unsuitable. |
| BlenderKit | [License documentation](https://www.blenderkit.com/docs/licenses/) and marketplace terms include separable-redistribution limitations that complicate inspectable runtime asset delivery. |
| Ready Player Me and avatar SaaS platforms | Proprietary/platform terms and service coupling conflict with offline, deterministic, openly inspectable asset requirements. |
| Unity Asset Store, Unreal Marketplace, and similar commercial stores | Licenses commonly allow use in a product but prohibit redistribution of raw or separable source/runtime files. |
| Sketchfab, OpenGameArt, and Poly Pizza as bulk libraries | Item licenses vary. Poly Pizza also prohibits automated scraping. Only a uniquely valuable, individually verified item could be reconsidered. |
| MB-Lab | Export and bundled-asset provenance is less clearly documented for this use than MakeHuman/MPFB's explicit CC0 export guidance. |

## License evidence storage

For an incorporated external asset, create an asset-specific evidence file under `assets/licenses/`, for example `assets/licenses/quaternius-universal-base-characters.md`. It should record:

- the license text or the relevant included notice without exceeding source copyright limits;
- the official proof URL and the date checked;
- the exact archive hash to which the evidence applies;
- creator and pack/item identifiers;
- attribution wording, if required;
- any website/API conditions that are separate from redistribution rights;
- the reviewer and unresolved questions.

The manifest validator requires this local evidence file to exist. A generic CC0 text without a connection to the acquired archive is insufficient provenance.

## Removal and replacement

If a license is unclear, a source disappears, provenance cannot be reconstructed, or a redistribution restriction conflicts with the repository:

1. stop adding new derivatives;
2. remove runtime references and committed derivative files in a normal forward commit;
3. remove the incorporated manifest entry;
4. retain an appropriate historical explanation without retaining prohibited bytes;
5. replace the asset with project-authored geometry or a verified source;
6. re-run asset validation, build, and browser tests.

Useful Git history must not be rewritten merely to hide an ordinary replacement. Legal removal requests require repository-owner review because public Git history and released bundles may need coordinated handling.
