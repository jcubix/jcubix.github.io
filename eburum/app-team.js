const roleLabels = {
  admin: "Amministratore",
  manager: "Team manager",
  coach: "Allenatore",
};
const teamArrays = () => {
  for (const k of ["activities", "roster", "administration", "technical"])
    state[k] ??= [];
};
const activityRows = (id) =>
  (state.roster || []).filter((r) => r.activity_id === id);
const activityLabel = (a) =>
  a.activity_type === "Partita" ? `Eburum · ${a.title}` : a.title;
const clock = (t) => (t ? t.slice(0, 5) : "Orario da definire");
const expiryLimit = () => {
  const d = new Date();
  d.setDate(d.getDate() + 30);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
function expiringPlayers() {
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
function activityCard(a) {
  const rows = activityRows(a.id),
    called = rows.filter((r) => r.called),
    waiting = called.filter((r) => r.availability === "In attesa").length;
  return `<button class="activity-card" data-open-activity="${a.id}"><span class="activity-date"><b>${new Date(a.activity_date + "T12:00:00").getDate()}</b><small>${new Intl.DateTimeFormat("it-IT", { month: "short" }).format(new Date(a.activity_date + "T12:00:00"))}</small></span><span class="activity-main"><span class="activity-type">${esc(a.activity_type)} · ${esc(a.status)}</span><strong>${esc(activityLabel(a))}</strong><span>${clock(a.start_time)}${a.location ? " · " + esc(a.location) : ""}</span><small>${called.length} convocati${waiting ? " · " + waiting + " risposte da registrare" : ""}</small></span><span aria-hidden="true">›</span></button>`;
}
const originalShell = shell;
shell = function (content) {
  const html = originalShell(content);
  const nav = html.indexOf('<nav class="nav">');
  return (
    html.slice(0, nav) +
    `<nav class="nav team-nav" aria-label="Navigazione principale"><div class="nav-brand" aria-hidden="true"><img src="./icon.svg" alt=""></div>${navBtn("dashboard", "", "Home")}${navBtn("agenda", "", "Agenda")}${navBtn("players", "", "Rosa")}${navBtn("matches", "", "Partite")}${navBtn("more", "", "Altro")}</nav>`
  );
};
const originalNav = navBtn;
navBtn = function (page, icon, label) {
  if (!["agenda", "more"].includes(page)) return originalNav(page, icon, label);
  const paths =
    page === "agenda"
      ? '<path d="M4 5h16v16H4zM8 3v4m8-4v4M4 11h16m-11 4h2m3 0h2m-7 3h2"/>'
      : '<circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/>';
  return `<button data-page="${page}" class="${(state.page === page || page === "more" && ["training","register","reports"].includes(state.page)) ? "active" : ""}" ${(state.page === page || page === "more" && ["training","register","reports"].includes(state.page)) ? 'aria-current="page"' : ""}><b aria-hidden="true"><svg viewBox="0 0 24 24">${paths}</svg></b><span>${label}</span></button>`;
};
function morePage() {
  return `<div class="section-title"><div><h2>Strumenti squadra</h2><p class="muted">${roleLabels[teamRole()]} · ${esc(state.user.email || "")}</p></div></div><div class="list tool-list"><button data-page="training"><b>Registra presenze</b><span>Allenamenti e attività svolte</span></button><button data-page="register"><b>Registro</b><span>Consulta e correggi le presenze</span></button><button data-page="reports"><b>Report e statistiche</b><span>Presenze, convocazioni e minuti giocati</span></button>${canManage() ? "<button data-expiries><b>Scadenze e tesseramenti</b><span>Certificati e documenti da verificare</span></button>" : ""}${isAdmin() ? '<button id="teamUsers"><b>Gestione staff</b><span>Utenze e ruoli della squadra condivisa</span></button>' : ""}</div>`;
}
function bindMore() {
  document.querySelector("#teamUsers")?.addEventListener("click", usersModal);
}
function agendaPage() {
  teamArrays();
  return `<div class="section-title"><div><div class="eyebrow">ORGANIZZAZIONE</div><h2>Agenda squadra</h2><div class="muted">Allenamenti, partite e riunioni in un solo posto.</div></div><button class="primary" data-new-activity>+ Attività</button></div><div class="agenda-controls"><input id="agendaSearch" type="search" aria-label="Cerca attività" placeholder="Cerca titolo o luogo"><div class="report-tabs"><button data-agenda-scope="upcoming" class="active">In programma</button><button data-agenda-scope="all">Tutte</button></div><div class="form-grid"><div class="field"><label for="agendaFrom">Dal</label><input type="date" id="agendaFrom"></div><div class="field"><label for="agendaType">Tipo attività</label><select id="agendaType"><option value="">Tutte le attività</option><option>Allenamento</option><option>Partita</option><option>Riunione</option></select></div></div></div><div class="list" id="agendaList"></div>`;
}
function bindAgenda() {
  let scope = "upcoming";
  const paint = () => {
    const q = document
        .querySelector("#agendaSearch")
        .value.toLocaleLowerCase("it"),
      from = document.querySelector("#agendaFrom").value,
      type = document.querySelector("#agendaType").value;
    const rows = state.activities
      .filter(
        (a) =>
          (scope === "all" || a.status === "Programmato") &&
          (!from || a.activity_date >= from) &&
          (!type || a.activity_type === type) &&
          `${a.title} ${a.location || ""}`.toLocaleLowerCase("it").includes(q),
      )
      .sort((a, b) =>
        (a.activity_date + (a.start_time || "")).localeCompare(
          b.activity_date + (b.start_time || ""),
        ),
      );
    document.querySelector("#agendaList").innerHTML =
      rows.map(activityCard).join("") ||
      '<div class="card empty">Nessuna attività corrisponde ai filtri.</div>';
    bindTeamLinks();
  };
  for (const id of ["agendaSearch", "agendaFrom", "agendaType"])
    document.querySelector("#" + id).oninput = paint;
  document.querySelectorAll("[data-agenda-scope]").forEach(
    (b) =>
      (b.onclick = () => {
        scope = b.dataset.agendaScope;
        document
          .querySelectorAll("[data-agenda-scope]")
          .forEach((x) => x.classList.toggle("active", x === b));
        paint();
      }),
  );
  paint();
}
function bindTeamLinks() {
  document
    .querySelectorAll("[data-open-activity]")
    .forEach((b) => (b.onclick = () => openActivity(b.dataset.openActivity)));
  document
    .querySelectorAll("[data-new-activity]")
    .forEach((b) => (b.onclick = () => activityModal()));
  document
    .querySelectorAll("[data-player-sheet]")
    .forEach((b) => (b.onclick = () => playerSheet(b.dataset.playerSheet)));
  document
    .querySelectorAll("[data-expiries]")
    .forEach((b) => (b.onclick = expiryModal));
}
async function openActivity(id, preferredTab = "auto") {
  if(state.openingActivity)return;state.openingActivity=true;
  try {
    const uid = teamOwner(),
      actor = state.user.id;
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
    if (state.user?.id !== actor) return;
    activityModal(a.data, r.data, t.data[0], preferredTab === "auto" ? (a.data.match_id && ["during","after"].includes(matchPhase(a.data)) ? "results" : "details") : preferredTab);
  } catch (e) {
    fail(e);
  } finally {state.openingActivity=false}
}
function activityModal(a = {}, savedRows = [], technical = {}, preferredTab = "details") {
  teamArrays();
  const root = document.createElement("div");
  root.className = "modal-back";
  let busy = false;
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
  root.innerHTML = `<section class="modal activity-modal" role="dialog" aria-modal="true" aria-labelledby="activityTitle"><div class="modal-head"><div><div class="eyebrow">AGENDA · SQUADRA</div><h2 id="activityTitle">${a.id ? esc(activityLabel(a)) : "Nuova attività"}</h2></div><button id="closeActivity" aria-label="Chiudi attività">✕</button></div><div class="activity-tabs" role="tablist" aria-label="Scheda attività"><button type="button" data-activity-tab="details" role="tab" aria-selected="true">Organizzazione</button><button type="button" data-activity-tab="roster" role="tab" aria-selected="false">Convocazioni</button>${canTechnical() ? '<button type="button" data-activity-tab="technical" role="tab" aria-selected="false">Formazione</button>' : ""}${a.match_id ? '<button type="button" data-activity-tab="results" role="tab" aria-selected="false">Risultato ed eventi</button>' : ""}</div><div id="matchReadiness" class="notice field-space" role="status"></div><form id="activityForm" novalidate><section data-activity-panel="details"><div class="form-grid"><div class="field"><label for="activityType">Tipo</label><select id="activityType" ${a.id ? "disabled" : ""}>${["Allenamento", "Partita", "Riunione"].map((t) => `<option ${a.activity_type === t ? "selected" : ""}>${t}</option>`).join("")}</select></div><div class="field"><label for="activityName">Titolo / avversario</label><input id="activityName" maxlength="160" required value="${esc(a.title || "")}"></div>${field("activityDate", "Data", "date", a.activity_date || today())}${field("activityStart", "Inizio", "time", a.start_time)}${field("activityEnd", "Fine", "time", a.end_time)}<div class="field"><label for="activityState">Stato</label><select id="activityState">${["Programmato", "Concluso", "Annullato"].map((t) => `<option ${a.status === t ? "selected" : ""}>${t}</option>`).join("")}</select></div></div><div class="field field-space"><label for="activityLocation">Campo / luogo</label><input id="activityLocation" maxlength="500" value="${esc(a.location || "")}"></div><h3 class="sheet-heading">Ritrovo e organizzazione</h3><div class="form-grid">${field("activityMeetingTime", "Ora ritrovo", "time", a.meeting_time)}${field("activityMeetingPlace", "Luogo ritrovo", "text", a.meeting_place)}</div><div class="field field-space"><label for="activityNote">Indicazioni per lo staff</label><textarea id="activityNote" rows="3" maxlength="10000" placeholder="Trasporto, divise, documenti, materiale…">${esc(a.organization_note || "")}</textarea></div>${a.id ? `<div class="session-tools">${a.match_id ? '<button type="button" id="activityMatch">Risultato ed eventi</button>' : ""}<button type="button" id="activityAttendance">${a.session_id ? "Apri presenze" : "Registra presenze"}</button></div>` : ""}</section><section data-activity-panel="roster" hidden><div class="notice">Disponibilità prevista e convocazione. Le presenze effettive si confermano dopo la gara.</div><input type="search" id="rosterSearch" aria-label="Cerca convocato" placeholder="Cerca giocatore"><div id="rosterCounts" class="attendance-counts field-space"></div><div class="list field-space" id="activityRoster"></div></section>${canTechnical() ? `<section data-activity-panel="technical" hidden><div class="notice">Note tecniche visibili soltanto ad amministratori e allenatori.</div><div id="formationPreview" class="formation-preview" aria-label="Titolari raggruppati per ruolo"></div><div class="field field-space"><label for="formation">Modulo</label><input id="formation" maxlength="30" value="${esc(technical?.formation || "")}" placeholder="Es. 4-3-3"></div><div class="field field-space"><label for="technicalNote">Osservazioni tecniche</label><textarea id="technicalNote" rows="4" maxlength="10000">${esc(technical?.note || "")}</textarea></div><p class="muted">Titolari, panchina, posizione e minuti giocati si compilano dalla scheda di ogni convocato. I minuti sono registrati dallo staff.</p></section>` : ""}<div class="modal-actions"><button class="ghost" id="cancelActivity" type="button">Annulla</button><button class="primary" type="submit">${a.id ? "Salva attività" : "Crea attività"}</button></div><p id="activityFeedback" role="status" aria-live="polite"></p></form></section>`;
  document.body.appendChild(root);
  const $ = (s) => root.querySelector(s);
  let dirty = false, resultPanel = null, workflow = null;
  const savedState=document.createElement('p');savedState.id='activitySaveState';savedState.className='save-state';savedState.setAttribute('role','status');savedState.textContent=a.id?'Salvato · Nessuna modifica':'Bozza non ancora salvata';root.querySelector('.activity-tabs').after(savedState);
  const updateSaveState=()=>{root.dataset.dirty=String(dirty||!!resultPanel?.isDirty());savedState.textContent=(busy||resultPanel?.isBusy())?'Salvataggio in corso…':(dirty||resultPanel?.isDirty())?'Modifiche non salvate':a.id?'Salvato · Nessuna modifica':'Bozza non ancora salvata'};
  root.addEventListener('input',()=>queueMicrotask(updateSaveState));root.addEventListener('change',()=>queueMicrotask(updateSaveState));
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
        if(b.dataset.activityTab!=="results"&&resultPanel?.isDirty())return toast("Salva risultato e note prima di cambiare sezione");
        $("#activityForm > .modal-actions").hidden=b.dataset.activityTab==="results";
        root
          .querySelectorAll("[data-activity-tab]")
          .forEach((x) => x.setAttribute("aria-selected", String(x === b)));
        root
          .querySelectorAll("[data-activity-panel]")
          .forEach(
            (x) =>
              (x.hidden = x.dataset.activityPanel !== b.dataset.activityTab),
          );
      }),
  );
  root.querySelector('.activity-tabs').addEventListener('keydown',event=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;const tabs=[...root.querySelectorAll('[data-activity-tab]')].filter(b=>!b.hidden);const at=tabs.indexOf(document.activeElement);if(at<0)return;event.preventDefault();const index=event.key==='Home'?0:event.key==='End'?tabs.length-1:(at+(event.key==='ArrowRight'?1:-1)+tabs.length)%tabs.length;tabs[index].click();if(tabs[index].getAttribute('aria-selected')==='true')tabs[index].focus()});
  const paint = () => {
    updateSaveState();
    const pitch = $("#formationPreview");
    const rowsForWarnings=[...entries.values()].filter(r=>r.called),unavailable=rowsForWarnings.filter(r=>r.availability==="Indisponibile"),startersCount=rowsForWarnings.filter(r=>r.lineup==="Titolare").length;
    $("#matchReadiness").hidden=$("#activityType").value!=="Partita";
    $("#matchReadiness").textContent=$("#activityType").value==="Partita"?`${rowsForWarnings.length} convocati · ${startersCount}/11 titolari${unavailable.length?` · Attenzione: ${unavailable.length} convocati indisponibili`:""}${startersCount!==11?" · Formazione da completare":""}`:"";
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
    const responseRows=rows;
    $("#rosterCounts").innerHTML =
      `<span class="badge b-blue">${called.length} convocati</span><span class="badge b-green">${responseRows.filter((r) => r.availability === "Disponibile").length} disponibili</span><span class="badge b-yellow">${responseRows.filter((r) => r.availability === "In attesa").length} non hanno risposto</span>`;
    $("#activityRoster").innerHTML =
      players
        .filter((p) =>
          `${p.surname} ${p.name}`.toLocaleLowerCase("it").includes(q),
        )
        .map((p) => {
          const r = entries.get(p.id);
          return `<div class="roster-person"><label><input type="checkbox" data-called="${p.id}" ${$("#activityType").value!=="Partita"?"hidden":""} ${r.called ? "checked" : ""}><span><b>${esc(p.surname)} ${esc(p.name)}</b><small>${esc(p.role || "")}${!p.active ? " · Inattivo" : ""}</small></span></label><button type="button" data-roster-edit="${p.id}">${esc(r.availability)}</button><div class="row-sub">${r.called ? `${esc(r.lineup)} · ${r.minutes_played} min${r.position ? " · " + esc(r.position) : ""}` : "Non convocato"}</div></div>`;
        })
        .join("") || '<div class="empty">Nessun giocatore.</div>';
    $("#activityRoster")
      .querySelectorAll("[data-called]")
      .forEach(
        (c) =>
          (c.onchange = () => {
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
    paintRosterExtras();
  };
  const paintRosterExtras=()=>{
   root.querySelectorAll('.roster-person').forEach(el=>{const id=el.querySelector('[data-roster-edit]').dataset.rosterEdit,r=entries.get(id),quick=document.createElement('div');quick.className='roster-quick';quick.setAttribute('role','group');quick.setAttribute('aria-label','Risposta di '+players.find(p=>p.id===id)?.surname);quick.innerHTML=['Disponibile','Indisponibile','In attesa'].map(v=>`<button type="button" data-availability="${v}" aria-pressed="${r.availability===v}">${v==='In attesa'?'Non risposto':v}</button>`).join('');el.append(quick);quick.querySelectorAll('[data-availability]').forEach(b=>b.onclick=()=>{if(busy)return;r.availability=b.dataset.availability;dirty=true;paint()});if($("#activityType").value!=='Partita')el.querySelector('.row-sub').hidden=true;
   });workflow?.filterRows();
  };
  $("#rosterSearch").oninput = paint;
  workflow=configureActivityWorkflow(root,a,entries,players,value=>{if(value===null)return dirty;dirty=true;updateSaveState();return dirty},paint);
  $("#activityType").addEventListener('change',()=>{const match=$("#activityType").value==='Partita';root.querySelector('[data-activity-tab="roster"]').textContent=match?'Convocazioni':'Sondaggio';root.querySelector('[data-activity-tab="technical"]')?.toggleAttribute('hidden',!match);if(match&&!root.querySelector('.match-phases'))mountMatchPhases(root,{...a,activity_type:'Partita'});if(root.querySelector('.match-phases'))root.querySelector('.match-phases').hidden=!match;if(match&&!root.querySelector('.callup-copy'))mountCallupCopy(root,a,entries,players,()=>dirty);if(root.querySelector('.callup-copy'))root.querySelector('.callup-copy').hidden=!match;paint()});
  paint();
  if($("#activityType").value==="Partita")mountCallupCopy(root,a,entries,players,()=>dirty);
  if(a.match_id&&state.matches.some(m=>m.id===a.match_id))resultPanel=mountMatchResults(root,a,()=>!busy&&!dirty,()=>state.matches.find(m=>m.id===a.match_id));
  const tabKey='activity-'+crypto.randomUUID();root.querySelectorAll('[data-activity-tab]').forEach(b=>{b.id=tabKey+'-'+b.dataset.activityTab;const panel=root.querySelector(`[data-activity-panel="${b.dataset.activityTab}"]`);if(panel){panel.id=b.id+'-panel';panel.setAttribute('role','tabpanel');panel.setAttribute('aria-labelledby',b.id);b.setAttribute('aria-controls',panel.id)}});
  if(preferredTab!=="details")root.querySelector(`[data-activity-tab="${preferredTab}"]`)?.click();
  if (a.id) {
    $("#activityMatch")?.addEventListener("click", () => {
      if (dirty)
        return toast("Salva o annulla le modifiche prima di aprire la partita");
      root.querySelector('[data-activity-tab="results"]')?.click();
    });
    $("#activityAttendance").onclick = () => {
      if (dirty)
        return toast(
          "Salva o annulla le modifiche prima di aprire le presenze",
        );
      if(a.status==='Annullato')return toast('L’attività è annullata');
      if(a.activity_date>today())return toast('Per una data futura registra il sondaggio. Le presenze si confermano dopo l’attività.');
      if(trainingDraft?.saving)return toast('Attendi il salvataggio in corso');
      if(trainingDraft&&draftChanged(trainingDraft)&&!confirm('Scartare la bozza presenze non salvata?'))return;
      root.remove();startActualAttendance(a,true);
    };
  }
  $("#activityForm").onsubmit = async (e) => {
    e.preventDefault();
    if(root.querySelector('[data-activity-tab="results"][aria-selected="true"]'))return root.querySelector("#saveMatchResult")?.click();
    if (busy || resultPanel?.isBusy()) return;
    if(resultPanel?.isDirty())return toast("Salva risultato e note prima di salvare l’organizzazione");
    const button = e.target.querySelector("[type=submit]");
    busy = true;
    setBusyControls(root,true);updateSaveState();
    button.disabled = true;
    $("#activityFeedback").textContent = "Salvataggio…";
    try {
      const activity = {
        request_id: requestId,
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
      if (error) throw error;
      a = data;
      dirty = false;
      root.remove();
      await refresh();
      toast("Attività e convocazioni salvate");
    } catch (error) {
      $("#activityFeedback").textContent = error.message;
      if(error.code==='40001'){
        const reopen=document.createElement('button');reopen.type='button';reopen.className='ghost wide field-space';reopen.textContent='Ricarica Agenda';
        $("#activityFeedback").appendChild(reopen);reopen.onclick=async()=>{if(!confirm('Scartare questa bozza e caricare l’Agenda aggiornata?'))return;root.remove();state.page='agenda';await refresh()};
      }
    } finally {
      busy = false;
      setBusyControls(root,false);updateSaveState();
      button.disabled = false;
    }
  };
}
function rosterModal(p, r, onSave, isMatch = true) {
  const root = document.createElement("div");
  root.className = "modal-back event-back";
  root.innerHTML = `<section class="modal" role="dialog" aria-modal="true" aria-labelledby="rosterTitle"><div class="modal-head"><h2 id="rosterTitle">${esc(p.surname)} ${esc(p.name)}</h2><button aria-label="Chiudi convocato">✕</button></div><form><div class="field"><label for="availability">Disponibilità</label><select id="availability">${["In attesa", "Disponibile", "Indisponibile"].map((v) => `<option ${r.availability === v ? "selected" : ""}>${v}</option>`).join("")}</select></div><div class="field field-space"><label for="responseNote">Nota sulla risposta</label><textarea id="responseNote" maxlength="2000" rows="2">${esc(r.response_note || "")}</textarea></div><div class="form-grid field-space"><div class="field"><label for="lineup">Impiego</label><select id="lineup" ${!r.called || !isMatch ? "disabled" : ""}>${["Non impiegato", "Titolare", "Panchina"].map((v) => `<option ${r.lineup === v ? "selected" : ""}>${v}</option>`).join("")}</select></div><div class="field"><label for="minutesPlayed">Minuti giocati</label><input id="minutesPlayed" type="number" min="0" max="130" step="1" value="${r.minutes_played}" ${!r.called || !isMatch ? "disabled" : ""}></div></div><div class="field field-space"><label for="position">Posizione in campo</label><input id="position" maxlength="50" value="${esc(r.position || "")}"></div><p class="muted">${r.called ? "Convocato. Indica i minuti effettivamente giocati." : "Seleziona la convocazione nella lista per indicare l’impiego."}</p><button class="primary wide field-space" type="submit">Conferma in bozza</button><p role="status" id="rosterError"></p></form></section>`;
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
      availability: $("#availability").value,
      response_note: $("#responseNote").value.trim() || null,
      lineup: r.called && isMatch ? $("#lineup").value : "Non impiegato",
      minutes_played: r.called && isMatch ? minutes : 0,
      position: $("#position").value.trim() || null,
    });
    root.remove();
    onSave();
  };
}
const originalPlayerRow = playerRow;
playerRow = function (p) {
  const html = originalPlayerRow(p);
  if (!canManage())
    return `<div class="row"><div><div class="row-title">${esc(p.surname)} ${esc(p.name)}</div><div class="row-sub">${esc(p.role || "")}</div></div><button data-player-sheet="${p.id}">Scheda</button></div>`;
  return html.replace(
    '<div class="toolbar">',
    `<div class="toolbar"><button data-player-sheet="${p.id}">Scheda</button>`,
  );
};
const originalPlayersPage = playersPage,
  originalBindPlayers = bindPlayers;
