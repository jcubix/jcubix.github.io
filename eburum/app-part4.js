function registerPage(){
 const dates=[...new Set(state.sessions.map(s=>s.session_date))].sort().reverse(),latest=state.registerDate||dates[0]||today();
 return '<div class="section-title"><div><h2>Registro</h2><div class="muted">Consulta presenze e assenze per data</div></div><span class="badge b-blue">'+state.sessions.length+' sessioni</span></div><section class="register-layout"><div class="card calendar-card"><div class="calendar-head"><button class="ghost" id="calPrev">‹</button><div><div class="row-title" id="calTitle"></div><div class="row-sub">I giorni evidenziati contengono attività</div></div><button class="ghost" id="calNext">›</button></div><div class="calendar-week"><span>Lun</span><span>Mar</span><span>Mer</span><span>Gio</span><span>Ven</span><span>Sab</span><span>Dom</span></div><div class="calendar-grid" id="calendarGrid"></div></div><div id="registerDetail" data-selected="'+latest+'"></div></section>';
}
function bindRegister(){
 const dates=[...new Set(state.sessions.map(s=>s.session_date))].sort().reverse(),activity=new Set(dates),detail=document.querySelector('#registerDetail'),grid=document.querySelector('#calendarGrid'),title=document.querySelector('#calTitle'),pm=Object.fromEntries(state.players.map(p=>[p.id,p]));
 let selected=detail.dataset.selected||today(),d0=new Date(selected+'T12:00:00'),year=d0.getFullYear(),month=d0.getMonth();
 function group(label,arr,cls){
  return '<div class="register-group"><div class="register-group-head"><span>'+label+'</span><span class="badge '+cls+'">'+arr.length+'</span></div>'+(arr.length?'<div class="register-people">'+arr.map(a=>{const p=pm[a.player_id],name=p?p.surname+' '+p.name:'Giocatore';return '<div class="person-chip"><b>'+esc(name)+'</b>'+(a.note?'<small>'+esc(a.note)+'</small>':'')+'</div>'}).join('')+'</div>':'<div class="row-sub">Nessuno</div>')+'</div>';
 }
 function drawDetail(){
  const sessions=state.sessions.filter(s=>s.session_date===selected);
  if(!sessions.length){detail.innerHTML='<div class="card empty">Nessuna attività registrata il '+fmt(selected)+'.</div>';return}
  detail.innerHTML=sessions.map(s=>{const A=state.attendance.filter(a=>a.session_id===s.id),P=A.filter(a=>a.status==='Presente'),X=A.filter(a=>a.status==='Assente'),I=A.filter(a=>a.status==='Infortunato');return '<div class="card session-detail"><div class="session-detail-head"><div><div class="row-title">'+esc(s.session_type)+'</div><div class="row-sub">'+fmt(s.session_date)+(s.note?' · '+esc(s.note):'')+'</div></div><div class="session-summary"><span class="badge b-green">'+P.length+' P</span><span class="badge b-red">'+X.length+' A</span><span class="badge b-blue">'+I.length+' I</span>'+'</div></div><div class="register-groups">'+group('Presenti',P,'b-green')+group('Assenti',X,'b-red')+group('Infortunati',I,'b-blue')+'</div><div class="session-tools"><button class="primary" '+(!canOperate()?'hidden ':'')+'data-edit-session="'+s.id+'">Correggi presenze</button><button class="ghost" data-session-history="'+s.id+'">Storico modifiche</button></div><div class="row-sub session-updated">'+(s.updated_at?'Ultimo salvataggio: '+esc(new Intl.DateTimeFormat('it-IT',{dateStyle:'short',timeStyle:'short'}).format(new Date(s.updated_at))):'Storico importato · nessuna modifica tracciata')+'</div></div>'}).join('');
 }
 function drawCalendar(){
  const first=new Date(year,month,1),last=new Date(year,month+1,0),start=(first.getDay()+6)%7;
  title.textContent=new Intl.DateTimeFormat('it-IT',{month:'long',year:'numeric'}).format(first);
  let html='';for(let i=0;i<start;i++)html+='<span class="calendar-day blank"></span>';
  for(let day=1;day<=last.getDate();day++){const key=year+'-'+String(month+1).padStart(2,'0')+'-'+String(day).padStart(2,'0');html+='<button class="calendar-day '+(activity.has(key)?'has-activity ':'')+(selected===key?'selected':'')+'" data-date="'+key+'"><span>'+day+'</span>'+(activity.has(key)?'<i></i>':'')+'</button>'}
  grid.innerHTML=html;grid.querySelectorAll('[data-date]').forEach(b=>b.onclick=()=>{selected=b.dataset.date;state.registerDate=selected;drawCalendar();drawDetail()});
 }
 document.querySelector('#calPrev').onclick=()=>{month--;if(month<0){month=11;year--}drawCalendar()};
 document.querySelector('#calNext').onclick=()=>{month++;if(month>11){month=0;year++}drawCalendar()};
 drawCalendar();drawDetail();
 detail.onclick=e=>{const edit=e.target.closest('[data-edit-session]'),history=e.target.closest('[data-session-history]');if(edit)editAttendanceSession(edit.dataset.editSession,edit);if(history)sessionHistoryModal(history.dataset.sessionHistory)};
}

