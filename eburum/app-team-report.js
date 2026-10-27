export const teamReportColumns = [
  { key: "name", label: "Giocatore", group: "Giocatore", width: 46 },
  { key: "role", label: "Ruolo", group: "Giocatore", width: 26 },
  {
    key: "sessions",
    pdfLabel: "Allen. reg.",
    label: "Allenamenti registrati",
    group: "Allenamenti",
    width: 15,
  },
  { key: "present", label: "Presenze", group: "Allenamenti", width: 15 },
  { key: "absent", label: "Assenze", group: "Allenamenti", width: 15 },
  { key: "injured", label: "Infortuni", group: "Allenamenti", width: 16 },
  { key: "percentage", label: "Presenze %", group: "Allenamenti", width: 17 },
  {
    key: "called",
    pdfLabel: "Convoc.",
    label: "Convocazioni",
    group: "Impiego in gara",
    width: 18,
  },
  {
    key: "starters",
    label: "Da titolare",
    group: "Impiego in gara",
    width: 17,
  },
  {
    key: "substitutes",
    pdfLabel: "Subentri",
    label: "Ingressi dalla panchina",
    group: "Impiego in gara",
    width: 19,
  },
  {
    key: "minutes",
    label: "Minuti registrati",
    group: "Impiego in gara",
    width: 18,
  },
  { key: "goals", label: "Gol", group: "Rendimento e disciplina", width: 14 },
  {
    key: "yellows",
    pdfLabel: "Gialli",
    label: "Ammonizioni",
    group: "Rendimento e disciplina",
    width: 18,
  },
  {
    key: "reds",
    pdfLabel: "Rossi",
    label: "Espulsioni",
    group: "Rendimento e disciplina",
    width: 17,
  },
];

export function teamReportRows(players, snapshot, from, to) {
  const within = (date) => date >= from && date <= to;
  const cancelled = new Set(
    snapshot.activities
      .filter((a) => a.status === "Annullato")
      .flatMap((a) => [a.id, a.match_id]),
  );
  const sessions = new Set(
    snapshot.sessions
      .filter(
        (s) =>
          s.session_type === "Allenamento" &&
          within(s.session_date) &&
          !snapshot.activities.some(
            (a) => a.session_id === s.id && a.status === "Annullato",
          ),
      )
      .map((s) => s.id),
  );
  const matches = new Map(
    snapshot.matches
      .filter((m) => within(m.match_date) && !cancelled.has(m.id))
      .map((m) => [m.id, m]),
  );
  const activities = new Map(
    snapshot.activities
      .filter(
        (a) =>
          a.activity_type === "Partita" &&
          within(a.activity_date) &&
          !cancelled.has(a.id) &&
          matches.has(a.match_id),
      )
      .map((a) => [a.id, a]),
  );
  const events = snapshot.events.filter((e) => matches.has(e.match_id));
  const played = new Set(
    [...matches.values()]
      .filter((m) => m.goals_for != null && m.goals_against != null)
      .map((m) => m.id),
  );
  for (const e of events) if (e.event_type !== "Nota") played.add(e.match_id);
  for (const r of snapshot.roster)
    if (r.minutes_played > 0 && activities.has(r.activity_id))
      played.add(activities.get(r.activity_id).match_id);
  return players.map((p) => {
    const attendance = snapshot.attendance.filter(
      (r) =>
        r.player_id === p.id &&
        sessions.has(r.session_id) &&
        ["Presente", "Assente", "Infortunato"].includes(r.status),
    );
    const rows = snapshot.roster.filter(
      (r) => r.player_id === p.id && activities.has(r.activity_id),
    );
    const own = events.filter((e) => e.player_id === p.id);
    const count = (status) =>
      attendance.filter((r) => r.status === status).length;
    const present = count("Presente");
    return {
      id: p.id,
      name: `${p.surname} ${p.name}`,
      role: p.role || "",
      active: p.active,
      sessions: attendance.length,
      present,
      absent: count("Assente"),
      injured: count("Infortunato"),
      percentage: attendance.length
        ? Math.round((present / attendance.length) * 100)
        : null,
      called: new Set(rows.filter((r) => r.called).map((r) => r.activity_id))
        .size,
      starters: new Set(
        rows
          .filter(
            (r) =>
              r.called &&
              r.lineup === "Titolare" &&
              played.has(activities.get(r.activity_id).match_id),
          )
          .map((r) => r.activity_id),
      ).size,
      substitutes: new Set(
        own
          .filter(
            (e) => e.event_type === "Sostituzione" && played.has(e.match_id),
          )
          .map((e) => e.match_id),
      ).size,
      minutes: rows.reduce((n, r) => n + Number(r.minutes_played || 0), 0),
      goals: own.filter((e) => e.event_type === "Gol").length,
      yellows: own.filter((e) => e.event_type === "Ammonizione").length,
      reds: own.filter((e) => e.event_type === "Espulsione").length,
    };
  });
}

