import { rememberQuery } from './app-presentation.js';
import { playerModal } from './app-part2.js';
import { dismissalAlert } from './app-dismissals.js';
import { confirmDialog } from './app-confirm.js';
import { documentState, matchReview } from './app-workflow-tools.js';
import { roleLabels } from './app-roles.js';
import { planningModal } from './app-training-planning.js';
import { matchTitle } from './app-match-display.js';
import { matchReportModal } from './app-match-report.js';
import { icon } from './app-icons.js';
import { readonlyActivity } from './app-access.js';
import { usersModal } from './app-admin.js';
import { bindDialog } from './app-dialogs.js';
import { bindExtensions, renderExtensions } from './app-hooks.js';
import { mountCallupCopy, mountMatchResults } from './app-operations.js';
import { ROLE_ORDER, canManage, canOperate, canPlan, canViewExpiries, canTechnical, db, esc, fail, fetchAllRows, fmt, isAdmin, refresh, render, sortPlayers, state, teamOwner, teamRequestGuard, teamRole, toast, today } from './app-part1.js';
import { configureActivityWorkflow, setBusyControls, trackDialogDraft } from './app-workflows.js';

const teamArrays = () => {
  for (const k of ["activities", "roster", "administration", "technical"])
    state[k] ??= [];
};
const activityRows = (id) =>
  (state.roster || []).filter((r) => r.activity_id === id);
const activityLabel = (a) =>
  a.activity_type === "Partita" ? matchTitle({opponent:a.title,venue:state.matches.find(m=>m.id===a.match_id)?.venue}) : a.title;
