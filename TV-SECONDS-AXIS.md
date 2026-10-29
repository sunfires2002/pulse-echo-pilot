# TV PULSE seconds axis (2026-10-29)

Base: `6473597f5074b68d4b0a7b2080e8c058cf359dc3`.
Branch: `codex/tv-seconds-axis`. No main merge or deployment.

## Runtime changes

- Standalone TV (`tv-mode` without `lab-mode`) uses a linear Chart.js x scale from zero to YouTube `getDuration()` seconds. Minute aggregation stays local to the existing chart rendering; stored reactions are not changed.
- Each complete minute is plotted at its midpoint (30, 90, … seconds). The last partial minute is plotted at the midpoint of its available interval, inside the video endpoint. TV now displays all minute bins, including those after minute 30. Invalid/out-of-video reaction timestamps are excluded from this chart only.
- TV playback marker and clicks use that exact scale's `getPixelForValue` / `getValueForPixel`. Canvas scaling, borders and chart margins are accounted for. Clicks outside the plot do not seek. The former automatic ten-second rewind was removed so a click seeks to the selected whole second; the target is capped before the video endpoint to keep playback possible.
- Playback completion places the marker at the right endpoint. The marker keeps its existing appearance; there is no TV drag knob or free-layout UI addition.
- Until valid metadata arrives, TV has no reaction points, x tick labels or playback line, and does not accept map seeks. Loading another video invalidates the previous duration before `loadVideoById`. Player metadata must match the selected video. Player ready/state hooks and subsequent polling refresh duration; PC/TV mode events rebuild the chart in the new coordinate system.
- Other modes retain their existing chart branches. The script cache versions were incremented so the TV fix is not mixed with the old loader.
- No styles, production config/data, Supabase operations, keyboard handling, home navigation, PC layout storage, or independent LABO files were changed.

## Browser verification

Chrome with an AFTMM/Silk-equivalent UA at 1280×720, local HTTP. Tests replace config with an empty object, use browser-only public-video/sample-reaction fixtures, and block and record all Supabase requests. No requests to Supabase occurred.

Real YouTube playback was confirmed after every map click, then paused for measurements. These are API-reported durations in this run, which can change slightly between player states:

| Video ID | Duration (seconds) | Start / middle / near-end seek targets | Measured playback-line error |
| --- | ---: | --- | ---: |
| Mx5IiSYW7T8 | 1389 | 0 / 694 / 1381 | <0.02 px |
| dSIO3AdVRIs | 1640.041 | 0 / 819 / 1630 | <0.02 px |
| l3QQQu7QLoM | 3677.601 | 0 / 1837 / 3656 | <0.02 px |

The last video is NASA Goddard's public *A Decade of Sun*; it was used only in the test browser, not added to app data. Source: https://svs.gsfc.nasa.gov/13641 . Reaction at 61 seconds remains in the 1:00–1:59 bin at x=90; minute counts and points beyond minute 30 were checked using sample reactions. YouTube time measured after playback settled and pause was approximately 0.54–0.75 seconds after each seek target, including deliberate playback before measurement. This is not a frame-accuracy claim.

`tests/tv-seconds-axis.cjs` uses real Chart.js with a controlled player API (not real YouTube) for durations 1205/1800/2705 seconds. It checks unknown metadata, exact midpoint relationships, right endpoint on ended state, partial final bins, post-30-minute reactions, coordinate conversion, and stale metadata during video switch. Maximum measured marker rounding error is under 0.1 px.

`tests/pc-video-controls.cjs` passed at 1280×720, 1920×1080 and 2500×928: play/pause, click/drag PC seek, volume/mute, fullscreen/Esc, video-only view, PC↔TV while playing/stopped, layout preservation, docking/reload/restore/split and four icons. A further 1280×720 run explicitly measured TV scale after both switches: maximum equals current API duration and marker error <0.16 px. Paused player recreation can report YouTube state -1; time, stopped state, volume/mute and subsequent resume were retained.

Baseline/current browser comparisons passed for iPhone 13, Pixel 7, iPad Mini portrait/landscape, Silk TV and desktop TV: existing player controls and layout geometry match. These are Chrome emulations, not physical devices. TV axis contents intentionally differ.

## Reproduction

Serve this checkout over local HTTP on port 8027. With Node, Playwright and system Chrome available, set:

- `TV_TEST_URL=http://127.0.0.1:8027/` (optional default)
- `TV_EVIDENCE_DIR` to an existing or creatable evidence directory

Run `node tests/tv-seconds-axis.cjs` and `node tests/tv-seconds-youtube.cjs`. For full PC regression, set `PC_VIDEO_TEST_URL` and `PC_VIDEO_EVIDENCE_DIR`, then run `node tests/pc-video-controls.cjs`. `PC_VIDEO_ONE=1` selects the 1280×720-only run. Screenshots and JSON measurements are written only to the specified evidence directory. All contexts are isolated and do not touch the user's saved browser configuration.

## Limits

Fire TV hardware, Silk's actual engine and remote, iOS Safari and Android hardware are not tested. TV remote event handlers were not changed. Live streams with indefinite/changing length and unavailable/restricted videos are not covered; no map seek is enabled until the API supplies a valid duration. No production write/delete/post was exercised. No public deployment was performed.
