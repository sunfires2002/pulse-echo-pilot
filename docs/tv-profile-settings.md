# TV name setup and home editor

Base: 29f51a1. Branch: codex/tv-profile-settings. Not a production release.

TV-only module `tv-profile-settings.js` uses the unchanged `PULSE_PROFILE` API from `profile.js`. Existing storage keys, sender identity, legacy-name migration and guest generation are unchanged.

For direct TV match links, the existing first-name dialog remains. Skip receives initial focus to avoid automatically opening an on-screen keyboard. Tab and Shift+Tab stay in the dialog; attempts to focus background controls return to the initial control. Pointer access to input/save/skip remains available. Completion returns focus to the TV home control. Existing first-dialog Escape/backdrop behavior is unchanged.

TV home initializes the same profile API but does not automatically open a dialog or save a guest name. Above the match cards, it displays the current name and a name-change entry. The editor pre-fills the current name, rejects blank input, supports save/Enter and cancel/Escape, and restores focus to its opener. Saving a name does not replace the sender ID. Ordinary home does not initialize identity or create TV controls; non-TV first dialogs retain existing behavior.

Validation:
- `tests/tv-profile-settings.cjs`: 960×540, 1280×720, 1920×1080 with Silk-equivalent UA. Direct links, typing, skip/guest posts, Tab trap, pointer controls, home editing, validation/cancel, A-home-B, reload and sender identity preservation. Fresh TV home does not suppress the later first-match gate. Ordinary desktop/iPhone home and non-TV gate unaffected.
- Existing `tv-react-list.cjs`: all three sizes, REACT open/close, exact seeks, time sync, local posts and part changes.
- Existing `tv-toolbar.cjs`: TV geometry/posting/home and desktop/phone/tablet baseline checks.

Tests use fresh browser contexts, fixture matches and empty backend config. Production Supabase HTTP/WebSocket attempts remain zero. Screenshots/JSON are in `../tv-profile-settings-evidence/`.

The hardware test preview is separate from ports 8053 and 8059. It contains local test data only. Physical Fire TV remote input, native software keyboard and Back-button behavior remain for hardware verification. No main merge, deployment or old-branch changes.
