# Development

## Requirements

- Node.js 24 LTS or newer compatible release
- npm 11
- A browser with WebGL2 and module-worker support
- Optional: Blender 5.x for asset conversion
- Optional: Git LFS for future large runtime binaries

## Install and run

```powershell
npm ci
npm run dev
```

Open the URL printed by Vite. The application must work without a network connection after its own files load; live information adapters are optional build/server tools.

### Running from an NTFS cache

Google Drive and some other synchronized/virtual filesystems can create zero-byte or partially extracted files during `npm ci`. Symptoms include `TAR_ENTRY_ERROR`, `EBADF`, a missing `node_modules/.bin` command, or a package file such as `typescript/lib/tsc.js` having length zero. Keep the Git repository on the synchronized drive, but install and execute from a filtered NTFS mirror:

```powershell
# Development server (the default task)
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\run-from-local-cache.ps1

# Unit tests
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\run-from-local-cache.ps1 -Script test

# Production build
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\run-from-local-cache.ps1 -Script build
```

The default cache root is `$env:LOCALAPPDATA\Codex\project-cache`. Override it only with another directory on a ready NTFS volume:

```powershell
.\scripts\run-from-local-cache.ps1 -CacheRoot 'D:\LocalProjectCache' -Script typecheck
```

Preview the resolved source/cache paths and install decision without writing, purging, installing, or running npm:

```powershell
.\scripts\run-from-local-cache.ps1 -Script build -DryRun
```

The runner derives a collision-resistant cache key from the package name and source path, records only the source-path hash, verifies that the purge target is a managed `workspace` beneath the configured cache root, and then uses filtered `robocopy /MIR`. It never mirrors `.git`, `node_modules`, build/test output, browser state, `.env` files, credentials, raw data/save caches, or raw asset work. File names are suppressed from sync output. `npm ci` runs only when the source `package-lock.json` hash changes or the cached `node_modules` directory is absent; the requested allowlisted npm task then runs from the cache and its exit code is returned unchanged.

Do not put credentials in package scripts or tracked source. The filter is a defense-in-depth boundary, not permission to store secrets in the repository. If Node itself or a native dependency changes without a lockfile change, use a new `-ProjectKey` or safely remove that managed cache instance so the next run performs a clean install.

## Useful commands

```powershell
npm run lint
npm run typecheck
npm run test
npm run test:coverage
npm run build
npm run preview
npm run sim:150
npm run sim:long
npm run data:ingest
npm run assets:validate
npm run test:e2e
```

Headless runs write ignored reports beneath `benchmarks/results/`. Curated verification summaries may be force-added only when they contain no private paths or machine data.

## Coding expectations

Use pure functions in the simulation where practical, exhaustive discriminated unions at commands/events, stable ordering before seeded choices, and explicit units. Keep UI state out of snapshots. Validate untrusted save files, external data, and worker commands at their boundaries.

When changing rules, add or update deterministic tests and explain intentional digest changes in `docs/DECISIONS.md`. When changing presentation, verify both a desktop and narrow viewport and ensure every living person remains inspectable even when its current representation is a far tier.
