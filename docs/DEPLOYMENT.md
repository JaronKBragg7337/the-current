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

The verified public preview is <https://jaronkbragg7337.github.io/the-current/>. Quality, desktop Chromium, Pixel 7 Chromium, and deployment all passed in [workflow run 29243877756](https://github.com/JaronKBragg7337/the-current/actions/runs/29243877756); a separate post-deploy WebGL smoke also passed against that origin.

## Shared authoritative engine promotion

GitHub Pages publishes the spectator client, but it does not redeploy the Supabase `the-current-tick` function. That function imports the simulation from an exact merged GitHub commit so the shared world's authority cannot silently change with a branch or dependency update. After merging simulation-rule changes:

1. create a focused follow-up branch from `main` and update the function's engine URL to the resulting `main` commit SHA;
2. open a ready, non-draft PR, pass CI, and merge it;
3. from an authenticated Supabase CLI, inspect the existing function and deploy with `supabase functions deploy the-current-tick --project-ref ygjpnvrwhkrowkrskftk --use-api` without changing its JWT policy; and
4. verify that the next persisted shared-world snapshot reports the promoted engine version and that the private entropy audit received the same day.

Never pin an unmerged feature-branch SHA, float the simulation import, or assume a Pages deployment updated the shared authority. The engine `0.2.0` environmental promotion is pinned to merged commit `d471ed804c4ad18f01df04837524826f2c4276c1`; the Supabase client import is also version-pinned for repeatable function bundles.

## Persistence and live data

Static hosting retains local IndexedDB saves per origin. A future shared public world needs a separately authenticated synchronization service with server-authoritative event ordering; do not mistake local browser persistence for multi-viewer consensus.

Credentialed or User-Agent-sensitive information sources should be fetched by scheduled infrastructure, normalized, signed/versioned, and published as same-origin snapshots. The browser must never receive private provider credentials.
