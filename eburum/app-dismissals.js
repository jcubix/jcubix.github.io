import { loadDismissalSnapshot, sportSeason } from './app-data.js';
import { bindDialog } from './app-dialogs.js';
import { confirmDialog } from './app-confirm.js';
import { canOperate, db, esc, fmt, render, state, teamOwner, teamRequestGuard, today } from './app-part1.js';
import { setBusyControls, trackDialogDraft } from './app-workflows.js';

function dismissalEvents(){
 const events=new Map((state.dismissals||[]).map(e=>[e.id,e]));
 for(const e of state.events||[])if(e.event_type==='Espulsione'||events.has(e.id)){
  const m=state.matches.find(m=>m.id===e.match_id),a=state.activities.find(a=>a.match_id===e.match_id);
  events.set(e.id,{...events.get(e.id),...e,...(m?{match_date:m.match_date,opponent:m.opponent}:{}),...(a?{activity_status:a.status}:{})});
 }
 return [...events.values()];
}
function dismissalState(event,asOf=today()){
 const sanction=(state.dismissal_sanctions||[]).find(s=>s.event_id===event.id),clearances=(state.dismissal_clearances||[]).filter(c=>c.event_id===event.id);
 const valid=clearances.filter(c=>event.player_id===sanction?.player_id&&c.player_id===sanction?.player_id&&c.match_date>event.match_date&&c.match_date<=today()&&c.match_date<=asOf&&c.activity_status!=='Annullato'&&c.has_result&&!c.has_minutes&&!(state.disciplinary_clearances||[]).some(y=>y.player_id===c.player_id&&y.served_match_id===c.match_id));
 const review=clearances.filter(c=>!valid.includes(c)),base={event,sanction,clearances,valid,review,remaining:0,attention:false,tone:'b-gray',label:'Provvedimento annullato'};
 if(sanction?.voided)return sanction.player_id===event.player_id?base:{...base,attention:true,tone:'b-red',label:'Provvedimento da definire'};
 if(event.activity_status==='Annullato'||event.event_type!=='Espulsione'||sanction&&sanction.player_id!==event.player_id)return {...base,attention:!!sanction,tone:'b-yellow',label:'Espulsione da verificare'};
 if(!sanction)return {...base,attention:true,tone:'b-red',label:'Provvedimento da definire'};
 if(review.length)return {...base,attention:true,tone:'b-yellow',label:'Conferme da verificare',remaining:Math.max(0,(sanction.match_count||0)-valid.length)};
 if(sanction.kind==='until')return {...base,attention:asOf<=sanction.suspended_until,tone:asOf<=sanction.suspended_until?'b-red':'b-green',label:asOf<=sanction.suspended_until?`Fino al ${fmt(sanction.suspended_until)} compreso`:'Termine raggiunto'};
 const remaining=Math.max(0,sanction.match_count-valid.length);
 return {...base,remaining,attention:remaining>0,tone:remaining?'b-red':'b-green',label:remaining?`${remaining} ${remaining===1?'gara da scontare':'gare da scontare'}`:'Scontata'};
}
function playerDismissals(playerId,asOf=today()){
 const season=sportSeason();
 return dismissalEvents().filter(e=>e.player_id===playerId||(state.dismissal_sanctions||[]).some(s=>s.event_id===e.id&&s.player_id===playerId&&!s.voided)).filter(e=>e.match_date<=today()&&(e.activity_status!=='Annullato'||(state.dismissal_sanctions||[]).some(s=>s.event_id===e.id))).map(e=>dismissalState(e,asOf)).filter(d=>d.event.match_date<=season.to&&(d.event.match_date>=season.from||d.attention)).sort((a,b)=>b.event.match_date.localeCompare(a.event.match_date));
}
function dismissalAlert(playerId,matchDate=today()){
 const open=playerDismissals(playerId,matchDate).filter(d=>d.attention&&d.event.match_date<matchDate);
 return open.length?`Espulsione · ${open[0].label}${open.length>1?` · Altri ${open.length-1} provvedimenti aperti`:''}`:'';
}
function dismissalSections(playerId){
 const rows=playerDismissals(playerId);if(!rows.length)return '';
 const active=rows.filter(d=>!d.sanction?.voided),voided=rows.filter(d=>d.sanction?.voided);
 const records=list=>list.map(d=>
`<article class="dismissal-record"><div class="dismissal-heading"><b>${fmt(d.event.match_date)} · ${esc(d.event.opponent||'Gara registrata')}</b><span class="badge ${d.tone}">${esc(d.label)}</span></div><p class="row-sub">${d.event.minute==null?'Minuto non indicato':d.event.minute+'′'}${d.event.match_date<sportSeason().from?' · Stagione precedente':''}${d.sanction?.kind==='matches'?` · ${d.valid.length}/${d.sanction.match_count} giornate confermate`:''}</p>${d.sanction?.note?`<p class="dismissal-note">${d.sanction.voided?"Indicazione precedente: ":""}${esc(d.sanction.note)}</p>`:''}${canOperate()?`<div class="dismissal-actions"><button type="button" data-sanction-event="${esc(d.event.id)}">${d.sanction?.voided?'Consulta o riattiva':d.sanction?'Modifica provvedimento':'Registra provvedimento'}</button>${d.sanction&&!d.sanction.voided&&d.sanction.kind==='matches'&&d.remaining>0&&!d.review.length&&d.event.activity_status!=='Annullato'?`<button type="button" data-dismissal-serve="${esc(d.event.id)}">Conferma gara scontata</button>`:''}</div>`:''}${d.clearances.length?`<details class="field-space"><summary>Gare confermate (${d.clearances.length})</summary><div class="dismissal-served-list">${d.clearances.map(c=>`<div><span>${fmt(c.match_date)} · ${esc(c.opponent||'Gara registrata')}<small>${d.valid.includes(c)?'Scontata':'Conferma da verificare'}</small></span>${canOperate()?`<button type="button" class="ghost" data-dismissal-undo="${esc(c.id)}">Annulla conferma</button>`:''}</div>`).join('')}</div></details>`:''}</article>`).join('');
 return `<section class="dismissal-section"><h4>Espulsioni e squalifiche</h4>${records(active)}${voided.length?`<details class="dismissal-voided"><summary>Provvedimenti annullati (${voided.length})</summary><p class="row-sub">Storico dei provvedimenti annullati: le indicazioni riportate non sono istruzioni correnti.</p>${records(voided)}</details>`:''}</section>`;
}
async function reloadDismissals(current){const data=await loadDismissalSnapshot();if(!current())return false;Object.assign(state,data);render();return true}
function bindDismissalActions(root,onChanged){
 root.querySelectorAll('[data-sanction-event]').forEach(b=>b.onclick=()=>sanctionModal(b.dataset.sanctionEvent,onChanged));
 root.querySelectorAll('[data-dismissal-serve]').forEach(b=>b.onclick=()=>dismissalClearanceModal(b.dataset.dismissalServe,onChanged));
 root.querySelectorAll('[data-dismissal-undo]').forEach(b=>b.onclick=async()=>{
  if(b.disabled||!canOperate())return;const current=teamRequestGuard();b.disabled=true;
  try{if(!(await confirmDialog({title:'Annulla gara scontata',message:'Annullare questa conferma? La giornata tornerà da scontare.',confirmLabel:'Annulla conferma',danger:true}))||!current()||!b.isConnected)return;
   const {error}=await db.from('dismissal_clearances').delete().eq('id',b.dataset.dismissalUndo).eq('user_id',teamOwner());if(error)throw error;
   if(await reloadDismissals(current))onChanged();
  }catch(error){if(current()&&root.isConnected){const feedback=root.querySelector('#dismissalFeedback');if(feedback)feedback.textContent=error.message||'Conferma non annullata. Riprova.'}}
  finally{b.disabled=false}
 });
}
function sanctionModal(eventId,onSaved=()=>{}){
 if(!canOperate())return;const event=dismissalEvents().find(e=>e.id===eventId);if(!event?.player_id)return;
 const s=(state.dismissal_sanctions||[]).find(s=>s.event_id===eventId),root=document.createElement('div');root.className='modal-back dismissal-editor';
 root.innerHTML=`<section class="modal" role="dialog" aria-modal="true" aria-labelledby="sanctionTitle"><div class="modal-head"><h2 id="sanctionTitle">${s?'Modifica':'Registra'} provvedimento</h2><button type="button" aria-label="Chiudi provvedimento">✕</button></div><p>${fmt(event.match_date)} · ${esc(event.opponent||'Gara registrata')}</p><p class="row-sub">Inserisci la durata stabilita dal comunicato ufficiale. Nessuna giornata viene assegnata automaticamente dall’espulsione.</p><form id="sanctionForm"><div class="field"><label for="sanctionKind">Tipo di squalifica</label><select id="sanctionKind"><option value="matches" ${s?.kind==='until'?'':'selected'}>Per giornate</option><option value="until" ${s?.kind==='until'?'selected':''}>Fino a una data</option></select></div><div class="field field-space" id="sanctionGamesField"><label for="sanctionGames">Giornate da scontare</label><input type="number" inputmode="numeric" id="sanctionGames" min="1" max="100" step="1" value="${s?.match_count??''}" placeholder="Es. 2"></div><div class="field field-space" id="sanctionUntilField"><label for="sanctionUntil">Squalificato fino al giorno compreso</label><input type="date" id="sanctionUntil" min="${event.match_date}" value="${s?.suspended_until||''}"></div><div class="field field-space"><label for="sanctionNote">Riferimento al comunicato e note</label><textarea id="sanctionNote" maxlength="2000" rows="3" placeholder="Numero del comunicato, data e precisazioni…">${esc(s?.note||'')}</textarea></div>${s?.voided?'<p class="notice">Provvedimento annullato. Salvando verrà riattivato con i dati indicati.</p>':''}<div class="modal-actions"><button class="primary" type="submit">Salva provvedimento</button>${s&&!s.voided?'<button type="button" class="danger" id="voidSanction">Annulla provvedimento</button>':''}</div><p id="sanctionFeedback" role="status"></p></form></section>`;
 document.body.append(root);let busy=false,persisted=false;const current=teamRequestGuard(),$=q=>root.querySelector(q),close=trackDialogDraft(root,()=>busy);root.querySelector('.modal-head button').onclick=close;bindDialog(root,close);
 const fields=()=>{const games=$('#sanctionKind').value==='matches';$('#sanctionGamesField').hidden=!games;$('#sanctionUntilField').hidden=games;$('#sanctionGames').required=games;$('#sanctionUntil').required=!games};$('#sanctionKind').onchange=fields;fields();
 const save=async voided=>{
  if(busy||!current()||!root.isConnected||!canOperate())return;
  const kind=voided?s.kind:$('#sanctionKind').value,count=voided?s.match_count:kind==='matches'?Number($('#sanctionGames').value):null,until=voided?s.suspended_until:kind==='until'?$('#sanctionUntil').value:null,note=voided?s.note:$('#sanctionNote').value.trim()||null;
  if(!voided&&(kind==='matches'&&(!Number.isInteger(count)||count<1||count>100)||kind==='until'&&(!until||until<event.match_date))){$('#sanctionFeedback').textContent='Inserisci da 1 a 100 giornate, oppure una data non precedente alla gara.';return}
  busy=true;setBusyControls(root,true);
  try{
   if(!persisted){const {error}=await db.rpc('save_dismissal_sanction',{p_event_id:eventId,p_revision:s?.revision??null,p_values:{kind,match_count:count,suspended_until:until,note,voided}});if(error)throw error;persisted=true}
   if(!current())return;
   if(await reloadDismissals(current)){root.remove();onSaved()}
  }catch(error){if(current()&&root.isConnected){$('#sanctionFeedback').textContent=persisted?'Provvedimento salvato. Lettura non riuscita: premi Ricarica dati.':error.message||'Provvedimento non salvato. Riprova.';if(persisted){root.dataset.dirty='false';root.querySelector('button[type=submit]').textContent='Ricarica dati';root.querySelectorAll('input,select,textarea,#voidSanction').forEach(el=>el.disabled=true)}}}
  finally{busy=false;setBusyControls(root,false);if(persisted)root.querySelectorAll('input,select,textarea,#voidSanction').forEach(el=>el.disabled=true)}
 };
 $('#sanctionForm').onsubmit=e=>{e.preventDefault();save(false)};
 $('#voidSanction')?.addEventListener('click',async()=>{if(busy)return;if(await confirmDialog({title:'Annulla provvedimento',message:'Annullare questo provvedimento? Espulsione e conferme resteranno nello storico.',confirmLabel:'Annulla provvedimento',danger:true}))save(true)});
 return root;
}
function dismissalClearanceModal(eventId,onSaved=()=>{}){
 if(!canOperate())return;const event=dismissalEvents().find(e=>e.id===eventId);if(!event)return;const d=dismissalState(event);if(!d.sanction||d.sanction.voided||d.sanction.kind!=='matches'||!d.remaining||d.review.length)return;
 const choices=state.matches.filter(m=>m.match_date>event.match_date&&m.match_date<=today()&&m.goals_for!=null&&m.goals_against!=null&&!state.activities.some(a=>a.match_id===m.id&&a.status==='Annullato')&&!state.roster.some(r=>r.player_id===event.player_id&&r.minutes_played>0&&state.activities.some(a=>a.id===r.activity_id&&a.match_id===m.id))&&!(state.dismissal_clearances||[]).some(c=>c.player_id===event.player_id&&c.match_id===m.id)&&!(state.disciplinary_clearances||[]).some(c=>c.player_id===event.player_id&&c.served_match_id===m.id)).sort((a,b)=>a.match_date.localeCompare(b.match_date));
 const root=document.createElement('div');root.className='modal-back dismissal-editor';root.innerHTML=`<section class="modal" role="dialog" aria-modal="true" aria-labelledby="dismissalClearanceTitle"><div class="modal-head"><h2 id="dismissalClearanceTitle">Conferma gara scontata</h2><button type="button" aria-label="Chiudi gara scontata">✕</button></div><p>${esc(d.label)} · Espulsione del ${fmt(event.match_date)}</p><p class="row-sub">Scegli la gara effettivamente saltata per questa squalifica. Deve appartenere alla competizione prevista dal provvedimento. Una gara può coprire una sola squalifica.</p><form id="dismissalClearanceForm"><div class="field"><label for="dismissalServedMatch">Gara saltata</label><select id="dismissalServedMatch" required><option value="">Seleziona una gara</option>${choices.map(m=>`<option value="${esc(m.id)}">${fmt(m.match_date)} · ${esc(m.opponent)}</option>`).join('')}</select></div>${choices.length?'':'<p class="notice">Nessuna gara idonea nella stagione selezionata. Registra prima risultato e minuti della gara saltata.</p>'}<label class="reminder-option field-space"><input type="checkbox" id="dismissalServedConfirmed" required>Confermo che il giocatore ha saltato la gara per questa squalifica.</label><div class="modal-actions"><button type="submit" class="primary" ${choices.length?'':'disabled'}>Conferma giornata scontata</button></div><p id="dismissalClearanceFeedback" role="status"></p></form></section>`;
 document.body.append(root);let busy=false,persisted=false;const current=teamRequestGuard(),$=q=>root.querySelector(q),close=trackDialogDraft(root,()=>busy);root.querySelector('.modal-head button').onclick=close;bindDialog(root,close);
 $('#dismissalClearanceForm').onsubmit=async e=>{
  e.preventDefault();if(busy||!current()||!root.isConnected||!canOperate())return;const id=$('#dismissalServedMatch').value;
  if(!choices.some(m=>m.id===id)||!$('#dismissalServedConfirmed').checked){$('#dismissalClearanceFeedback').textContent='Seleziona la gara e conferma che è stata saltata per squalifica.';return}
  busy=true;setBusyControls(root,true);
  try{if(!persisted){const {error}=await db.rpc('confirm_dismissal_match',{p_event_id:eventId,p_match_id:id});if(error)throw error;persisted=true}if(!current())return;if(await reloadDismissals(current)){root.remove();onSaved()}}
  catch(error){if(current()&&root.isConnected){$('#dismissalClearanceFeedback').textContent=persisted?'Conferma salvata. Lettura non riuscita: premi Ricarica dati.':error.message||'Conferma non salvata. Riprova.';if(persisted){root.dataset.dirty='false';root.querySelector('button[type=submit]').textContent='Ricarica dati'}}}
  finally{busy=false;setBusyControls(root,false);if(persisted)root.querySelectorAll('select,input').forEach(el=>el.disabled=true)}
 };
 return root;
}
export { dismissalEvents, dismissalState, playerDismissals, dismissalAlert, dismissalSections, bindDismissalActions, sanctionModal, dismissalClearanceModal };
