import { validDay, rememberQuery } from './app-presentation.js';
import { matchTitle, matchScore } from './app-match-display.js';
import { icon } from './app-icons.js';
import { calculateMatchMinutes } from './app-match-minutes.js';
import { readonlyActivity } from './app-access.js';
import { bindDialog } from './app-dialogs.js';
import { confirmDialog } from './app-confirm.js';
import { renderExtensions } from './app-hooks.js';
import { canOperate, canPlan, db, esc, fmt, isAdmin, sortPlayers, state, teamOwner, teamRequestGuard, toast, today } from './app-part1.js';
import { editAttendanceSession, sessionHistoryModal } from './app-part3.js';
import { activityModal, openActivity } from './app-team.js';
import { setBusyControls, trackDialogDraft } from './app-workflows.js';

const registerTrainings=()=>state.activities.filter(a=>a.activity_type==='Allenamento'&&(a.activity_date<=today()||a.status!=='Programmato'||a.session_id));
const registerDates=()=>[...new Set([...state.sessions.map(s=>s.session_date),...registerTrainings().map(a=>a.activity_date)])].sort().reverse();
function registerTrainingCard(a){return `<article class="card register-training-card"><div class="session-detail-head"><div><h3>${esc(a.title||'Allenamento')}</h3><p class="row-sub">${fmt(a.activity_date)}${a.start_time?' · '+esc(a.start_time.slice(0,5)):''}${a.location?' · '+esc(a.location):''}</p></div><span class="office-status sc-status">${esc(a.status)}</span></div>${a.organization_note?`<p class="register-training-note">${esc(a.organization_note)}</p>`:''}<p class="row-sub">${a.status==='Annullato'?'Allenamento annullato: nessuna presenza da confermare.':a.session_id?'Presenze confermate.':'Presenze non ancora confermate.'}</p><button class="ghost" data-register-training="${esc(a.id)}">Apri scheda allenamento</button></article>`;}
function registerPage(){
 const params=new URLSearchParams(window.location.hash.split('?')[1]||'');if(validDay(params.get('date')))state.registerDate=params.get('date');if(/^\d{4}-(0[1-9]|1[0-2])$/.test(params.get('month')||''))state.registerMonth=params.get('month');
 const dates=registerDates(),latest=state.registerDate||dates[0]||today();
 return '<div class="section-title"><div><h1>Registro</h1><div class="muted">Presenze e schede degli allenamenti per data</div></div><span class="badge b-blue">'+state.sessions.length+' sessioni</span></div><section class="register-layout"><div class="card calendar-card"><div class="calendar-head"><button class="ghost" id="calPrev" aria-label="Mese precedente">‹</button><div><div class="row-title" id="calTitle" aria-live="polite"></div><div class="row-sub">I giorni evidenziati contengono attività</div></div><button class="ghost" id="calNext" aria-label="Mese successivo">›</button></div><div class="calendar-week"><span>Lun</span><span>Mar</span><span>Mer</span><span>Gio</span><span>Ven</span><span>Sab</span><span>Dom</span></div><div class="calendar-grid" id="calendarGrid"></div></div><div id="registerDetail" data-selected="'+latest+'"></div></section>';
}
function bindRegister(){
 const dates=registerDates(),activity=new Set(dates),detail=document.querySelector('#registerDetail'),grid=document.querySelector('#calendarGrid'),title=document.querySelector('#calTitle'),pm=Object.fromEntries(state.players.map(p=>[p.id,p]));
 let selected=detail.dataset.selected||today(),d0=new Date((state.registerMonth?state.registerMonth+'-01':selected)+'T12:00:00'),year=d0.getFullYear(),month=d0.getMonth();
 const remember=()=>{state.registerMonth=year+'-'+String(month+1).padStart(2,'0');rememberQuery({date:selected,month:state.registerMonth})};
 function group(label,arr,cls){
  return '<div class="register-group"><div class="register-group-head"><span>'+label+'</span><span class="badge '+cls+'">'+arr.length+'</span></div>'+(arr.length?'<div class="register-people">'+arr.map(a=>{const p=pm[a.player_id],name=p?p.surname+' '+p.name:'Giocatore';return '<div class="person-chip"><b>'+esc(name)+'</b>'+(a.note?'<small>'+esc(a.note)+'</small>':'')+'</div>'}).join('')+'</div>':'<div class="row-sub">Nessuno</div>')+'</div>';
 }
 function drawDetail(){
  const sessions=state.sessions.filter(s=>s.session_date===selected);
  const trainings=registerTrainings().filter(a=>a.activity_date===selected),linked=registerTrainings().filter(a=>sessions.some(s=>s.id===a.session_id));
  const trainingCards=[...new Map([...trainings,...linked].map(a=>[a.id,a])).values()].map(registerTrainingCard).join('');
  if(!sessions.length){detail.innerHTML=trainingCards||'<div class="card sc-empty-state">'+icon('calendar',24)+'<h3>Nessuna attività registrata il '+fmt(selected)+'.</h3><p>Scegli un altro giorno evidenziato nel calendario.</p></div>';return}
  detail.innerHTML=sessions.map(s=>{const A=state.attendance.filter(a=>a.session_id===s.id),P=A.filter(a=>a.status==='Presente'),X=A.filter(a=>a.status==='Assente'),I=A.filter(a=>a.status==='Infortunato');return '<div class="card session-detail"><div class="session-detail-head"><div><div class="row-title">'+esc(s.session_type)+'</div><div class="row-sub">'+fmt(s.session_date)+(s.note?' · '+esc(s.note):'')+'</div></div><div class="session-summary"><span class="badge b-green">'+P.length+' P</span><span class="badge b-red">'+X.length+' A</span><span class="badge b-blue">'+I.length+' I</span>'+'</div></div><div class="register-groups">'+group('Presenti',P,'b-green')+group('Assenti',X,'b-red')+group('Infortunati',I,'b-blue')+'</div><div class="session-tools"><button class="primary" '+(!canOperate()?'hidden ':'')+'data-edit-session="'+s.id+'">Correggi presenze</button><button class="ghost" data-session-history="'+s.id+'">Storico modifiche</button></div><div class="row-sub session-updated">'+(s.updated_at?'Ultimo salvataggio: '+esc(new Intl.DateTimeFormat('it-IT',{dateStyle:'short',timeStyle:'short'}).format(new Date(s.updated_at))):'Storico importato · nessuna modifica tracciata')+'</div></div>'}).join('')+trainingCards;
 }
 function drawCalendar(){
  const first=new Date(year,month,1),last=new Date(year,month+1,0),start=(first.getDay()+6)%7;
  title.textContent=new Intl.DateTimeFormat('it-IT',{month:'long',year:'numeric'}).format(first);
  let html='';for(let i=0;i<start;i++)html+='<span class="calendar-day blank"></span>';
  for(let day=1;day<=last.getDate();day++){const key=year+'-'+String(month+1).padStart(2,'0')+'-'+String(day).padStart(2,'0');html+='<button class="calendar-day '+(activity.has(key)?'has-activity ':'')+(selected===key?'selected':'')+'" aria-pressed="'+(selected===key)+'" aria-label="'+esc(new Intl.DateTimeFormat('it-IT',{day:'numeric',month:'long',year:'numeric'}).format(new Date(year,month,day))+(activity.has(key)?' · attività registrata':''))+'" data-date="'+key+'"><span>'+day+'</span>'+(activity.has(key)?'<i aria-hidden="true"></i>':'')+'</button>'}
  grid.innerHTML=html;grid.querySelectorAll('[data-date]').forEach(b=>b.onclick=()=>{selected=b.dataset.date;state.registerDate=selected;remember();drawCalendar();drawDetail();grid.querySelector('[aria-pressed="true"]')?.focus({preventScroll:true})});
 }
 document.querySelector('#calPrev').onclick=()=>{month--;if(month<0){month=11;year--}remember();drawCalendar()};
 document.querySelector('#calNext').onclick=()=>{month++;if(month>11){month=0;year++}remember();drawCalendar()};
 drawCalendar();drawDetail();
 detail.onclick=async e=>{const training=e.target.closest('[data-register-training]');if(training){if(state.openingActivity)return;await openActivity(training.dataset.registerTraining);return}const edit=e.target.closest('[data-edit-session]'),history=e.target.closest('[data-session-history]');if(edit)editAttendanceSession(edit.dataset.editSession,edit);if(history)sessionHistoryModal(history.dataset.sessionHistory)};
}

