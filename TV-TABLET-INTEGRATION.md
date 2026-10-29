# TV seconds axis + tablet PULSE integration (2026-10-30)

Base main: `6473597f5074b68d4b0a7b2080e8c058cf359dc3`.
Merged in order on `codex/integrate-tv-tablet-fixes`:

1. `codex/tv-seconds-axis` / `c09bd1b0ba246a29a59d243fa5c5456f2e9662bb`
2. `codex/tablet-pulse-legend` / `1af5b4a218c29caea9517cc5fc9a725ab8bf865f`

## Integration adjustments

Only match.html's asset-version line conflicted. It now uses style.css `1.0.3` and pc-desktop.js `1.2.9`. The loader retains both tablet view classification and TV script version `1.2.4`. TV source and tablet stylesheet match their approved branch versions. Existing PC player controls/layout scripts, TV styles, home navigation, production config/data and profile code are unchanged.

The tablet test now compares TV layout geometry separately from chart contents, since TV seconds-axis contents intentionally differ from the old main. The YouTube test explicitly checks the 34:30 reaction bin for the 61-minute video. A home-cycle test checks same/different match round trips and normal-home links. These are test-only changes, not product behavior additions.

## Pre-publication verification

All suites passed against the combined local checkout:

- TV controlled metadata: 1205/1800/2705 seconds, unknown duration and stale metadata guards, minute bins beyond 30, plot-based clicks, shared conversions and ended-state right endpoint.
- Real YouTube with Silk-equivalent UA / 1280×720: videos Mx5IiSYW7T8 (1389s), dSIO3AdVRIs (1640.041s), l3QQQu7QLoM (3677.601s). Start/middle/near-end clicks seek and enter playback, then pause for marker measurement. The 61-minute video has a sample reaction at 2070 seconds plotted at x=2070 with count 1.
- Tablet legend: Android 1024×640, 1280×800, 1280×720; iPad 1024×768, 1180×820, 1366×1024. Full final legend/x-axis and no horizontal overflow. Width1100/1101 and height500 boundaries also passed.
- Rotation: Android 800×1280↔1280×800, iPad 768×1024↔1024×768, iPad Pro1024×1366↔1366×1024; each portrait→landscape→portrait cycle has correct canvas width and no overflow.
- PC1280×720,1920×1080,2500×928: click/knob second seek, playback, volume/mute, fullscreen/Esc, video-only/return, playing/stopped PC↔TV, preserved time/audio/layout, docking/reload/restore/split and four icons. TV scale matches current API duration after switching.
- Phone/Android portrait, tablet portrait/landscape, direct Silk-TV and PC-TV baseline geometry passed. Phone landscape844×390 retains video-priority layout.
- TV A→home→A and A→home→B maintain mode=tv; normal-home links have no TV mode. This local test uses two browser-only sample cards and blocks player API; actual video seeking is tested separately above.

The test contexts use empty config/browser-only sample reactions and block all Supabase requests. Request lists and page-error lists are empty. No real user browser profile or saved layout was opened. Publication smoke navigation may allow public read-only GET requests while blocking mutations and realtime sockets; it does not submit reactions.

## Release procedure and limits

Following these green checks, fast-forward main to the integration tip and push main. Existing GitHub Pages is configured for legacy deployment from main:/; its `pages build and deployment` Actions run must succeed. Then compare deployed source hashes and recheck live URLs, TV videos, tablet layouts/rotation, PC controls and home navigation.

Pre-publication evidence is in the task's `tv-tablet-integration` directory. Post-publication evidence will be in its `public` subdirectory. Physical Fire TV remote, Safari and actual Android/iPad hardware are not covered by Chrome emulation. Their existing handlers were not changed. No LABO changes, Supabase changes or migration/deletion of saved settings are included.
