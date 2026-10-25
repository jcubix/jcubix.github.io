import { matchScore } from './app-match-display.js';
import { matchReportModal } from './app-match-report.js';
import { icon } from './app-icons.js';
import { bindDialog } from './app-dialogs.js';
import { canOperate, canPlan, esc, fmt, render, state, teamRequestGuard } from './app-part1.js';
import { eventTone, matchEvents } from './app-part4.js';
import { activityLabel, activityRows, clock } from './app-team.js';

/* Administrative staff can inspect sporting records without editing them. */
function readonlyActivity(a){
 const root=document.createElement('div');root.className='modal-back';root.dataset.detail=(a.match_id?'match:':'activity:')+(a.match_id||a.id);root.dataset.page=state.page==='register'?'register':a.match_id?'matches':a.activity_type==='Riunione'?'meetings':'training';const m=state.matches.find(m=>m.id===a.match_id),people=new Map(state.players.map(p=>[p.id,`${p.surname} ${p.name}`])),rows=activityRows(a.id);
 root.innerHTML=`<section class="modal" role="dialog" aria-modal="true" aria-labelledby="readonlyActivityTitle"><div class="modal-head"><h2 id="readonlyActivityTitle">${esc(activityLabel(a))}</h2><button aria-label="Chiudi attività">✕</button></div><p class="notice">Consultazione · Il tuo ruolo può leggere queste informazioni. Le modifiche sportive spettano allo staff autorizzato.</p><p>${fmt(a.activity_date)} · ${clock(a.start_time)} · ${esc(a.status)}</p><p>${esc(a.location||'Luogo da definire')}</p>${a.organization_note?`<p>${esc(a.organization_note)}</p>`:''}${m?`<h3>Risultato</h3><p>${m.goals_for==null||m.goals_against==null?'Da registrare':matchScore(m)}</p>${m.note?`<p>${esc(m.note)}</p>`:''}`:''}<h3>${a.activity_type==='Partita'?'Convocati':'Disponibilità registrate'}</h3><div class="list">${rows.filter(r=>a.activity_type!=='Partita'||r.called).map(r=>`<article class="row"><div><b>${esc(people.get(r.player_id)||'Giocatore storico')}</b><p class="row-sub">${a.activity_type==='Partita'?esc(r.lineup)+' · '+Number(r.minutes_played||0)+' min':r.availability==='Disponibile'?'WhatsApp: Sì':r.availability==='Indisponibile'?'WhatsApp: No':'WhatsApp: Non risposto'}</p></div></article>`).join('')||'<p class="empty">Nessuna registrazione.</p>'}</div>${m?`<h3>Eventi</h3><div class="list readonly-match-events">${matchEvents(m.id).map(e=>`<article class="row"><div><b><span class="badge ${eventTone(e)}">${esc(e.event_type==='Gol'&&!e.player_id?'Gol avversario':e.event_type)}</span> ${e.minute==null?'':e.minute+'′'}</b><p>${esc(e.event_type==='Gol'&&!e.player_id?'Squadra avversaria':people.get(e.player_id)||'Giocatore non indicato')}${e.outgoing_player_id?' · Esce '+esc(people.get(e.outgoing_player_id)||'Giocatore storico'):''}</p>${e.detail?`<p class="row-sub">${esc(e.detail)}</p>`:''}</div></article>`).join('')||'<p class="empty">Nessun evento registrato.</p>'}</div>`:''}</section>`;
 document.body.append(root);const close=()=>root.remove();root.querySelector('.modal-head button').onclick=close;bindDialog(root,close);
 if(m){const current=teamRequestGuard(),tools=document.createElement('div');tools.className='match-export-toolbar';tools.innerHTML=`<button type="button" class="match-report-trigger">${icon('file',18)}<span>Esporta tabellino</span></button>`;root.querySelector('.modal-head').after(tools);tools.querySelector('button').onclick=()=>{if(current()&&root.isConnected)matchReportModal({match:m,activity:a,roster:rows,events:matchEvents(m.id),players:state.players})};}
}
function applyRoleControls(){
 if(!canPlan())document.querySelectorAll('[data-new-training],[data-new-meeting],[data-new-match],[data-new-activity],#addMatch').forEach(el=>el.remove());
 if(canOperate())return;
 document.querySelectorAll('[data-new-training],[data-new-meeting],[data-new-match],[data-new-activity],#addMatch,[data-edit-session],[data-start-actual]').forEach(el=>el.remove());
 document.querySelectorAll('[data-resume-session]').forEach(b=>{b.textContent='Consulta registro';b.onclick=()=>{state.page='register';render()}});
 document.querySelectorAll('.tool-list [data-page="register"] span').forEach(el=>el.textContent='Consulta le presenze registrate');
 document.querySelectorAll('[data-match]').forEach(b=>b.textContent='Consulta partita →');
}

export { readonlyActivity, applyRoleControls };
