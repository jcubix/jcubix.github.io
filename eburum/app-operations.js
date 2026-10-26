import { dayLabel, matchOutcome } from './app-presentation.js';
import { sportSeason } from './app-data.js';
import { playerDiscipline } from './app-discipline.js';
import { playerDismissals } from './app-dismissals.js';
import { matchReview } from './app-workflow-tools.js';
import { activityHistoryModal } from './app-activity-history.js';
import { icon } from "./app-icons.js";
import { confirmDialog } from "./app-confirm.js";
import { isAwayMatch, matchTitle } from "./app-match-display.js";
import { refreshMatchTimeline } from "./app-match-minutes.js";
import { registerBinder, renderExtensions } from "./app-hooks.js";
import {
  canPlan,
  canViewExpiries,
  teamRole,
  canOperate,
  db,
  emptyTeamDashboard,
  esc,
  fmt,
  isAdmin,
  refresh,
  state,
  teamOwner,
  teamRequestGuard,
  toast,
  today,
} from "./app-part1.js";
import { editAttendanceSession } from "./app-part3.js";
import { eventModal, eventTone, matchEvents } from "./app-part4.js";
import {
  activityLabel,
  clock,
  documentSummary,
  openActivity,
  teamArrays,
} from "./app-team.js";
import { pollEntries, setBusyControls } from "./app-workflows.js";

