# TV REACT vertical-list prototype

Base: `6d83e87`; branch: `codex/tv-react-list`. No production release.

## Data and behavior

- Reads the current in-memory `events` array only; no new network, persistence, or posting path.
- `good_time` is the YouTube position in seconds. `description` is the reaction kind; `comment` holds both typed and speech-recognized text. The stored format cannot distinguish those input sources.
- Requires the current `${match.id}:${currentPart}` video key. Excludes invalid, negative, future, out-of-duration and other-part rows; waits for matching player metadata.
- Displays the latest six rows at 960×540 or eight at 1280×720 and 1920×1080, ordered by time. Full comments wrap; the list scrolls internally.
- Polls actual player time every 250ms, including paused playback and backward seeks. Opening/closing does not change video, PULSE, or toolbar geometry.
- REACT toggles the overlay; Up/Down moves among rows, Enter activates, Escape closes and returns focus. Native buttons also support pointer selection.
- Row activation reuses the existing standalone-TV seek/play/announcement path, retaining stored fractional seconds. Original PULSE click rounding remains unchanged.
- No edit/delete/review/filter controls. Non-TV/PC LAB layouts are unchanged.

## Verification

`tests/tv-react-list.cjs` uses isolated config/data and a controlled player at all three viewport sizes. Covers future exclusion, advance/pause/backward seek, stale row rejection, fractional comment jumps, keyboard focus, safe text, local posting identity, part changes, overlay clearance, and unchanged geometry. Supabase HTTP/WebSocket attempts: zero.

`tests/tv-react-youtube.cjs` checks a real YouTube player: a 60.5-second comment target was passed unchanged to `seekTo`; paused observed position was 60.743 seconds. No production service access.

Existing suites passed: `tv-toolbar.cjs`, `tv-home-cycle.cjs`, `tv-seconds-axis.cjs`, `tv-seconds-youtube.cjs`, and `pc-video-mode.cjs`. Real video durations tested approximately 23, 27 and 61 minutes.

Screenshots and JSON measurements are stored separately in `../tv-react-list-evidence/`. Controlled-player screenshots have a black video background; `react-real-youtube.png` is the actual YouTube integration capture.

Fire TV hardware, Silk rendering and physical remote selection remain unverified. This prototype has not been merged into main or deployed.
