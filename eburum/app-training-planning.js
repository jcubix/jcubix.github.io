import { confirmDialog } from './app-confirm.js';
import { activityHistoryModal } from './app-activity-history.js';
import { attendanceMessage } from './app-workflow-tools.js';
import { sessionHistoryModal } from './app-part3.js';
import { icon } from "./app-icons.js";
import { bindDialog } from "./app-dialogs.js";
import {
  canOperate,
  canPlan,
  db,
  esc,
  fmt,
  refresh,
  render,
  sortPlayers,
  state,
  teamRequestGuard,
  toast,
  today,
} from "./app-part1.js";
import { activityCard, openActivity } from "./app-team.js";
import { copyOperationalText } from "./app-operations.js";
import { draftChanged } from "./app-part3.js";
import { setBusyControls, startActualAttendance } from "./app-workflows.js";

function trainingHub() {
  const rows = state.activities.filter(
    (a) => a.activity_type === "Allenamento",
  );
  const resume =
    canOperate() && state.trainingDraft && draftChanged(state.trainingDraft);
  return `<div class="section-title"><div><h2>Allenamenti</h2><p class="muted">Risposte WhatsApp prima. Presenze effettive dopo.</p></div>${canPlan() ? '<button class="primary" data-new-training>+ Allenamento</button>' : ""}</div>${resume ? '<button class="ghost wide field-space" id="resumeAttendance">Riprendi la bozza presenze</button>' : ""}<div class="training-hub-controls"><input id="trainingHubSearch" type="search" aria-label="Cerca allenamento" placeholder="Cerca allenamento o campo"><div class="report-tabs" role="group" aria-label="Periodo allenamenti"><button data-training-scope="upcoming" aria-pressed="true" class="active">In programma</button><button data-training-scope="all" aria-pressed="false">Tutti</button></div></div><div class="list" id="trainingHubList">${rows.map(activityCard).join("")}</div>`;
}
function bindTrainingHub() {
  let scope = "upcoming";
  const paint = () => {
    const q = document
      .querySelector("#trainingHubSearch")
      .value.toLocaleLowerCase("it");
    const rows = state.activities
      .filter(
        (a) =>
          a.activity_type === "Allenamento" &&
          (scope === "all" || a.status === "Programmato") &&
          `${a.title} ${a.location || ""}`.toLocaleLowerCase("it").includes(q),
      )
      .sort((a, b) =>
        scope === "all"
          ? b.activity_date.localeCompare(a.activity_date)
          : a.activity_date.localeCompare(b.activity_date),
      );
    document.querySelector("#trainingHubList").innerHTML =
      rows.map(activityCard).join("") ||
      '<div class="empty">Nessun allenamento corrisponde ai filtri. Puoi programmare il prossimo o consultare lo storico in Tutti.</div>';
    document
      .querySelectorAll("#trainingHubList [data-open-activity]")
      .forEach((b) => (b.onclick = () => openActivity(b.dataset.openActivity)));
  };
  document.querySelector("#trainingHubSearch").oninput = paint;
  document.querySelectorAll("[data-training-scope]").forEach(
    (b) =>
      (b.onclick = () => {
        scope = b.dataset.trainingScope;
        document.querySelectorAll("[data-training-scope]").forEach((x) => {
          x.classList.toggle("active", x === b);
          x.setAttribute("aria-pressed", String(x === b));
        });
        paint();
      }),
  );
  document.querySelector("#resumeAttendance")?.addEventListener("click", () => {
    state.trainingMode = "actual";
    render();
  });
  paint();
}
function meetingsPage() {
  const rows = state.activities
    .filter((a) => a.activity_type === "Riunione")
    .sort((a, b) => b.activity_date.localeCompare(a.activity_date));
  return `<div class="section-title"><div><h2>Riunioni</h2><p class="muted">Appuntamenti e indicazioni per lo staff.</p></div>${canPlan() ? '<button class="primary" data-new-meeting>+ Riunione</button>' : ""}</div><div class="list">${rows.map(activityCard).join("") || '<p class="empty">Nessuna riunione programmata.</p>'}</div>`;
}
/** @param {HTMLElement|null} mount */
function planningModal(a = {}, savedRows = [], mount = null) {
  if ((!a.id && !canPlan()) || (a.activity_type==='Riunione' && !canPlan()) || (!canOperate() && !mount))
    return { isDirty: () => false, isBusy: () => false, dispose: () => {} };
  const training = a.activity_type !== "Riunione",
    type = training ? "Allenamento" : "Riunione";
  const players = sortPlayers(
      state.players.filter(
        (p) => p.active || savedRows.some((r) => r.player_id === p.id),
      ),
    ),
    entries = new Map(
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
  let root = document.createElement("div");
  root.className = "modal-back";
  const field = (id, label, inputType, value, max = "") =>
    `<div class="field"><label for="${id}">${label}</label><input id="${id}" type="${inputType}" ${max ? `maxlength="${max}"` : ""} value="${esc(value || "")}"></div>`;
  root.innerHTML = `<section class="modal training-planning" role="dialog" aria-modal="true" aria-labelledby="planningTitle"><div class="modal-head"><h2 id="planningTitle">${a.id ? esc(a.title) : "Nuovo " + type.toLowerCase()}</h2><button type="button" id="closePlanning" aria-label="Chiudi ${type.toLowerCase()}"><svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" fill="none" stroke="currentColor" stroke-width="2"/></svg></button></div>${training ? '<div class="training-work-panel"><nav class="training-phase-tabs" aria-label="Fase allenamento"><button type="button" data-training-phase="replies" aria-current="page">Risposte WhatsApp</button><button type="button" data-training-phase="actual">Presenze effettive</button></nav>' : ""}<form id="planningForm"><details class="planning-details" ${!a.id || !training ? "open" : ""}><summary>Organizzazione${a.id ? " · " + fmt(a.activity_date) : ""}</summary><div class="form-grid field-space">${field("planningName", "Titolo", "text", a.title || type, 160)}${field("planningDate", "Data", "date", a.activity_date || today())}${field("planningStart", "Inizio", "time", a.start_time)}${field("planningEnd", "Fine", "time", a.end_time)}${field("planningLocation", training ? "Campo" : "Luogo", "text", a.location, 500)}<div class="field"><label for="planningState">Stato</label><select id="planningState">${(training && !a.session_id ? ["Programmato", "Annullato"] : ["Programmato", "Concluso", "Annullato"]).map((s) => `<option ${a.status === s ? "selected" : ""}>${s}</option>`).join("")}</select></div></div><details class="planning-notes field-space" ${a.organization_note ? "open" : ""}><summary>${training ? "Indicazioni per l’allenamento" : "Note della riunione"}</summary><div class="field field-space"><label for="planningNote">${training?"Indicazioni per l’allenamento":"Note della riunione"}</label><textarea id="planningNote" rows="2" maxlength="10000">${esc(a.organization_note || "")}</textarea></div></details></details>${training ? `<section class="training-replies sc-training-layout" aria-labelledby="repliesTitle"><section><h3 id="repliesTitle" class="sr-only">Risposte WhatsApp</h3><div class="sc-segmented" role="group" aria-label="Filtra risposte"><button type="button" id="allReplyFilter" aria-pressed="true">Tutti</button><button type="button" id="pendingReplyFilter" aria-pressed="false">Non risposto <span id="pendingReplyNumber"></span></button></div><p class="sc-helper">Trascrivi il sondaggio WhatsApp. Queste sono risposte previste, non presenze effettive.</p><div id="trainingReplies" class="sc-player-list"></div></section><aside class="sc-training-aside"><h3>Il punto sulle risposte</h3><div id="planningReplySummary" class="sc-count-strip" aria-live="polite"></div><div id="planningReplyTrack" hidden></div><button type="button" class="sc-primary" id="copyTrainingReminder">Copia nomi da sollecitare ${icon("clipboard", 18)}</button><p class="sc-helper">Il sondaggio resta su WhatsApp. La dashboard aiuta lo staff a registrarlo.</p><button type="button" class="sc-secondary" id="openActualPhase">Presenze effettive ${icon("arrowUp", 18)}</button><details class="field-space"><summary>Cerca giocatore</summary><input id="replySearch" type="search" aria-label="Cerca risposta o giocatore" placeholder="Cerca giocatore"></details><p id="replyCounts" class="sr-only" aria-live="polite"></p><p id="trainingReminderStatus" role="status" class="sc-helper"></p></aside></section>` : ""}<div class="modal-actions"><button type="button" class="ghost" id="cancelPlanning">Annulla</button><button type="submit" class="primary" id="savePlanning">${training ? "Salva allenamento e risposte" : "Salva riunione"}</button></div><p id="planningFeedback" role="status" aria-live="polite"></p></form>${training ? `<section class="training-actual-entry" hidden><h3>Presenze effettive</h3><p class="row-sub">${a.session_id ? "Presenze già confermate. Puoi consultarle o correggerle." : "Verifica chi ha partecipato: le risposte precompilano una bozza da confermare."}</p><button type="button" class="primary" id="planningAttendance" ${!a.id || a.status === "Annullato" || a.activity_date > today() ? "disabled" : ""}>${a.session_id ? "Apri presenze registrate" : "Verifica e conferma presenze"}</button>${!a.id ? '<p class="row-sub">Salva prima l’allenamento.</p>' : a.activity_date > today() ? '<p class="row-sub">La conferma sarà disponibile il giorno dell’allenamento.</p>' : ""}</section></div><p class="training-explanation">Le risposte WhatsApp restano separate dal registro: conferma le presenze solo dopo aver verificato chi ha partecipato.</p>` : ""}</section>`;
  if (training && a.session_id) {
    const actual = root.querySelector('.training-actual-entry'), records = state.attendance.filter(r => r.session_id === a.session_id), names = new Map(state.players.map(p => [p.id, p.surname+' '+p.name]));
    const summary = document.createElement('section'); summary.className='training-confirmed-summary';
    summary.innerHTML='<div class="sc-count-strip">'+['Presente','Assente','Infortunato'].map(status=>'<span><b>'+records.filter(r=>r.status===status).length+'</b>'+({Presente:'Presenti',Assente:'Assenti',Infortunato:'Infortunati'}[status])+'</span>').join('')+'</div><div class="list">'+records.map(r=>'<article class="row"><b>'+esc(names.get(r.player_id)||'Giocatore storico')+'</b><span class="badge '+(r.status==='Presente'?'b-green':r.status==='Assente'?'b-red':'b-blue')+'">'+esc(r.status)+'</span></article>').join('')+'</div><div class="workflow-tools"><button type="button" id="copyActualAttendance">Copia riepilogo WhatsApp</button><button type="button" id="actualHistory">Storico modifiche</button></div><p id="actualCopyStatus" role="status"></p>';
    actual.append(summary);
    root.querySelector('[data-training-phase="replies"]').textContent='Risposte storiche';
  }
  if (mount) {
    const panel = root.firstElementChild;
    panel.className = "sc-inline-training sc-surface";
    panel.setAttribute("role", "region");
    panel.removeAttribute("aria-modal");
    mount.append(panel);
    root = panel;
  } else document.body.append(root);
  const $ = (s) => root.querySelector(s),
    current = teamRequestGuard();
  let dirty = false,
    busy = false,
    pendingOnly = false;
  const requestId = crypto.randomUUID();
  $("#planningName").required = true;
  $("#planningDate").required = true;
  if (training && a.id) {
    const aside = $(".sc-training-aside");
    aside.append($("#savePlanning"));
    aside.append($("#planningFeedback"));
    if (mount) $("#cancelPlanning").closest(".modal-actions").hidden = true;
  }
  if (training && a.id) {
    const organization = $(".planning-details");
    $("#planningForm").insertBefore(
      organization,
      $("#planningForm > .modal-actions"),
    );
  }
  const close = () => {
    if (busy) return;
    if (dirty && !confirm("Scartare le modifiche non salvate?")) return;
    root.remove();
  };
  $("#closePlanning").onclick = close;
  $("#cancelPlanning").onclick = close;
  if (!mount) {root.dataset.detail="activity:"+(a.id||"new");root.dataset.page=training?(state.page==="register"?"register":"training"):"meetings";bindDialog(root, close);}
  const signature=()=>JSON.stringify({fields:['planningName','planningDate','planningStart','planningEnd','planningLocation','planningState','planningNote'].map(id=>$('#'+id).value),replies:[...entries.values()].map(r=>[r.player_id,r.availability,r.response_note])});
  const baseline=signature();
  const updateDirty=()=>{dirty=signature()!==baseline;root.dataset.dirty=String(dirty);if(dirty)$('#savePlanning').hidden=false;};
  const timeError=document.createElement('p');timeError.id='planningTimeError';timeError.setAttribute('role','status');timeError.className='field-error';$('.planning-details .form-grid').after(timeError);
  const validateTimes=()=>{const start=$('#planningStart').value,end=$('#planningEnd').value,invalid=!!start&&!!end&&end<=start;timeError.textContent=invalid?'La fine deve essere successiva all’inizio.':'';for(const id of ['planningStart','planningEnd']){$('#'+id).setAttribute('aria-invalid',String(invalid));$('#'+id).setAttribute('aria-describedby','planningTimeError')}};
  root.addEventListener('input',event=>{if(event.target.id!=='replySearch'){updateDirty();validateTimes()}});
  root.addEventListener('change',()=>{updateDirty();validateTimes()});
  if(training&&!a.id){
    root.classList.add('planning-create');
    for(const selector of ['.training-phase-tabs','.training-replies','.training-actual-entry','.training-explanation'])$(selector).hidden=true;
    $('#planningState').closest('.field').hidden=true;
    $('.planning-notes').open=true;
    $('#savePlanning').textContent='Crea allenamento';
  }
  const paintReplies = () => {
    if (!training) return;
    const q = $("#replySearch").value.toLocaleLowerCase("it"),
      rows = players.filter(
        (p) =>
          (!pendingOnly || entries.get(p.id).availability === "In attesa") &&
          `${p.surname} ${p.name}`.toLocaleLowerCase("it").includes(q),
      );
    const yes = [...entries.values()].filter(
        (r) => r.availability === "Disponibile",
      ).length,
      no = [...entries.values()].filter(
        (r) => r.availability === "Indisponibile",
      ).length,
      waiting = players.length - yes - no;
    $("#planningReplySummary").innerHTML =
      `<span><b>${yes}</b>Sì</span><span><b>${no}</b>No</span><span class="sc-pending"><b>${waiting}</b>${a.session_id ? 'Non registrate' : 'In attesa'}</span>`;
    $("#planningReplyTrack").innerHTML = [
      [yes, "yes"],
      [no, "no"],
      [waiting, "waiting"],
    ]
      .filter(([n]) => n)
      .map(([n, t]) => `<span class="${t}" style="flex:${n}"></span>`)
      .join("");
    $("#replyCounts").textContent =
      `${[...entries.values()].filter((r) => r.availability === "Disponibile").length} sì · ${[...entries.values()].filter((r) => r.availability === "Indisponibile").length} no · ${[...entries.values()].filter((r) => r.availability === "In attesa").length} non hanno risposto · ${rows.length} di ${players.length} visibili`;
    $("#trainingReplies").innerHTML =
      rows
        .map((p) => {
          const r = entries.get(p.id);
          return `<article class="sc-reply-row"><span class="sc-person-avatar">${esc(p.name.slice(0, 1) + p.surname.slice(0, 1))}</span><div class="sc-person-copy"><b>${esc(p.name)} ${esc(p.surname)}</b><small>${r.availability === "In attesa" ? (a.session_id ? "Risposta non registrata" : "Non ha risposto") : r.availability === "Disponibile" ? "Ha risposto sì" : "Ha risposto no"}${!p.active ? " · Inattivo" : ""}</small></div><div class="sc-reply-buttons" role="group" aria-label="Risposta di ${esc(p.surname)} ${esc(p.name)}">${[
            ["Disponibile", "Sì", "yes", "check"],
            ["Indisponibile", "No", "no", "close"],
            ["In attesa", "Non risposto", "pending", "minus"],
          ]
            .map(
              ([value, label, tone, symbol]) =>
                `<button type="button" data-training-player="${p.id}" data-training-reply="${value}" aria-label="${esc(p.name)} ${esc(p.surname)}: ${label}" aria-pressed="${r.availability === value}" class="${r.availability === value ? "sc-" + tone : ""}" ${!canOperate() ? "disabled" : ""}>${icon(symbol, 18)}</button>`,
            )
            .join("")}</div></article>`;
        })
        .join("") ||
      '<div class="sc-empty-state"><h3>Nessun giocatore da sollecitare</h3><p>Tutti hanno risposto oppure nessuno corrisponde alla ricerca.</p></div>';
    $("#pendingReplyNumber").textContent = String(waiting);
    $("#allReplyFilter").setAttribute("aria-pressed", String(!pendingOnly));
    $("#pendingReplyFilter").setAttribute("aria-pressed", String(pendingOnly));
  };
  if (training) {
    root.querySelectorAll("[data-training-phase]").forEach(
      (button) =>
        (button.onclick = () => {
          const actual = button.dataset.trainingPhase === "actual";
          root.querySelectorAll("[data-training-phase]").forEach((b) => {
            if (b === button) b.setAttribute("aria-current", "page");
            else b.removeAttribute("aria-current");
          });
          $("#planningForm").hidden = actual;
          $(".training-actual-entry").hidden = !actual;
        }),
    );
    $("#allReplyFilter").onclick = () => {
      pendingOnly = false;
      paintReplies();
    };
    $("#openActualPhase").onclick = () => {
      $("#planningForm").hidden = true;
      $(".training-actual-entry").hidden = false;
      $(".training-phase-tabs").style.display = "flex";
    };
    paintReplies();
    $("#replySearch").oninput = paintReplies;
    $("#pendingReplyFilter").onclick = () => {
      pendingOnly = !pendingOnly;
      paintReplies();
    };
    $("#trainingReplies").onclick = (e) => {
      const b = e.target.closest("[data-training-reply]");
      if (!b || busy || !canOperate()) return;
      entries.get(b.dataset.trainingPlayer).availability =
        b.dataset.trainingReply;
      updateDirty();
      $("#savePlanning").hidden = false;
      $("#planningFeedback").textContent = "Risposte modificate · Da salvare";
      $("#trainingReminderStatus").textContent = "";
      paintReplies();
    };
    $("#copyTrainingReminder").onclick = () => {
      const waiting = players.filter(
        (p) => entries.get(p.id).availability === "In attesa",
      );
      copyOperationalText(
        [
          `ALLENAMENTO EBURUM · ${fmt($("#planningDate").value)}`,
          dirty || !a.id
            ? "BOZZA · risposte non ancora salvate"
            : "Risposte salvate",
          `Non hanno risposto (${waiting.length})`,
          ...waiting.map((p) => `• ${p.surname} ${p.name}`),
          waiting.length
            ? "Da sollecitare a votare al sondaggio WhatsApp."
            : "Tutti hanno risposto.",
        ].join("\n"),
        $("#trainingReminderStatus"),
        $(".training-replies"),
      );
    };
    $("#planningAttendance").onclick = async () => {
      if (busy) return;
      if (dirty)
        return toast(
          "Salva le modifiche e le risposte prima di aprire le presenze",
        );
      if (state.trainingDraft?.saving)
        return toast("Attendi il salvataggio in corso");
      if (
        state.trainingDraft &&
        draftChanged(state.trainingDraft) &&
        !(await confirmDialog({message:"Scartare la bozza presenze non salvata?",confirmLabel:'Scarta'}))
      )
        return;
      busy = true;
      setBusyControls(root, true);
      try {
        if (await startActualAttendance(a, true)) root.remove();
      } finally {
        busy = false;
        setBusyControls(root, false);
      }
    };
  }
  if (mount) {
    $("#savePlanning").hidden = true;
    if (!canPlan())
      root
        .querySelectorAll(
          ".planning-details input,.planning-details select,.planning-details textarea",
        )
        .forEach((el) => (el.disabled = true));
  }
  if(!canPlan())root.querySelectorAll(".planning-details input,.planning-details select,.planning-details textarea").forEach(el=>el.disabled=true);
  if(!canOperate() && training)$('#planningAttendance').disabled=true;
  $("#planningForm").onsubmit = async (e) => {
    e.preventDefault();
    if (busy || !canOperate()) return;
    try {
      const activity = {
        activity_type: type,
        title: $("#planningName").value.trim(),
        activity_date: $("#planningDate").value,
        start_time: $("#planningStart").value || null,
        end_time: $("#planningEnd").value || null,
        location: $("#planningLocation").value.trim() || null,
        status: $("#planningState").value,
        organization_note: $("#planningNote").value.trim() || null,
        meeting_time: a.meeting_time || null,
        meeting_place: a.meeting_place || null,
        request_id: requestId,
      };
      if (!activity.title || !activity.activity_date)
        throw Error("Inserisci titolo e data");
      if (
        activity.start_time &&
        activity.end_time &&
        activity.end_time <= activity.start_time
      )
        throw Error("La fine deve essere successiva all’inizio");
      busy = true;
      setBusyControls(root, true);
      $("#planningFeedback").textContent = "Salvataggio…";
      const { data, error } = await db.rpc("save_team_activity", {
        p_activity: activity,
        p_roster: (training ? [...entries.values()] : savedRows).map(
          ({ player_id, availability, response_note }) => ({
            player_id,
            availability: availability || "In attesa",
            response_note: response_note || null,
            called: false,
            lineup: "Non impiegato",
            position: null,
            minutes_played: 0,
          }),
        ),
        p_id: a.id || null,
        p_revision: a.revision ?? null,
        p_technical: null,
      });
      if (error) throw error;
      if (!current()) return;
      dirty = false;
      root.dataset.keepRoute="true";
      root.remove();
      const loaded = await refresh();
      if (!current()) return;
      if (loaded && !mount)
        planningModal(
          data,
          state.roster.filter((r) => r.activity_id === data.id),
        );
      toast(training ? (a.id?"Allenamento e risposte salvati":"Allenamento creato") : "Riunione salvata");
    } catch (error) {
      if (current())
        $("#planningFeedback").textContent =
          error.message || "Salvataggio non riuscito. La bozza è conservata.";
    } finally {
      busy = false;
      setBusyControls(root, false);
    }
  };
  if (training && a.session_id) {
    $('#copyActualAttendance').onclick=()=>copyOperationalText(attendanceMessage(a,state.attendance.filter(r=>r.session_id===a.session_id),state.players,fmt),$('#actualCopyStatus'),$('.training-actual-entry'));
    $('#actualHistory').onclick=()=>sessionHistoryModal(a.session_id);
    $('[data-training-phase="actual"]').click();
    $('#openActualPhase').onclick=()=> $('[data-training-phase="actual"]').click();
    $('#copyTrainingReminder').hidden=true;
    $('#pendingReplyFilter').hidden=true;
    $('.training-replies .sc-helper').textContent='Risposte WhatsApp eventualmente registrate prima dell’allenamento. Una risposta mancante nello storico non indica un’assenza.';
    $('.training-explanation').textContent='Allenamento concluso: il registro contiene le presenze effettive. Le risposte WhatsApp restano uno storico separato.';
  }
  if(training && a.id){
    const history=document.createElement('button');history.type='button';history.className='sc-secondary field-space';history.textContent='Storico risposte e organizzazione';history.onclick=()=>activityHistoryModal(a.id);$('.planning-details').append(history);
  }
  return {
    isDirty: () => dirty,
    isBusy: () => busy,
    dispose: () => root.remove(),
  };
}
export { trainingHub, bindTrainingHub, meetingsPage, planningModal };