async function copyOperationalText(text, status, container) {
  try {
    await navigator.clipboard.writeText(text);
    status.textContent = "Testo copiato";
  } catch {
    let area = container.querySelector("[data-copy-fallback]");
    if (!area) {
      area = document.createElement("textarea");
      area.dataset.copyFallback = "";
      area.readOnly = true;
      area.setAttribute("aria-label", "Testo da copiare");
      container.append(area);
    }
    area.value = text;
    area.focus();
    area.select();
    status.textContent = "Copia manualmente il testo selezionato.";
  }
}
function callupMessage(a, rows, players) {
  const called = players.filter((p) =>
    rows.some((r) => r.player_id === p.id && r.called),
  );
  return [
    `CONVOCAZIONE EBURUM · ${a.activity_type}`,
    activityLabel(a),
    `Data: ${fmt(a.activity_date)}`,
    `Inizio: ${clock(a.start_time)}`,
    `Campo / luogo: ${a.location || "Da definire"}`,
    `Ritrovo: ${clock(a.meeting_time)} · ${a.meeting_place || "Luogo da definire"}`,
    `Convocati (${called.length}):`,
    ...called.map((p) => `• ${p.surname} ${p.name}`),
    a.organization_note
      ? `Indicazioni (divisa, materiale, trasporto):\n${a.organization_note}`
      : "Indicazioni sulla divisa e sul materiale: da definire",
  ].join("\n");
}
function mountCallupCopy(root, a, entries, players, isDirty) {
  const panel = root.querySelector('[data-activity-panel="roster"]'),
    section = document.createElement("section");
  section.className = "callup-copy field-space";
  section.innerHTML =
    '<h3>Comunicazione ai convocati</h3><p class="row-sub">Il testo comprende organizzazione e nomi dei convocati. Puoi rivederlo prima di copiarlo.</p><button type="button" id="previewCallup">Prepara convocazione</button><div id="callupPreview" hidden><textarea id="callupText" rows="9" aria-label="Testo convocazione da rivedere"></textarea><button type="button" id="copyCallup">Copia convocazione</button><p id="callupCopyStatus" class="row-sub" role="status"></p></div>';
  panel.append(section);
  root.querySelector("#previewCallup").onclick = () => {
    const get = (id) => root.querySelector("#" + id).value;
    const snapshot = {
      ...a,
      activity_type: get("activityType"),
      title: get("activityName").trim(),
      activity_date: get("activityDate"),
      start_time: get("activityStart"),
      location: get("activityLocation").trim(),
      meeting_time: get("activityMeetingTime"),
      meeting_place: get("activityMeetingPlace").trim(),
      organization_note: get("activityNote").trim(),
    };
    root.querySelector("#callupText").value =
      (isDirty() || !a.id
        ? "BOZZA · organizzazione e convocazioni non ancora salvate\n\n"
        : "") + callupMessage(snapshot, [...entries.values()], players);
    root.querySelector("#callupPreview").hidden = false;
    root.querySelector("#callupCopyStatus").textContent =
      "Controlla orari, convocati e indicazioni prima di copiare.";
  };
  root.querySelector("#copyCallup").onclick = () =>
    copyOperationalText(
      root.querySelector("#callupText").value,
      root.querySelector("#callupCopyStatus"),
      section,
    );
}
function mountMatchResults(root, a, guard, getMatch, onTimeline = () => {}) {
  const panel = document.createElement("section");
  panel.dataset.activityPanel = "results";
  panel.hidden = true;
  panel.className = "match-results";
  const current = teamRequestGuard();
  let m = getMatch(),
    dirty = false,
    busy = false, needsReload = false, inlineEditor = null;
  const score = (id, label, value) =>
    `<div class="field"><label for="${id}">${esc(label)}</label><input id="${id}" type="number" inputmode="numeric" min="0" max="99" step="1" value="${value ?? ""}" placeholder="—"></div>`;
  panel.innerHTML = `<div class="field match-result-venue"><label for="matchVenue">Dove si gioca</label><select id="matchVenue"><option ${m.venue === "Casa" ? "selected" : ""}>Casa</option><option ${m.venue === "Trasferta" ? "selected" : ""}>Trasferta</option></select></div><div class="match-score-fields">${score("matchGoalsFor", "Eburum", m.goals_for)}<span aria-hidden="true">:</span>${score("matchGoalsAgainst", m.opponent, m.goals_against)}</div><details class="match-settings field-space"><summary>Durata e note <span class="row-sub" id="matchSettingsSummary"></span></summary><div class="form-grid field-space"><div class="field"><label for="matchDuration">Durata della gara (minuti)</label><input id="matchDuration" type="number" inputmode="numeric" min="1" max="130" step="1" value="${m.duration_minutes ?? 90}"></div><div class="field"><label for="matchMinutesMode">Minuti giocati</label><select id="matchMinutesMode"><option value="auto" ${m.minutes_auto ? "selected" : ""}>Automatici dagli eventi</option><option value="manual" ${!m.minutes_auto ? "selected" : ""}>Inseriti dallo staff</option></select></div></div><p class="row-sub">Il calcolo usa titolari, cambi ed espulsioni. La durata comprende il recupero che vuoi conteggiare. Prima del risultato o di un cambio, i minuti restano a zero.</p><div class="field field-space"><label for="matchNote">Note della partita</label><textarea id="matchNote" rows="2" maxlength="10000" placeholder="Osservazioni sulla gara…">${esc(m.note || "")}</textarea></div></details><div class="match-save-row"><button type="button" class="primary" id="saveMatchResult">Salva partita</button><p id="matchResultStatus" role="status" aria-live="polite"></p></div><div class="section-title match-events-heading"><h3>Eventi <span class="row-sub" id="matchEventCount"></span></h3><div class="match-event-actions"><button type="button" id="addGoal">${icon("ball", 18)}<span>Gol Eburum</span></button><button type="button" id="addOpponentGoal">${icon("ball",18)}<span>Gol avversari</span></button><button type="button" id="addYellow">${icon("card", 18)}<span>Ammonizione</span></button><button type="button" id="addMatchEvent">${icon("plus", 18)}<span>Altro evento</span></button><button type="button" id="addSubstitution">${icon("substitution", 18)}<span>Sostituzione</span></button></div></div><div id="matchEventList" class="event-list match-timeline"></div><details class="match-minutes field-space"><summary>Minuti giocati <span class="row-sub" id="matchMinutesSummary"></span></summary><p class="row-sub" id="matchMinutesHint"></p><div id="matchMinutesList" class="match-minutes-list"></div></details>${isAdmin() ? '<details class="match-danger field-space"><summary>Altre azioni</summary><button type="button" class="danger field-space" id="removeUnifiedMatch">Elimina partita</button></details>' : ""}`;
  root
    .querySelector("#activityForm")
    .insertBefore(panel, root.querySelector("#activityForm > .modal-actions"));
  const $ = (s) => panel.querySelector(s);
  if(!canPlan())['#matchVenue','#matchMinutesMode'].forEach(id=>$(id).disabled=true);
  const live = document.createElement("div");
  live.className = "match-live-grid";
  const main = document.createElement("div");
  main.className = "match-live-main";
  const side = document.createElement("aside");
  side.className = "match-live-side";
  const scoreFields = panel.querySelector(".match-score-fields"),
    settings = panel.querySelector(".match-settings"),
    note = settings.querySelector("#matchNote").closest(".field"),
    save = panel.querySelector(".match-save-row");
  const heading = panel.querySelector(".match-events-heading"),
    timeline = panel.querySelector("#matchEventList"),
    minutes = panel.querySelector(".match-minutes");
  const composer=document.createElement('div');composer.className='match-event-composer';
  const notes=document.createElement('div');notes.className='match-game-notes';note.classList.remove('field-space');notes.append(note);
  main.append(heading, composer, timeline, notes);
  settings.querySelector('summary').firstChild.textContent='Durata e calcolo minuti ';
  settings.append(panel.querySelector('.match-result-venue'));
  side.append(settings, minutes);
  live.append(main, side);
  panel.prepend(scoreFields, live);
  panel.append(save);
  const orderScoreFields = () => {
    const own = $("#matchGoalsFor").closest(".field"),
      opponent = $("#matchGoalsAgainst").closest(".field"),
      separator = scoreFields.querySelector("[aria-hidden]");
    scoreFields.append(
      ...(isAwayMatch({ venue: $("#matchVenue").value })
        ? [opponent, separator, own]
        : [own, separator, opponent]),
    );
  };
  orderScoreFields();
  $("#matchVenue").addEventListener("change", orderScoreFields);

  const review=document.createElement('details'); review.className='match-review field-space'; review.innerHTML='<summary>Riepilogo e controllo finale</summary><div id="finalMatchReview" role="status"></div><button type="button" id="matchChangeHistory">Storico modifiche</button>';
  panel.insertBefore(review,save); $('#matchChangeHistory').onclick=()=>activityHistoryModal(a.id);
  const redraw = () => {
    const names = new Map(
        state.players.map((p) => [p.id, `${p.surname} ${p.name}`]),
      ),
      events = matchEvents(m.id);
    $("#matchSettingsSummary").textContent =
      `${m.duration_minutes ?? 90}′ · ${m.minutes_auto ? "Automatici" : "Manuali"}`;
    $("#matchEventCount").textContent = `(${events.length})`;
    const issues=matchReview(m,state.roster.filter(r=>r.activity_id===a.id),events);
    $("#finalMatchReview").innerHTML=issues.length?"<ul>"+issues.map(issue=>"<li>"+esc(issue)+"</li>").join("")+"</ul>":"<p>Risultato, formazione, minuti e sostituzioni coerenti con i dati registrati.</p>";
    $("#matchEventList").innerHTML =
      events
        .map(
          (e) =>
            `<article class="event-item${e.event_type==='Gol'&&!e.player_id?' opponent-goal':''}"><div class="event-minute">${e.minute == null ? "—" : `${e.minute}′`}</div><div class="event-content" data-event-type="${esc(e.event_type)}"><span class="badge ${eventTone(e)}">${esc(e.event_type==='Gol'&&!e.player_id?'Gol avversario':e.event_type)}</span>${e.event_type==="Gol"&&!e.player_id?'<b>Squadra avversaria</b>':""}${names.get(e.player_id) ? `<b>${e.event_type === "Sostituzione" ? "Entra " : ""}${esc(names.get(e.player_id))}</b>` : ""}${names.get(e.outgoing_player_id) ? `<small>Esce ${esc(names.get(e.outgoing_player_id))}</small>` : ""}${e.detail ? `<p>${esc(e.detail)}</p>` : ""}</div><button type="button" class="ghost event-edit" data-unified-event="${e.id}" aria-label="Modifica ${esc(e.event_type)}${e.minute == null ? "" : " al " + e.minute + "° minuto"}" title="Modifica evento">${icon("edit",18)}</button></article>`,
        )
        .join("") ||
      '<p class="empty">Nessun evento. Aggiungi un gol, un cartellino o una sostituzione.</p>';
    const rows = state.roster.filter((r) => r.activity_id === a.id && r.called);
    $("#matchMinutesSummary").textContent =
      `${m.duration_minutes ?? 90}′ · ${m.minutes_auto ? "Calcolo automatico" : "Registrazione manuale"}`;
    $("#matchMinutesHint").textContent = m.minutes_auto
      ? "Minuti calcolati sulla durata impostata. Verifica durata ed eventi al termine della gara."
      : "Minuti storici conservati. Per aggiornarli dai cambi, attiva il calcolo automatico in Durata e calcolo minuti.";
    $("#matchMinutesList").innerHTML =
      rows
        .sort(
          (x, y) =>
            (x.lineup === "Titolare" ? 0 : 1) -
            (y.lineup === "Titolare" ? 0 : 1),
        )
        .map(
          (r) =>
            `<div><span>${esc(names.get(r.player_id) || "Giocatore storico")}<small>${esc(r.lineup)}</small></span><b>${r.minutes_played}′</b></div>`,
        )
        .join("") ||
      '<p class="row-sub">Salva convocati e titolari per calcolare i minuti.</p>';
    panel
      .querySelectorAll("[data-unified-event]")
      .forEach(
        (b) =>
          (b.onclick = () =>
            openEvent(
              state.events.find((e) => e.id === b.dataset.unifiedEvent),
            )),
      );
  };
  const notify=()=>{
    const editor=inlineEditor?.isConnected?inlineEditor:null,locked=busy||!!editor;
    const selected=editor?(editor.dataset.editorType==='Gol'?(editor.dataset.editorTeam==='opponent'?'addOpponentGoal':'addGoal'):({Ammonizione:'addYellow',Sostituzione:'addSubstitution'}[editor.dataset.editorType]||'addMatchEvent')):null;
    heading.querySelectorAll('.match-event-actions button').forEach(button=>button.setAttribute('aria-pressed',String(button.id===selected)));
    setBusyControls(scoreFields,locked);setBusyControls(settings,locked);setBusyControls(note,locked);save.hidden=!dirty&&!needsReload;root.dispatchEvent(new Event('match-statechange'));
  };
  const syncFields=()=>{
    $('#matchGoalsFor').value=m.goals_for??'';$('#matchGoalsAgainst').value=m.goals_against??'';
    $('#matchDuration').value=m.duration_minutes??90;$('#matchMinutesMode').value=m.minutes_auto?'auto':'manual';
    $('#matchVenue').value=m.venue;$('#matchNote').value=m.note||'';$('label[for=matchGoalsAgainst]').textContent=m.opponent;orderScoreFields();
    const title=root.querySelector('#activityTitle');if(title)title.textContent=matchTitle(m);
  };
  const reloadTimeline = async () => {
    busy=true;setBusyControls(root,true);$('#matchResultStatus').textContent='Aggiornamento gara…';
    try{
      const timeline=await refreshMatchTimeline(m.id);if(!timeline||!root.isConnected)return;
      m=timeline.match;Object.assign(a,timeline.activity);needsReload=false;syncFields();onTimeline(timeline);redraw();
      $('#matchResultStatus').textContent='Gara aggiornata';
    }catch(error){
      if(current()&&root.isConnected){needsReload=true;$('#matchResultStatus').textContent='Modifica salvata. Non riesco a leggere i dati aggiornati. ';
       const retry=document.createElement('button');retry.type='button';retry.textContent='Ricarica gara';retry.onclick=reloadTimeline;$('#matchResultStatus').append(retry);}
    }finally{busy=false;setBusyControls(root,false);notify()}
  };
  const openEvent = (event = {},team) => {
    if(!guard()||busy)return;
    if(needsReload)return toast('Ricarica i dati della gara prima di inserire altri eventi.');
    if(dirty)return toast('Salva risultato, durata e note prima di registrare un evento.');
    if(inlineEditor?.isConnected){inlineEditor.querySelector('#close').click();if(inlineEditor.isConnected)return;}
    inlineEditor=eventModal(m.id,event,reloadTimeline,{container:composer,quick:!!event.event_type&&!event.id&&event.event_type!=='Nota',team,onStateChange:notify});
    notify();
  };
  redraw();notify();
  const mark=event=>{if(!event.target.closest('#eventForm')){dirty=true;notify()}};
  panel.addEventListener('input',mark);panel.addEventListener('change',mark);
  $('#addGoal').onclick=()=>openEvent({event_type:'Gol'},'own');
  $('#addOpponentGoal').onclick=()=>openEvent({event_type:'Gol'},'opponent');
  $('#addYellow').onclick=()=>openEvent({event_type:'Ammonizione'});
  $('#addMatchEvent').onclick=()=>openEvent({event_type:'Nota'});
  $('#addSubstitution').onclick=()=>openEvent({event_type:'Sostituzione'});
  $("#saveMatchResult").onclick = async () => {
    if (busy || !guard()) return;
    if(needsReload)return reloadTimeline();
    if(inlineEditor?.isConnected&&inlineEditor.dataset.dirty==='true')return toast('Salva o annulla prima l’evento in modifica.');
    busy = true;
    setBusyControls(root, true);
    try {
      const value = (id) => ($(id).value === "" ? null : Number($(id).value)),
        goals_for = value("#matchGoalsFor"),
        goals_against = value("#matchGoalsAgainst"),
        duration_minutes = value("#matchDuration"),
        minutes_auto = $("#matchMinutesMode").value === "auto";
      if (
        [goals_for, goals_against].some(
          (n) => n !== null && (!Number.isInteger(n) || n < 0 || n > 99),
        )
      )
        throw Error("Punteggi interi tra 0 e 99");
      if ((goals_for === null) !== (goals_against === null))
        throw Error("Inserisci entrambi i punteggi oppure lasciali vuoti");
      if (
        !Number.isInteger(duration_minutes) ||
        duration_minutes < 1 ||
        duration_minutes > 130
      )
        throw Error("Durata intera da 1 a 130 minuti");
      if (
        minutes_auto &&
        !m.minutes_auto &&
        !(await confirmDialog({
          message:
            "Ricalcolare i minuti di questa partita dai titolari e dagli eventi? I minuti inseriti manualmente saranno sostituiti.",
          confirmLabel: "Ricalcola minuti",
        }))
      )
        return;
      if (!current() || !root.isConnected || !guard()) return;
      const status = root.querySelector("#activitySaveState");
      if (status) status.textContent = "Salvataggio in corso…";
      const { data, error } = await db.rpc("save_match_result", {
        p_id: m.id,
        p_revision: a.revision,
        p_values: {
          goals_for,
          goals_against,
          duration_minutes,
          minutes_auto,
          venue: $("#matchVenue").value,
          note: $("#matchNote").value.trim() || null,
        },
      });
      if (error) throw error;
      if (!current()) return;
      dirty = false;
      m = data;
      state.matches=state.matches.filter(row=>row.id!==m.id).concat(m);
      await reloadTimeline();
      if(current()&&root.isConnected&&!needsReload)toast('Partita e minuti salvati');
    } catch (error) {
      if (current()) $("#matchResultStatus").textContent = error.message;
    } finally {
      busy = false;
      setBusyControls(root, false);
      const status = root.querySelector("#activitySaveState");
      if (status)
        status.textContent = dirty
          ? "Modifiche non salvate"
          : "Salvato · Nessuna modifica";
      notify();
    }
  };
  $("#removeUnifiedMatch")?.addEventListener("click", async () => {
    if (busy || !guard()) return;
    busy = true;
    setBusyControls(root, true);
    try {
      if (
        !(await confirmDialog({
          message:
            "Eliminare definitivamente la partita, convocazioni ed eventi collegati?",
          confirmLabel: "Elimina partita",
          danger: true,
        })) ||
        !current() ||
        !root.isConnected ||
        !guard()
      )
        return;
      const { error } = await db
        .from("matches")
        .delete()
        .eq("id", m.id)
        .eq("user_id", teamOwner());
      if (error) throw error;
      if (!current()) return;
      root.remove();
      await refresh();
      if (current()) toast("Partita eliminata");
    } catch (error) {
      if (current() && root.isConnected)
        $("#matchResultStatus").textContent = error.message;
    } finally {
      busy = false;
      setBusyControls(root, false);
    }
  });
  return { reload:reloadTimeline, isDirty: () => dirty||!!(inlineEditor?.isConnected&&inlineEditor.dataset.dirty==='true'), isBusy: () => busy||!!(inlineEditor?.isConnected&&inlineEditor.dataset.busy==='true') };
}