export function sortTeamReport(rows, key = "name", direction = "asc") {
  const column = teamReportColumns.some((c) => c.key === key) ? key : "name";
  const compare = new Intl.Collator("it", {
    numeric: true,
    sensitivity: "base",
  }).compare;
  return [...rows].sort((a, b) => {
    if (a[column] == null || b[column] == null)
      return a[column] == null
        ? b[column] == null
          ? compare(a.name, b.name)
          : 1
        : -1;
    const order =
      typeof a[column] === "number"
        ? a[column] - b[column]
        : compare(a[column], b[column]);
    return (direction === "desc" ? -order : order) || compare(a.name, b.name);
  });
}

export function teamReportCell(row, key) {
  if (row[key] == null) return "—";
  return key === "percentage" ? row[key] + "%" : String(row[key]);
}

export function teamReportCsv(rows) {
  const cell = (value) => {
    let text = String(value ?? "");
    if (/^\s*[=+@-]/.test(text)) text = "'" + text;
    return '"' + text.replaceAll('"', '""') + '"';
  };
  return (
    "\uFEFF" +
    [
      teamReportColumns.map((c) => c.label),
      ...rows.map((row) =>
        teamReportColumns.map((c) =>
          c.key === "name" && !row.active
            ? row.name + " (Inattivo)"
            : row[c.key],
        ),
      ),
    ]
      .map((row) => row.map(cell).join(";"))
      .join("\r\n")
  );
}

export function createTeamReportPdf(rows, from, to) {
  if (!globalThis.jspdf?.jsPDF)
    throw Error("Modulo PDF non disponibile. Riprova.");
  const pdf = new globalThis.jspdf.jsPDF({
    orientation: "landscape",
    unit: "mm",
    format: "a4",
    compress: true,
  });
  const clean = (text) =>
    String(text)
      .replace(/[’‘]/g, "'")
      .replace(/[—–]/g, "-")
      .replace(/[^\x20-\x7e\xa0-\xff]/g, " ");
  const date = (value) => value.split("-").reverse().join("/");
  const left = 12,
    width = teamReportColumns.reduce((n, c) => n + c.width, 0);
  const groups = [...new Set(teamReportColumns.map((c) => c.group))];
  const header = () => {
    pdf.setTextColor(15, 27, 61);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(16);
    pdf.text("Report squadra - Eburum", left, 15);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(9);
    pdf.text(
      `${date(from)} - ${date(to)} | ${rows.length} giocatori`,
      left,
      22,
    );
    pdf.setFontSize(7.5);
    pdf.setFillColor(233, 237, 244);
    pdf.rect(left, 27, width, 27, "F");
    let x = left;
    for (const group of groups) {
      const span = teamReportColumns
        .filter((c) => c.group === group)
        .reduce((n, c) => n + c.width, 0);
      pdf.setFont("helvetica", "bold");
      pdf.text(group, x + 2, 32);
      x += span;
    }
    x = left;
    for (const column of teamReportColumns) {
      pdf.text(
        pdf.splitTextToSize(
          clean(column.pdfLabel || column.label),
          column.width - 2,
        ),
        x + 1,
        40,
      );
      x += column.width;
    }
  };
  header();
  let y = 54;
  for (const [index, row] of rows.entries()) {
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(8);
    const cells = teamReportColumns.map((c) =>
      pdf.splitTextToSize(
        clean(
          c.key === "name" && !row.active
            ? row.name + " (Inattivo)"
            : teamReportCell(row, c.key),
        ),
        c.width - 4,
      ),
    );
    const height = Math.max(
      10,
      ...cells.map((lines) => lines.length * 3.7 + 4),
    );
    if (y + height > 190) {
      pdf.addPage();
      header();
      y = 54;
    }
    if (index % 2 === 0) {
      pdf.setFillColor(246, 248, 251);
      pdf.rect(left, y, width, height, "F");
    }
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(8);
    let x = left;
    for (const [i, column] of teamReportColumns.entries()) {
      pdf.text(cells[i], x + 2, y + 5);
      x += column.width;
    }
    pdf.setDrawColor(214, 221, 232);
    pdf.line(left, y + height, left + width, y + height);
    y += height;
  }
  for (let i = 1; i <= pdf.getNumberOfPages(); i++) {
    pdf.setPage(i);
    pdf.setFontSize(7);
    pdf.setTextColor(76, 88, 110);
    pdf.text(
      "Presenze confermate. Gli allenamenti senza registrazione non sono assenze. Inattivi inclusi.",
      left,
      195,
    );
    pdf.text(
      "Allen. reg.: allenamenti registrati | Convoc.: convocazioni | Subentri: ingressi dalla panchina | Gialli: ammonizioni | Rossi: espulsioni",
      left,
      201,
    );
    pdf.text(`${i} / ${pdf.getNumberOfPages()}`, left + width, 198, {
      align: "right",
    });
  }
  return pdf;
}