const clock = (t) => (t ? t.slice(0, 5) : "Orario da definire");
const expiryLimit = () => {
  const d = new Date();
  d.setDate(d.getDate() + 30);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
function expiringPlayers() {
  if(teamRole()==='president')return (state.administration||[]).filter(d=>state.players.some(p=>p.id===d.player_id&&p.active)&&d.needs_review);
  return state.players
    .filter((p) => p.active)
    .map((p) => ({
      player_id: p.id,
      registration_status: "Da verificare",
      ...(state.administration || []).find((d) => d.player_id === p.id),
    }))
    .filter(
      (d) =>
        !d.certificate_until ||
        !d.document_until ||
        d.certificate_until <= expiryLimit() ||
        d.document_until <= expiryLimit() ||
        d.registration_status !== "In regola",
    );
}
function documentSummary() {
 if(!canViewExpiries())return {review:0,expired:null};
 const rows=expiringPlayers();
 return {review:rows.length,expired:teamRole()==='president'?null:rows.filter(d=>[d.certificate_until,d.document_until].some(date=>date&&date<today())).length};
}
function activityCard(a) {
  const rows = activityRows(a.id), called = rows.filter((r) => r.called);
 const summary=a.activity_type==="Partita"?`${called.length} convocati`:a.activity_type==="Allenamento"?(a.session_id?"Presenze confermate":`${rows.filter(r=>r.availability!=="In attesa").length} risposte registrate · ${state.players.filter(p=>p.active||rows.some(r=>r.player_id===p.id)).filter(p=>!rows.some(r=>r.player_id===p.id&&r.availability!=="In attesa")).length} da sollecitare`):"Appuntamento staff";
  return `<button class="activity-card" data-open-activity="${a.id}"><span class="activity-date"><b>${new Date(a.activity_date + "T12:00:00").getDate()}</b><small>${new Intl.DateTimeFormat("it-IT", { month: "short" }).format(new Date(a.activity_date + "T12:00:00"))}</small></span><span class="activity-main"><strong>${esc(activityLabel(a))}</strong><span class="activity-type">${a.activity_type==="Allenamento"?esc(a.status):esc(a.activity_type)+" · "+esc(a.status)}</span><span>${clock(a.start_time)}${a.location ? " · " + esc(a.location) : ""}</span><small>${summary}${a.activity_type==="Riunione"&&a.status==="Programmato"&&a.activity_date<today()?" · Data trascorsa, stato da aggiornare":""}</small></span><span aria-hidden="true">›</span></button>`;
}
function morePage() {
  return `<div class="section-title"><div><h2>Strumenti squadra</h2><p class="muted">${roleLabels[teamRole()]} · ${esc(state.user.email || "")}</p></div></div><div class="list tool-list">${renderExtensions("tools")}<button data-page="meetings"><b>Riunioni</b><span>Appuntamenti e note dello staff</span></button><button data-page="register"><b>Registro</b><span>Consulta e correggi le presenze</span></button><button data-page="reports"><b>Report e statistiche</b><span>Presenze, convocazioni e minuti giocati</span></button>${canViewExpiries() ? "<button data-expiries><b>Scadenze e tesseramenti</b><span>Certificati e documenti da verificare</span></button>" : ""}${isAdmin() ? '<button id="teamUsers"><b>Gestione staff</b><span>Utenze e ruoli della squadra condivisa</span></button>' : ""}</div>`;
}
function bindMore() {
  document.querySelector("#teamUsers")?.addEventListener("click", usersModal);
}
function bindTeamLinks() {
  document
    .querySelectorAll("[data-open-activity]")
    .forEach((b) => (b.onclick = () => openActivity(b.dataset.openActivity)));
  document
    .querySelectorAll("[data-new-activity]")
    .forEach((b) => (b.onclick = () => planningModal({activity_type:"Allenamento"})));
  document.querySelectorAll("[data-new-training]").forEach(b=>b.onclick=()=>planningModal({activity_type:"Allenamento"}));
  document.querySelectorAll("[data-new-meeting]").forEach(b=>b.onclick=()=>planningModal({activity_type:"Riunione"}));
  document.querySelectorAll("[data-new-match]").forEach(b=>b.onclick=()=>activityModal({activity_type:"Partita"}));
  document
    .querySelectorAll("[data-player-sheet]")
    .forEach((b) => (b.onclick = () => playerSheet(b.dataset.playerSheet)));
  document
    .querySelectorAll("[data-expiries]")
    .forEach((b) => (b.onclick = expiryModal));
 bindExtensions(document);
}
async function openActivity(id, preferredTab = "auto") {
  if(state.openingActivity)return;state.openingActivity=true;
  try {
    const uid = teamOwner(),current=teamRequestGuard();
    const [a, r, t] = await Promise.all([
      db
        .from("activities")
        .select("*")
        .eq("id", id)
        .eq("user_id", uid)
        .single(),
      fetchAllRows(() =>
        db
          .from("activity_roster")
          .select("*")
          .eq("activity_id", id)
          .eq("user_id", uid)
          .order("id"),
      ),
      fetchAllRows(() =>
        db
          .from("activity_technical")
          .select("*")
          .eq("activity_id", id)
          .eq("user_id", uid)
          .order("activity_id"),
      ),
    ]);
    if (a.error || r.error || t.error) throw a.error || r.error || t.error;
    if (!current()) return;
    if(!canOperate() || (a.data.activity_type==='Riunione'&&!canPlan()))return readonlyActivity(a.data);
    activityModal(a.data, r.data, t.data[0], preferredTab === "auto" ? (a.data.match_id ? "results" : "details") : preferredTab);
  } catch (e) {
    fail(e);
  } finally {state.openingActivity=false}
}
function activityModal(a = {}, savedRows = [], technical = {}, preferredTab = "details") {
 if(!a.id&&!canPlan())return toast("Creazione riservata ai responsabili dell’organizzazione");
 if(a.activity_type!=="Partita"&&!a.match_id)return planningModal(a,savedRows);
 if(!canOperate()){if(a.id)readonlyActivity(a);else toast("Creazione attività riservata allo staff operativo");return}
  teamArrays();
  const root = document.createElement("div");
  root.className = "modal-back";
  root.dataset.detail="match:"+(a.match_id||"new");root.dataset.page="matches";
  let busy = false;const current=teamRequestGuard();
  const requestId = crypto.randomUUID();
  const players = sortPlayers([
    ...state.players.filter(
      (p) => p.active || savedRows.some((r) => r.player_id === p.id),
    ),
  ]);
  const entries = new Map(
    players.map((p) => [
      p.id,
      {
        player_id: p.id,
        activity_id: a.id || null,
        called: false,
        availability: "In attesa",
        response_note: null,
        lineup: "Non impiegato",
        position: null,
        minutes_played: 0,
        ...savedRows.find((r) => r.player_id === p.id),
      },
    ]),
  );
  const field = (id, label, type, value = "") =>
    `<div class="field"><label for="${id}">${label}</label><input id="${id}" type="${type}" value="${esc(value || "")}"></div>`;
  root.innerHTML = `<section class="modal activity-modal" role="dialog" aria-modal="true" aria-labelledby="activityTitle"><div class="modal-head"><div><h2 id="activityTitle">${a.id ? esc(activityLabel(a)) : "Nuova partita"}</h2></div><button id="closeActivity" aria-label="Chiudi attività">✕</button></div><div class="activity-tabs" role="tablist" aria-label="Scheda attività"><button type="button" data-activity-tab="details" role="tab" aria-selected="true">Organizzazione</button><button type="button" data-activity-tab="roster" role="tab" aria-selected="false">Convocazioni</button>${canTechnical() ? '<button type="button" data-activity-tab="technical" role="tab" aria-selected="false">Formazione</button>' : ""}${a.match_id ? '<button type="button" data-activity-tab="results" role="tab" aria-selected="false">Risultato ed eventi</button>' : ""}</div><div id="matchReadiness" class="notice field-space" role="status"></div><form id="activityForm" novalidate><section data-activity-panel="details"><div class="form-grid"><input id="activityType" type="hidden" value="Partita"><div class="field"><label for="activityName">Titolo / avversario</label><input id="activityName" maxlength="160" required value="${esc(a.title || "")}"></div>${field("activityDate", "Data", "date", a.activity_date || today())}${field("activityStart", "Inizio", "time", a.start_time)}${field("activityEnd", "Fine", "time", a.end_time)}<div class="field"><label for="activityState">Stato</label><select id="activityState">${["Programmato", "Concluso", "Annullato"].map((t) => `<option ${a.status === t ? "selected" : ""}>${t}</option>`).join("")}</select></div></div><div class="field field-space"><label for="activityLocation">Campo / luogo</label><input id="activityLocation" maxlength="500" value="${esc(a.location || "")}"></div><h3 class="sheet-heading">Ritrovo e organizzazione</h3><div class="form-grid">${field("activityMeetingTime", "Ora ritrovo", "time", a.meeting_time)}${field("activityMeetingPlace", "Luogo ritrovo", "text", a.meeting_place)}</div><div class="field field-space"><label for="activityNote">Indicazioni per lo staff</label><textarea id="activityNote" rows="3" maxlength="10000" placeholder="Trasporto, divise, documenti, materiale…">${esc(a.organization_note || "")}</textarea></div></section><section data-activity-panel="roster" hidden><div class="notice">Inserisci la distinta dei convocati, poi assegna titolari e panchina.</div><input type="search" id="rosterSearch" aria-label="Cerca convocato" placeholder="Cerca giocatore"><div id="rosterCounts" class="attendance-counts field-space"></div><div class="list field-space" id="activityRoster"></div></section>${canTechnical() ? `<section data-activity-panel="technical" hidden><div class="notice">Note tecniche riservate ad amministratori, allenatori e collaboratori tecnici.</div><div id="formationPreview" class="formation-preview" aria-label="Titolari raggruppati per ruolo"></div><div class="field field-space"><label for="formation">Modulo</label><input id="formation" maxlength="30" value="${esc(technical?.formation || "")}" placeholder="Es. 4-3-3"></div><div class="field field-space"><label for="technicalNote">Osservazioni tecniche</label><textarea id="technicalNote" rows="4" maxlength="10000">${esc(technical?.note || "")}</textarea></div><p class="muted">Titolari, panchina, posizione e minuti giocati si compilano dalla scheda di ogni convocato. I minuti sono registrati dallo staff.</p></section>` : ""}<div class="modal-actions"><button class="ghost" id="cancelActivity" type="button">Annulla</button><button class="primary" type="submit">${a.id ? "Salva" : "Crea partita"}</button></div><p id="activityFeedback" role="status" aria-live="polite"></p></form></section>`;
  if(a.match_id){const tabs=root.querySelector('.activity-tabs');tabs.prepend(tabs.querySelector('[data-activity-tab="results"]'));const readiness=root.querySelector('#matchReadiness');root.querySelector('[data-activity-panel="roster"]').prepend(readiness);root.querySelector('#activityMatch')?.remove();root.querySelector('[data-activity-panel="technical"] .muted')?.replaceChildren(document.createTextNode('Impiego e posizione si impostano nelle convocazioni. I minuti seguono la modalità scelta nelle impostazioni della partita.'));}
  if(!a.match_id){const venue=document.createElement("div");venue.className="field match-creation-venue";venue.innerHTML='<label for="activityVenue">Dove si gioca</label><select id="activityVenue"><option value="Casa">Casa</option><option value="Trasferta">Trasferta</option></select>';root.querySelector(".activity-tabs").before(venue);}
  const tabs=root.querySelector('.activity-tabs');
  const technicalPanel=root.querySelector('[data-activity-panel="technical"]');
  if(technicalPanel){const notes=document.createElement('details');notes.className='match-technical field-space';notes.innerHTML='<summary>Formazione e note tecniche</summary>';notes.append(...technicalPanel.children);root.querySelector('[data-activity-panel="roster"]').append(notes);technicalPanel.remove();tabs.querySelector('[data-activity-tab="technical"]').remove();}
  tabs.querySelector('[data-activity-tab="details"]').textContent='Impostazioni';
  tabs.querySelector('[data-activity-tab="roster"]').textContent='Convocati';
  const gameTab=tabs.querySelector('[data-activity-tab="results"]');
  if(gameTab){gameTab.textContent='Gara';tabs.append(gameTab,tabs.querySelector('[data-activity-tab="roster"]'),tabs.querySelector('[data-activity-tab="details"]'));}
  root.classList.add('match-workspace');
  if(!a.id){root.classList.add('match-create');tabs.hidden=true;root.querySelector('#activityState').closest('.field').hidden=true;}
  document.body.appendChild(root);
  const $ = (s) => root.querySelector(s);
  const limited = !canPlan();
  if(limited){root.querySelectorAll('[data-activity-panel="details"] input,[data-activity-panel="details"] select,[data-activity-panel="details"] textarea,#formation').forEach(el=>el.disabled=true);$('#activityForm [type=submit]').textContent='Salva';$('#activityForm [type=submit]').setAttribute('aria-label','Salva osservazioni tecniche');}
  let dirty = false, resultPanel = null, workflow = null;
  const savedState=document.createElement('p');savedState.id='activitySaveState';savedState.className='save-state';savedState.setAttribute('role','status');savedState.textContent=a.id?'Salvato · Nessuna modifica':'Bozza non ancora salvata';root.querySelector('.activity-tabs').after(savedState);
  const updateSaveState=()=>{root.dataset.dirty=String(dirty||!!resultPanel?.isDirty());savedState.textContent=(busy||resultPanel?.isBusy())?'Salvataggio in corso…':(dirty||resultPanel?.isDirty())?'Modifiche non salvate':a.id?'Salvato · Nessuna modifica':'Bozza non ancora salvata'};
  root.addEventListener('match-statechange',updateSaveState);root.addEventListener('input',()=>queueMicrotask(updateSaveState));root.addEventListener('change',()=>queueMicrotask(updateSaveState));
  if(a.match_id){
    const tools=document.createElement('div');tools.className='match-export-toolbar';
    tools.innerHTML=`<button type="button" class="match-report-trigger">${icon('file',18)}<span>Esporta tabellino</span></button>`;
    root.querySelector('.activity-tabs').before(tools);
    tools.querySelector('button').onclick=()=>{
      if(!current()||busy||resultPanel?.isBusy())return;
      if(dirty||resultPanel?.isDirty())return toast('Salva le modifiche alla partita prima di esportare il tabellino.');
      matchReportModal({match:state.matches.find(m=>m.id===a.match_id),activity:a,roster:[...entries.values()],events:state.events,players:state.players});
    };
  }
  root.addEventListener("input", (event) => {if(!["rosterSearch","callupText"].includes(event.target.id)&&!event.target.closest('[data-activity-panel="results"]'))dirty=true});
  root.addEventListener("change", (event) => {if(!["rosterSearch","callupText"].includes(event.target.id)&&!event.target.closest('[data-activity-panel="results"]'))dirty=true});
  const close = () => {
    if (busy || resultPanel?.isBusy()) return;
    if ((dirty || resultPanel?.isDirty()) && !confirm("Scartare le modifiche non salvate?")) return;
    root.remove();
    if(state.page==="matches")render();
  };
  $("#closeActivity").onclick = close;
  $("#cancelActivity").onclick = close;
  bindDialog(root, close);
  root.querySelectorAll("[data-activity-tab]").forEach(
    (b) =>
      (b.onclick = () => {
        if(busy||resultPanel?.isBusy())return;
        if(b.dataset.activityTab==="results"&&dirty)return toast("Salva organizzazione e convocazioni prima di aprire risultato ed eventi");
        if(b.dataset.activityTab!=="results"&&resultPanel?.isDirty())return toast("Salva o annulla le modifiche alla gara prima di cambiare sezione");
        $("#activityForm > .modal-actions").hidden=b.dataset.activityTab==="results";
        root
          .querySelectorAll("[data-activity-tab]")
          .forEach((x) => {x.setAttribute("aria-selected", String(x === b));x.tabIndex=x===b?0:-1;x.id=`activity-tab-${a.id||"new"}-${x.dataset.activityTab}`;x.setAttribute("aria-controls",`activity-panel-${a.id||"new"}-${x.dataset.activityTab}`);});
        root
          .querySelectorAll("[data-activity-panel]")
          .forEach(
            (x) => {
              x.hidden = x.dataset.activityPanel !== b.dataset.activityTab;
              x.id=`activity-panel-${a.id||"new"}-${x.dataset.activityPanel}`;
              x.setAttribute("role","tabpanel");
              x.setAttribute("aria-labelledby",`activity-tab-${a.id||"new"}-${x.dataset.activityPanel}`);
            },
          );
      }),
  );
  root.querySelector('.activity-tabs').addEventListener('keydown',event=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;const tabs=[...root.querySelectorAll('[data-activity-tab]')].filter(b=>!b.hidden);const at=tabs.indexOf(document.activeElement);if(at<0)return;event.preventDefault();const index=event.key==='Home'?0:event.key==='End'?tabs.length-1:(at+(event.key==='ArrowRight'?1:-1)+tabs.length)%tabs.length;tabs[index].click();if(tabs[index].getAttribute('aria-selected')==='true')tabs[index].focus()});
  const paint = () => {
    updateSaveState();
    const pitch = $("#formationPreview");
    const rowsForWarnings=[...entries.values()].filter(r=>r.called),startersCount=rowsForWarnings.filter(r=>r.lineup==="Titolare").length;
    $("#matchReadiness").hidden=!a.id||$("#activityType").value!=="Partita";
    $("#matchReadiness").textContent=$("#activityType").value==="Partita"?`${rowsForWarnings.length} convocati · ${startersCount}/11 titolari${startersCount!==11?" · Formazione da completare":""}`:"";
    if (pitch) {
      const starters = players.filter((p) => {
        const r = entries.get(p.id);
        return r.called && r.lineup === "Titolare";
      });
      pitch.innerHTML = starters.length
        ? [...ROLE_ORDER]
            .reverse()
            .map((role) => {
              const group = starters.filter((p) => p.role === role);
              return group.length
                ? `<div class="pitch-line">${group.map((p) => `<div class="pitch-player"><b>${p.shirt_number || "●"}</b><span>${esc(p.surname)}</span><small>${esc(entries.get(p.id).position || role)}</small></div>`).join("")}</div>`
                : "";
            })
            .join("")
        : '<p class="empty">Seleziona i titolari nelle convocazioni per visualizzare la formazione.</p>';
    }
    const q = $("#rosterSearch").value.toLocaleLowerCase("it");
    const rows = [...entries.values()],
      called = rows.filter((r) => r.called);
    $("#rosterCounts").innerHTML =
      `<span class="badge b-blue">${called.length} convocati</span><span class="badge b-green">${called.filter(r=>r.lineup==="Titolare").length} titolari</span><span class="badge b-gray">${called.filter(r=>r.lineup==="Panchina").length} panchina</span>`;
    $("#activityRoster").innerHTML =
      players
        .filter((p) =>
          `${p.surname} ${p.name}`.toLocaleLowerCase("it").includes(q),
        )
        .map((p,index,filtered) => {
          const r = entries.get(p.id);
          const suspension=$('#activityType').value==='Partita'?dismissalAlert(p.id,$('#activityDate').value):'';
          return `${index===0||filtered[index-1].role!==p.role?`<h3 class="roster-role">${esc(p.role||"Altri giocatori")}</h3>`:""}<div class="roster-person"><label><input type="checkbox" data-called="${p.id}" ${$("#activityType").value!=="Partita"?"hidden":""} ${r.called ? "checked" : ""}><span><b>${esc(p.surname)} ${esc(p.name)}</b><small>${esc(p.role || "")}${!p.active ? " · Inattivo" : ""}</small>${suspension?`<small class="roster-suspension">${esc(suspension)}</small>`:""}</span></label><div class="roster-quick-controls"><label class="sr-only" for="quickLineup-${p.id}">Impiego di ${esc(p.surname)} ${esc(p.name)}</label><select id="quickLineup-${p.id}" data-roster-lineup="${p.id}" ${!r.called||limited?"disabled":""}>${["Non impiegato","Titolare","Panchina"].map(v=>`<option ${r.lineup===v?"selected":""}>${v}</option>`).join("")}</select><button type="button" data-roster-edit="${p.id}">Dettagli</button></div><div class="row-sub">${r.called ? `Convocato · ${esc(r.lineup)} · ${r.minutes_played} min${r.position ? " · " + esc(r.position) : ""}` : "Non convocato"}</div></div>`;
        })
        .join("") || '<div class="empty">Nessun giocatore.</div>';
    $("#activityRoster")
      .querySelectorAll("[data-called]")
      .forEach(
        (c) =>
          (c.onchange = () => {
            if(!canPlan()){paint();return}
            const r = entries.get(c.dataset.called);
            r.called = c.checked;
            if (!r.called) {
              r.lineup = "Non impiegato";
              r.minutes_played = 0;
            }
            dirty = true;
            paint();
          }),
      );
    $("#activityRoster")
      .querySelectorAll("[data-roster-edit]")
      .forEach(
        (b) =>
          (b.onclick = () =>
            rosterModal(
              players.find((p) => p.id === b.dataset.rosterEdit),
              entries.get(b.dataset.rosterEdit),
              () => {
                dirty = true;
                paint();
              },
              $("#activityType").value === "Partita",
            )),
      );
    root.querySelectorAll('[data-roster-lineup]').forEach(select=>select.onchange=()=>{if(!canPlan())return;const row=entries.get(select.dataset.rosterLineup);if(!row.called)return;row.lineup=select.value;dirty=true;paint();root.querySelector(`[data-roster-lineup="${row.player_id}"]`)?.focus({preventScroll:true})});
    if(limited)root.querySelectorAll("[data-called],[data-roster-edit]").forEach(el=>el.disabled=true);
    paintRosterExtras();
  };
  const paintRosterExtras=()=>{workflow?.filterRows()};
  $("#rosterSearch").oninput = paint;
  workflow=configureActivityWorkflow(root,a,entries,players,value=>{if(value===null)return dirty;dirty=true;updateSaveState();return dirty},paint);
  paint();
  if($("#activityType").value==="Partita")mountCallupCopy(root,a,entries,players,()=>dirty);
  if(a.match_id&&state.matches.some(m=>m.id===a.match_id))resultPanel=mountMatchResults(root,a,()=>!busy&&!dirty,()=>state.matches.find(m=>m.id===a.match_id),timeline=>{for(const row of timeline.roster)if(entries.has(row.player_id))Object.assign(entries.get(row.player_id),row);paint()});
  const tabKey='activity-'+crypto.randomUUID();root.querySelectorAll('[data-activity-tab]').forEach(b=>{b.id=tabKey+'-'+b.dataset.activityTab;const panel=root.querySelector(`[data-activity-panel="${b.dataset.activityTab}"]`);if(panel){panel.id=b.id+'-panel';panel.setAttribute('role','tabpanel');panel.setAttribute('aria-labelledby',b.id);b.setAttribute('aria-controls',panel.id)}});
  if(limited)preferredTab="results";
  if(preferredTab!=="details")root.querySelector(`[data-activity-tab="${preferredTab}"]`)?.click();

  if (a.id) {
    $("#activityMatch")?.addEventListener("click", () => {
      if (dirty)
        return toast("Salva o annulla le modifiche prima di aprire la partita");
      root.querySelector('[data-activity-tab="results"]')?.click();
    });
  }
  $("#activityForm").onsubmit = async (e) => {
    e.preventDefault();
    if(root.querySelector('[data-activity-tab="results"][aria-selected="true"]'))return root.querySelector("#saveMatchResult")?.click();
    if (busy || resultPanel?.isBusy()) return;
    if(resultPanel?.isDirty())return toast("Salva risultato e note prima di salvare l’organizzazione");
    if(limited){
      if(root.querySelector('[data-activity-tab="roster"]')?.getAttribute('aria-selected')!=='true')return;
      busy=true;setBusyControls(root,true);
      try{
        const {error}=await db.rpc('save_activity_observation',{p_id:a.id,p_revision:a.revision,p_note:$('#technicalNote').value.trim()||null});
        if(error)throw error;if(!current())return;
        dirty=false;const note=state.technical.find(row=>row.activity_id===a.id);if(note)note.note=$('#technicalNote').value.trim()||null;await resultPanel.reload();paint();$('#activityFeedback').textContent='Osservazioni tecniche salvate';
      }catch(error){$('#activityFeedback').textContent=error.message||'Osservazioni non salvate';}
      finally{busy=false;setBusyControls(root,false);updateSaveState();}
      return;
    }
    const button = e.target.querySelector("[type=submit]");
    busy = true;
    setBusyControls(root,true);updateSaveState();
    button.disabled = true;
    $("#activityFeedback").textContent = "Salvataggio…";
    try {
      const activity = {
        request_id: requestId,
        ...(!a.match_id ? {venue: $("#activityVenue").value} : {}),
        activity_type: $("#activityType").value,
        title: $("#activityName").value.trim(),
        activity_date: $("#activityDate").value,
        start_time: $("#activityStart").value,
        end_time: $("#activityEnd").value,
        meeting_time: $("#activityMeetingTime").value,
        meeting_place: $("#activityMeetingPlace").value.trim(),
        location: $("#activityLocation").value.trim(),
        status: $("#activityState").value,
        organization_note: $("#activityNote").value.trim(),
      };
      if (!activity.title || !activity.activity_date)
        throw new Error("Inserisci titolo e data");
      if (
        activity.end_time &&
        activity.start_time &&
        activity.end_time <= activity.start_time
      )
        throw new Error("La fine deve essere successiva all’inizio");
      if(activity.status==='Concluso' && a.status!=='Concluso' && a.match_id){
        const match=state.matches.find(m=>m.id===a.match_id), issues=matchReview(match,[...entries.values()],state.events.filter(e=>e.match_id===a.match_id));
        if(match.goals_for==null||match.goals_against==null)throw Error('Salva il risultato prima di concludere la partita');
        if(issues.length&&!(await confirmDialog({title:'Controllo prima della chiusura',message:'Prima di concludere verifica:\n'+issues.join('\n')+'\nConfermi di avere verificato questi dati?',confirmLabel:'Concludi'})))return;
      }
      const { data, error } = await db.rpc("save_team_activity", {
        p_activity: activity,
        p_roster: [...entries.values()].map(
          ({
            player_id,
            called,
            availability,
            response_note,
            lineup,
            position,
            minutes_played,
          }) => ({
            player_id,
            called,
            availability,
            response_note,
            lineup,
            position,
            minutes_played,
          }),
        ),
        p_id: a.id || null,
        p_revision: a.revision ?? null,
        p_technical: canTechnical()
          ? {
              formation: $("#formation").value.trim() || null,
              note: $("#technicalNote").value.trim() || null,
            }
          : null,
      });
      if (error) throw error;if(!current())return;
      const existing=!!a.id;
      Object.assign(a,data);
      dirty = false;
      if(existing&&resultPanel){
        state.activities=state.activities.filter(row=>row.id!==a.id).concat({...a});
        if(canTechnical()){
          const updated={activity_id:a.id,user_id:teamOwner(),formation:$('#formation').value.trim()||null,note:$('#technicalNote').value.trim()||null};
          state.technical=state.technical.filter(row=>row.activity_id!==a.id).concat(updated);
        }
        await resultPanel.reload();paint();$('#activityFeedback').textContent='Partita e convocazioni salvate';
      }else{
        root.dataset.keepRoute=String(!existing);root.remove();const loaded=await refresh();
        if(!existing&&loaded&&current())activityModal(a,state.roster.filter(r=>r.activity_id===a.id),state.technical.find(t=>t.activity_id===a.id)||null,'roster');
        toast(existing?'Partita e convocazioni salvate':'Partita programmata. Puoi preparare i convocati.');
      }
    } catch (error) {
      $("#activityFeedback").textContent = error.message;
      if(['40001','PT409'].includes(error.code)){
        const reopen=document.createElement('button');reopen.type='button';reopen.className='ghost wide field-space';reopen.textContent='Ricarica partite';
        $("#activityFeedback").appendChild(reopen);reopen.onclick=async()=>{if(!(await confirmDialog({message:'Scartare questa bozza e caricare le partite aggiornate?',confirmLabel:'Scarta'})))return;root.remove();state.page='matches';await refresh()};
      }
    } finally {
      busy = false;
      setBusyControls(root,false);updateSaveState();
      button.disabled = false;
    }
  };
}
function rosterModal(p, r, onSave, isMatch = true) {
  if(!canPlan())return;
  const automatic=isMatch&&(!r.activity_id||state.matches.find(m=>state.activities.some(a=>a.id===r.activity_id&&a.match_id===m.id))?.minutes_auto);
  const root = document.createElement("div");
  root.className = "modal-back event-back";
  root.innerHTML = `<section class="modal" role="dialog" aria-modal="true" aria-labelledby="rosterTitle"><div class="modal-head"><h2 id="rosterTitle">${esc(p.surname)} ${esc(p.name)}</h2><button aria-label="Chiudi convocato">✕</button></div><form><div class="form-grid field-space"><div class="field"><label for="lineup">Impiego</label><select id="lineup" ${!r.called || !isMatch ? "disabled" : ""}>${["Non impiegato", "Titolare", "Panchina"].map((v) => `<option ${r.lineup === v ? "selected" : ""}>${v}</option>`).join("")}</select></div><div class="field"><label for="minutesPlayed">Minuti giocati</label><input id="minutesPlayed" type="number" inputmode="numeric" min="0" max="130" step="1" value="${r.minutes_played}" ${!r.called || !isMatch || automatic ? "disabled" : ""}></div></div><div class="field field-space"><label for="position">Posizione in campo</label><input id="position" maxlength="50" value="${esc(r.position || "")}"></div><p class="muted">${r.called ? automatic ? "Minuti automatici dai titolari e dagli eventi. Verifica la durata nelle impostazioni della partita." : "Convocato. Indica i minuti effettivamente giocati." : "Seleziona la convocazione nella lista per indicare l’impiego."}</p><button class="primary wide field-space" type="submit">Conferma in bozza</button><p role="status" id="rosterError"></p></form></section>`;
  document.body.appendChild(root);
  const $ = (s) => root.querySelector(s);
  const close = () => root.remove();
  root.querySelector(".modal-head button").onclick = close;
  bindDialog(root, close);
  root.querySelector("form").onsubmit = (e) => {
    e.preventDefault();
    const minutes = Number($("#minutesPlayed").value);
    if (!Number.isInteger(minutes) || minutes < 0 || minutes > 130) {
      $("#rosterError").textContent = "Minuti interi tra 0 e 130";
      return;
    }
    Object.assign(r, {
      lineup: r.called && isMatch ? $("#lineup").value : "Non impiegato",
      minutes_played: r.called && isMatch ? minutes : 0,
      position: $("#position").value.trim() || null,
    });
    root.remove();
    onSave();
  };
}
function playerSheet(id) {
  teamArrays();
  const p = state.players.find((p) => p.id === id);
  if (!p) return;
  const d = state.administration.find((d) => d.player_id === id) || {},
    rows = state.roster.filter((r) => r.player_id === id && state.activities.some(a=>a.id===r.activity_id&&a.activity_type==='Partita'&&a.status!=='Annullato')),
    minutes = rows.reduce((n, r) => n + Number(r.minutes_played||0), 0);
  const attendance=state.attendance.filter(r=>r.player_id===id), events=state.events.filter(e=>e.player_id===id);
  const root = document.createElement("div");
  root.className = "modal-back";
  root.dataset.detail="player:"+id;root.dataset.page="players";
  root.innerHTML = `<section class="modal player-sheet" role="dialog" aria-modal="true" aria-labelledby="playerSheetTitle"><div class="modal-head"><div><h2 id="playerSheetTitle">${esc(p.surname)} ${esc(p.name)}</h2></div><button aria-label="Chiudi scheda">✕</button></div><p class="muted">${esc(p.role || "")} ${p.secondary_role ? "· " + esc(p.secondary_role) : ""}${p.shirt_number ? " · #" + p.shirt_number : ""}</p><h3 class="sheet-heading">Stagione selezionata</h3><div class="player-kpis"><div><b>${rows.filter((r) => r.called).length}</b><span>Convocazioni</span></div><div><b>${minutes}</b><span>Minuti registrati</span></div><div><b>${attendance.filter(r=>r.status==="Presente").length}</b><span>Presenze effettive</span></div></div>${renderExtensions("player-actions",p)}<div class="player-kpis player-kpis-events"><div><b>${events.filter(e=>e.event_type==="Gol").length}</b><span>Gol</span></div><div><b>${events.filter(e=>["Ammonizione","Espulsione"].includes(e.event_type)).length}</b><span>Cartellini</span></div></div><p class="row-sub">Dati della stagione selezionata. Il report permette di consultare tutto lo storico ed esportare il PDF.</p><button type="button" id="openPlayerReport">Report e PDF del giocatore</button><details class="field-space"><summary>Presenze nello storico della stagione</summary><div class="list">${attendance.map(r=>`<article class="row"><span>${fmt(state.sessions.find(s=>s.id===r.session_id)?.session_date)}</span><b>${esc(r.status)}</b></article>`).join("")||"<p>Nessuna presenza registrata.</p>"}</div></details>${canManage() ? `<details class="player-sheet-management"><summary>Dati e gestione giocatore</summary><p class="muted">${p.active ? "Giocatore nella rosa attiva." : "Giocatore inattivo. Lo storico è conservato."}</p><div class="player-sheet-actions"><button type="button" id="editSheetPlayer">Modifica dati giocatore</button><button type="button" id="toggleSheetPlayer" class="${p.active ? "danger" : "primary"}">${p.active ? "Disattiva giocatore" : "Riattiva giocatore"}</button></div><p class="row-sub">La disattivazione conserva presenze, partite e report.</p><p id="playerStateFeedback" role="status"></p></details><form id="playerAdminForm"><h3 class="sheet-heading">Scadenze e tesseramento</h3><div class="field"><label for="registrationState">Tesseramento</label><select id="registrationState">${["Da verificare", "In regola", "Da completare"].map((v) => `<option ${d.registration_status === v ? "selected" : ""}>${v}</option>`).join("")}</select></div><div class="form-grid field-space"><div class="field"><label for="certificateUntil">Certificato valido fino al</label><input id="certificateUntil" type="date" value="${d.certificate_until || ""}"></div><div class="field"><label for="documentUntil">Documento valido fino al</label><input id="documentUntil" type="date" value="${d.document_until || ""}"></div></div><div class="field field-space"><label for="emergencyContact">Contatto di emergenza</label><input id="emergencyContact" maxlength="300" value="${esc(d.emergency_contact || "")}"></div><p class="muted">Registra solo scadenze e recapiti necessari, senza diagnosi o documenti sanitari.</p><button class="primary wide" type="submit">Salva scheda</button><p role="status" id="playerAdminStatus"></p></form>` : ""}</section>`;
  document.body.appendChild(root);
 bindExtensions(root);
 root.querySelector("#openPlayerReport").onclick=async()=>{if(root.dataset.dirty==='true'&&!(await confirmDialog({message:'Scartare le modifiche alla scheda non salvate?',confirmLabel:'Scarta'})))return;state.reportPlayer=id;root.remove();state.page='reports';render();};
  let busy=false;const current=teamRequestGuard(),close = trackDialogDraft(root,()=>busy);
  root.querySelector(".modal-head button").onclick = close;
  bindDialog(root, close);
  if (canManage()) {
    root.querySelector('#editSheetPlayer').onclick = () => { if (busy) return; close(); if (!root.isConnected) playerModal(p); };
    root.querySelector('#toggleSheetPlayer').onclick = async () => {
      if (busy) return;
      busy = true;
      const feedback = root.querySelector('#playerStateFeedback');
      try {
        if (root.dataset.dirty === 'true') { feedback.textContent = 'Salva prima le modifiche alla scheda.'; return; }
        if (!(await confirmDialog({title:p.active?'Disattiva giocatore':'Riattiva giocatore', message:p.active?`Disattivare ${p.surname} ${p.name}? Lo storico resta disponibile.`:`Riattivare ${p.surname} ${p.name} nella rosa?`, confirmLabel:p.active?'Disattiva':'Riattiva', danger:p.active}))) return;
        if (!current() || !canManage()) return;
        setBusyControls(root,true);
        feedback.textContent = 'Salvataggio in corso…';
        const values = {active:!p.active};
        if (values.active) values.role_order = Math.max(0,...state.players.filter(x=>x.active&&x.role===p.role).map(x=>Number(x.role_order)||0))+1;
        const {error} = await db.from('players').update(values).eq('id',p.id).eq('user_id',teamOwner());
        if (error) throw error;
        if (!current()) return;
        root.remove(); await refresh(); toast(values.active?'Giocatore riattivato':'Giocatore disattivato; storico conservato');
      } catch(error) { feedback.textContent=error.message||'Salvataggio non riuscito. Riprova.'; }
      finally { busy=false; setBusyControls(root,false); }
    };
  }
  if (canManage())
    root.querySelector("form").onsubmit = async (e) => {
      e.preventDefault();
      const button = e.target.querySelector("button");
      if(busy)return;busy=true;setBusyControls(root,true);button.disabled = true;root.querySelector("#playerAdminStatus").textContent="Salvataggio in corso…";
      try {
        const val = (id) => root.querySelector("#" + id).value;
        const { error } = await db
          .from("player_administration")
          .upsert(
            {
              user_id: teamOwner(),
              player_id: p.id,
              registration_status: val("registrationState"),
              certificate_until: val("certificateUntil") || null,
              document_until: val("documentUntil") || null,
              emergency_contact: val("emergencyContact").trim() || null,
            },
            { onConflict: "player_id" },
          );
        if (error) throw error;if(!current())return;
        root.remove();
        await refresh();
        toast("Scheda aggiornata");
      } catch (error) {
        root.querySelector("#playerAdminStatus").textContent = error.message;
      } finally {
        busy=false;setBusyControls(root,false);button.disabled = false;
      }
    };
}
function expiryModal() {
 if(!canViewExpiries())return;
 teamArrays();const summaryOnly=teamRole()==='president',rows=expiringPlayers(),root=document.createElement('div');root.className='modal-back';root.dataset.detail='tool:expiries';root.dataset.page='more';root.dataset.workspace='true';
 const statuses=d=>summaryOnly?[d.certificate_status,d.document_status]:[documentState(d.certificate_until,today(),expiryLimit()),documentState(d.document_until,today(),expiryLimit())];
 const choices=[['all','Tutti'],['missing','Mancanti'],['expired','Scaduti'],['soon','In scadenza'],['registration','Tesseramento incompleto']];
 const matches=(d,key)=>key==='all'||key==='registration'&&d.registration_status!=='In regola'||statuses(d).includes(({missing:'Mancante',expired:'Scaduto',soon:'In scadenza'})[key]);
 let filter=new URLSearchParams(window.location.hash.split('?')[1]||'').get('filter')||'all';if(!choices.some(([key])=>key===filter))filter='all';
 root.innerHTML=`<section class="modal expiry-page" role="dialog" aria-modal="true" aria-labelledby="expiryTitle"><div class="modal-head"><h2 id="expiryTitle">Scadenze e tesseramenti</h2><button aria-label="Chiudi scadenze">${icon('close')}</button></div><p class="muted">${rows.length} giocatori da verificare${summaryOnly?'. Consultazione sintetica: le date restano riservate alla segreteria.':'. Le date mancanti richiedono verifica; non sono scadenze già superate.'}</p><div class="expiry-filters" role="group" aria-label="Filtra scadenze">${choices.map(([key,label])=>`<button type="button" data-expiry-filter="${key}" aria-pressed="${filter===key}">${label} <span>${rows.filter(d=>matches(d,key)).length}</span></button>`).join('')}</div><p id="expiryFilterSummary" class="row-sub" role="status"></p><div id="expiryList" class="list"></div></section>`;
 document.body.append(root);const close=()=>root.remove();root.querySelector('.modal-head button').onclick=close;bindDialog(root,close);
 const paint=()=>{
  const selected=rows.filter(d=>matches(d,filter));
  const missing=selected.reduce((n,d)=>n+statuses(d).filter(status=>status==='Mancante').length,0);
  root.querySelector('#expiryFilterSummary').textContent=selected.length+' giocatori mostrati'+(missing?' · '+missing+' scadenze mancanti':'');
  root.querySelector('#expiryList').innerHTML=selected.map(d=>{const p=state.players.find(p=>p.id===d.player_id),values=statuses(d);return `<button class="expiry-row" data-player-sheet="${esc(p.id)}"><b>${esc(p.surname)} ${esc(p.name)}</b><span>Certificato: ${esc(values[0])}${!summaryOnly&&d.certificate_until?' · '+fmt(d.certificate_until):''}</span><span>Documento: ${esc(values[1])}${!summaryOnly&&d.document_until?' · '+fmt(d.document_until):''}</span><small>Tesseramento: ${esc(d.registration_status)}</small></button>`}).join('')||'<div class="sc-empty-state"><h3>Nessun giocatore in questo filtro</h3><p>Scegli un altro stato per consultare le verifiche.</p></div>';
  root.querySelectorAll('[data-player-sheet]').forEach(button=>button.onclick=()=>{root.remove();playerSheet(button.dataset.playerSheet)});
  root.querySelectorAll('[data-expiry-filter]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.expiryFilter===filter)));
 };
 root.querySelectorAll('[data-expiry-filter]').forEach(button=>button.onclick=()=>{filter=button.dataset.expiryFilter;rememberQuery({filter});paint()});paint();
}

export { roleLabels, teamArrays, activityRows, activityLabel, clock, expiryLimit, expiringPlayers, documentSummary, activityCard, morePage, bindMore, bindTeamLinks, openActivity, activityModal, rosterModal, playerSheet, expiryModal };