function dashboard() {
 teamArrays();
 const day=today(),welcome=state.team?.first_name?.trim();
 const heading=`<header class="sc-page-heading office-heading"><div><h1>${welcome?'Bentornato, <span>'+esc(welcome)+'.</span>':'Bentornato'}</h1><p class="sc-date-line">${esc(new Intl.DateTimeFormat('it-IT',{weekday:'long',day:'numeric',month:'long',year:'numeric'}).format(new Date()).replace(/^./,c=>c.toUpperCase()))}</p></div></header>`;
 if(!state.players.length)return '<div class="sc-surface">'+heading+emptyTeamDashboard()+'</div>';
 const upcoming=state.activities.filter(a=>['Allenamento','Partita'].includes(a.activity_type)&&a.activity_date>=day&&a.status==='Programmato').sort((a,b)=>(a.activity_date+(a.start_time||'')).localeCompare(b.activity_date+(b.start_time||'')));
 const next=upcoming[0],latest=[...state.activities].filter(a=>a.activity_type==='Allenamento'&&a.status!=='Annullato'&&a.activity_date<=day&&a.session_id).sort((a,b)=>b.activity_date.localeCompare(a.activity_date))[0];
 const actual=latest?state.attendance.filter(r=>r.session_id===latest.session_id):[],docs=documentSummary();
 const task=(symbol,label,detail,attrs,count,extra='')=>`<button ${attrs} class="sc-list-row"><span class="sc-row-icon tone-warning">${icon(symbol,20)}</span><span class="sc-row-copy"><strong>${label}</strong><small>${detail}</small>${extra}<span class="sc-small-count">${count} da verificare</span></span>${icon('chevron',18)}</button>`;
 const pendingTotal=upcoming.filter(a=>a.activity_type==='Allenamento'&&!a.session_id).reduce((n,a)=>n+pollEntries(a).filter(x=>x.row.availability==='In attesa').length,0);
 const overdue=state.activities.filter(a=>a.activity_type==='Allenamento'&&a.status==='Programmato'&&!a.session_id&&a.activity_date<=day);
 const incomplete=state.matches.filter(m=>m.match_date<day&&matchOutcome(m)===null&&!state.activities.some(a=>a.match_id===m.id&&a.status==='Annullato')).sort((a,b)=>a.match_date.localeCompare(b.match_date));
 const unread=(state.staff_communications||[]).filter(m=>m.requires_ack&&Date.parse(m.expires_at)>Date.now()&&!(state.communication_receipts||[]).some(r=>r.communication_id===m.id&&r.reader_id===state.user.id)).length;
 const tasks=[canOperate()&&incomplete.length?task('trophy','Risultati da registrare',fmt(incomplete[0].match_date)+' · '+incomplete[0].opponent,`data-open-match="${incomplete[0].id}"`,incomplete.length):'',(canOperate()||teamRole()==='president')&&pendingTotal?task('message',teamRole()==='president'?'Disponibilità allenamento':'Risposte da registrare','Risposte WhatsApp ancora in attesa','data-priority="poll"',pendingTotal):'',canOperate()&&overdue.length?task('clipboard','Presenze da confermare','Verifica gli allenamenti trascorsi',`data-open-activity="${overdue[0].id}"`,overdue.length):'',unread?task('message','Avvisi da confermare','Leggi e conferma gli avvisi importanti','data-communications',unread):'',canViewExpiries()&&docs.review?task('shield','Documenti da verificare','Certificati e tesseramenti','data-expiries',docs.review,docs.expired?`<small class="text-destructive">${docs.expired} scaduti</small>`:''):''].join('');
 let hero='';
 if(next){
  const match=state.matches.find(m=>m.id===next.match_id),isMatch=next.activity_type==='Partita';
  const title=isMatch?'Eburum vs '+(match?.opponent||next.title):next.title;
  hero=`<section class="sc-training-focus sc-home-hero" aria-labelledby="trainingPreviewTitle"><div class="sc-focus-top"><span class="sc-light-tag">${icon(isMatch?'trophy':'calendar',16)}${isMatch?'Prossima partita':'Prossimo allenamento'}</span><span>${esc(dayLabel(next.activity_date,day))}</span></div><h3 id="trainingPreviewTitle">${esc(title)}</h3><p>${fmt(next.activity_date)}</p><div class="sc-focus-place">${icon('clock',18)}${clock(next.start_time)} · ${icon('pin',18)}${esc(next.location||'Luogo da definire')}</div>${isMatch&&match?`<span class="badge ${isAwayMatch(match)?'venue-away':'venue-home'}">${esc(match.venue)}</span>`:''}<button class="sc-light-button" data-open-activity="${next.id}">${isMatch?(canPlan()?'Prepara la distinta':'Consulta partita'):(canOperate()?'Gestisci presenze':'Consulta allenamento')}${icon('arrowUp',20)}</button></section>`;
 }else hero=`<section class="sc-empty-state sc-home-hero">${icon('calendar',24)}<h3>Nessun impegno in programma</h3><p>Il prossimo allenamento o la prossima partita compariranno qui.</p>${canPlan()?'<button class="primary" data-new-training>Programma allenamento</button>':''}${!canOperate()&&!latest?'<button data-page="training">Consulta allenamento</button>':''}</section>`;
 const last=latest?`<section class="sc-last-training sc-home-last"><h2>Ultimo allenamento</h2><p>${fmt(latest.activity_date)} · ${esc(latest.title)}</p><dl class="home-stat-grid"><div data-tone="success"><dd data-home-count>${actual.filter(r=>r.status==='Presente').length}</dd><dt>Presenti</dt></div><div data-tone="neutral"><dd data-home-count>${actual.filter(r=>r.status==='Assente').length}</dd><dt>Assenti</dt></div><div data-tone="danger"><dd data-home-count>${actual.filter(r=>r.status==='Infortunato').length}</dd><dt>Infortunati</dt></div></dl><button class="ghost" data-open-activity="${latest.id}">Dettagli ${icon('chevron',18)}</button></section>`:'';
 const result=[...state.matches].filter(m=>m.match_date<=day&&matchOutcome(m)&&!state.activities.some(a=>a.match_id===m.id&&a.status==='Annullato')).sort((a,b)=>b.match_date.localeCompare(a.match_date))[0];
 const resultHtml=result?`<section class="sc-home-result"><div class="sc-section-heading"><h2>Ultimo risultato</h2><span>${fmt(result.match_date)}</span></div><button class="sc-match-preview" data-open-match="${result.id}"><div class="sc-match-meta"><span class="match-outcome outcome-${matchOutcome(result)}">${matchOutcome(result)}</span><span class="badge ${isAwayMatch(result)?'venue-away':'venue-home'}">${esc(result.venue)}</span></div><div class="match-scoreboard"><span class="match-team ${isAwayMatch(result)?'':'is-own'}">${esc(isAwayMatch(result)?result.opponent:'Eburum')}</span><strong class="match-goals">${isAwayMatch(result)?result.goals_against:result.goals_for}</strong><span class="match-team ${isAwayMatch(result)?'is-own':''}">${esc(isAwayMatch(result)?'Eburum':result.opponent)}</span><strong class="match-goals">${isAwayMatch(result)?result.goals_for:result.goals_against}</strong></div><footer>Risultato ed eventi ${icon('arrowUp',20)}</footer></button></section>`:'';
 const players=state.players.filter(p=>p.active),injured=new Set(actual.filter(r=>r.status==='Infortunato').map(r=>r.player_id)),suspended=new Set(players.filter(p=>{const d=playerDiscipline(p.id);return d.pending.length||playerDismissals(p.id).some(r=>r.sanction&&!r.sanction.voided&&r.attention)}).map(p=>p.id));
 const clear=players.filter(p=>!injured.has(p.id)&&!suspended.has(p.id)).length;
 const availability=`<section class="sc-home-availability"><h2>Segnalazioni rosa</h2><p class="row-sub">${latest?"Presenze rilevate il "+fmt(latest.activity_date):"Nessuna presenza confermata disponibile"}. Provvedimenti aperti della stagione.</p><dl class="home-stat-grid"><div data-tone="success"><dd data-home-count>${latest?clear:"—"}</dd><dt>Senza segnalazioni</dt></div><div data-tone="danger"><dd data-home-count>${latest?players.filter(p=>injured.has(p.id)).length:"—"}</dd><dt>Infortunati all’ultimo allenamento</dt></div><div data-tone="warning"><dd data-home-count>${suspended.size}</dd><dt>Squalifiche aperte</dt></div></dl><button class="ghost wide" data-page="players">Apri Rosa ${icon('chevron',18)}</button></section>`;
 return `<div class="sc-surface club-office-home">${heading}<div class="sc-home-layout"><div class="sc-home-main">${hero}<section class="sc-home-tasks"><div class="sc-section-heading"><h2>${teamRole()==='president'?'Situazione squadra':'Da completare'}</h2></div><div class="sc-rows">${tasks||'<div class="sc-empty-state tone-success">'+icon('check',24)+'<h3>Nessuna verifica in elenco</h3><p>Le attività controllate qui non richiedono interventi.</p></div>'}</div>${canOperate()&&state.trainingDraft?'<button class="office-resume" data-resume-attendance>Riprendi la bozza presenze'+icon('chevron',18)+'</button>':''}</section>${last}</div><div class="sc-home-secondary">${renderExtensions('dashboard-side')}${resultHtml}${availability}</div></div></div>`;
}
function registerOperations() {
  registerBinder("operations", () => {
    document
      .querySelectorAll("[data-resume-session]")
      .forEach(
        (b) =>
          (b.onclick = () => editAttendanceSession(b.dataset.resumeSession, b)),
      );
    document.querySelectorAll("[data-copy-home-reminder]").forEach(
      (b) =>
        (b.onclick = () => {
          const a = state.activities.find(
            (x) => x.id === b.dataset.copyHomeReminder,
          );
          if (!a) return;
          const waiting = pollEntries(a).filter(
            (x) => x.row.availability === "In attesa",
          );
          copyOperationalText(
            [
              "ALLENAMENTO EBURUM · " + fmt(a.activity_date),
              "Non hanno risposto (" + waiting.length + ")",
              ...waiting.map(
                (x) => "• " + x.player.surname + " " + x.player.name,
              ),
              waiting.length
                ? "Da sollecitare a votare al sondaggio WhatsApp."
                : "Tutti hanno risposto.",
            ].join("\n"),
            document.querySelector("#homeReminderStatus"),
            b.closest(".office-training"),
          );
        }),
    );
  });
}

export {
  copyOperationalText,
  callupMessage,
  mountCallupCopy,
  mountMatchResults,
  dashboard,
  registerOperations,
};
