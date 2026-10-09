import { db, fetchAllRows, refresh, state, teamOwner, today } from './app-part1.js';

// Load sporting history by period; shared reference data stays available to every page.
const DATE_TABLES=[['sessions','session_date'],['matches','match_date'],['activities','activity_date']];
function sportSeason(){const year=state.seasonYear||Number(String(window.CONFIG.season).match(/20\d{2}/)?.[0])||Number(today().slice(0,4));return {year,key:`${year}/${year+1}`,from:`${year}-07-01`,to:`${year+1}-06-30`}}
async function rowsOrThrow(build){const result=await fetchAllRows(build);if(result.error)throw result.error;return result.data}
async function childRows(table,column,ids,owner,player=null){
 const unique=[...new Set(ids)],data=[];
 for(let offset=0;offset<unique.length;offset+=100){const batch=unique.slice(offset,offset+100);data.push(...await rowsOrThrow(()=>{let q=db.from(table).select('*').eq('user_id',owner).in(column,batch).order(table==='activity_technical'?'activity_id':'id');if(player)q=q.eq('player_id',player);return q}))}
 return data;
}
async function loadSportPeriod(from,to,owner,player=null,withTechnical=false){
 const parents=await Promise.all(DATE_TABLES.map(([table,date])=>rowsOrThrow(()=>db.from(table).select('*').eq('user_id',owner).gte(date,from).lte(date,to).order('id'))));
 const [sessions,matches,activities]=parents;
 const [attendance,events,roster,technical]=await Promise.all([
  childRows('attendance','session_id',sessions.map(s=>s.id),owner,player),
  childRows('match_events','match_id',matches.map(m=>m.id),owner),
  childRows('activity_roster','activity_id',activities.map(a=>a.id),owner,player),
  withTechnical?childRows('activity_technical','activity_id',activities.map(a=>a.id),owner):Promise.resolve([])
 ]);
 sessions.sort((a,b)=>b.session_date.localeCompare(a.session_date));matches.sort((a,b)=>b.match_date.localeCompare(a.match_date));
 return {sessions,matches,activities,attendance,events,roster,technical};
}
async function earliestSportDate(owner=teamOwner()){
 const results=await Promise.all(DATE_TABLES.map(([table,date])=>db.from(table).select(date).eq('user_id',owner).order(date).limit(1)));
 for(const r of results)if(r.error)throw r.error;
 return results.flatMap((r,i)=>(r.data||[]).map(x=>x[DATE_TABLES[i][1]])).sort()[0]||today();
}
async function loadTeamData(owner){
 const season=sportSeason();
 const [sport,players,administration,disciplinary_clearances,staff_communications,earliest]=await Promise.all([
  loadSportPeriod(season.from,season.to,owner,null,true),
  rowsOrThrow(()=>db.from('players').select('*').eq('user_id',owner).order('id')),
  rowsOrThrow(()=>db.from('player_administration').select('*').eq('user_id',owner).order('player_id')),
  rowsOrThrow(()=>db.from('disciplinary_clearances').select('*').eq('user_id',owner).eq('season_start',season.from).order('id')),
  rowsOrThrow(()=>db.from('staff_communications').select('*').eq('user_id',owner).gt('expires_at',new Date().toISOString()).order('id')),
  earliestSportDate(owner)
 ]);
 return {...sport,players,administration,disciplinary_clearances,staff_communications,dataRange:season,earliestSport:earliest};
}
function seasonPicker(){
 if(!['dashboard','agenda','matches','register','players'].includes(state.page))return '';
 const selected=sportSeason().year,configured=Number(String(window.CONFIG.season).match(/20\d{2}/)?.[0])||selected,first=state.earliestSport||today(),earliest=Number(first.slice(0,4))-(first.slice(5,7)<'07'?1:0),years=[];
 for(let y=Math.max(configured,selected);y>=Math.min(earliest,selected);y--)years.push(y);
 return `<div class="season-picker field"><label for="sportSeason">Stagione sportiva</label><select id="sportSeason">${years.map(y=>`<option value="${y}" ${y===selected?'selected':''}>${y}/${y+1}</option>`).join('')}</select><span class="row-sub">Dati sportivi della stagione selezionata · i report possono includere tutto lo storico.</span></div>`;
}
function bindSeasonPicker(){const select=document.querySelector('#sportSeason');if(!select)return;select.onchange=async()=>{select.disabled=true;state.seasonYear=Number(select.value);delete state.registerDate;await refresh()}}

export { DATE_TABLES, sportSeason, rowsOrThrow, childRows, loadSportPeriod, earliestSportDate, loadTeamData, seasonPicker, bindSeasonPicker };
