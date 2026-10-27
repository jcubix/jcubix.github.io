import {db,fetchAllRows,state,teamOwner,teamRequestGuard} from './app-part1.js';
import {childRows} from './app-data.ts';
import {notifyCommunications} from './app-realtime.js';

function activeCommunications(at = Date.now()) {
  return (state.staff_communications || [])
    .filter((m) => Date.parse(m.expires_at) > at)
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
}

function communicationTime(value) {
  return new Intl.DateTimeFormat("it-IT", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function communicationExpiry(value, at = Date.now()) {
  const remaining = Date.parse(value) - at;
  if (remaining <= 0) return "Scaduta";
  if (remaining < 60000) return "Scade tra meno di un minuto";
  const minutes = Math.ceil(remaining / 60000),
    hours = Math.ceil(remaining / 3600000),
    days = Math.ceil(remaining / 86400000);
  return remaining < 3600000
    ? `Scade tra ${minutes} ${minutes === 1 ? "minuto" : "minuti"}`
    : remaining < 172800000
      ? `Scade tra ${hours} ${hours === 1 ? "ora" : "ore"}`
      : `Scade tra ${days} ${days === 1 ? "giorno" : "giorni"}`;
}

function communicationAudience(m) {
  if (m.kind === "meeting") return "Riunione staff";
  const p = state.players.find((p) => p.id === m.player_id);
  return p
    ? `${p.surname} ${p.name}`
    : m.player_id
      ? "Giocatore"
      : "Comunicazione generale";
}

let communicationFetchGeneration = 0;

async function fetchCommunications() {
  const current = teamRequestGuard(),
    generation = ++communicationFetchGeneration,
    owner = teamOwner();
  const result = await fetchAllRows(() =>
    db
      .from("staff_communications")
      .select("*")
      .eq("user_id", owner)
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false }),
  );
  if (!current() || generation !== communicationFetchGeneration) return false;
  if (result.error) throw result.error;
  const receipts = await childRows(
    "communication_receipts",
    "communication_id",
    result.data.filter((m) => m.requires_ack).map((m) => m.id),
    owner,
  );
  if (!current() || generation !== communicationFetchGeneration) return false;
  state.communication_receipts = receipts;
  state.staff_communications = result.data;
  notifyCommunications();
  return true;
}


export { activeCommunications, communicationTime, communicationExpiry, communicationAudience, communicationFetchGeneration, fetchCommunications };