const EVENT_TYPES=['Gol','Ammonizione','Espulsione','Sostituzione','Nota'];
const eventTone=type=>({Gol:'b-green',Ammonizione:'b-yellow',Espulsione:'b-red',Sostituzione:'b-blue',Nota:'b-gray'}[type]||'b-gray');
const matchEvents=id=>state.events.filter(e=>e.match_id===id).sort((a,b)=>(a.minute??Infinity)-(b.minute??Infinity)||(a.created_at||'').localeCompare(b.created_at||''));
function matchesPage(){return `<div class="section-title"><div><h2>Partite</h2><div class="muted">Risultati, eventi e appunti dal campo</div></div><button class="primary" id="addMatch">+ Partita</button></div><div class="match-list">${state.matches.map(m=>{const ev=matchEvents(m.id),scored=m.goals_for!=null&&m.goals_against!=null;return `<article class="card match-card"><div class="match-meta"><span>${fmt(m.match_date)}</span><span class="badge b-blue">${esc(m.venue)}</span></div><div class="match-heading"><h3>Eburum <span>–</span> ${esc(m.opponent)}</h3><strong class="match-score" aria-label="Risultato">${scored?`${m.goals_for} : ${m.goals_against}`:'– : –'}</strong></div>${m.note?`<p class="match-note-preview">${esc(m.note)}</p>`:''}<div class="match-card-footer"><span class="row-sub">${ev.length} eventi${m.note?' · Note presenti':''}</span><button data-match="${m.id}">Gestisci partita →</button></div></article>`}).join('')||'<div class="empty card">Nessuna partita.<br>Aggiungi la prossima gara per registrare eventi e note.</div>'}</div>`}
function bindMatches(){document.querySelector('#addMatch').onclick=()=>matchModal();document.querySelectorAll('[data-match]').forEach(b=>b.onclick=()=>matchModal(state.matches.find(x=>x.id===b.dataset.match)))}
function matchModal(m={}){
 if(!m.id)return activityModal({activity_type:'Partita'});
 const activity=state.activities.find(a=>a.match_id===m.id);
 if(activity)return openActivity(activity.id);
 toast('Attività della partita non disponibile. Ricarica la squadra.');
}
function eventModal(matchId,event={},onSaved=()=>{}){
 const root=document.createElement('div');root.className='modal-back event-back';
 const options=sortPlayers(state.players.filter(p=>p.active||p.id===event.player_id||p.id===event.outgoing_player_id));
 root.innerHTML=`<section class="modal" role="dialog" aria-modal="true" aria-labelledby="eventTitle"><div class="modal-head"><h2 id="eventTitle">${event.id?'Modifica evento':'Nuovo evento'}</h2><button id="close" aria-label="Chiudi evento">✕</button></div><form id="eventForm"><div class="event-types">${EVENT_TYPES.map(t=>`<button type="button" data-event-type="${t}" class="${(event.event_type||'Gol')===t?'selected':''}" aria-pressed="${(event.event_type||'Gol')===t}">${t}</button>`).join('')}</div><div class="form-grid field-space"><div class="field"><label for="eventMinute">Minuto (facoltativo)</label><input id="eventMinute" type="number" inputmode="numeric" min="0" max="130" step="1" value="${event.minute??''}" placeholder="Es. 65"></div><div class="field"><label for="eventPlayer" id="eventPlayerLabel">Giocatore (facoltativo)</label><select id="eventPlayer"><option value="">Nessun giocatore / avversario</option>${options.map(p=>`<option value="${p.id}" ${p.id===event.player_id?'selected':''}>${esc(p.surname)} ${esc(p.name)}</option>`).join('')}</select></div></div><div class="field field-space" id="outgoingField" hidden><label for="eventOutgoing">Giocatore uscito</label><select id="eventOutgoing"><option value="">Seleziona giocatore</option>${options.map(p=>`<option value="${p.id}" ${p.id===event.outgoing_player_id?'selected':''}>${esc(p.surname)} ${esc(p.name)}</option>`).join('')}</select></div><div class="field field-space"><label for="eventDetail">Dettagli e note</label><textarea id="eventDetail" rows="4" maxlength="10000" placeholder="Descrivi l’evento…">${esc(event.detail||'')}</textarea><small class="muted" id="eventHint"></small></div><div class="modal-actions"><button class="primary" type="submit">Salva evento</button>${event.id?'<button class="danger" type="button" id="deleteEvent">Elimina evento</button>':''}</div><p id="eventFeedback" role="status"></p></form></section>`;
 document.body.appendChild(root);const current=teamRequestGuard();let type=event.event_type||'Gol',busy=false;
 const hint=()=>{root.querySelector('#outgoingField').hidden=type!=='Sostituzione';root.querySelector('#eventPlayerLabel').textContent=type==='Sostituzione'?'Giocatore entrato':'Giocatore (facoltativo)';root.querySelector('#eventHint').textContent=type==='Sostituzione'?'Indica entrato, uscito e minuto. Verifica i minuti effettivi nella formazione.':type==='Nota'?'Inserisci il testo della nota; il minuto è facoltativo.':'Puoi aggiungere un dettaglio anche per un evento dell’avversario.'};
 hint();root.querySelectorAll('[data-event-type]').forEach(b=>b.onclick=()=>{type=b.dataset.eventType;root.dataset.dirty='true';root.querySelectorAll('[data-event-type]').forEach(x=>{x.classList.toggle('selected',x===b);x.setAttribute('aria-pressed',String(x===b))});hint()});
 root.querySelector('#close').onclick=trackDialogDraft(root,()=>busy);
 bindDialog(root,()=>root.querySelector('#close').click());
 root.querySelector('#eventForm').onsubmit=async e=>{e.preventDefault();if(busy)return;const button=e.target.querySelector('[type="submit"]');try{const value=root.querySelector('#eventMinute').value,minute=value===''?null:Number(value),detail=root.querySelector('#eventDetail').value.trim()||null;if(minute!==null&&(!Number.isInteger(minute)||minute<0||minute>130))throw new Error('Il minuto deve essere un intero da 0 a 130');if(type==='Sostituzione'&&(!root.querySelector('#eventPlayer').value||!root.querySelector('#eventOutgoing').value||root.querySelector('#eventPlayer').value===root.querySelector('#eventOutgoing').value||minute===null))throw new Error('Seleziona due giocatori diversi e il minuto della sostituzione');if(type==='Nota'&&!detail)throw new Error('Inserisci il testo della nota');busy=true;setBusyControls(root,true);button.disabled=true;const row={user_id:teamOwner(),match_id:matchId,player_id:root.querySelector('#eventPlayer').value||null,minute,event_type:type,detail,outgoing_player_id:type==='Sostituzione'?root.querySelector('#eventOutgoing').value:null};const query=event.id?db.from('match_events').update(row).eq('id',event.id).eq('match_id',matchId).eq('user_id',teamOwner()):db.from('match_events').insert(row);const {data,error}=await query.select().single();if(error)throw error;if(!current())return;state.events=state.events.filter(x=>x.id!==data.id).concat(data);root.remove();onSaved();toast('Evento salvato')}catch(error){root.querySelector('#eventFeedback').textContent=error.message}finally{busy=false;setBusyControls(root,false);button.disabled=false}};
 if(event.id)root.querySelector('#deleteEvent').onclick=async()=>{
  if(busy||!confirm('Eliminare definitivamente questo evento?'))return;
  busy=true;setBusyControls(root,true);
  try{
   const {error}=await db.from('match_events').delete().eq('id',event.id).eq('match_id',matchId).eq('user_id',teamOwner());
   if(error)throw error;if(!current())return;
   state.events=state.events.filter(x=>x.id!==event.id);root.remove();onSaved();toast('Evento eliminato');
  }catch(error){root.querySelector('#eventFeedback').textContent=error.message||'Eliminazione non riuscita'}
  finally{busy=false;setBusyControls(root,false)}
 };

}
