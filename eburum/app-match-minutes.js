import { db, fetchAllRows, state, teamOwner, teamRequestGuard } from './app-part1.js';
import { loadDismissalSnapshot } from './app-data.js';

// Preview only: the database validates and persists the same timeline atomically.
function calculateMatchMinutes(duration, roster, events, started=true) {
 if(!Number.isInteger(duration)||duration<1||duration>130)throw Error('Durata da 1 a 130 minuti');
 const minutes=new Map(roster.map(r=>[r.player_id,0])),called=new Set(roster.filter(r=>r.called).map(r=>r.player_id));
 const active=new Map(roster.filter(r=>r.called&&r.lineup==='Titolare').map(r=>[r.player_id,0]));
 const used=new Set(active.keys()),dismissed=new Set();
 if(active.size>11)throw Error('Al massimo 11 titolari');
 if(!started)return minutes;
 const timeline=events.filter(e=>e.event_type==='Sostituzione'||e.event_type==='Espulsione'&&e.player_id)
  .sort((a,b)=>a.minute-b.minute||String(a.created_at||'').localeCompare(String(b.created_at||''))||String(a.id||'').localeCompare(String(b.id||'')));
 for(const e of timeline){
  if(!Number.isInteger(e.minute)||e.minute<0||e.minute>duration)throw Error('Il minuto deve rientrare nella durata della gara');
  if(e.event_type==='Sostituzione'){
   if(!e.player_id||e.player_id===e.outgoing_player_id||!active.has(e.outgoing_player_id))throw Error('Il giocatore uscente deve essere in campo. Verifica titolari ed eventi.');
   if(!called.has(e.player_id)||used.has(e.player_id)||dismissed.has(e.player_id))throw Error('Il subentrato deve essere convocato, non impiegato prima e non espulso');
   minutes.set(e.outgoing_player_id,e.minute-active.get(e.outgoing_player_id));active.delete(e.outgoing_player_id);
   active.set(e.player_id,e.minute);used.add(e.player_id);
  }else{
   if(!called.has(e.player_id)||dismissed.has(e.player_id))throw Error('Verifica il convocato espulso');
   if(active.has(e.player_id)){minutes.set(e.player_id,e.minute-active.get(e.player_id));active.delete(e.player_id)}
   dismissed.add(e.player_id);
  }
 }
 for(const [id,start] of active)minutes.set(id,duration-start);
 return minutes;
}

async function refreshMatchTimeline(matchId){
 const current=teamRequestGuard(),owner=teamOwner();
 const [match,activity,events,dismissals]=await Promise.all([
  db.from('matches').select('*').eq('id',matchId).eq('user_id',owner).single(),
  db.from('activities').select('*').eq('match_id',matchId).eq('user_id',owner).single(),
  fetchAllRows(()=>db.from('match_events').select('*').eq('match_id',matchId).eq('user_id',owner).order('id')),loadDismissalSnapshot()
 ]);
 if(!current())return null;
 for(const result of [match,activity,events])if(result.error)throw result.error;
 const roster=await fetchAllRows(()=>db.from('activity_roster').select('*').eq('activity_id',activity.data.id).eq('user_id',owner).order('id'));
 if(!current())return null;if(roster.error)throw roster.error;if(!Array.isArray(roster.data))throw Error("Risposta delle convocazioni non valida");
 Object.assign(state,dismissals);
 state.matches=state.matches.filter(m=>m.id!==matchId).concat(match.data);
 state.activities=state.activities.filter(a=>a.id!==activity.data.id).concat(activity.data);
 state.events=state.events.filter(e=>e.match_id!==matchId).concat(events.data);
 state.roster=state.roster.filter(r=>r.activity_id!==activity.data.id).concat(roster.data);
 return {match:match.data,activity:activity.data,roster:roster.data};
}
export { calculateMatchMinutes, refreshMatchTimeline };
