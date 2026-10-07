let trainingDraft=null;
const attendanceValues=a=>({status:a.status||'Presente',delay_minutes:a.delay_minutes||0,notified:a.notified??null,note:a.note||null});
const sessionValues=s=>({session_date:s.session_date,session_type:s.session_type,note:s.note||null});
const draftRows=d=>d.players.map(p=>({player_id:p.id,...d.entries.get(p.id)}));
const draftChanged=d=>JSON.stringify({session:d.session,rows:draftRows(d)})!==d.baseline;
function makeTrainingDraft(session=null,rows=[]){
 const players=session?sortPlayers(rows.map(a=>state.players.find(p=>p.id===a.player_id)||{id:a.player_id,surname:'Giocatore storico',name:'',role:'',active:false})):activePlayers();
 const entries=new Map(players.map(p=>[p.id,attendanceValues(session?rows.find(a=>a.player_id===p.id):{})]));
 const draft={userId:state.user.id,id:session?.id||null,revision:session?.revision??0,session:session?sessionValues(session):{session_date:today(),session_type:'Allenamento',note:null},players,entries,search:'',filter:'all',requestId:crypto.randomUUID(),saving:false};
 draft.baseline=JSON.stringify({session:draft.session,rows:draftRows(draft)});return draft;
}
function getTrainingDraft(){if(!trainingDraft||trainingDraft.userId!==state.user.id)trainingDraft=makeTrainingDraft();return trainingDraft}
function trainingPage(){
 const d=getTrainingDraft();
 return `<div class="section-title"><div><h2>${d.id?'Correggi sessione':'Allenamento rapido'}</h2><div class="muted">${d.id?'Modifica le presenze già registrate':'Tutti presenti: modifica solo le eccezioni'}</div></div>${d.id?'<button class="ghost" id="newTraining">Nuova</button>':`<span class="badge b-blue">${d.players.length} giocatori</span>`}</div><div class="card"><div class="form-grid"><div class="field"><label for="td">Data</label><input id="td" type="date" required value="${d.session.session_date}"></div><div class="field"><label for="tt">Tipo</label><select id="tt">${['Allenamento','Partita','Riunione'].map(t=>`<option ${d.session.session_type===t?'selected':''}>${t}</option>`).join('')}</select></div></div><div class="field field-space"><label for="tn">Nota sessione</label><textarea id="tn" rows="2" maxlength="10000" placeholder="Appunti sull’allenamento…">${esc(d.session.note||'')}</textarea></div>${d.id?'<p class="row-sub">La rosa di questa sessione include anche i giocatori oggi inattivi.</p>':''}</div><div class="training-controls"><div class="field"><label for="trainingSearch">Cerca un giocatore</label><input id="trainingSearch" type="search" value="${esc(d.search)}" placeholder="Nome, cognome o ruolo" autocomplete="off"></div><div class="attendance-filters" role="group" aria-label="Filtra presenze"><button data-attendance-filter="all">Tutti</button><button data-attendance-filter="exceptions">Eccezioni</button></div><div id="trainingCounts" class="attendance-counts" aria-live="polite"></div><div class="row-sub" id="trainingVisible" aria-live="polite"></div></div><div class="list" id="trainList"></div><div class="training-save"><button class="primary wide" id="saveTraining" ${d.saving?'disabled':''}>${d.id?'Riepilogo correzioni':'Riepilogo e salva'}</button><span class="row-sub" id="trainingSaveStatus" role="status">${d.saving?'Salvataggio in corso…':'Bozza non ancora salvata'}</span></div>`;
}
function attendanceCounts(entries){const a=Array.from(entries);return {present:a.filter(x=>x.status==='Presente').length,absent:a.filter(x=>x.status==='Assente').length,injured:a.filter(x=>x.status==='Infortunato').length,delayed:a.filter(x=>x.delay_minutes>0).length}}
function countBadges(c){return `<span class="badge b-green">${c.present} presenti</span><span class="badge b-red">${c.absent} assenti</span><span class="badge b-blue">${c.injured} infortunati</span><span class="badge b-yellow">${c.delayed} ritardi</span>`}
function bindTraining(){
 const d=getTrainingDraft(),box=document.querySelector('#trainList');
 const paint=()=>{
  const query=d.search.trim().toLocaleLowerCase('it'),players=d.players.filter(p=>`${p.surname} ${p.name} ${p.role||''}`.toLocaleLowerCase('it').includes(query)&&(d.filter==='all'||d.entries.get(p.id).status!=='Presente'||d.entries.get(p.id).delay_minutes>0||d.entries.get(p.id).note));
  box.innerHTML=players.map(p=>{const a=d.entries.get(p.id);return `<div class="row attendance-row"><div class="row-main"><div class="row-title">${esc(p.surname)} ${esc(p.name)}</div><div class="row-sub">${esc(p.role||'')}${p.active===false?' · Inattivo':''}</div>${a.note?`<div class="attendance-note">${esc(a.note)}</div>`:''}</div><span class="badge ${badge(a.status)}">${a.status}</span><button data-a="${p.id}" aria-label="Modifica presenza di ${esc(p.surname)} ${esc(p.name)}">Modifica</button>${a.delay_minutes?`<span class="badge b-yellow">${a.delay_minutes} min</span>`:''}</div>`}).join('')||'<div class="card empty">Nessun giocatore corrisponde ai filtri.</div>';
  document.querySelector('#trainingCounts').innerHTML=countBadges(attendanceCounts(d.entries.values()));
  document.querySelector('#trainingVisible').textContent=`${players.length} di ${d.players.length} giocatori mostrati. Il salvataggio include tutta la sessione.`;
  document.querySelectorAll('[data-attendance-filter]').forEach(b=>{b.classList.toggle('active',b.dataset.attendanceFilter===d.filter);b.setAttribute('aria-pressed',String(b.dataset.attendanceFilter===d.filter))});
 };paint();
 document.querySelector('#trainingSearch').oninput=e=>{d.search=e.target.value;paint()};
 document.querySelectorAll('[data-attendance-filter]').forEach(b=>b.onclick=()=>{d.filter=b.dataset.attendanceFilter;paint()});
 box.onclick=e=>{const b=e.target.closest('[data-a]');if(b&&!d.saving)attendanceModal(b.dataset.a,d.entries,paint,d.players)};
 for(const [id,key] of [['td','session_date'],['tt','session_type'],['tn','note']])document.querySelector('#'+id).oninput=e=>{d.session[key]=key==='note'?(e.target.value.trim()||null):e.target.value};
 document.querySelector('#saveTraining').onclick=()=>reviewTrainingDraft(d);
 const newButton=document.querySelector('#newTraining');if(newButton)newButton.onclick=()=>{if(d.saving)return;if(draftChanged(d)&&!confirm('Scartare le correzioni non salvate e iniziare una nuova sessione?'))return;trainingDraft=null;render()};
}
async function editAttendanceSession(id,button){
 if(trainingDraft?.saving)return toast('Attendi il salvataggio in corso');
 if(trainingDraft&&draftChanged(trainingDraft)&&!confirm('Aprire questa sessione e scartare la bozza non salvata?'))return;
 if(button)button.disabled=true;
 try{
  const actor=state.user.id,uid=teamOwner();
  const [session,attendance]=await Promise.all([db.from('sessions').select('*').eq('id',id).eq('user_id',uid).single(),fetchAllRows(()=>db.from('attendance').select('*').eq('session_id',id).eq('user_id',uid).order('id'))]);
  if(session.error)throw session.error;if(attendance.error)throw attendance.error;
  if(!attendance.data.length)throw new Error('Questa sessione non contiene presenze da correggere');
  if(state.user?.id!==actor)return;
  trainingDraft=makeTrainingDraft(session.data,attendance.data);state.page='training';render();window.scrollTo(0,0);
 }catch(error){fail(error)}finally{if(button)button.disabled=false}
}
function reviewTrainingDraft(d){
 if(d.saving||document.querySelector('.attendance-review'))return;
 if(!d.session.session_date)return toast('Inserisci la data');
 if(!d.players.length)return toast('Aggiungi almeno un giocatore alla rosa prima di salvare');
 const payload={p_session:{...d.session},p_attendance:draftRows(d),p_session_id:d.id,p_expected_revision:d.id?d.revision:null,p_request_id:d.id?null:d.requestId};
 const old=JSON.parse(d.baseline),changed=payload.p_attendance.filter(a=>JSON.stringify(a)!==JSON.stringify(old.rows.find(x=>x.player_id===a.player_id)));
 const exceptions=payload.p_attendance.filter(a=>a.status!=='Presente'||a.delay_minutes>0||a.note);
 const shown=d.id?changed:exceptions,c=attendanceCounts(payload.p_attendance),root=document.createElement('div');root.className='modal-back';
 root.innerHTML=`<section class="modal attendance-review" role="dialog" aria-modal="true" aria-labelledby="reviewTitle"><div class="modal-head"><h2 id="reviewTitle">${d.id?'Riepilogo correzioni':'Riepilogo sessione'}</h2><button id="closeReview" aria-label="Torna alla bozza">✕</button></div><p><b>${esc(d.session.session_type)}</b> · ${fmt(d.session.session_date)}</p><div class="attendance-counts">${countBadges(c)}</div>${d.session.note?`<p class="attendance-note">${esc(d.session.note)}</p>`:''}<h3>${d.id?`${changed.length} presenze modificate`:'Eccezioni da registrare'}</h3><div class="list">${shown.map(a=>{const p=d.players.find(p=>p.id===a.player_id),previous=old.rows.find(x=>x.player_id===a.player_id);return `<div class="review-person"><b>${esc(p.surname)} ${esc(p.name)}</b><div>${d.id&&previous?.status!==a.status?`${esc(previous.status)} → `:''}<span class="badge ${badge(a.status)}">${a.status}</span>${a.delay_minutes?` · ${a.delay_minutes} min di ritardo`:''}</div>${a.notified!==null?`<small>Ha avvisato: ${a.notified?'sì':'no'}</small>`:''}${a.note?`<p>${esc(a.note)}</p>`:''}</div>`}).join('')||`<div class="notice">${d.id?'Nessuna presenza modificata. Verranno salvate le eventuali modifiche a data, tipo o nota.':'Tutti presenti, nessuna eccezione.'}</div>`}</div><p class="muted">${d.id?'Lo storico delle modifiche registrerà autore e orario.':`Verranno salvate le presenze di tutti i ${d.players.length} giocatori, anche quelli nascosti dalla ricerca.`}</p><div class="modal-actions"><button class="ghost" id="backToDraft">Torna alla bozza</button><button class="primary" id="confirmTraining">Conferma e salva</button></div><p id="reviewStatus" role="status" aria-live="polite"></p></section>`;
 document.body.appendChild(root);
 const close=()=>{if(!d.saving)root.remove()};root.querySelector('#closeReview').onclick=close;root.querySelector('#backToDraft').onclick=close;bindDialog(root,close);
 root.querySelector('#confirmTraining').onclick=async()=>{
  if(d.saving)return;d.saving=true;root.querySelectorAll('button').forEach(b=>b.disabled=true);root.querySelector('#reviewStatus').textContent='Salvataggio in corso…';const mainButton=document.querySelector('#saveTraining');if(mainButton)mainButton.disabled=true;
  try{
   const {data,error}=await db.rpc('save_attendance_session',payload);if(error)throw error;
   if(!data?.session?.id)throw new Error('Risposta del salvataggio non valida');
   root.remove();if(state.user?.id!==d.userId)return;
   if(trainingDraft===d)trainingDraft=null;
   state.registerDate=data.session.session_date;state.page='register';
   let refreshed=false;try{refreshed=await refresh()}catch(error){fail(error)}
   if(state.user?.id!==d.userId)return;
   toast(refreshed?(d.id?'Correzioni salvate':'Sessione salvata'):'Salvataggio riuscito. Riprova il caricamento della squadra.');window.scrollTo(0,0);
  }catch(error){const message=error.code==='23505'?'Esiste già una sessione con questa data e tipo. Correggila dal Registro.':error.message||'Salvataggio non riuscito. La bozza è ancora disponibile.';root.querySelector('#reviewStatus').textContent=message;root.querySelectorAll('button').forEach(b=>b.disabled=false);root.querySelector('#confirmTraining').textContent=error.code==='40001'?'Riapri dal Registro':'Riprova salvataggio';if(error.code==='40001')root.querySelector('#confirmTraining').onclick=()=>{root.remove();state.registerDate=d.session.session_date;state.page='register';render();toast('Riapri la sessione aggiornata; la tua bozza resta disponibile')}}
  finally{d.saving=false;if(mainButton)mainButton.disabled=false}
 };
}
function attendanceModal(id,local,paint,players=state.players){
 const a=local.get(id),p=players.find(x=>x.id===id),root=document.createElement('div');root.className='modal-back';
 root.innerHTML=`<section class="modal" role="dialog" aria-modal="true" aria-labelledby="attendanceTitle"><div class="modal-head"><h2 id="attendanceTitle">${esc(p.surname)} ${esc(p.name)}</h2><button id="close" aria-label="Chiudi presenza">✕</button></div><div class="status-grid">${['Presente','Assente','Infortunato'].map(s=>`<button data-status="${s}" class="${a.status===s?'selected':''}" aria-pressed="${a.status===s}">${s}</button>`).join('')}</div><div class="form-grid field-space"><div class="field"><label for="delay">Ritardo (min)</label><input id="delay" type="number" inputmode="numeric" min="0" max="2147483647" step="1" value="${a.delay_minutes||0}"></div><div class="field"><label for="not">Ha avvisato?</label><select id="not"><option value="">Non indicato</option><option value="true" ${a.notified===true?'selected':''}>Sì</option><option value="false" ${a.notified===false?'selected':''}>No</option></select></div></div><div class="field field-space"><label for="note">Nota</label><textarea id="note" rows="3" maxlength="10000">${esc(a.note||'')}</textarea></div><p id="attendanceError" role="status"></p><button class="primary wide field-space" id="ok">Conferma presenza</button></section>`;
 document.body.appendChild(root);let chosen=a.status;
 root.querySelectorAll('[data-status]').forEach(b=>b.onclick=()=>{chosen=b.dataset.status;root.querySelectorAll('[data-status]').forEach(x=>{x.classList.toggle('selected',x.dataset.status===chosen);x.setAttribute('aria-pressed',String(x.dataset.status===chosen))})});
 const close=()=>root.remove();root.querySelector('#close').onclick=close;bindDialog(root,close);
 root.querySelector('#ok').onclick=()=>{const delay=Number(root.querySelector('#delay').value);if(!Number.isInteger(delay)||delay<0||delay>2147483647){root.querySelector('#attendanceError').textContent='Inserisci minuti interi positivi o zero';return}local.set(id,{status:chosen,delay_minutes:delay,notified:root.querySelector('#not').value===''?null:root.querySelector('#not').value==='true',note:root.querySelector('#note').value.trim()||null});root.remove();paint()};
}
function historyValue(key,value){if(value==null||value==='')return 'Non indicato';if(key==='notified')return value?'Sì':'No';if(key==='session_date')return fmt(value);if(key==='delay_minutes')return `${value} min`;return String(value)}
function sessionHistoryModal(id){
 const root=document.createElement('div');root.className='modal-back';root.innerHTML=`<section class="modal" role="dialog" aria-modal="true" aria-labelledby="historyTitle"><div class="modal-head"><h2 id="historyTitle">Storico modifiche</h2><button id="closeHistory" aria-label="Chiudi storico">✕</button></div><p class="muted">Le correzioni vengono tracciate da questo aggiornamento. Le modifiche precedenti non sono ricostruibili.</p><div class="list" id="historyList" aria-live="polite">Caricamento…</div><button class="ghost wide field-space" id="loadMoreHistory" hidden>Carica precedenti</button></section>`;document.body.appendChild(root);root.querySelector('#closeHistory').onclick=()=>root.remove();bindDialog(root,()=>root.remove());
 let offset=0;const labels={status:'Stato',delay_minutes:'Ritardo',notified:'Ha avvisato',note:'Nota',session_date:'Data',session_type:'Tipo'};
 const load=async()=>{const button=root.querySelector('#loadMoreHistory');button.disabled=true;try{const {data,error}=await db.from('attendance_history').select('*').eq('user_id',teamOwner()).eq('session_id',id).eq('action','UPDATE').order('changed_at',{ascending:false}).order('id').range(offset,offset+19);if(error)throw error;if(offset===0)root.querySelector('#historyList').innerHTML='';root.querySelector('#historyList').insertAdjacentHTML('beforeend',data.map(h=>{const p=state.players.find(x=>x.id===h.player_id),actor=h.actor_id===state.user.id?(state.user.email||'Tu'):h.actor_id?'Utente '+h.actor_id.slice(0,8):'Sistema',time=new Intl.DateTimeFormat('it-IT',{dateStyle:'short',timeStyle:'short'}).format(new Date(h.changed_at));return `<article class="history-change"><b>${h.entity==='session'?'Dati sessione':esc(p?`${p.surname} ${p.name}`:'Giocatore storico')}</b><div class="row-sub">${esc(actor)} · ${esc(time)}</div>${Object.entries(labels).filter(([key])=>JSON.stringify(h.before_data?.[key])!==JSON.stringify(h.after_data?.[key])).map(([key,label])=>`<div class="history-field"><strong>${label}</strong><span>${esc(historyValue(key,h.before_data?.[key]))} → ${esc(historyValue(key,h.after_data?.[key]))}</span></div>`).join('')}</article>`}).join(''));if(offset===0&&!data.length)root.querySelector('#historyList').innerHTML='<div class="empty">Nessuna correzione registrata dall’attivazione dello storico.</div>';offset+=data.length;button.hidden=data.length<20}catch(error){if(!offset)root.querySelector('#historyList').textContent=error.message;else toast('Impossibile caricare altre modifiche')}finally{button.disabled=false}};
 root.querySelector('#loadMoreHistory').onclick=load;load();
}
