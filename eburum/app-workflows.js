import { bindDialog } from './app-dialogs.js';
import { registerBinder } from './app-hooks.js';
import { copyOperationalText } from './app-operations.js';
import { esc, fmt, render, sortPlayers, state, toast, today } from './app-part1.js';
import { actualTrainingPage, bindActualTraining, draftChanged, draftRows, editAttendanceSession, getTrainingDraft, makeTrainingDraft } from './app-part3.js';
import { activityLabel, activityModal, activityRows, openActivity } from './app-team.js';

/* Operational workflows: planned replies, actual attendance and contextual priorities. */
function localISO(date){return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`}
function recentFrom(days=30){const d=new Date(today()+'T12:00:00');d.setDate(d.getDate()-days+1);return localISO(d)}
const rosterIndexes=new WeakMap();
function indexedActivityRows(id){const rows=state.roster||[];let cached=rosterIndexes.get(rows);if(!cached||cached.length!==rows.length){const index=new Map();for(const r of rows){if(!index.has(r.activity_id))index.set(r.activity_id,[]);index.get(r.activity_id).push(r)}cached={length:rows.length,index};rosterIndexes.set(rows,cached)}return cached.index.get(id)||[]}
function activityPeople(a){const ids=new Set(indexedActivityRows(a.id).map(r=>r.player_id));return sortPlayers(state.players.filter(p=>p.active||ids.has(p.id)))}
function pollEntries(a){const rows=new Map(indexedActivityRows(a.id).map(r=>[r.player_id,r]));return activityPeople(a).map(p=>({player:p,row:rows.get(p.id)||{player_id:p.id,availability:'In attesa',called:false}}))}
function activityPollPending(a){return pollEntries(a).filter(x=>x.row.availability==='In attesa').length}
function matchPhase(a){
 if(a.status==='Annullato')return 'cancelled';if(a.status==='Concluso'||a.activity_date<today())return 'after';
 if(a.activity_date>today())return 'before';const now=new Intl.DateTimeFormat('it-IT',{hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date());
 if(a.end_time&&now>=a.end_time.slice(0,5))return 'after';return a.start_time&&now>=a.start_time.slice(0,5)?'during':'before';
}
function activityHasEnded(a){if(a.status!=='Programmato')return false;return a.activity_date<today()||(a.activity_date===today()&&a.end_time&&matchPhase(a)==='after')}
function trainingActivity(d){return (state.activities||[]).find(a=>a.status!=='Annullato'&&(d.id?a.session_id===d.id:a.activity_date===d.session.session_date&&a.activity_type===d.session.session_type))}
function seedPlannedReplies(d,a){
 d.activityId=a.id;d.planned=new Map(activityRows(a.id).map(r=>[r.player_id,r.availability]));
 for(const [id,row] of d.entries){const response=activityRows(a.id).find(r=>r.player_id===id);if(response)row.notified=response.availability==='In attesa'?false:true}
}
function startActualAttendance(a,discardConfirmed=false){
 if(a.status==='Annullato')return toast('L’attività è annullata');
 if(a.activity_date>today())return toast('Per una data futura registra le disponibilità nel sondaggio. Le presenze si confermano dopo l’attività.');
 if(a.session_id)return editAttendanceSession(a.session_id,null,discardConfirmed);
 if(state.trainingDraft?.saving)return toast('Attendi il salvataggio in corso');
 if(!discardConfirmed&&state.trainingDraft&&draftChanged(state.trainingDraft)&&!confirm('Scartare la bozza presenze non salvata?'))return;
 state.trainingDraft=makeTrainingDraft();state.trainingDraft.session={session_date:a.activity_date,session_type:a.activity_type,note:null};seedPlannedReplies(state.trainingDraft,a);
 state.trainingDraft.baseline=JSON.stringify({session:state.trainingDraft.session,rows:draftRows(state.trainingDraft)});state.page='training';state.trainingMode='actual';render();window.scrollTo(0,0);
}
const busyControlStates=new WeakMap();
function setBusyControls(container,busy){if(!container)return;if(busy){if(busyControlStates.has(container))return;const controls=[...container.querySelectorAll('button,input,select,textarea')];busyControlStates.set(container,controls.map(el=>[el,el.disabled]));controls.forEach(el=>el.disabled=true);container.setAttribute('aria-busy','true')}else{for(const [el,disabled] of busyControlStates.get(container)||[])el.disabled=disabled;busyControlStates.delete(container);container.removeAttribute('aria-busy')}}
function priorityModal(kind){
 const upcoming=(state.activities||[]).filter(a=>a.status==='Programmato'&&a.activity_date>=today()).sort((a,b)=>(a.activity_date+(a.start_time||'')).localeCompare(b.activity_date+(b.start_time||'')));
 const list=kind==='poll'?upcoming.filter(a=>activityPollPending(a)>0):(state.activities||[]).filter(activityHasEnded).sort((a,b)=>a.activity_date.localeCompare(b.activity_date));
 const root=document.createElement('div');root.className='modal-back';root.innerHTML=`<section class="modal" role="dialog" aria-modal="true" aria-labelledby="priorityTitle"><div class="modal-head"><h2 id="priorityTitle">${kind==='poll'?'Sondaggi da completare':'Attività da completare'}</h2><button aria-label="Chiudi priorità">✕</button></div><p class="muted">${kind==='poll'?'Risposte ancora da registrare per attività programmate.':'Attività trascorse da verificare: conferma le presenze o aggiorna lo stato nell’Agenda.'}</p><div class="list">${list.map(a=>`<button class="priority-row" data-priority-activity="${a.id}"><span><b>${esc(activityLabel(a))}</b><small>${fmt(a.activity_date)} · ${kind==='poll'?activityPollPending(a)+' risposte in attesa':'Stato da aggiornare'}</small></span><span aria-hidden="true">›</span></button>`).join('')||'<p class="empty">Tutto aggiornato.</p>'}</div></section>`;document.body.append(root);const close=()=>root.remove();root.querySelector('.modal-head button').onclick=close;bindDialog(root,close);root.querySelectorAll('[data-priority-activity]').forEach(b=>b.onclick=()=>{close();openActivity(b.dataset.priorityActivity,kind==='poll'?'roster':undefined)});
}
function surveyHub(){
 const activities=(state.activities||[]).filter(a=>a.status!=='Annullato'&&a.activity_type!=='Partita').sort((a,b)=>b.activity_date.localeCompare(a.activity_date));
 return `<div class="section-title"><div><h2>Sondaggio allenamento</h2><p class="muted">Prima dell’attività registra le disponibilità. Dopo, conferma le presenze effettive.</p></div></div><div class="workflow-switch" role="group" aria-label="Fase allenamento"><button data-training-mode="survey" aria-pressed="true">1. Sondaggio</button><button data-training-mode="actual" aria-pressed="false">2. Presenze</button></div><section class="card"><div class="field"><label for="surveyActivity">Attività da gestire</label><select id="surveyActivity"><option value="">Seleziona un’attività</option>${activities.map(a=>`<option value="${a.id}">${fmt(a.activity_date)} · ${esc(a.title)}${a.session_id?' · Presenze registrate':''}</option>`).join('')}</select></div><div class="session-tools"><button class="primary" id="openSurvey">Apri sondaggio</button><button id="newSurvey">Nuovo sondaggio</button></div><p id="surveyHubStatus" class="row-sub" role="status">Le disponibilità salvate non entrano nel conteggio delle presenze.</p></section><div class="list field-space">${activities.filter(a=>a.status==='Programmato'&&a.activity_date>=today()).slice(0,5).map(a=>`<button class="priority-row" data-poll-activity="${a.id}"><span><b>${esc(a.title)}</b><small>${fmt(a.activity_date)} · ${activityPollPending(a)} risposte da registrare</small></span><span aria-hidden="true">›</span></button>`).join('')||'<p class="empty">Programma il prossimo allenamento per preparare il sondaggio.</p>'}</div>`;
}
function trainingModeTabs(){return '<div class="workflow-switch" role="group" aria-label="Fase allenamento"><button data-training-mode="survey" aria-pressed="false">1. Sondaggio</button><button data-training-mode="actual" aria-pressed="true">2. Presenze</button></div>'}
function trainingPage(){return state.trainingMode==='survey'?surveyHub():actualTrainingPage()}
function bindTraining(){
 const switchMode=mode=>{if(state.trainingDraft?.saving)return toast('Attendi il salvataggio in corso');state.trainingMode=mode;render();window.scrollTo(0,0)};
 if(state.trainingMode==='survey'){
  document.querySelector('#openSurvey').onclick=()=>{const id=document.querySelector('#surveyActivity').value;if(!id){document.querySelector('#surveyHubStatus').textContent='Seleziona un’attività oppure crea un nuovo sondaggio.';return}openActivity(id,'roster')};
  document.querySelector('#newSurvey').onclick=()=>activityModal({activity_type:'Allenamento',activity_date:today(),title:'Allenamento',status:'Programmato'},[],{},'roster');
 }else{
  bindActualTraining();const d=getTrainingDraft(),linked=trainingActivity(d);if(linked&&!d.planned)d.planned=new Map(activityRows(linked.id).map(r=>[r.player_id,r.availability]));
  const info=document.createElement('p');info.className='notice training-stage-note';info.textContent='Presenze effettive: correggi le eccezioni, poi conferma tutta la sessione.';document.querySelector('.training-controls').before(info);if(linked&&!d.id&&!d.activityId){const importButton=document.createElement('button');importButton.type='button';importButton.textContent='Usa le risposte del sondaggio salvato';importButton.id='usePlannedReplies';info.after(importButton);importButton.onclick=()=>{const a=trainingActivity(d);if(!a)return toast('Nessun sondaggio collegato alla data e al tipo selezionati');if([...d.entries.values()].some(r=>r.notified!==null)&&!confirm('Sostituire le risposte al sondaggio in bozza con quelle salvate?'))return;seedPlannedReplies(d,a);render();toast('Risposte importate. Le presenze effettive restano da confermare.')}}
  const summary=document.createElement('p');summary.id='trainingFilterSummary';summary.className='filter-summary';summary.setAttribute('aria-live','polite');document.querySelector('#trainingVisible').after(summary);
  const update=()=>{const a=trainingActivity(d);d.planned=a?new Map(activityRows(a.id).map(r=>[r.player_id,r.availability])):new Map();const labels={all:'Tutti',exceptions:'Eccezioni',yes:'Ha risposto',no:'Non ha risposto',unknown:'Da verificare',pending:'Da sollecitare'};summary.textContent=`Filtro: ${labels[d.filter]||'Tutti'}${d.search?' · Ricerca: '+d.search:''}`;const status=document.querySelector('#trainingSaveStatus');if(status)status.textContent=d.saving?'Salvataggio in corso…':d.id?(draftChanged(d)?'Modifiche non salvate':'Sessione salvata · Nessuna modifica'):'Bozza non ancora salvata';document.querySelectorAll('[data-a]').forEach(b=>{const holder=b.closest('.row').querySelector('.row-main');holder.querySelector('.planned-reply')?.remove();const planned=d.planned?.get(b.dataset.a);if(planned){const label=document.createElement('small');label.className='planned-reply';label.textContent='Disponibilità prevista: '+(planned==='In attesa'?'Non ha risposto':planned);holder.append(label)}})};
  const controls=document.querySelector('.training-controls');controls.addEventListener('click',update);controls.addEventListener('input',update);document.querySelector('#trainList').addEventListener('click',update);const inputRoot=document.querySelector('#app');inputRoot.addEventListener('input',update);
  const observer=new MutationObserver(update);observer.observe(document.querySelector('#trainList'),{childList:true});const cleanup=new MutationObserver(()=>{if(!summary.isConnected){observer.disconnect();cleanup.disconnect();inputRoot.removeEventListener('input',update)}});cleanup.observe(document.querySelector('#app'),{childList:true});update();
 }
 document.querySelectorAll('[data-training-mode]').forEach(b=>b.onclick=()=>switchMode(b.dataset.trainingMode));
};
function configureActivityWorkflow(root,a,entries,players,markDirty,paint){
 const isMatch=a.activity_type==='Partita'||!!a.match_id,rosterPanel=root.querySelector('[data-activity-panel="roster"]');
 root.querySelector('[data-activity-tab="roster"]').textContent=isMatch?'Convocazioni':'Sondaggio';
 root.querySelector('#rosterSearch').placeholder=isMatch?'Cerca giocatore':'Cerca risposta o giocatore';
 let filter='all';
 const filterBar=document.createElement('div');filterBar.className='roster-filters field-space';filterBar.innerHTML=`<div class="workflow-switch" role="group" aria-label="Filtra disponibilità"><button type="button" data-roster-filter="all" aria-pressed="true">Tutti</button><button type="button" data-roster-filter="pending" aria-pressed="false">Non hanno risposto</button>${isMatch?'<button type="button" data-roster-filter="called" aria-pressed="false">Convocati</button>':''}</div><p id="rosterFilterSummary" class="filter-summary" aria-live="polite"></p><button type="button" class="ghost" id="copyActivityReminder">Copia sollecito sondaggio</button><p id="activityReminderStatus" class="row-sub" role="status"></p>`;
 rosterPanel.querySelector('#rosterSearch').after(filterBar);
 filterBar.querySelectorAll('[data-roster-filter]').forEach(b=>b.onclick=()=>{filter=b.dataset.rosterFilter;filterBar.querySelectorAll('[data-roster-filter]').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));paint()});
 const filterRows=()=>{let visible=0;root.querySelectorAll('.roster-person').forEach(el=>{const id=el.querySelector('[data-roster-edit]').dataset.rosterEdit,r=entries.get(id);el.hidden=(filter==='pending'&&r.availability!=='In attesa')||(filter==='called'&&!r.called);if(!el.hidden)visible++});root.querySelector('#rosterFilterSummary').textContent=`${visible} di ${players.length} giocatori · Filtro: ${filter==='pending'?'Non hanno risposto':filter==='called'?'Convocati':'Tutti'}. Il salvataggio include tutta la rosa.`};
 root.querySelector('#copyActivityReminder').onclick=()=>{const waiting=players.filter(p=>entries.get(p.id).availability==='In attesa');const get=id=>root.querySelector('#'+id).value;const text=[`SONDAGGIO EBURUM · ${get('activityType')} · ${fmt(get('activityDate'))}`,!a.id||markDirty(null)?'BOZZA · risposte non ancora salvate':'Risposte salvate',`Non hanno risposto (${waiting.length})`,...waiting.map(p=>`• ${p.surname} ${p.name}`),waiting.length?'Da sollecitare a votare al sondaggio.':'Tutti hanno risposto.'].join('\n');copyOperationalText(text,root.querySelector('#activityReminderStatus'),filterBar)};
 if(isMatch){mountMatchPhases(root,a)}
 else{rosterPanel.querySelector('.notice').textContent='Sondaggio prima dell’attività: disponibile o indisponibile indica la risposta ricevuta. Le presenze effettive si confermano dopo.';root.querySelectorAll('[data-activity-tab="technical"]').forEach(b=>b.hidden=true)}
 return {filterRows,isMatch};
}
function mountMatchPhases(root,a){
 const phase=matchPhase(a),bar=document.createElement('section');bar.className='match-phases';bar.setAttribute('aria-label','Fasi della partita');
 bar.innerHTML=`<div class="workflow-switch" role="group" aria-label="Fase partita"><button type="button" data-match-phase="before" aria-pressed="${phase==='before'}">Prima</button><button type="button" data-match-phase="during" aria-pressed="${phase==='during'}">Durante</button><button type="button" data-match-phase="after" aria-pressed="${phase==='after'}">Dopo</button></div><p id="matchPhaseHint" class="row-sub" role="status"></p><div id="matchPhaseTools" class="phase-tools"></div>`;root.querySelector('.activity-tabs').before(bar);
 const choose=(selected,navigate)=>{const hint=bar.querySelector('#matchPhaseHint'),tools=bar.querySelector('#matchPhaseTools');bar.querySelectorAll('[data-match-phase]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.matchPhase===selected)));
 hint.textContent=selected==='before'?'Prima della gara: disponibilità, convocazioni, ritrovo e formazione.':selected==='during'?'Durante la gara: registra subito gli eventi. Il risultato si salva separatamente.':'Dopo la gara: verifica risultato, minuti effettivi e osservazioni.';
 tools.innerHTML=selected==='before'?'':selected==='during'?'<button type="button" id="quickPhaseEvent" class="primary">+ Evento rapido</button>':'<button type="button" data-phase-tab="results">Risultato e note</button><button type="button" data-phase-tab="roster">Minuti giocati</button>';
 tools.querySelectorAll('[data-phase-tab]').forEach(b=>{b.disabled=!a.match_id;b.onclick=()=>root.querySelector(`[data-activity-tab="${b.dataset.phaseTab}"]`)?.click()});tools.querySelector('#quickPhaseEvent')?.addEventListener('click',()=>{if(!a.match_id)return toast('Salva la partita prima di aggiungere eventi');root.querySelector('[data-activity-tab="results"]')?.click();if(root.querySelector('[data-activity-panel="results"]')?.hidden===false)root.querySelector('#addMatchEvent')?.click()});
 if(navigate)root.querySelector(`[data-activity-tab="${selected==='before'?'details':'results'}"]`)?.click();
 };bar.querySelectorAll('[data-match-phase]').forEach(b=>b.onclick=()=>choose(b.dataset.matchPhase,true));choose(phase==='cancelled'?'after':phase,false);
}
function bindWorkflowLinks(){document.querySelectorAll('[data-priority]').forEach(b=>b.onclick=()=>priorityModal(b.dataset.priority));document.querySelectorAll('[data-poll-activity]').forEach(b=>b.onclick=()=>openActivity(b.dataset.pollActivity,'roster'));document.querySelectorAll('[data-start-actual]').forEach(b=>b.onclick=()=>{const a=state.activities.find(a=>a.id===b.dataset.startActual);if(a)startActualAttendance(a)})};


window.addEventListener('beforeunload',event=>{if((state.trainingDraft&&draftChanged(state.trainingDraft))||document.querySelector('.modal-back[data-dirty="true"]')){event.preventDefault();event.returnValue=''}});

function trackDialogDraft(root,isBusy=()=>false){
 const mark=()=>root.dataset.dirty='true';root.addEventListener('input',mark);root.addEventListener('change',mark);
 return ()=>{if(isBusy())return;if(root.dataset.dirty==='true'&&!confirm('Scartare le modifiche non salvate?'))return;root.remove()};
}

function registerWorkflows(){registerBinder("workflows",bindWorkflowLinks)}

export { localISO, recentFrom, rosterIndexes, indexedActivityRows, activityPeople, pollEntries, activityPollPending, matchPhase, activityHasEnded, trainingActivity, seedPlannedReplies, startActualAttendance, busyControlStates, setBusyControls, priorityModal, surveyHub, trainingModeTabs, trainingPage, bindTraining, configureActivityWorkflow, mountMatchPhases, bindWorkflowLinks, trackDialogDraft, registerWorkflows };
