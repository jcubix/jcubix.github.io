// Shared, side-effect-free decisions for daily workflows and final checks.
export function documentState(value, today, limit) {
  return !value ? 'Mancante' : value < today ? 'Scaduto' : value <= limit ? 'In scadenza' : 'In regola';
}
export function matchReview(match, roster, events) {
  const issues = [], called = roster.filter(r => r.called), duration = match.duration_minutes ?? 90;
  if (match.goals_for == null || match.goals_against == null) issues.push('Risultato non compilato');
  if (called.filter(r => r.lineup === 'Titolare').length !== 11) issues.push('Verifica la formazione iniziale: non risultano 11 titolari');
  if (called.some(r => r.minutes_played < 0 || r.minutes_played > duration)) issues.push('Minuti giocati fuori dalla durata della gara');
  if (!match.minutes_auto) issues.push('Minuti manuali: verifica le registrazioni dello staff');
  const onPitch = new Set(called.filter(r => r.lineup === 'Titolare').map(r => r.player_id)), used=new Set(onPitch);
  for (const event of [...events].sort((a,b) => (a.minute ?? Infinity)-(b.minute ?? Infinity) || String(a.created_at || '').localeCompare(String(b.created_at || '')) || String(a.id).localeCompare(String(b.id)))) {
    if (event.minute == null || event.minute < 0 || event.minute > duration) issues.push(`${event.event_type}: minuto da verificare`);
    if (event.event_type === 'Sostituzione') {
      if (!onPitch.has(event.outgoing_player_id) || used.has(event.player_id) || !called.some(r => r.player_id === event.player_id) || event.player_id === event.outgoing_player_id) issues.push(`Sostituzione al ${event.minute ?? '—'}′: entrata e uscita da verificare`);
      onPitch.delete(event.outgoing_player_id); onPitch.add(event.player_id); used.add(event.player_id);
    } else if (event.event_type === 'Espulsione') onPitch.delete(event.player_id);
  }
  return [...new Set(issues)];
}
export function attendanceMessage(activity, attendance, players, format) {
  const names = new Map(players.map(p => [p.id, `${p.surname} ${p.name}`]));
  return [`ALLENAMENTO EBURUM · ${format(activity.activity_date)}`, 'Presenze effettive registrate', ...['Presente','Assente','Infortunato'].flatMap(status => {
    const rows = attendance.filter(r => r.status === status).sort((a,b) => (names.get(a.player_id)||'').localeCompare(names.get(b.player_id)||'', 'it'));
    return [`${{Presente:'Presenti',Assente:'Assenti',Infortunato:'Infortunati'}[status]} (${rows.length})`, ...rows.map(r => `• ${names.get(r.player_id)||'Giocatore storico'}`)];
  })].join('\n');
}
