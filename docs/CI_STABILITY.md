# CI stability note

The desktop Chromium suite runs under software WebGL on GitHub-hosted Linux runners. Panels that are conditionally unmounted are asserted by DOM count. Mounted side panels are closed through the application's documented Escape keyboard control and then checked through their native `hidden` attribute. This avoids accessibility-tree and repeated-pointer polling that can stall even after the interface itself is responsive.
