# The Current agent instructions

Read and follow `AGENTS.md` before making changes. Its architectural constraints, required checks, and CI policy apply to Claude sessions as well.

## Observe the owner's live world, not a new one

Working with the owner means observing the owner's existing live shared world.
It is the default for `npm run dev` and for production alike. Never create a
fresh local world and treat it as the real one; a day-0 private world is not
this project's world, and a session spent reviewing one reports on nothing.

`?world=local` (alias `?world=new`) exists only for an outsider forking a
private world of their own, and for the browser suite, which opts in
explicitly. Before drawing any conclusion about world state, confirm the top bar
shows the **`LIVE — ONE SHARED WORLD`** badge and that the world day matches the
deployed site at <https://jaronkbragg7337.github.io/the-current/>. A
`Private fork — not the shared world` badge, or a disagreeing day, means stop
and fix that first. See AGENTS.md for the full rule.

Time is a property of the world: every world advances one world day per real
day and has no pause, speed, or manual-advance control. Do not add one.

## CI rule that must not be bypassed

`Lint, test, build, and simulate` plus the desktop and mobile browser smoke checks are required release gates. The extended desktop Three.js suite is manual diagnostic coverage, not a deployment blocker: it can starve a constrained GitHub software-WebGL runner even when the application is healthy.

If only that manual suite fails, inspect the Action logs and retained artifacts before changing code. Do not repeatedly alter simulation logic, renderer behavior, test interactions, or timeouts merely to make it pass. Treat it as a product regression only when the smoke or quality gates provide supporting evidence.

When the user explicitly asks for delivery, run relevant checks, open a focused ready-for-review PR (never a draft), wait for required CI, merge it, and verify the post-merge deployment.
