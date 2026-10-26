import {canPlan,canOperate,state,today} from './app-part1.js';
import {activityModal,openActivity} from './app-team.js';
import {readonlyActivity} from './app-access.js';
import {ui} from './src/ui-service.ts';

const registerTrainings = () =>
  state.activities.filter(
    (a) =>
      a.activity_type === "Allenamento" &&
      (a.activity_date <= today() ||
        a.status !== "Programmato" ||
        a.session_id),
  );

const registerDates = () =>
  [
    ...new Set([
      ...state.sessions.map((s) => s.session_date),
      ...registerTrainings().map((a) => a.activity_date),
    ]),
  ]
    .sort()
    .reverse();

const EVENT_TYPES = [
  "Gol",
  "Ammonizione",
  "Espulsione",
  "Sostituzione",
  "Nota",
];

const eventTone = (event) => {
  const type = typeof event === "string" ? event : event.event_type;
  return type === "Gol" && typeof event === "object" && !event.player_id
    ? "b-red"
    : {
        Gol: "b-green",
        Ammonizione: "b-yellow",
        Espulsione: "b-red",
        Sostituzione: "b-blue",
        Nota: "b-gray",
      }[type] || "b-gray";
};

const matchEvents = (id) =>
  state.events
    .filter((e) => e.match_id === id)
    .sort(
      (a, b) =>
        (a.minute ?? Infinity) - (b.minute ?? Infinity) ||
        (a.created_at || "").localeCompare(b.created_at || ""),
    );

function matchModal(match={}){if(!match.id){if(canPlan())return activityModal({activity_type:'Partita'})}else {const activity=state.activities.find(a=>a.match_id===match.id);if(activity)return openActivity(activity.id);return canOperate()?activityModal({activity_type:'Partita',match_id:match.id,title:match.opponent,activity_date:match.match_date}):readonlyActivity({activity_type:'Partita',match_id:match.id,title:match.opponent,activity_date:match.match_date})}}
function eventModal(matchId,type='Gol',event={},context={}){return ui.open('event',{matchId,type,event,context})}
export {matchModal,eventModal};
export { registerTrainings, registerDates, EVENT_TYPES, eventTone, matchEvents };
