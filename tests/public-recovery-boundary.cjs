const fs = require('node:fs');
const assert = require('node:assert/strict');
const home = fs.readFileSync('index.html', 'utf8');
const match = fs.readFileSync('match.html', 'utf8');
const homeInit = home.split('async function refreshPublicMatches(){')[1].split('refreshPublicMatches();')[0];
const matchInit = match.split('async function initMatch(){')[1].split('function onYouTubeIframeAPIReady()')[0];
for (const part of [homeInit, matchInit]) {
  assert(!/PULSE_PUBLIC_MATCHES|localStorage|data\.js|fetch\s*\(/.test(part));
  assert(part.includes('一時停止'));
}
assert(homeInit.includes('location.reload()'));
assert(matchInit.includes('showPublicFailure'));
assert(match.includes('class="public-blocked"'));
console.log('PASS recovery screens stop without reading current or stale match data');
