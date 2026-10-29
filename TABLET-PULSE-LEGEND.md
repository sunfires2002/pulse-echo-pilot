# Tablet PULSE legend sizing (2026-10-30)

Base main: `6473597f5074b68d4b0a7b2080e8c058cf359dc3`.
Branch: `codex/tablet-pulse-legend`. No main merge or deployment.

## Change

The existing device classification now marks non-TV mobile/touch-device views with `html.pulse-touch-view`. It does not change the desktop/TV startup guards or load PC modules on mobile.

For these views only, above 640px width and 500px height, the chart's grid/panel/wrapper can shrink (`min-width:0`). This lets Chart.js's existing ResizeObserver resize the canvas after rotation. No additional resize listener, chart reinitialization or time-axis change is needed.

In landscape above 1100px width and 500px height, the chart wrapper uses the existing tablet height of 220px instead of falling back to 120px. Three legend rows now have 76px of layout space; the last item ends at 66px, safely inside it. The plot itself has 115.6px height instead of 31.6px. The x-axis fits within the canvas.

The selectors additionally exclude `.tv-mode` and `.lab-mode`. Desktop classification, desktop layout/storage, all reaction aggregation/post/delete code, TV map/time-axis/remote handlers and mobile landscape's video-priority rules are unchanged. Cache versions for the viewing page's stylesheet and device loader were updated.

## Browser verification

`tests/tablet-pulse-legend.cjs` uses real Chart.js in Chrome, with Android tablet/iPad/Silk-equivalent UA and touch emulation. Config and YouTube API loading are intercepted only inside isolated test contexts; synthetic reactions are browser-only. Every Supabase request is blocked and recorded; there were zero requests and zero page errors. These are rendered layout checks, not physical Android/iPad/Silk/Safari tests or video playback checks.

| Case | Result |
| --- | --- |
| Android 1024×640 | 220px canvas, 159.6px plot; complete legend/x-axis; no horizontal overflow |
| Android 1280×800 / 1280×720 | 220px canvas, 115.6px plot; complete three-row legend/x-axis; no horizontal overflow |
| iPad 1024×768 | 220px canvas, 159.6px plot; complete legend/x-axis |
| iPad 1180×820 / 1366×1024 | 220px canvas, 115.6px plot; complete three-row legend/x-axis |
| Phone landscape 844×390 | PULSE remains hidden under the existing video-priority layout; geometry matches main |
| PC 1280×800 | Layout and default saved-layout value match main |
| Silk-equivalent TV 1280×720 | Map, legend arrangement, video/control geometry match main; no TV-axis changes |
| Width boundary 1100 / 1101 | Both retain a 220px canvas; the last legend and x-axis fit |
| Height 500px | Existing landscape layout still hides PULSE, matching main |

Three portrait→landscape→portrait cycles passed with complete legend/x-axis on every step, no horizontal overflow and no panel outside the page:

- Android 800×1280 → 1280×800 → 800×1280: canvas width 734 → 308.6 → 734px; page width stays 800 → 1280 → 800px.
- iPad 768×1024 → 1024×768 → 768×1024: canvas width 702 → 958 → 702px.
- iPad Pro 1024×1366 → 1366×1024 → 1024×1366: canvas width 958 → 308.6 → 958px.

The same test loads main's original files and asserts that its 120px canvas clips the final legend. This confirms reproduction before the fix. It also compares PC, TV and hidden phone geometry directly against main.

The existing PC video-controls browser regression also passed at 1280×720 with real YouTube: play/pause, click/knob seek, volume/mute, fullscreen/Esc, video-only/return, playing and stopped PC↔TV round trips, preserved time/audio/layout, docking/reload/restore/split and four icons. The first run timed out waiting for YouTube; an evidence-only copy with a 60-second ready timeout completed. No product workaround was added. Supabase requests were blocked and the recorded request list remained empty.

## Reproduction and evidence

Serve this checkout over local HTTP. Set `TABLET_TEST_URL` (default `http://127.0.0.1:8031/`) and `TABLET_EVIDENCE_DIR`, then run `node tests/tablet-pulse-legend.cjs` with Playwright and system Chrome available. It writes JSON measurements, before/after panels and device/rotation screenshots to the evidence directory.

Evidence for this run is under the task's `tablet-pulse-fix` artifact directory. User browser profiles and saved panel settings were not used. Independent LABO and `codex/tv-seconds-axis` were not modified.

Physical tablet orientation changes, native browser address bars and Safari/Fire TV hardware remain untested. The existing rule at height 500px or less is deliberately retained. No public deployment was performed.
