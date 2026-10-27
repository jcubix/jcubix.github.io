import { BookOpen, Search } from "lucide-react";
import { useState } from "react";
import {
  canTechnicalRole,
  canViewExpiriesRole,
  canViewFinanceRole,
  roleHelp,
  roleLabels,
} from "../app-roles.ts";
import { Button } from "./components/ui/button";
import { Dialog } from "./components/ui/dialog";
import { Input } from "./components/ui/input";
import { Tooltip } from "./components/ui/tooltip";

const topics = [
  {
    title: "Orientarsi nell’app",
    text: "La Home riassume le attività da completare. La barra in basso apre Home, Allenamenti, Comunicazioni, Partite e Altro. Per tesoriere e presidente mostra Home, Comunicazioni, Economia, Partite e Altro. La Rosa si trova in Altro. Seleziona la stagione dal menu in alto: statistiche e attività si riferiscono alla stagione scelta. La campanella apre le comunicazioni, le iniziali aprono account e stagione.",
    steps: [
      "Apri la sezione desiderata dalla barra in basso.",
      "Usa + per creare un elemento, quando il tuo ruolo lo consente.",
      "Salva prima di uscire da una modifica; un avviso protegge le bozze non salvate.",
    ],
  },
  {
    title: "Allenamenti: risposte WhatsApp e presenze",
    text: "Il sondaggio resta su WhatsApp. Una risposta Sì indica una disponibilità prevista, non certifica la partecipazione. Non risposto identifica chi deve ancora votare.",
    steps: [
      "Apri l’allenamento e trascrivi Sì, No o Non risposto nella sezione Risposte WhatsApp.",
      "Filtra Non risposto e copia i nomi per il sollecito nel gruppo interno.",
      "Dopo l’allenamento registra le Presenze effettive: presente, assente o infortunato, poi salva.",
      "Nel Registro in Altro trovi presenze e schede degli allenamenti passati o annullati. Apri la scheda per note e risposte WhatsApp; Storico modifiche mostra autore e variazione delle correzioni.",
    ],
  },
  {
    title: "Partite: gara, convocati e impostazioni",
    text: "La partita ha un percorso distinto dall’allenamento. Inserisci avversario, data e Casa o Trasferta; in trasferta l’avversario appare per primo, anche nel risultato.",
    steps: [
      "In Convocati seleziona la distinta e scegli Titolare o Panchina direttamente dalla lista; trovi qui anche formazione e note tecniche autorizzate.",
      "In Gara trovi subito risultato ed eventi. Gol Eburum, Gol avversari, Ammonizione e Sostituzione aprono un inserimento rapido nella stessa pagina. I gol aggiornano il risultato anche quando li correggi o elimini.",
      "Per un cambio indica chi esce e chi entra: in modalità automatica i minuti vengono divisi in base agli eventi e alla durata della gara.",
      "In Impostazioni gestisci data, ritrovo, campo e stato. Risultato ed eventi si aggiornano senza chiudere la scheda; le osservazioni tecniche restano riservate ai ruoli autorizzati.",
      "Dopo aver salvato, usa Esporta tabellino nella scheda partita: copia il testo per WhatsApp o scarica il PDF con titolari, eventi e risultato. Per un gol su rigore scrivi RIG o Rigore nei dettagli dell’evento.",
    ],
  },
  {
    title: "Cartellini e diffide",
    text: "Le ammonizioni vengono conteggiate dagli eventi già registrati in partita. Non occorre inserirle una seconda volta.",
    steps: [
      "Apri Cartellini e diffide dalla sezione Partite.",
      "Controlla i giocatori vicini alla soglia: ogni cinque gialli si salta una gara, secondo la regola impostata per la squadra.",
      "Lo staff conferma manualmente la gara saltata per segnare la squalifica come scontata.",
      "Se correggi un evento, ricontrolla il conteggio e le squalifiche.",
      "Nel filtro Espulsioni registra la durata dal comunicato ufficiale: numero di giornate oppure data finale inclusa. Le espulsioni senza provvedimento restano Da definire.",
      "Per le giornate conferma ogni gara effettivamente saltata; sono ammesse gare successive con risultato e senza minuti del giocatore. La stessa gara non può coprire anche una squalifica per ammonizioni.",
      "Le squalifiche a data restano aperte fino al giorno indicato compreso. I provvedimenti aperti delle stagioni precedenti restano visibili e la distinta segnala i giocatori da verificare.",
    ],
  },
  {
    title: "Rosa e scheda del giocatore",
    text: "La Rosa permette di cercare un giocatore, ordinare per cognome o raggruppare per ruolo. La scheda riunisce dati e statistiche della stagione.",
    steps: [
      "Apri Altro → Rosa, cerca il giocatore e premi sul suo nome.",
      "Consulta presenze, convocazioni, minuti, gol e cartellini; apri il report individuale per i dettagli.",
      "I ruoli autorizzati possono modificare i dati e disattivare il giocatore: lo storico viene conservato.",
      "Usa + per aggiungere un giocatore, se disponibile per il tuo ruolo.",
    ],
  },
  {
    title: "Messaggi dello staff",
    text: "Sono aggiornamenti condivisi fra gli utenti della squadra, anche quando riguardano un singolo giocatore. Non sono una chat privata e non sostituiscono i sondaggi WhatsApp.",
    steps: [
      "Premi +, inserisci il contenuto e scegli eventualmente un giocatore.",
      "Per un avviso scegli 1, 3 o 7 giorni dalla pubblicazione. Amministratore, team manager e allenatore possono scegliere Riunione, inserire data, ora, luogo e ordine del giorno: l’invito resta fino all’appuntamento e per 1, 3 o 7 giorni successivi.",
      "Gli inviti richiedono conferma di lettura: significa aver letto, non aver confermato la partecipazione. Filtra Riunioni per consultarli; in Riunioni già registrate restano gli appuntamenti precedenti, senza cancellazioni o conversioni automatiche.",
      "Usa ricerca e filtri per trovare generali, per giocatore, da confermare o in scadenza.",
      "Conferma esplicitamente la lettura quando richiesto: aprire il messaggio non equivale a confermarlo.",
      "Gli aggiornamenti arrivano in tempo reale; usa Aggiorna per ripristinare la connessione se necessario.",
    ],
  },
  {
    title: "Report dei giocatori e della squadra",
    text: "Scegli Giocatore per il dettaglio individuale o Squadra per confrontare tutti i giocatori in una tabella. Risposte WhatsApp e presenze effettive sono indicatori distinti.",
    steps: [
      "Apri Report da Altro oppure dalla scheda del giocatore.",
      "Seleziona la vista e il periodo: stagione, ultimo mese oppure intervallo personalizzato.",
      "Consulta indicatori, grafici e storico; seleziona gli indicatori disponibili per i dettagli.",
      "Nella vista Squadra ordina le colonne; su smartphone scorri la tabella mantenendo il nome visibile. Seleziona un nome per aprire il report individuale nello stesso periodo.",
      "Esporta il PDF orizzontale o il file Excel (.xlsx) con filtri e intestazioni bloccate. I minuti derivano dalle registrazioni delle partite; gli allenamenti non confermati non sono assenze. I giocatori disattivati restano inclusi.",
    ],
  },
  {
    title: "Documenti, tesseramenti e scadenze",
    access: "expiries",
    text: "Questa area aiuta a verificare certificati, documenti e tesseramenti. Un dato mancante è diverso da un documento scaduto. Il presidente vede lo stato sintetico, senza i dettagli amministrativi riservati.",
    steps: [
      "Apri Scadenze da Altro o dalla Home.",
      "Controlla dati mancanti e date da aggiornare.",
      "I ruoli abilitati aggiornano i dati dalla scheda del giocatore; gli altri consultano soltanto le informazioni consentite.",
    ],
  },
  {
    title: "Economia: fondi, movimenti e rendiconto",
    access: "finance",
    text: "Un fondo indica dove sono i soldi: contanti in cassa o conto corrente. Il saldo iniziale è denaro già disponibile, non una nuova entrata. Amministratore e tesoriere gestiscono l’area; il presidente la consulta.",
    steps: [
      "In Fondi crea cassa o conto e inserisci il saldo iniziale reale.",
      "In Movimenti registra ogni incasso come entrata e ogni pagamento come uscita, indicando data, motivo e ricevuta se disponibile.",
      "Un trasferimento sposta denaro tra fondi senza cambiare il totale. Esempio: 200 € iniziali + 100 € ricevuti − 30 € pagati = 270 €.",
      "Verifica saldo confronta i soldi reali con quelli registrati, senza correggerli automaticamente. La chiusura del periodo blocca le registrazioni in quel periodo.",
      "Per correggere un movimento usa Storna: annulla l’effetto conservando lo storico.",
      "Elimina fondo rimuove un fondo inutilizzato con il suo solo saldo iniziale; un fondo già utilizzato si archivia a saldo zero. Non inserire spese fittizie per svuotarlo.",
      "In Rendiconto seleziona il periodo ed esporta PDF o CSV. Storico mostra le operazioni tracciate.",
    ],
  },
  {
    title: "Lavagna tattica e osservazioni",
    access: "technical",
    text: "Le osservazioni tecniche sono riservate ai ruoli tecnici autorizzati. Permessi di consultazione, pianificazione e modifica possono essere diversi.",
    steps: [
      "In Altro → Lavagna tattica crea una lavagna libera o collegala a un allenamento o a una partita. Amministratore, allenatore e collaboratore tecnico condividono le lavagne della squadra.",
      "Usa il campo o carica una foto JPG, PNG o WebP fino a 10 MB. La foto viene ridimensionata e salvata in modo privato insieme ai disegni.",
      "Su smartphone il campo è verticale, con pedine e note leggibili. Apri Dettagli lavagna per titolo e attività. Gli strumenti restano visibili mentre lavori: Scorri muove la pagina, Sposta trascina gli elementi; scegli un altro strumento per disegnare. Le foto mantengono il proprio orientamento.",
      "Scegli freccia, penna o cerchio e trascina; con Nota scrivi il testo e tocca il punto desiderato. Eburum e Avversario aggiungono giocatori numerati; Sposta permette di trascinarli.",
      "Annulla e Ripristina correggono il disegno. Salva lavagna conserva il lavoro per lo staff; Esporta immagine scarica una PNG anche della bozza. Le modifiche di un collega richiedono di riaprire la lavagna; non c’è modifica simultanea in diretta.",
      "Apri l’attività prevista per consultare o compilare il materiale tecnico disponibile.",
      "Inserisci indicazioni e osservazioni negli spazi dedicati e salva.",
      "Le note tecniche riservate non sono visibili a tutti gli utenti della squadra.",
    ],
  },
  {
    title: "Utenti e accessi",
    access: "admin",
    text: "Solo l’amministratore crea le utenze e modifica email, password, nominativi e ruoli degli altri utenti. Ogni account lavora sulla stessa squadra con permessi specifici.",
    steps: [
      "Apri le iniziali in alto e poi Gestione utenti.",
      "Inserisci nome, cognome, email, password iniziale e ruolo.",
      "Controlla l’email prima di comunicare le credenziali; se è errata usa Modifica email sull’utenza esistente.",
      "Assegna il ruolo in base al lavoro svolto. Non condividere l’account amministratore.",
      "Per rimuovere un accesso usa Elimina utenza e conferma il nominativo. L’operazione è definitiva; lo storico della squadra rimane. Non puoi eliminare te stesso o il proprietario.",
    ],
  },
  {
    title: "Installazione sul telefono e aggiornamenti",
    text: "Puoi installare Eburum sulla schermata Home del telefono per aprirla come app. Per salvare e ricevere aggiornamenti serve una connessione.",
    steps: [
      "Su iPhone apri il sito in Safari, usa Condividi e Aggiungi alla schermata Home.",
      "Su Android usa l’opzione Installa app o Aggiungi alla schermata Home del browser.",
      "Quando compare Aggiornamento disponibile, salva le bozze e premi Ricarica.",
      "Se un salvataggio fallisce, verifica la connessione e riprova mantenendo i dati inseriti.",
    ],
  },
];
export function UserGuide({ role }: { role: string }) {
  const [open, setOpen] = useState(false),
    [query, setQuery] = useState("");
  const visible = topics.filter(
    (t) =>
      !t.access ||
      (t.access === "finance" && canViewFinanceRole(role)) ||
      (t.access === "expiries" && canViewExpiriesRole(role)) ||
      (t.access === "technical" && canTechnicalRole(role)) ||
      (t.access === "admin" && role === "admin"),
  );
  const search = query.trim().toLocaleLowerCase("it");
  const results = visible.filter((t) =>
    [t.title, t.text, ...t.steps]
      .join(" ")
      .toLocaleLowerCase("it")
      .includes(search),
  );
  return (
    <>
      <Tooltip label="Guida all’app">
        <Button
          variant="secondary"
          size="icon"
          aria-label="Guida all’app"
          onClick={() => {
            setQuery("");
            setOpen(true);
          }}
        >
          <BookOpen />
        </Button>
      </Tooltip>
      <Dialog
        open={open}
        onOpenChange={setOpen}
        title="Guida a Eburum"
        description="Istruzioni pratiche per il lavoro quotidiano dello staff."
      >
        <div className="user-guide">
          <section className="guide-role">
            <h2>
              Il tuo ruolo:{" "}
              {roleLabels[role as keyof typeof roleLabels] || "Staff"}
            </h2>
            <p>
              {roleHelp[role as keyof typeof roleHelp]}
              {role === "president"
                ? " Consulta anche l’Economia in sola lettura."
                : ""}
            </p>
            <p>
              Le sezioni consultabili possono mostrare meno azioni rispetto a
              quelle descritte: valgono sempre i permessi del tuo ruolo.
            </p>
          </section>
          <label className="guide-search">
            <Search size={18} aria-hidden="true" />
            <Input
              type="search"
              aria-label="Cerca nella guida"
              placeholder="Cerca un argomento…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>
          <p className="guide-result" role="status">
            {results.length} argomenti
          </p>
          {results.length ? (
            results.map((t) => (
              <details
                key={t.title}
                className="guide-topic"
                open={search ? true : undefined}
              >
                <summary>{t.title}</summary>
                <div>
                  <p>{t.text}</p>
                  <ol>
                    {t.steps.map((s) => (
                      <li key={s}>{s}</li>
                    ))}
                  </ol>
                </div>
              </details>
            ))
          ) : (
            <p>
              Nessun argomento trovato. Prova con “presenze”, “cassa” o
              “comunicazioni”.
            </p>
          )}
        </div>
      </Dialog>
    </>
  );
}
