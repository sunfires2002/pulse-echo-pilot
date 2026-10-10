/* Room selection affects navigation and the match list only. */
window.PULSE_ROOMS = (() => {
  const teams = Object.freeze({ sunfires: "SUNFIRES", "8motion": "8motion" });
  const normalize = value => String(value ?? "").normalize("NFKC").trim().toLowerCase();
  const params = new URLSearchParams(location.search);
  const rawTeam = params.get("team");
  const slug = normalize(rawTeam);
  const team = Object.hasOwn(teams, slug) ? { slug, name: teams[slug] } : null;
  const requested = rawTeam !== null;
  const since = "2026-09-01";
  const includeOlder = params.get("period") === "all";
  const roomUrl = slug => `./?team=${encodeURIComponent(slug)}`;
  const homeUrl = team ? roomUrl(team.slug) + (includeOlder ? "&period=all" : "") : "./";
  function matchesRoom(match) {
    if (!requested) return true;
    if (!team) return false;
    const belongs = [match.home, match.away].some(name => normalize(name) === normalize(team.name));
    const recorded = [match.firstHalfVideo, match.secondHalfVideo, match.highlightVideo]
      .some(video => typeof video === "string" && video.trim().length > 0);
    return belongs && recorded && (includeOlder || /^\d{4}-\d{2}-\d{2}$/.test(match.date || "") && match.date >= since);
  }
  function matchUrl(id) {
    const base = `match.html?id=${encodeURIComponent(id)}`;
    return team ? base + `&team=${encodeURIComponent(team.slug)}` + (includeOlder ? "&period=all" : "") : base;
  }
  return { teams, team, requested, includeOlder, homeUrl, roomUrl, matchesRoom, matchUrl };
})();
