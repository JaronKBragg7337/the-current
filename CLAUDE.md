# The Current agent instructions

Read and follow `AGENTS.md` before making changes. Its architectural constraints, required checks, and CI policy apply to Claude sessions as well.

## CI rule that must not be bypassed

`Lint, test, build, and simulate` plus the desktop and mobile browser smoke checks are required release gates. The extended desktop Three.js suite is manual diagnostic coverage, not a deployment blocker: it can starve a constrained GitHub software-WebGL runner even when the application is healthy.

If only that manual suite fails, inspect the Action logs and retained artifacts before changing code. Do not repeatedly alter simulation logic, renderer behavior, test interactions, or timeouts merely to make it pass. Treat it as a product regression only when the smoke or quality gates provide supporting evidence.

When the user explicitly asks for delivery, run relevant checks, open a focused ready-for-review PR (never a draft), wait for required CI, merge it, and verify the post-merge deployment.
