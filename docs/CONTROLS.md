# Spectator controls

The observer has no avatar and cannot steer NPCs.

## Time is not a control

Every world advances one world day per real day, measured from its own genesis.
There is no pause, no speed selector, and no manual day advance — in the shared
world or in a private fork. The top bar reports the world day and its 24-hour
time of day; it does not offer a way to change either.

## Desktop

- Left drag: orbit around the current target.
- Right drag or Shift + left drag: pan in orbital mode.
- Wheel: smooth zoom between world and street scales.
- Click: select an NPC, building, or vehicle.
- Double-click an NPC: enter standard third-person follow.
- `1`: orbital view.
- `2`: third-person follow for the selected NPC.
- `3`: first-person view through the selected NPC.
- `Escape`: dismiss the active details or information panel without cancelling an active follow or first-person view.
- `H`: toggle the interface.

## Touch

- One-finger drag: orbit.
- Two-finger drag: pan in orbital mode.
- Pinch: zoom.
- Tap: select.
- Camera-mode buttons replace camera keyboard shortcuts.
- History, Influence, Signals, and System remain available in the compact world toolbar.
- Details in the camera dock reopens the selected entity card after it has been dismissed.

Orbital panning keeps the chosen roaming target until a camera-mode transition. Camera modes are observational. In follow and first-person views the person continues its autonomous task and route, and dismissing the details card does not cancel the view.
