import {isAwayMatch} from './app-match-display.js';import {fmt,sortPlayers,today} from './app-part1.js';import {ui} from './src/ui-service.ts';

const line = (value) =>
  String(value ?? "")
    .replace(/[\r\n\t]+/g, " ")
    .trim();

const key = (value) => line(value).normalize("NFKC").toLocaleLowerCase("it");

function participantNames(players, ids) {
  const people = players.filter((p) => ids.has(p.id)),
    labels = new Map();
  for (const p of people) {
    const surname = line(p.surname),
      name = line(p.name);
    const others = players.filter(
      (other) => other.id !== p.id && key(other.surname) === key(surname),
    );
    let label = surname || name || "Giocatore senza nome";
    if (surname && name && others.length) {
      let size = 1;
      while (
        size < name.length &&
        others.some((other) =>
          key(other.name).startsWith(key(name.slice(0, size))),
        )
      )
        size++;
      label += " " + name.slice(0, size);
    }
    labels.set(p.id, label);
  }
  return (id) =>
    labels.get(id) || (id ? "Giocatore storico" : "Giocatore non indicato");
}

function matchReportModel({
  match,
  activity,
  roster = [],
  events = [],
  players = [],
}) {
  if (!match?.id)
    throw Error("Salva la partita prima di esportare il tabellino.");
  const rows = activity?.id
    ? roster.filter((r) => r.activity_id === activity.id)
    : [];
  const timeline = events
    .filter((e) => e.match_id === match.id)
    .slice()
    .sort(
      (a, b) =>
        (a.minute ?? Infinity) - (b.minute ?? Infinity) ||
        String(a.created_at || "").localeCompare(String(b.created_at || "")) ||
        String(a.id || "").localeCompare(String(b.id || "")),
    );
  const ids = new Set(rows.filter((r) => r.called).map((r) => r.player_id));
  for (const e of timeline) {
    if (e.player_id) ids.add(e.player_id);
    if (e.outgoing_player_id) ids.add(e.outgoing_player_id);
  }
  const name = participantNames(players, ids),
    seen = new Set();
  const starters = rows.filter(
    (r) =>
      r.called &&
      r.lineup === "Titolare" &&
      !seen.has(r.player_id) &&
      seen.add(r.player_id),
  );
  const ordered = sortPlayers(
    starters.map(
      (r) => players.find((p) => p.id === r.player_id) || { id: r.player_id },
    ),
  );
  const opponent = line(match.opponent) || "Avversario da indicare";
  const title = isAwayMatch(match)
    ? `${opponent} - EBURUM`
    : `EBURUM - ${opponent}`;
  const eventEntries = timeline.map((e) => {
    const detail = line(e.detail),
      penalty = /^(?:\(?rig\.?\)?|(?:su |calcio di )?rigore)$/i.test(detail);
    const annotation = detail
      ? ` (${penalty && e.event_type === "Gol" ? "RIG" : detail})`
      : "";
    const person = e.player_id ? name(e.player_id) : "(giocatore non indicato)";
    const action =
      e.event_type === "Gol"
        ? e.player_id
          ? `Gol ${person}`
          : "Gol Squadra avversaria"
        : e.event_type === "Ammonizione"
          ? `Ammonito ${person}`
          : e.event_type === "Espulsione"
            ? `Espulso ${person}`
            : e.event_type === "Sostituzione"
              ? `Esce ${name(e.outgoing_player_id)} entra ${name(e.player_id)}`
              : e.event_type === "Nota"
                ? `Nota${e.player_id ? " " + person : ""}`
                : `${line(e.event_type)}${e.player_id ? " " + person : ""}`;
    return {
      minute: e.minute,
      type: e.event_type,
      opponent: e.event_type === "Gol" && !e.player_id,
      action: action + annotation,
    };
  });
  const eventLines = eventEntries.map(
    (e) =>
      `${e.minute == null ? "Minuto non indicato" : e.minute + "’"} - ${e.action}`,
  );
  const scored = match.goals_for != null && match.goals_against != null;
  const scores = isAwayMatch(match)
    ? [match.goals_against, match.goals_for]
    : [match.goals_for, match.goals_against];
  const cancelled = activity?.status === "Annullato";
  const final =
    !cancelled &&
    (activity?.status === "Concluso" || match.match_date < today());
  const result = scored
    ? `${final ? "Risultato finale" : "Risultato registrato"}: ${scores.join("-")}`
    : "Risultato: da registrare";
  const text = [
    title,
    ...(cancelled ? ["Partita annullata"] : []),
    "",
    "Formazione Titolare:",
    ...(ordered.length
      ? ordered.map((p) => name(p.id))
      : ["Formazione non registrata."]),
    "",
    ...(eventLines.length ? eventLines : ["Nessun evento registrato."]),
    "",
    result,
  ].join("\n");
  const filename = ["Eburum-tabellino", opponent, match.match_date]
    .filter(Boolean)
    .join("-")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9-]+/g, "-")
    .slice(0, 160);
  return {
    title,
    date: fmt(match.match_date),
    starters: ordered.map((p) => name(p.id)),
    events: eventLines,
    result,
    text,
    filename,
    teams: isAwayMatch(match) ? [opponent, "EBURUM"] : ["EBURUM", opponent],
    scores: scored ? scores : null,
    cancelled,
    eventEntries,
  };
}

function createMatchReportPdf(model) {
  if (!globalThis.jspdf?.jsPDF)
    throw Error("Modulo PDF non disponibile. Riprova.");
  const pdf = new globalThis.jspdf.jsPDF({
    unit: "mm",
    format: "a4",
    compress: true,
  });
  const clean = (value) =>
    String(value)
      .replace(/[’‘′]/g, "'")
      .replace(/[–—]/g, "-")
      .replace(/[^\x20-\x7e\xa0-\xff\n]/g, "");
  let y = 22;
  const write = (value, size = 11, bold = false) => {
    pdf.setFont("helvetica", bold ? "bold" : "normal");
    pdf.setFontSize(size);
    pdf.setTextColor(20, 33, 59);
    for (const row of pdf.splitTextToSize(clean(value), 174)) {
      if (y + 7 > 278) {
        pdf.addPage();
        y = 22;
      }
      pdf.text(row, 18, y);
      y += size * 0.45 + 2;
    }
  };
  pdf.setProperties({
    title: clean(model.title + " - Tabellino gara"),
    author: "Eburum Team Manager",
  });
  write(model.title, 19, true);
  write(model.date, 10);
  y += 6;
  // Use the same text as the preview, including cancellation and missing-data notices.
  for (const row of model.text.split("\n").slice(1)) {
    if (!row) {
      y += 4;
      continue;
    }
    write(
      row,
      11,
      row === "Formazione Titolare:" ||
        row === model.result ||
        row === "Partita annullata",
    );
  }
  const pages = pdf.getNumberOfPages();
  for (let page = 1; page <= pages; page++) {
    pdf.setPage(page);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(8);
    pdf.setTextColor(91, 105, 122);
    pdf.text("Eburum | Tabellino gara | " + model.date, 18, 289);
    pdf.text(`${page} / ${pages}`, 192, 289, { align: "right" });
  }
  return pdf;
}

function matchReportModal(snapshot,routed=false){return ui.open('match-report',snapshot,routed?{page:'reports',detail:'report-match:'+snapshot.match.id}:{})} export {matchReportModal};
export { line, key, participantNames, matchReportModel, createMatchReportPdf };
