import { confirmDialog } from './app-confirm.js';
import { icon } from './app-icons.js';
import { trainingHub, bindTrainingHub } from './app-training-planning.js';
import { bindDialog } from './app-dialogs.js';
import { registerBinder } from './app-hooks.js';
import { canOperate, esc, fmt, render, sortPlayers, state, toast, today } from './app-part1.js';
import { actualTrainingPage, bindActualTraining, draftChanged, draftRows, editAttendanceSession, getTrainingDraft, makeTrainingDraft } from './app-part3.js';
import { activityLabel, activityRows, openActivity } from './app-team.js';

/* Operational workflows: planned replies, actual attendance and contextual priorities. */
function localISO(date){return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`}
function recentFrom(days=30){const d=new Date(today()+'T12:00:00');d.setDate(d.getDate()-days+1);return localISO(d)}
const rosterIndexes=new WeakMap();
function indexedActivityRows(id){const rows=state.roster||[];let cached=rosterIndexes.get(rows);if(!cached||cached.length!==rows.length){const index=new Map();for(const r of rows){if(!index.has(r.activity_id))index.set(r.activity_id,[]);index.get(r.activity_id).push(r)}cached={length:rows.length,index};rosterIndexes.set(rows,cached)}return cached.index.get(id)||[]}
function activityPeople(a){const ids=new Set(indexedActivityRows(a.id).map(r=>r.player_id));return sortPlayers(state.players.filter(p=>p.active||ids.has(p.id)))}
function pollEntries(a){const rows=new Map(indexedActivityRows(a.id).map(r=>[r.player_id,r]));return activityPeople(a).map(p=>({player:p,row:rows.get(p.id)||{player_id:p.id,availability:'In attesa',called:false}}))}
function activityPollPending(a){return a.activity_type==='Allenamento'&&!a.session_id&&a.status==='Programmato'?pollEntries(a).filter(x=>x.row.availability==='In attesa').length:0}
function matchPhase(a){
 if(a.status==='Annullato')return 'cancelled';if(a.status==='Concluso'||a.activity_date<today())return 'after';
 if(a.activity_date>today())return 'before';const now=new Intl.DateTimeFormat('it-IT',{hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date());
 if(a.end_time&&now>=a.end_time.slice(0,5))return 'after';return a.start_time&&now>=a.start_time.slice(0,5)?'during':'before';
}
function activityHasEnded(a){if(a.status!=='Programmato')return false;return a.activity_date<today()||(a.activity_date===today()&&a.end_time&&matchPhase(a)==='after')}
function seedPlannedReplies(d,a){
 d.activityId=a.id;d.activityRevision=a.revision;d.planned=new Map(activityRows(a.id).map(r=>[r.player_id,r.availability]));
 for(const [id,row] of d.entries){const response=activityRows(a.id).find(r=>r.player_id===id);row.notified=!!response&&response.availability!=='In attesa';row.status=response?.availability==='Disponibile'?'Presente':response?.availability==='Indisponibile'?'Assente':'Da confermare';row.note=response?.response_note||null}
}
async function startActualAttendance(a,discardConfirmed=false){if(!canOperate())return;
 if(a.activity_type!=='Allenamento')return toast('Le presenze si registrano nella sezione Allenamenti');
 if(a.status==='Annullato')return toast('L’allenamento è annullato');
 if(a.activity_date>today())return toast('Per una data futura registra le disponibilità nel sondaggio. Le presenze si confermano dopo l’attività.');
 if(a.session_id)return editAttendanceSession(a.session_id,null,discardConfirmed);
 if(state.trainingDraft?.saving)return toast('Attendi il salvataggio in corso');
 if(!discardConfirmed&&state.trainingDraft&&draftChanged(state.trainingDraft)&&!confirm('Scartare la bozza presenze non salvata?'))return;
 state.trainingDraft=makeTrainingDraft();state.trainingDraft.session={session_date:a.activity_date,session_type:a.activity_type,note:null};seedPlannedReplies(state.trainingDraft,a);
 state.trainingDraft.baseline=JSON.stringify({session:state.trainingDraft.session,rows:draftRows(state.trainingDraft)});state.page='training';state.trainingMode='actual';render();window.scrollTo(0,0);return true;
}
const busyControlStates=new WeakMap();
function setBusyControls(container,busy){if(!container)return;if(busy){if(busyControlStates.has(container))return;const controls=[...container.querySelectorAll('button,input,select,textarea')];busyControlStates.set(container,controls.map(el=>[el,el.disabled]));controls.forEach(el=>el.disabled=true);container.setAttribute('aria-busy','true')}else{for(const [el,disabled] of busyControlStates.get(container)||[])el.disabled=disabled;busyControlStates.delete(container);container.removeAttribute('aria-busy')}}
function priorityModal(kind){
 const upcoming=(state.activities||[]).filter(a=>a.status==='Programmato'&&a.activity_date>=today()).sort((a,b)=>(a.activity_date+(a.start_time||'')).localeCompare(b.activity_date+(b.start_time||'')));
 const list=kind==='poll'?upcoming.filter(a=>a.activity_type==='Allenamento'&&activityPollPending(a)>0):(state.activities||[]).filter(activityHasEnded).sort((a,b)=>a.activity_date.localeCompare(b.activity_date));
 const root=document.createElement('div');root.className='modal-back';root.innerHTML=`<section class="modal" role="dialog" aria-modal="true" aria-labelledby="priorityTitle"><div class="modal-head"><h2 id="priorityTitle">${kind==='poll'?'Risposte WhatsApp da registrare':'Attività da completare'}</h2><button aria-label="Chiudi priorità">${icon('close')}</button></div><p class="muted">${kind==='poll'?'Risposte al sondaggio WhatsApp degli allenamenti ancora da registrare.':'Attività trascorse da verificare: conferma le presenze o aggiorna lo stato nella sezione corrispondente.'}</p><div class="list">${list.map(a=>`<button class="priority-row" data-priority-activity="${a.id}"><span><b>${esc(activityLabel(a))}</b><small>${fmt(a.activity_date)} · ${kind==='poll'?activityPollPending(a)+' risposte in attesa':'Stato da aggiornare'}</small></span>${icon('chevron')}</button>`).join('')||'<p class="empty">Tutto aggiornato.</p>'}</div></section>`;document.body.append(root);const close=()=>root.remove();root.querySelector('.modal-head button').onclick=close;bindDialog(root,close);root.querySelectorAll('[data-priority-activity]').forEach(b=>b.onclick=()=>{close();openActivity(b.dataset.priorityActivity,kind==='poll'?'roster':undefined)});
}
function trainingModeTabs(){const d=getTrainingDraft();return `${d.activityId?'<nav class="training-phase-tabs" aria-label="Fase allenamento"><button type="button" id="backToTrainingReplies">Risposte WhatsApp</button><button type="button" aria-current="page">Presenze effettive</button></nav>':''}`}
function trainingPage(){return state.trainingMode==='actual'?actualTrainingPage():trainingHub()}
function bindTraining(){
 if(state.trainingMode!=='actual'){bindTrainingHub();return}
 bindActualTraining();const d=getTrainingDraft();
 document.querySelector('#backToTrainingReplies')?.addEventListener('click',async()=>{if(d.saving)return;if(draftChanged(d)&&!(await confirmDialog({message:'Scartare le modifiche alle presenze non salvate?',confirmLabel:'Scarta'})))return;const a=state.activities.find(a=>a.id===d.activityId);if(!a)return toast('Allenamento non disponibile. Ricarica la squadra.');if(draftChanged(d))state.trainingDraft=null;state.trainingMode='hub';openActivity(a.id)});
 document.querySelector('#backToTrainings').onclick=async()=>{if(d.saving)return;if(draftChanged(d)&&!(await confirmDialog({message:'Uscire dalle presenze non salvate? La bozza resta disponibile in questa sessione.',confirmLabel:'Esci dalle presenze'})))return;state.trainingMode='hub';if(d.originPage==='register')state.page='register';render()};

}
function configureActivityWorkflow(root,a,entries,players,markDirty,paint){
 let onlyCalled=false;const bar=document.createElement('div');bar.className='roster-filters field-space';bar.innerHTML='<div class="workflow-switch" role="group" aria-label="Filtra convocazioni"><button type="button" data-roster-filter="all" aria-pressed="true">Rosa</button><button type="button" data-roster-filter="called" aria-pressed="false">Convocati</button></div>';
 root.querySelector('#rosterSearch').after(bar);bar.querySelectorAll('[data-roster-filter]').forEach(b=>b.onclick=()=>{onlyCalled=b.dataset.rosterFilter==='called';bar.querySelectorAll('button').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));paint()});
 return {isMatch:true,filterRows:()=>{
  root.querySelectorAll('.roster-person').forEach(el=>{const id=el.querySelector('[data-roster-edit]').dataset.rosterEdit;el.hidden=onlyCalled&&!entries.get(id).called});
  root.querySelectorAll('.roster-role').forEach(heading=>{let visible=false;for(let row=heading.nextElementSibling;row&&!row.matches('.roster-role');row=row.nextElementSibling)if(!row.hidden)visible=true;heading.hidden=!visible});
 }};
}
function bindWorkflowLinks(){document.querySelectorAll('[data-priority]').forEach(b=>b.onclick=()=>priorityModal(b.dataset.priority));document.querySelectorAll('[data-poll-activity]').forEach(b=>b.onclick=()=>openActivity(b.dataset.pollActivity,'roster'));document.querySelectorAll('[data-start-actual]').forEach(b=>b.onclick=()=>{const a=state.activities.find(a=>a.id===b.dataset.startActual);if(a)startActualAttendance(a)})};


window.addEventListener('beforeunload',event=>{if((state.trainingDraft&&draftChanged(state.trainingDraft))||document.querySelector('.modal-back[data-dirty="true"]')){event.preventDefault();event.returnValue=''}});

function trackDialogDraft(root,isBusy=()=>false){
 const scope=root.querySelector('form')||root;
 const signature=()=>JSON.stringify([...scope.querySelectorAll('input:not([type="search"]),select,textarea')].filter(el=>!el.matches('[data-transient]')).map(el=>[el.id||el.name,el.type==='checkbox'||el.type==='radio'?el.checked:el.value]));
 let baseline=signature(),touched=false;
 queueMicrotask(()=>{if(!touched)baseline=signature()});
 const mark=event=>{if(!scope.contains(event.target)||event.target.matches('input[type="search"],[data-transient]'))return;touched=true;root.dataset.dirty=String(signature()!==baseline)};
 root.addEventListener('input',mark);root.addEventListener('change',mark);
 return ()=>{if(isBusy())return;if(root.dataset.dirty==='true'&&!confirm('Scartare le modifiche non salvate?'))return;root.remove()};
}

function registerWorkflows(){registerBinder("workflows",bindWorkflowLinks)}

export { localISO, recentFrom, rosterIndexes, indexedActivityRows, activityPeople, pollEntries, activityPollPending, matchPhase, activityHasEnded, seedPlannedReplies, startActualAttendance, busyControlStates, setBusyControls, priorityModal, trainingModeTabs, trainingPage, bindTraining, configureActivityWorkflow, bindWorkflowLinks, trackDialogDraft, registerWorkflows };
