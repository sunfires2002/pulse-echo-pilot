# TV GOAL lightweight prototype

Base: 414152f. Branch: codex/tv-goal-prototype. No production release.

## Scope and data contract

Explicit opt-in only: `mode=tv&goalLab=1`. Ordinary TV without the flag, flexible PC, phone and tablet do not load the GOAL module/styles/core. The actual TV/PULSE/REACT/profile/posting files are unchanged; the desktop loader adds the prototype resources conditionally.

`prism-goals-core.js` is a byte-for-byte copy of independent LABO `lab-goals-core.js` at c8fa302. The confirmed contract is documented there in GOAL-FLAGS.md (PRISM exporter ab4240e). `sec`, `kickoff_sec`, `end_sec` are positions in the exported video. No kickoff/cut correction is added. Scorer number remains a string (`07`), OG and optional scorer follow the existing contract. Team and score arrays retain their existing meaning.

Two explicitly fictional fixture records are loaded only in the opt-in prototype, with match_id tv-goal-a / tv-goal-b and youtube_id dSIO3AdVRIs. They cannot match the existing real-named match IDs. Data stays in a normalized in-page store; no GOAL persistence, Supabase access, MATCH LOG UI or editing is added.

- A: separated goals at 1.5, 120.5, 300, 600, 900 and 1638 seconds.
- B: 1.5, 120, 121.2, 122.8, 300, 300.8 and 1638 seconds (nearby comparisons).

## UI and interaction

- Native ⚽: 16px. Hit box: 36×32px. White focus outline. Fits within the existing 48px chart region; no graph/domain/panel height or video resize.
- Uses PULSE_TV_AXIS.secondsToX (the actual Chart.js seconds scale) and canvas CSS scaling. At endpoints the hit box is kept inside the existing PULSE container while the icon retains the exact second coordinate. No independent ratio/axis/padding is introduced.
- Overlapping targets become one ⚽ with the number of eligible nearby goals. Its representative stays at the earliest member's exact time; each member retains its own time in the selection menu. Targets do not overlap.
- A single GOAL seeks to max(0, sec−10) through the existing TV exact-seconds seek/play path. A grouped ball first opens individual choices; selecting one applies the same ten-second lead. The lead is a prototype UI choice, not a transformation of prism data.
- Only goals at/before the current position and within the actual duration are shown, refreshed every200ms. Counts/menu choices also exclude future goals. Clicks revalidate against the current position. After a jump before the goal, that ball disappears until playback reaches it again.
- Nearby selection menu is above the PULSE/toolbar, not a new lane or layout region. Escape closes it without closing an already-open REACT. Outside pointer actions continue normally.

## Verification

`tests/tv-goals.cjs`: Chrome with Silk-equivalent UA at 960×540,1280×720,1920×1080. Compared with 414152f: video, PULSE, chart, toolbar and REACT button geometry unchanged. Verified single/nearby goals, 0/end/outside-duration cases, exact icon alignment, nonoverlapping hit boxes, panel-contained icons/targets, future filtering and stale-choice rejection, 10-second and fractional seeks, normal PULSE and REACT, local posting identity and part changes. Ordinary PULSE expected time is derived from actual click pixels (a pixel is approximately1.9s at960px), preserving its existing rounding.

Existing tv-react-list, tv-profile-settings and tv-toolbar suites pass on all three sizes; ordinary PC/phone/tablet baseline cases pass as well. The pure prism core preserves07, OG and video-position semantics. Captures and JSON: ../tv-goal-evidence/.

Real YouTube validation: tests/tv-goals-youtube.cjs checks A single-goal and B grouped-goal jumps at960×540 and the actual player time. All tests use isolated sample data/config and block production HTTP/WebSocket traffic.

Limitations: Chrome emulation is not physical Fire TV proof; native emoji/white-circle cursor/remote behavior needs hardware review. Balls overlay the existing small reaction plot, so nearby graph strokes can be covered. Only test-data input is supplied; file-import UI, production data integration and a final GOAL design are not included. Main, completed LAB branches and independent LABO remain untouched.

## Fire TV refinement from 1c4106b

The ball changes24→16px and its vertical center uses the chart y=0 position (red reaction baseline), transformed into the existing canvas CSS coordinate system. Horizontal seconds coordinates are unchanged. The36×32px target remains above the tick-label ink; the smaller ball sits toward its lower edge. Count badge moves down2px but remains above and separate from the ball. Nearby grouping and selection-menu behavior are unchanged.

Seek lead changes3→10 seconds, clamped at0; imported sec values and all sample JSON remain unchanged. Labels use the same lead constant. Future hiding and redisplay at the original goal time are preserved.

Three-size tests compare against1c4106b and check16px, x/y alignment, badge clearance, tick-label clearance, preserved hit boxes, future disappearance/reappearance, single/nearby fractional seek and existing TV interactions. Evidence: ../tv-goal-16px-evidence/. Actual YouTube targets110.5 and111.2 seconds were observed at110.557 and111.278 seconds respectively after playback started. Physical Fire TV remains unverified for this adjustment.