playersPage = function () {
  let html = originalPlayersPage();
  if (!canManage()) {
    html = html.replace(
      '<button class="primary" id="addPlayer">+ Giocatore</button>',
      "",
    );
    html = html.replace(
      /<div class="toolbar"><button data-edit="[^"]+">Modifica<\/button><button data-reactivate="[^"]+">Riattiva<\/button><\/div>/g,
      "",
    );
  }
  return html;
};
bindPlayers = function () {
  if (canManage()) originalBindPlayers();
  bindTeamLinks();
};
function playerSheet(id) {
  teamArrays();
  const p = state.players.find((p) => p.id === id);
  if (!p) return;
  const d = state.administration.find((d) => d.player_id === id) || {},
    rows = state.roster.filter((r) => r.player_id === id),
    minutes = rows.reduce((n, r) => n + r.minutes_played, 0);
  const root = document.createElement("div");
  root.className = "modal-back";
  root.innerHTML = `<section class="modal" role="dialog" aria-modal="true" aria-labelledby="playerSheetTitle"><div class="modal-head"><div><div class="eyebrow">SCHEDA GIOCATORE</div><h2 id="playerSheetTitle">${esc(p.surname)} ${esc(p.name)}</h2></div><button aria-label="Chiudi scheda">✕</button></div><p class="muted">${esc(p.role || "")} ${p.secondary_role ? "· " + esc(p.secondary_role) : ""}${p.shirt_number ? " · #" + p.shirt_number : ""}</p><div class="player-kpis"><div><b>${rows.filter((r) => r.called).length}</b><span>Convocazioni</span></div><div><b>${minutes}</b><span>Minuti registrati</span></div></div>${canManage() ? `<form id="playerAdminForm"><h3 class="sheet-heading">Tesseramento e scadenze</h3><div class="field"><label for="registrationState">Tesseramento</label><select id="registrationState">${["Da verificare", "In regola", "Da completare"].map((v) => `<option ${d.registration_status === v ? "selected" : ""}>${v}</option>`).join("")}</select></div><div class="form-grid field-space"><div class="field"><label for="certificateUntil">Certificato valido fino al</label><input id="certificateUntil" type="date" value="${d.certificate_until || ""}"></div><div class="field"><label for="documentUntil">Documento valido fino al</label><input id="documentUntil" type="date" value="${d.document_until || ""}"></div></div><div class="field field-space"><label for="emergencyContact">Contatto di emergenza</label><input id="emergencyContact" maxlength="300" value="${esc(d.emergency_contact || "")}"></div><p class="muted">Registra solo scadenze e recapiti necessari, senza diagnosi o documenti sanitari.</p><button class="primary wide" type="submit">Salva scheda</button><p role="status" id="playerAdminStatus"></p></form>` : ""}</section>`;
  document.body.appendChild(root);
  let busy=false;const close = trackDialogDraft(root,()=>busy);
  root.querySelector(".modal-head button").onclick = close;
  bindDialog(root, close);
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
        if (error) throw error;
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
  teamArrays();
  const root = document.createElement("div");
  root.className = "modal-back";
  const rows = expiringPlayers();
  root.innerHTML = `<section class="modal" role="dialog" aria-modal="true" aria-labelledby="expiryTitle"><div class="modal-head"><h2 id="expiryTitle">Scadenze da verificare</h2><button aria-label="Chiudi scadenze">✕</button></div><p class="muted">Documenti già scaduti o in scadenza entro 30 giorni e tesseramenti da completare. Le date mancanti richiedono una verifica nella scheda.</p><div class="list">${
    rows
      .map((d) => {
        const p = state.players.find((p) => p.id === d.player_id);
        return `<button class="expiry-row" data-player-sheet="${p.id}"><b>${esc(p.surname)} ${esc(p.name)}</b><span>Certificato: ${d.certificate_until ? fmt(d.certificate_until) : "Da verificare"}</span><span>Documento: ${d.document_until ? fmt(d.document_until) : "Da verificare"}</span><small>${esc(d.registration_status)}</small></button>`;
      })
      .join("") ||
    '<div class="empty">Nessuna scadenza registrata da segnalare.</div>'
  }</div></section>`;
  document.body.appendChild(root);
  const close = () => root.remove();
  root.querySelector(".modal-head button").onclick = close;
  bindDialog(root, close);
  root.querySelectorAll("[data-player-sheet]").forEach(
    (b) =>
      (b.onclick = () => {
        root.remove();
        playerSheet(b.dataset.playerSheet);
      }),
  );
}
const originalMatchModal = matchModal;
matchModal = function(m={}) {
 if(!m.id)return activityModal({activity_type:"Partita"});
 const a=(state.activities||[]).find(x=>x.match_id===m.id);
 if(a)return openActivity(a.id);
 originalMatchModal(m);
 if(!isAdmin())document.querySelector('#deleteMatch')?.remove();
};
const originalEventModal = eventModal;
eventModal = function (...args) {
  originalEventModal(...args);
  if (!isAdmin()) document.querySelector("#deleteEvent")?.remove();
};
