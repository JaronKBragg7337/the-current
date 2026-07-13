# Deployment

The Current is a standalone static application. It does not need to share source code or build tooling with Heartbeat Observatory.

## Root deployment

```powershell
npm run build
```

## Heartbeat Observatory route

```powershell
npm run build:heartbeat
```

The resulting `dist/` expects `/worlds/the-current/`. Heartbeat Observatory can serve those immutable files directly, mount an independently deployed origin behind that path, or embed an isolated deployment. Cache HTML briefly and hashed JS/assets for a long duration.

## GitHub Pages preview

```powershell
npm run build:github
```

This produces a build rooted at `/the-current/`. The committed GitHub Actions workflow publishes the same command when Pages is enabled.

## Persistence and live data

Static hosting retains local IndexedDB saves per origin. A future shared public world needs a separately authenticated synchronization service with server-authoritative event ordering; do not mistake local browser persistence for multi-viewer consensus.

Credentialed or User-Agent-sensitive information sources should be fetched by scheduled infrastructure, normalized, signed/versioned, and published as same-origin snapshots. The browser must never receive private provider credentials.
