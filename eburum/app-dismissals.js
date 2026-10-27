import {loadDismissalSnapshot,sportSeason} from './app-data.ts';
import {canOperate,fmt,render,state,teamRequestGuard,today} from './app-part1.js';
import {ui} from './src/ui-service.ts';

function dismissalEvents() {
  const events = new Map((state.dismissals || []).map((e) => [e.id, e]));
  for (const e of state.events || [])
    if (e.event_type === "Espulsione" || events.has(e.id)) {
      const m = state.matches.find((m) => m.id === e.match_id),
        a = state.activities.find((a) => a.match_id === e.match_id);
      events.set(e.id, {
        ...events.get(e.id),
        ...e,
        ...(m ? { match_date: m.match_date, opponent: m.opponent } : {}),
        ...(a ? { activity_status: a.status } : {}),
      });
    }
  return [...events.values()];
}

function dismissalState(event, asOf = today()) {
  const sanction = (state.dismissal_sanctions || []).find(
      (s) => s.event_id === event.id,
    ),
    clearances = (state.dismissal_clearances || []).filter(
      (c) => c.event_id === event.id,
    );
  const valid = clearances.filter(
    (c) =>
      event.player_id === sanction?.player_id &&
      c.player_id === sanction?.player_id &&
      c.match_date > event.match_date &&
      c.match_date <= today() &&
      c.match_date <= asOf &&
      c.activity_status !== "Annullato" &&
      c.has_result &&
      !c.has_minutes &&
      !(state.disciplinary_clearances || []).some(
        (y) => y.player_id === c.player_id && y.served_match_id === c.match_id,
      ),
  );
  const review = clearances.filter((c) => !valid.includes(c)),
    base = {
      event,
      sanction,
      clearances,
      valid,
      review,
      remaining: 0,
      attention: false,
      tone: "b-gray",
      label: "Provvedimento annullato",
    };
  if (sanction?.voided)
    return sanction.player_id === event.player_id
      ? base
      : {
          ...base,
          attention: true,
          tone: "b-red",
          label: "Provvedimento da definire",
        };
  if (
    event.activity_status === "Annullato" ||
    event.event_type !== "Espulsione" ||
    (sanction && sanction.player_id !== event.player_id)
  )
    return {
      ...base,
      attention: !!sanction,
      tone: "b-yellow",
      label: "Espulsione da verificare",
    };
  if (!sanction)
    return {
      ...base,
      attention: true,
      tone: "b-red",
      label: "Provvedimento da definire",
    };
  if (review.length)
    return {
      ...base,
      attention: true,
      tone: "b-yellow",
      label: "Conferme da verificare",
      remaining: Math.max(0, (sanction.match_count || 0) - valid.length),
    };
  if (sanction.kind === "until")
    return {
      ...base,
      attention: asOf <= sanction.suspended_until,
      tone: asOf <= sanction.suspended_until ? "b-red" : "b-green",
      label:
        asOf <= sanction.suspended_until
          ? `Fino al ${fmt(sanction.suspended_until)} compreso`
          : "Termine raggiunto",
    };
  const remaining = Math.max(0, sanction.match_count - valid.length);
  return {
    ...base,
    remaining,
    attention: remaining > 0,
    tone: remaining ? "b-red" : "b-green",
    label: remaining
      ? `${remaining} ${remaining === 1 ? "gara da scontare" : "gare da scontare"}`
      : "Scontata",
  };
}

function playerDismissals(playerId, asOf = today()) {
  const season = sportSeason();
  return dismissalEvents()
    .filter(
      (e) =>
        e.player_id === playerId ||
        (state.dismissal_sanctions || []).some(
          (s) => s.event_id === e.id && s.player_id === playerId && !s.voided,
        ),
    )
    .filter(
      (e) =>
        e.match_date <= today() &&
        (e.activity_status !== "Annullato" ||
          (state.dismissal_sanctions || []).some((s) => s.event_id === e.id)),
    )
    .map((e) => dismissalState(e, asOf))
    .filter(
      (d) =>
        d.event.match_date <= season.to &&
        (d.event.match_date >= season.from || d.attention),
    )
    .sort((a, b) => b.event.match_date.localeCompare(a.event.match_date));
}

function dismissalAlert(playerId, matchDate = today()) {
  const open = playerDismissals(playerId, matchDate).filter(
    (d) => d.attention && d.event.match_date < matchDate,
  );
  return open.length
    ? `Espulsione · ${open[0].label}${open.length > 1 ? ` · Altri ${open.length - 1} provvedimenti aperti` : ""}`
    : "";
}

async function reloadDismissals(current) {
  const data = await loadDismissalSnapshot();
  if (!current()) return false;
  Object.assign(state, data);
  render();
  return true;
}

function sanctionModal(eventId){if(canOperate())return ui.open('sanction',{eventId})}
function dismissalClearanceModal(eventId){if(canOperate())return ui.open('dismissal-clearance',{eventId})}
export {sanctionModal,dismissalClearanceModal};
export { dismissalEvents, dismissalState, playerDismissals, dismissalAlert, reloadDismissals };
