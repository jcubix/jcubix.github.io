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
const originalDashboard = dashboard;
dashboard = function () {
  teamArrays();
  if (!state.players.length) return originalDashboard();
  const upcoming = state.activities
      .filter((a) => a.activity_date >= today() && a.status === "Programmato")
      .sort((a, b) =>
        (a.activity_date + (a.start_time || "")).localeCompare(
          b.activity_date + (b.start_time || ""),
        ),
      ),
    next = upcoming[0],
    waiting = upcoming.reduce(
      (n, a) =>
        n +
        activityRows(a.id).filter(
          (r) => r.called && r.availability === "In attesa",
        ).length,
      0,
    ),
    pending = state.activities.filter(
      (a) =>
        a.activity_date <= today() &&
        a.status === "Programmato" &&
        !a.session_id,
    ),
    expiring = expiringPlayers();
  return `<div class="section-title"><div><div class="eyebrow">LA TUA SQUADRA · ${roleLabels[teamRole()]}</div><h2>Oggi, sul campo</h2><p class="muted">Appuntamenti e cose da completare.</p></div></div><section class="next-activity"><div class="eyebrow">PROSSIMO APPUNTAMENTO</div>${next ? `<h2>${esc(activityLabel(next))}</h2><p>${fmt(next.activity_date)} · ${clock(next.start_time)}</p><p class="muted">${esc(next.location || "Luogo da definire")}</p>${next.meeting_time || next.meeting_place ? `<div class="meeting-strip">Ritrovo ${clock(next.meeting_time)} · ${esc(next.meeting_place || "Luogo da definire")}</div>` : ""}<button class="primary wide" data-open-activity="${next.id}">Apri attività e convocazioni</button>` : '<h2>Prepara il prossimo impegno</h2><p class="muted">Organizza allenamenti, partite e riunioni nell’Agenda.</p><button class="primary wide" data-new-activity>+ Programma attività</button>'}</section><div class="action-grid"><button data-page="agenda"><b>${waiting}</b><span>Risposte da registrare</span></button><button data-page="agenda"><b>${pending.length}</b><span>Attività da completare</span></button>${canManage() ? `<button data-expiries><b>${expiring.length}</b><span>Scadenze e tesseramenti</span></button>` : ""}<button data-page="training"><b>+</b><span>Registra presenze</span></button></div><div class="section-title"><h3>In programma</h3><button class="ghost" data-page="agenda">Tutta l’Agenda</button></div><div class="list">${upcoming.slice(0, 3).map(activityCard).join("") || '<div class="card empty">Nessuna attività programmata.</div>'}</div><details class="team-overview"><summary>Riepilogo della squadra</summary>${originalDashboard()}</details>`;
};
const originalShell = shell;
shell = function (content) {
  const html = originalShell(content);
  const nav = html.indexOf('<nav class="nav">');
  return (
    html.slice(0, nav) +
    `<nav class="nav team-nav" aria-label="Navigazione principale">${navBtn("dashboard", "", "Home")}${navBtn("agenda", "", "Agenda")}${navBtn("players", "", "Rosa")}${navBtn("matches", "", "Partite")}${navBtn("more", "", "Altro")}</nav>`
  );
};
const originalNav = navBtn;
navBtn = function (page, icon, label) {
  if (!["agenda", "more"].includes(page)) return originalNav(page, icon, label);
  const paths =
    page === "agenda"
      ? '<path d="M4 5h16v16H4zM8 3v4m8-4v4M4 11h16m-11 4h2m3 0h2m-7 3h2"/>'
      : '<circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/>';
  return `<button data-page="${page}" class="${state.page === page ? "active" : ""}" ${state.page === page ? 'aria-current="page"' : ""}><b aria-hidden="true"><svg viewBox="0 0 24 24">${paths}</svg></b><span>${label}</span></button>`;
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
async function openActivity(id) {
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
    activityModal(a.data, r.data, t.data[0]);
  } catch (e) {
    fail(e);
  }
}
function activityModal(a = {}, savedRows = [], technical = {}) {
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
  root.innerHTML = `<section class="modal activity-modal" role="dialog" aria-modal="true" aria-labelledby="activityTitle"><div class="modal-head"><div><div class="eyebrow">AGENDA · SQUADRA</div><h2 id="activityTitle">${a.id ? esc(activityLabel(a)) : "Nuova attività"}</h2></div><button id="closeActivity" aria-label="Chiudi attività">✕</button></div><div class="activity-tabs" role="tablist" aria-label="Scheda attività"><button type="button" data-activity-tab="details" role="tab" aria-selected="true">Dettagli</button><button type="button" data-activity-tab="roster" role="tab" aria-selected="false">Convocazioni</button>${canTechnical() ? '<button type="button" data-activity-tab="technical" role="tab" aria-selected="false">Tecnica</button>' : ""}</div><form id="activityForm" novalidate><section data-activity-panel="details"><div class="form-grid"><div class="field"><label for="activityType">Tipo</label><select id="activityType" ${a.id ? "disabled" : ""}>${["Allenamento", "Partita", "Riunione"].map((t) => `<option ${a.activity_type === t ? "selected" : ""}>${t}</option>`).join("")}</select></div><div class="field"><label for="activityName">Titolo / avversario</label><input id="activityName" maxlength="160" required value="${esc(a.title || "")}"></div>${field("activityDate", "Data", "date", a.activity_date || today())}${field("activityStart", "Inizio", "time", a.start_time)}${field("activityEnd", "Fine", "time", a.end_time)}<div class="field"><label for="activityState">Stato</label><select id="activityState">${["Programmato", "Concluso", "Annullato"].map((t) => `<option ${a.status === t ? "selected" : ""}>${t}</option>`).join("")}</select></div></div><div class="field field-space"><label for="activityLocation">Campo / luogo</label><input id="activityLocation" maxlength="500" value="${esc(a.location || "")}"></div><h3 class="sheet-heading">Ritrovo e organizzazione</h3><div class="form-grid">${field("activityMeetingTime", "Ora ritrovo", "time", a.meeting_time)}${field("activityMeetingPlace", "Luogo ritrovo", "text", a.meeting_place)}</div><div class="field field-space"><label for="activityNote">Indicazioni per lo staff</label><textarea id="activityNote" rows="3" maxlength="10000" placeholder="Trasporto, divise, documenti, materiale…">${esc(a.organization_note || "")}</textarea></div>${a.id ? `<div class="session-tools">${a.match_id ? '<button type="button" id="activityMatch">Risultato ed eventi</button>' : ""}<button type="button" id="activityAttendance">${a.session_id ? "Apri presenze" : "Registra presenze"}</button></div>` : ""}</section><section data-activity-panel="roster" hidden><div class="notice">Lo staff registra le risposte ricevute. La convocazione è distinta dalla presenza effettiva.</div><input type="search" id="rosterSearch" aria-label="Cerca convocato" placeholder="Cerca giocatore"><div id="rosterCounts" class="attendance-counts field-space"></div><div class="list field-space" id="activityRoster"></div></section>${canTechnical() ? `<section data-activity-panel="technical" hidden><div class="notice">Note tecniche visibili soltanto ad amministratori e allenatori.</div><div id="formationPreview" class="formation-preview" aria-label="Titolari raggruppati per ruolo"></div><div class="field field-space"><label for="formation">Modulo</label><input id="formation" maxlength="30" value="${esc(technical?.formation || "")}" placeholder="Es. 4-3-3"></div><div class="field field-space"><label for="technicalNote">Osservazioni tecniche</label><textarea id="technicalNote" rows="4" maxlength="10000">${esc(technical?.note || "")}</textarea></div><p class="muted">Titolari, panchina, posizione e minuti giocati si compilano dalla scheda di ogni convocato. I minuti sono registrati dallo staff.</p></section>` : ""}<div class="modal-actions"><button class="ghost" id="cancelActivity" type="button">Annulla</button><button class="primary" type="submit">${a.id ? "Salva attività" : "Crea attività"}</button></div><p id="activityFeedback" role="status" aria-live="polite"></p></form></section>`;
  document.body.appendChild(root);
  const $ = (s) => root.querySelector(s);
  let dirty = false;
  root.addEventListener("input", (event) => {if(event.target.id!=="rosterSearch")dirty=true});
  root.addEventListener("change", () => (dirty = true));
  const close = () => {
    if (busy) return;
    if (dirty && !confirm("Scartare le modifiche non salvate?")) return;
    root.remove();
  };
  $("#closeActivity").onclick = close;
  $("#cancelActivity").onclick = close;
  bindDialog(root, close);
  root.querySelectorAll("[data-activity-tab]").forEach(
    (b) =>
      (b.onclick = () => {
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
  const paint = () => {
    const pitch = $("#formationPreview");
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
      `<span class="badge b-blue">${called.length} convocati</span><span class="badge b-green">${called.filter((r) => r.availability === "Disponibile").length} disponibili</span><span class="badge b-yellow">${called.filter((r) => r.availability === "In attesa").length} in attesa</span>`;
    $("#activityRoster").innerHTML =
      players
        .filter((p) =>
          `${p.surname} ${p.name}`.toLocaleLowerCase("it").includes(q),
        )
        .map((p) => {
          const r = entries.get(p.id);
          return `<div class="roster-person"><label><input type="checkbox" data-called="${p.id}" ${r.called ? "checked" : ""}><span><b>${esc(p.surname)} ${esc(p.name)}</b><small>${esc(p.role || "")}${!p.active ? " · Inattivo" : ""}</small></span></label><button type="button" data-roster-edit="${p.id}">${esc(r.availability)}</button><div class="row-sub">${r.called ? `${esc(r.lineup)} · ${r.minutes_played} min${r.position ? " · " + esc(r.position) : ""}` : "Non convocato"}</div></div>`;
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
  };
  $("#rosterSearch").oninput = paint;
  paint();
  if (a.id) {
    $("#activityMatch")?.addEventListener("click", () => {
      if (dirty)
        return toast("Salva o annulla le modifiche prima di aprire la partita");
      root.remove();
      matchModal(state.matches.find((m) => m.id === a.match_id));
    });
    $("#activityAttendance").onclick = () => {
      if (dirty)
        return toast(
          "Salva o annulla le modifiche prima di aprire le presenze",
        );
      if (a.status === "Annullato") return toast("L’attività è annullata");
      if (a.session_id) {
        root.remove();
        editAttendanceSession(a.session_id);
        return;
      }
      if (
        trainingDraft &&
        draftChanged(trainingDraft) &&
        !confirm("Scartare la bozza presenze non salvata?")
      )
        return;
      trainingDraft = makeTrainingDraft();
      trainingDraft.session = {
        session_date: a.activity_date,
        session_type: a.activity_type,
        note: null,
      };
      trainingDraft.baseline = JSON.stringify({
        session: trainingDraft.session,
        rows: draftRows(trainingDraft),
      });
      root.remove();
      state.page = "training";
      render();
      window.scrollTo(0, 0);
    };
  }
  $("#activityForm").onsubmit = async (e) => {
    e.preventDefault();
    if (busy) return;
    const button = e.target.querySelector("[type=submit]");
    busy = true;
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
  const close = () => root.remove();
  root.querySelector(".modal-head button").onclick = close;
  bindDialog(root, close);
  if (canManage())
    root.querySelector("form").onsubmit = async (e) => {
      e.preventDefault();
      const button = e.target.querySelector("button");
      button.disabled = true;
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
        button.disabled = false;
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
matchModal = function (m = {}) {
  originalMatchModal(m);
  if (m.id) {
    const a = (state.activities || []).find((a) => a.match_id === m.id),
      modal = document.querySelector(".match-modal");
    if (a && modal) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "ghost wide field-space";
      b.textContent = "Convocazioni, ritrovo e formazione";
      modal.querySelector("#eventSection").prepend(b);
      b.onclick = () => {
        const form = modal.querySelector("#matchForm");
        if (
          [...form.elements].some(
            (e) =>
              e.value !== e.defaultValue &&
              e.tagName !== "BUTTON" &&
              e.tagName !== "SELECT",
          ) &&
          !confirm(
            "Aprire l’attività senza salvare le modifiche della partita?",
          )
        )
          return;
        modal.parentElement.remove();
        openActivity(a.id);
      };
    }
    if (!isAdmin()) document.querySelector("#deleteMatch")?.remove();
  }
};
const originalBindReports = bindReports;
bindReports = function () {
  originalBindReports();
  const card = document.querySelector("#report").parentElement,
    box = document.createElement("section");
  box.className = "sport-report";
  box.innerHTML =
    '<h3 class="sheet-heading">Impiego e disponibilità</h3><div id="sportStats" class="player-kpis"></div><div id="availabilityStats" class="row-sub field-space"></div><h3 class="sheet-heading">Andamento presenze</h3><div id="attendanceTrend" class="attendance-trend"></div>';
  card.appendChild(box);
  const paint = () => {
    const from = document.querySelector("#rf").value,
      to = document.querySelector("#rt").value,
      playerMode = document
        .querySelector('[data-report-tab="player"]')
        .classList.contains("active"),
      player = document.querySelector("#rp").value,
      activities = (state.activities || []).filter(
        (a) =>
          a.activity_date >= from &&
          a.activity_date <= to &&
          a.status !== "Annullato",
      ),
      ids = new Set(activities.map((a) => a.id)),
      rows = (state.roster || []).filter(
        (r) =>
          ids.has(r.activity_id) && (!playerMode || r.player_id === player),
      ),
      matchIds = new Set(
        activities.filter((a) => a.match_id).map((a) => a.match_id),
      ),
      events = state.events.filter(
        (e) =>
          matchIds.has(e.match_id) && (!playerMode || e.player_id === player),
      ),
      A = state.attendance.filter((a) => {
        const s = state.sessions.find((s) => s.id === a.session_id);
        return (
          s &&
          s.session_date >= from &&
          s.session_date <= to &&
          (!playerMode || a.player_id === player)
        );
      });
    document.querySelector("#sportStats").innerHTML = [
      ["Convocazioni", rows.filter((r) => r.called).length],
      ["Minuti registrati", rows.reduce((n, r) => n + r.minutes_played, 0)],
      ["Gol", events.filter((e) => e.event_type === "Gol" && e.player_id).length],
      [
        "Cartellini",
        events.filter((e) =>
          ["Ammonizione", "Espulsione"].includes(e.event_type),
        ).length,
      ],
    ]
      .map(
        ([label, value]) => `<div><b>${value}</b><span>${label}</span></div>`,
      )
      .join("");
    const months = [
      ...new Set(
        A.map((a) =>
          state.sessions
            .find((s) => s.id === a.session_id)
            ?.session_date.slice(0, 7),
        ),
      ),
    ]
      .filter(Boolean)
      .sort()
      .slice(-6);
    document.querySelector("#attendanceTrend").innerHTML =
      months
        .map((month) => {
          const list = A.filter((a) =>
              state.sessions
                .find((s) => s.id === a.session_id)
                ?.session_date.startsWith(month),
            ),
            pct = Math.round(
              (list.filter((a) => a.status === "Presente").length /
                list.length) *
                100,
            ),
            label = new Intl.DateTimeFormat("it-IT", {
              month: "short",
              year: "numeric",
            }).format(new Date(month + "-15T12:00:00"));
          return `<div class="trend-row"><span>${label}</span><meter min="0" max="100" value="${pct}" aria-label="Presenza ${label}">${pct}%</meter><b>${pct}%</b></div>`;
        })
        .join("") ||
      '<p class="muted">Nessuna presenza nel periodo selezionato.</p>';
    document.querySelector("#availabilityStats").textContent =
      `Assenze comunicate: ${A.filter((a) => a.status === "Assente" && a.notified === true).length} · Senza preavviso: ${A.filter((a) => a.status === "Assente" && a.notified === false).length} · Preavviso non indicato: ${A.filter((a) => a.status === "Assente" && a.notified == null).length} · Infortuni: ${A.filter((a) => a.status === "Infortunato").length}`;
  };
  for (const id of ["rf", "rt", "rp"])
    document.querySelector("#" + id).addEventListener("change", paint);
  document
    .querySelectorAll("[data-report-tab]")
    .forEach((b) => b.addEventListener("click", paint));
  document.querySelector("#copyReport").onclick = async () => {
    try {
      const text =
        document.querySelector("#report").textContent + "\n\n" + box.innerText;
      await navigator.clipboard.writeText(text);
      toast("Report completo copiato");
    } catch (e) {
      fail(e);
    }
  };
  paint();
};

const originalEventModal = eventModal;
eventModal = function (...args) {
  originalEventModal(...args);
  if (!isAdmin()) document.querySelector("#deleteEvent")?.remove();
};
