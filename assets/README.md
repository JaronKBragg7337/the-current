# Asset pipeline

This directory is the provenance boundary between external source material and The Current's runtime. No downloaded pack or external runtime binary has been incorporated. It now also contains a separately inventoried, project-authored Blender/GLB kit.

## Files and directories

| Path | Commit? | Purpose |
| --- | --- | --- |
| `manifest.json` | Yes | External assets actually incorporated and redistributed at runtime. It is intentionally empty today. |
| `project-assets.json` | Yes | Project-authored source/runtime files, hashes, tools, roots, and transformations. |
| `manifest.schema.json` | Yes | JSON Schema draft 2020-12 contract for incorporated records. |
| `source-catalog.json` | Yes | Research candidates only. Every current entry is not downloaded and not incorporated. |
| `source-catalog.schema.json` | Yes | Schema that prevents research records from claiming download/incorporation state. |
| `PIPELINE.md` | Yes | Canonical Blender/glTF normalization and verification procedure. |
| `licenses/` | Yes, once created | Asset-specific license/provenance evidence for incorporated assets. A generic license file is not enough. |
| `runtime/` | Yes, selected files only | Optimized derivatives listed in either the external manifest or project-authored inventory. |
| `source/` | Yes, selected files only | Reasonably sized project-authored Blender sources; never a holding area for downloaded packs. |
| `source-cache/` | **No** | Ignored local original archives and source packages. |
| `work/` | **No** | Ignored editable/intermediate Blender and conversion work. |
| `generated/` | **No** | Ignored unreviewed generated output awaiting validation and promotion. |

The repository `.gitignore` already excludes the three local working directories. Do not defeat those rules to make a download convenient.

## Status model

A source exists in exactly one operational state:

1. **Research candidate:** listed in `source-catalog.json` with `status: candidate-not-downloaded`, null acquisition fields, and no runtime files.
2. **Locally evaluating:** archive is in ignored `source-cache/`; the catalog remains unchanged while evaluation is private and no derivative is committed or loaded.
3. **Incorporated:** candidate record is removed; a complete `manifest.json` entry, local license evidence, and hashed files under `runtime/` are committed together.
4. **Removed:** runtime references and files are removed in a forward commit, along with the active manifest entry; the reason is documented.

There is no “downloaded candidate with untracked provenance” state in committed metadata.

## Validate

From the repository root:

```sh
npm run assets:validate
```

On Node 24 or newer, the no-dependency validator can also run directly:

```sh
node scripts/validate-assets.ts
```

The validator uses only Node built-ins. It checks the high-value invariants that do not require loading a JSON Schema package:

- both JSON schemas and metadata files parse;
- fixed schema versions, canonical units, axes, and character root;
- unique kebab-case IDs and HTTPS evidence/source URLs;
- approved SPDX identifiers and redistribution permission;
- candidate records cannot claim download or incorporation state;
- a source cannot remain a candidate after becoming incorporated;
- incorporated license-evidence and runtime files exist;
- runtime byte counts and SHA-256 values match;
- locally present source-cache archives match their manifest SHA-256 and byte count;
- runtime paths remain under `assets/runtime/` and license evidence under `assets/licenses/`.

The JSON Schemas remain the complete structural contracts. A future CI job may add standards-compliant JSON Schema validation, but the repository does not add a dependency for that today.

## Acquire a candidate safely

1. Demonstrate a visual or simulation-facing need and set triangle, texture, draw-call, and transfer budgets.
2. Recheck the official landing page, exact item page, and license on the day of download. Avoid mirrors when a creator source exists.
3. Download manually to `assets/source-cache/<source-id>/`. Do not automate around itch sessions, store cookies, or commit signed download URLs.
4. Capture exact archive filename, byte size, and SHA-256 before extraction.
5. Save the archive's included license/README and record any discrepancy from the website.
6. Inventory selected files before conversion. Do not process an entire mega-pack because one prop is useful.
7. Follow [`PIPELINE.md`](./PIPELINE.md), placing review output in ignored `generated/`.
8. Inspect scale, materials, normals, animation contacts, pivots, LODs, collision, and application behavior.
9. Promote only approved derivatives to `runtime/`, create an asset-specific note in `licenses/`, and add one manifest entry per archive or item-license scope.
10. Remove the candidate record, validate, test the application, and commit provenance with the bytes.

For manual SHA-256 inspection in PowerShell:

```powershell
Get-FileHash -Algorithm SHA256 -LiteralPath 'assets/source-cache/source-id/archive.zip'
```

The manifest stores lowercase hexadecimal hashes. The validator recomputes them for committed runtime files and any optional local archive it finds.

## Manifest rules

- `source.downloadUrl` identifies the exact acquisition endpoint or stable official download page; it must not contain credentials or expiring secrets.
- `license.localEvidenceFile` is asset-specific and must connect official/included evidence to the archive hash.
- `acquisition.localCachePath` points into ignored `assets/source-cache/`. Its absence on another developer's machine is valid; if present, it must hash correctly.
- `selectedSourceFiles` uses archive-internal forward-slash paths.
- `modifications` describes real transformations such as retargeting, atlas creation, LOD generation, texture resizing, pivot correction, or mesh separation.
- `toolVersions` pins exact versions that materially affected output.
- `runtimeFiles` contains every redistributed derivative, its byte count, SHA-256, and role.
- Attribution text is mandatory when `attributionRequired` is true. For CC0, it is normally null, while creator/source data remains mandatory.

## Runtime integration

`assets/runtime/` is the committed canonical library, not permission to eagerly download everything. Application code should reference selected files through base-aware URLs or imports that work under `/`, `/the-current/`, and `/worlds/the-current/`. Region, character, and animation bundles should be lazy-loaded according to camera and presentation needs. Simulation state must continue headlessly when none of these files is available or rendered.

Procedural terrain, roads, building assembly, construction stages, and collision remain project-authored even after visual modules are incorporated. An external facade cannot become navigation authority.
