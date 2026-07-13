# CI stability note

The desktop Chromium suite runs under software WebGL on GitHub-hosted Linux runners. Panels that are conditionally unmounted are asserted by DOM count, while panels intentionally kept mounted are asserted through their native `hidden` property. This avoids accessibility-tree visibility polling that can stall after the UI has already closed correctly.

For mounted sidebars, CI verifies that the floating close control is present and accessible, then closes through the same stable top-bar toggle that opened the panel. This isolates panel-state verification from software-rendered floating-control pointer timing without weakening the world, persistence, or signal assertions.