const EVENT_TYPES=['Gol','Ammonizione','Espulsione','Sostituzione','Nota'];
const eventTone=event=>{const type=typeof event==='string'?event:event.event_type;return type==='Gol'&&typeof event==='object'&&!event.player_id?'b-red':({Gol:'b-green',Ammonizione:'b-yellow',Espulsione:'b-red',Sostituzione:'b-blue',Nota:'b-gray'}[type]||'b-gray')};
const matchEvents=id=>state.events.filter(e=>e.match_id===id).sort((a,b)=>(a.minute??Infinity)-(b.minute??Infinity)||(a.created_at||'').localeCompare(b.created_at||''));
function matchesPage(){return `<div class="section-title"><div><h2>Partite</h2><div class="muted">Risultati, eventi e appunti dal campo</div></div><button class="primary" id="addMatch">+ Partita</button></div>${renderExtensions("match-tools")}<div class="match-list">${state.matches.map(m=>{const ev=matchEvents(m.id);return `<article class="card match-card"><div class="match-meta"><span>${fmt(m.match_date)}</span><span class="badge b-blue">${esc(m.venue)}</span></div><div class="match-heading"><h3>${esc(matchTitle(m))}</h3><strong class="match-score" aria-label="Risultato">${matchScore(m)}</strong></div>${m.note?`<p class="match-note-preview">${esc(m.note)}</p>`:''}<div class="match-card-footer"><span class="row-sub">${ev.length} eventi${m.note?' · Note presenti':''}</span><button data-match="${m.id}">Gestisci partita →</button></div></article>`}).join('')||'<div class="empty card">Nessuna partita.<br>Aggiungi la prossima gara per registrare eventi e note.</div>'}</div>`}
function bindMatches(){document.querySelector('#addMatch').onclick=()=>matchModal();document.querySelectorAll('[data-match]').forEach(b=>b.onclick=()=>matchModal(state.matches.find(x=>x.id===b.dataset.match)))}
function matchModal(m={}){if(!m.id&&!canPlan())return;if(!canOperate()){if(m.id)readonlyActivity(state.activities.find(a=>a.match_id===m.id)||{id:null,title:m.opponent,activity_type:'Partita',activity_date:m.match_date,match_id:m.id,status:'Concluso'});return}
 if(!m.id)return activityModal({activity_type:'Partita'});
 const activity=state.activities.find(a=>a.match_id===m.id);
 if(activity)return openActivity(activity.id,m.match_date>=today()&&m.goals_for==null&&m.goals_against==null?'roster':'results');
 toast('Attività della partita non disponibile. Ricarica la squadra.');
}
function eventModal(matchId,event={},onSaved=()=>{},context={}){
 if(!canOperate())return;
 const inline=!!context.container,root=document.createElement('div'),requestId=event.id||crypto.randomUUID();
 root.className=inline?'inline-match-event':'modal-back event-back';
 const current=teamRequestGuard();let type=event.event_type||'Gol',busy=false;
 const match=state.matches.find(m=>m.id===matchId),activity=state.activities.find(a=>a.match_id===matchId),roster=state.roster.filter(r=>r.activity_id===activity?.id);
 const people=sortPlayers(state.players.filter(p=>p.active||p.id===event.player_id||p.id===event.outgoing_player_id||roster.some(r=>r.player_id===p.id&&r.called)));
 const options=(selected,placeholder)=>`<option value="">${placeholder}</option>`+people.map(p=>`<option value="${p.id}" ${p.id===selected?'selected':''}>${esc(p.surname)} ${esc(p.name)}</option>`).join('');
 const formTag=inline?'div':'form';
 root.innerHTML=`<section class="${inline?'event-editor':'modal'}" role="${inline?'region':'dialog'}" ${inline?'':'aria-modal="true"'} aria-labelledby="eventTitle"><div class="${inline?'inline-event-head':'modal-head'}"><h2 id="eventTitle">${event.id?'Modifica evento':type==='Sostituzione'?'Sostituzione':type==='Gol'?(context.team==='own'?'Gol Eburum':context.team==='opponent'?'Gol Squadra avversaria':'Nuovo gol'):type==='Ammonizione'?'Ammonizione':'Nuovo evento'}</h2><button type="button" id="close" aria-label="Chiudi evento">${inline?'Annulla':'✕'}</button></div><${formTag} id="eventForm"><div class="event-types" ${context.quick?'hidden':''}>${EVENT_TYPES.map(t=>`<button type="button" data-event-type="${t}" class="${type===t?'selected':''}" aria-pressed="${type===t}">${t}</button>`).join('')}</div><div class="form-grid field-space event-fields"><div class="field"><label for="eventMinute">Minuto (facoltativo)</label><input id="eventMinute" type="number" inputmode="numeric" min="0" max="130" step="1" value="${event.minute??''}" placeholder="Es. 65"></div><div class="field" data-event-person><label for="eventPlayer" id="eventPlayerLabel">Giocatore</label><select id="eventPlayer">${options(event.player_id,'Squadra avversaria')}</select></div><div class="field" id="outgoingField" hidden><label for="eventOutgoing">Esce</label><select id="eventOutgoing">${options(event.outgoing_player_id,'Seleziona uscente')}</select></div></div><label class="event-penalty" hidden><input id="eventPenalty" type="checkbox" ${/^(rig|rigore|su rigore)(?:\s*·|$)/i.test(event.detail||'')?'checked':''}>Su rigore</label><p id="substitutionMinutesPreview" class="substitution-preview" role="status" hidden></p><details class="event-notes field-space" ${event.detail||type==='Nota'?'open':''}><summary>Dettagli facoltativi</summary><div class="field field-space"><label for="eventDetail">Dettagli</label><textarea id="eventDetail" rows="2" maxlength="10000" placeholder="Descrivi l’evento…">${esc(event.detail||'')}</textarea></div></details><p class="row-sub" id="eventHint"></p><div class="${inline?'inline-event-actions':'modal-actions'}"><button class="primary" data-save-event type="${inline?'button':'submit'}">Salva evento</button>${event.id&&isAdmin()?'<button class="danger" type="button" id="deleteEvent">Elimina evento</button>':''}</div><p id="eventFeedback" role="status"></p></${formTag}></section>`;
 (context.container||document.body).appendChild(root);
 const $=selector=>root.querySelector(selector),changed=()=>{root.dataset.editorType=type;root.dataset.editorTeam=context.team||($('#eventPlayer').value?'own':'opponent');context.onStateChange?.();root.dispatchEvent(new Event('match-statechange',{bubbles:true}))};
 const setBusy=value=>{busy=value;root.dataset.busy=String(value);setBusyControls(root,value);changed()};
 const close=trackDialogDraft(root,()=>busy);$('#close').onclick=()=>{close();changed()};
 if(!inline)bindDialog(root,()=>$('#close').click());
 const preview=()=>{
  const el=$('#substitutionMinutesPreview');el.hidden=type!=='Sostituzione';if(el.hidden)return;
  if(!match?.minutes_auto){el.textContent='Minuti manuali: attiva il calcolo automatico nelle impostazioni della partita.';return}
  const incoming=$('#eventPlayer').value,outgoing=$('#eventOutgoing').value,value=$('#eventMinute').value;
  if(!incoming||!outgoing||value===''){el.textContent=`Gara da ${match.duration_minutes??90}′ · Scegli chi esce, chi entra e il minuto.`;return}
  try{const candidate={...event,id:requestId,created_at:event.created_at||new Date().toISOString(),event_type:type,player_id:incoming,outgoing_player_id:outgoing,minute:Number(value)},minutes=calculateMatchMinutes(match.duration_minutes??90,roster,[...matchEvents(matchId).filter(e=>e.id!==event.id),candidate]);el.textContent=`Uscente: ${minutes.get(outgoing)}′ · Subentrato: ${minutes.get(incoming)}′`;}catch(error){el.textContent=error.message}
 };
 const filterSubstitutions=()=>{
  if(type!=='Sostituzione')return;
  const value=$('#eventMinute').value,minute=value===''?Infinity:Number(value),onPitch=new Set(roster.filter(r=>r.called&&r.lineup==='Titolare').map(r=>r.player_id)),used=new Set(onPitch);
  for(const e of matchEvents(matchId).filter(e=>e.id!==event.id&&(e.minute??Infinity)<=minute)){
   if(e.event_type==='Sostituzione'){onPitch.delete(e.outgoing_player_id);onPitch.add(e.player_id);used.add(e.player_id)}
   if(e.event_type==='Espulsione'&&e.player_id){onPitch.delete(e.player_id);used.add(e.player_id)}
  }
  for(const option of $('#eventOutgoing').options)if(option.value)option.hidden=!onPitch.has(option.value)&&option.value!==event.outgoing_player_id;
  for(const option of $('#eventPlayer').options)if(option.value)option.hidden=(!roster.some(r=>r.called&&r.player_id===option.value)||used.has(option.value))&&option.value!==event.player_id;
 };
 const hint=()=>{
  $('label[for=eventMinute]').textContent=type==='Sostituzione'?'Minuto del cambio':type==='Espulsione'?'Minuto dell’espulsione':'Minuto (facoltativo)';
  $('#eventMinute').required=type==='Sostituzione';$('#outgoingField').hidden=type!=='Sostituzione';
  $('[data-event-person]').hidden=type==='Gol'&&context.team==='opponent';
  $('#eventPlayerLabel').textContent=type==='Sostituzione'?'Entra':type==='Gol'?'Marcatore Eburum':'Giocatore';
  $('#eventPlayer').options[0].textContent=type==='Gol'?(context.team==='own'?'Seleziona marcatore':'Squadra avversaria'):type==='Sostituzione'?'Seleziona subentrato':'Giocatore non indicato';
  if(type==='Sostituzione')$('.event-fields').append($('#outgoingField'),$('[data-event-person]'));
  $('.event-penalty').hidden=type!=='Gol';
  if(type==='Nota')$('.event-notes').open=true;
  $('#eventHint').textContent=type==='Gol'?'Il gol aggiorna anche il risultato.':type==='Sostituzione'?'I minuti si aggiornano al salvataggio.':type==='Espulsione'?'Associa un giocatore per monitorare la squalifica in Cartellini e diffide. La durata si registra dal comunicato ufficiale.':type==='Nota'?'Inserisci il testo della nota.':'';
  filterSubstitutions();preview();
 };
 $('#eventForm').addEventListener('input',()=>{filterSubstitutions();preview();changed()});$('#eventForm').addEventListener('change',()=>{filterSubstitutions();preview();changed()});
 $('#eventPenalty').onchange=()=>{const detail=$('#eventDetail');if($('#eventPenalty').checked){if(!/\brig(?:ore)?\b/i.test(detail.value))detail.value=detail.value.trim()?'RIG · '+detail.value.trim():'RIG'}else detail.value=detail.value.replace(/^\s*(?:Su rigore|Rigore|RIG)(?:\s*·\s*|$)/i,'');};
 root.querySelectorAll('[data-event-type]').forEach(b=>b.onclick=()=>{type=b.dataset.eventType;root.dataset.dirty='true';root.querySelectorAll('[data-event-type]').forEach(x=>{x.classList.toggle('selected',x===b);x.setAttribute('aria-pressed',String(x===b))});hint();changed()});
 hint();changed();
 $('#eventForm').onsubmit=async e=>{
  e.preventDefault();e.stopPropagation?.();if(busy||!current()||!root.isConnected)return;
  try{
   const value=$('#eventMinute').value,minute=value===''?null:Number(value),detail=$('#eventDetail').value.trim()||null;
   if(minute!==null&&(!Number.isInteger(minute)||minute<0||minute>130))throw Error('Il minuto deve essere un intero da 0 a 130');
   if(type==='Gol'&&context.team==='own'&&!$('#eventPlayer').value)throw Error('Seleziona il marcatore Eburum. Per gli avversari usa Gol avversari.');
   if(type==='Sostituzione'&&(!$('#eventPlayer').value||!$('#eventOutgoing').value||$('#eventPlayer').value===$('#eventOutgoing').value||minute===null))throw Error('Seleziona due giocatori diversi e il minuto della sostituzione');
   if(type==='Nota'&&!detail)throw Error('Inserisci il testo della nota');
   setBusy(true);
   const row={user_id:teamOwner(),match_id:matchId,player_id:type==='Gol'&&context.team==='opponent'?null:$('#eventPlayer').value||null,minute,event_type:type,detail,outgoing_player_id:type==='Sostituzione'?$('#eventOutgoing').value:null};
   const query=event.id?db.from('match_events').update(row).eq('id',event.id).eq('match_id',matchId).eq('user_id',teamOwner()):db.from('match_events').insert({...row,id:requestId});
   let {data,error}=await query.select().single();
   if(error?.code==='23505'&&!event.id){const prior=await db.from('match_events').select('*').eq('id',requestId).eq('match_id',matchId).eq('user_id',teamOwner()).single();if(!prior.error&&prior.data&&Object.entries(row).every(([k,v])=>prior.data[k]===v)){data=prior.data;error=null}}
   if(error)throw error;if(!current())return;
   state.events=state.events.filter(x=>x.id!==data.id).concat(data);root.remove();await onSaved();changed();
   if(!inline)toast('Evento salvato');
  }catch(error){if(current()&&root.isConnected)$('#eventFeedback').textContent=error.message||'Evento non salvato. Riprova.'}
  finally{setBusy(false)}
 };
 if(inline){$('[data-save-event]').onclick=()=>$('#eventForm').dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));$('#eventForm').addEventListener('keydown',e=>{if(e.key==='Enter'&&e.target.tagName!=='TEXTAREA'&&e.target.tagName!=='BUTTON'){e.preventDefault();$('#eventForm').dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}))}});}
 if(event.id&&isAdmin())$('#deleteEvent').onclick=async()=>{
  if(busy)return;setBusy(true);
  try{
   if(!(await confirmDialog({message:event.event_type==='Espulsione'?'Eliminare questa espulsione, il relativo provvedimento e le conferme delle gare scontate?':'Eliminare questo evento? Per un gol viene rettificato anche il risultato.',confirmLabel:'Elimina evento',danger:true}))||!current()||!root.isConnected||!isAdmin())return;
   const {error}=await db.from('match_events').delete().eq('id',event.id).eq('match_id',matchId).eq('user_id',teamOwner());
   if(error)throw error;if(!current())return;state.events=state.events.filter(x=>x.id!==event.id);root.remove();await onSaved();changed();
  }catch(error){if(current()&&root.isConnected)$('#eventFeedback').textContent=error.message||'Eliminazione non riuscita'}finally{setBusy(false)}
 };
 if(inline){$('#eventMinute').focus({preventScroll:true});root.scrollIntoView?.({block:'nearest',behavior:'instant'})}
 return root;
}

export { registerPage, bindRegister, EVENT_TYPES, eventTone, matchEvents, matchesPage, bindMatches, matchModal, eventModal };
