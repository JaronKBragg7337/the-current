# The Current

The Current is an autonomous, deterministic civilization simulation presented as a Three.js spectator world. Its inhabitants make their own decisions; observers may inspect history, move between orbital and NPC viewpoints, and introduce limited pressures without taking control of anyone.

This repository is intentionally independent from Heartbeat Observatory. It is designed to deploy either at its own origin or beneath `/worlds/the-current/` through a configurable base path.

## Status

Active initial implementation. The authoritative specification is committed in [`docs/MASTER_SPECIFICATION.md`](docs/MASTER_SPECIFICATION.md). Verified setup, controls, architecture, tests, performance results, and current limitations will be maintained here as working systems land.

## Safety

Do not commit credentials, tokens, browser profiles, local simulation saves, or raw source-asset caches. See `.gitignore` and `SECURITY.md`.

## License

Source code is MIT licensed. External runtime assets, if any, retain their own licenses and are recorded in the asset manifests and license inventory.

