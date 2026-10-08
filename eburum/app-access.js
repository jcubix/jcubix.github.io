/* Administrative staff can inspect sporting records without editing them. */
function readonlyActivity(a){
 const root=document.createElement('div');root.className='modal-back';const m=state.matches.find(m=>m.id===a.match_id),people=new Map(state.players.map(p=>[p.id,`${p.surname} ${p.name}`])),rows=activityRows(a.id);
 root.innerHTML=`<section class="modal" role="dialog" aria-modal="true" aria-labelledby="readonlyActivityTitle"><div class="modal-head"><h2 id="readonlyActivityTitle">${esc(activityLabel(a))}</h2><button aria-label="Chiudi attività">✕</button></div><p class="notice">Consultazione · Il ruolo Segretario gestisce rosa e dati amministrativi. Le modifiche sportive spettano allo staff tecnico e al team manager.</p><p>${fmt(a.activity_date)} · ${clock(a.start_time)} · ${esc(a.status)}</p><p>${esc(a.location||'Luogo da definire')}</p>${a.organization_note?`<p>${esc(a.organization_note)}</p>`:''}${m?`<h3>Risultato</h3><p>${m.goals_for==null?'Da registrare':m.goals_for+' : '+m.goals_against}</p>${m.note?`<p>${esc(m.note)}</p>`:''}`:''}<h3>${a.activity_type==='Partita'?'Convocati':'Disponibilità registrate'}</h3><div class="list">${rows.filter(r=>a.activity_type!=='Partita'||r.called).map(r=>`<article class="row"><div><b>${esc(people.get(r.player_id)||'Giocatore storico')}</b><p class="row-sub">${esc(r.availability)}${a.activity_type==='Partita'?' · '+esc(r.lineup)+' · '+Number(r.minutes_played||0)+' min':''}</p></div></article>`).join('')||'<p class="empty">Nessuna registrazione.</p>'}</div>${m?`<h3>Eventi</h3><div class="list">${matchEvents(m.id).map(e=>`<article class="row"><div><b>${esc(e.event_type)} ${e.minute==null?'':e.minute+'′'}</b><p>${esc(people.get(e.player_id)||'Squadra / avversario')}${e.outgoing_player_id?' · Esce '+esc(people.get(e.outgoing_player_id)||'Giocatore storico'):''}</p>${e.detail?`<p class="row-sub">${esc(e.detail)}</p>`:''}</div></article>`).join('')||'<p class="empty">Nessun evento registrato.</p>'}</div>`:''}</section>`;
 document.body.append(root);const close=()=>root.remove();root.querySelector('.modal-head button').onclick=close;bindDialog(root,close);
}
const accessActivityModal=activityModal;
activityModal=function(a={},...args){if(!canOperate()){if(a.id)readonlyActivity(a);else toast('Creazione attività riservata allo staff operativo');return}return accessActivityModal(a,...args)};
const accessMatchModal=matchModal;
matchModal=function(m={}){if(!canOperate()){if(m.id)readonlyActivity(state.activities.find(a=>a.match_id===m.id)||{id:null,title:m.opponent,activity_type:'Partita',activity_date:m.match_date,match_id:m.id,status:'Concluso'});return}return accessMatchModal(m)};
const accessEditSession=editAttendanceSession;
editAttendanceSession=function(...args){if(!canOperate()){state.page='register';render();return}return accessEditSession(...args)};
const accessStartActual=startActualAttendance;
startActualAttendance=function(...args){if(!canOperate()){state.page='register';render();return}return accessStartActual(...args)};
const accessEventModal=eventModal;
eventModal=function(...args){if(!canOperate())return;return accessEventModal(...args)};
const accessRender=render;
render=function(){if(!canOperate()&&state.page==='training')state.page='register';accessRender();if(canOperate())return;
 document.querySelectorAll('[data-page="training"],[data-new-activity],#addMatch,[data-edit-session],[data-start-actual]').forEach(el=>el.remove());
 document.querySelectorAll('[data-resume-session]').forEach(b=>{b.textContent='Consulta registro';b.onclick=()=>{state.page='register';render()}});
 document.querySelectorAll('.tool-list [data-page="register"] span').forEach(el=>el.textContent='Consulta le presenze registrate');
 document.querySelectorAll('[data-match]').forEach(b=>b.textContent='Consulta partita →');
};
