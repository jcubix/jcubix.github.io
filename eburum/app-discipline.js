import {sportSeason} from './app-data.js';
import {state,today} from './app-part1.js';
import {playerDismissals} from './app-dismissals.js';
import {ui} from './src/ui-service.ts';

function disciplineSeason() {
  return sportSeason();
}

function playerDiscipline(id) {
  const season = disciplineSeason(),
    cancelled = new Set(
      (state.activities || [])
        .filter((a) => a.status === "Annullato")
        .map((a) => a.match_id),
    ),
    matches = new Map(
      state.matches
        .filter(
          (m) =>
            m.match_date >= season.from &&
            m.match_date <= season.to &&
            m.match_date <= today() &&
            !cancelled.has(m.id),
        )
        .map((m) => [m.id, m]),
    );
  const seen = new Set(),
    events = state.events
      .filter((e) => {
        if (
          seen.has(e.id) ||
          e.player_id !== id ||
          !matches.has(e.match_id) ||
          !["Ammonizione", "Espulsione"].includes(e.event_type)
        )
          return false;
        seen.add(e.id);
        return true;
      })
      .sort(
        (a, b) =>
          matches
            .get(a.match_id)
            .match_date.localeCompare(matches.get(b.match_id).match_date) ||
          (a.minute ?? 999) - (b.minute ?? 999) ||
          (a.created_at || "").localeCompare(b.created_at || "") ||
          a.id.localeCompare(b.id),
      );
  const yellows = events.filter((e) => e.event_type === "Ammonizione"),
    total = yellows.length,
    cycles = Math.floor(total / 5),
    current = total % 5;
  const milestones = yellows.filter((e, i) => (i + 1) % 5 === 0),
    confirmed = (state.disciplinary_clearances || []).filter(
      (c) => c.player_id === id && c.season_start === season.from,
    ),
    valid = confirmed.filter(
      (c) =>
        milestones.some((e) => e.id === c.threshold_event_id) &&
        matches.has(c.served_match_id) &&
        matches.get(c.served_match_id).match_date >
          matches.get(
            state.events.find((e) => e.id === c.threshold_event_id)?.match_id,
          )?.match_date &&
        !(state.roster || []).some(
          (r) =>
            r.player_id === id &&
            r.minutes_played > 0 &&
            state.activities.some(
              (a) => a.id === r.activity_id && a.match_id === c.served_match_id,
            ),
        ),
    ),
    pending = milestones.filter(
      (e) => !valid.some((c) => c.threshold_event_id === e.id),
    ),
    review = confirmed.filter((c) => !valid.includes(c));
  const dismissals = playerDismissals(id),
    redAttention = dismissals.some((d) => d.attention);
  return {
    season,
    events,
    yellows,
    total,
    cycles,
    current,
    milestones,
    confirmed,
    valid,
    pending,
    review,
    dismissals,
    redAttention,
    reds: events.filter((e) => e.event_type === "Espulsione").length,
    diffida: current === 4,
    matches,
  };
}

/** @param {string|null} playerId */
function disciplineModal(playerId=null){return ui.open('discipline',{playerId},{page:playerId?'players':'more',detail:playerId?'discipline:'+playerId:'tool:discipline',workspace:!playerId})} export {disciplineModal};
export { disciplineSeason, playerDiscipline };
