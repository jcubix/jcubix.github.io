# Frontend Eburum

Il frontend usa React, TypeScript con controlli strict e Vite. Supabase rimane il servizio per autenticazione, dati, permessi e aggiornamenti delle comunicazioni. Non sono state aggiunte chat IA, API di inferenza o sondaggi interni.

## Avvio e verifiche

Richiede Node.js 24 e npm. Da `eburum`:

```sh
npm ci
npm run dev
```

Per verificare la versione distribuibile:

```sh
npm --prefix tests ci
npm run verify
npm run preview
```

`verify` esegue TypeScript, build, 51 test dei moduli operativi e del presentation adapter, 111 test dei componenti React effettivi e 3 test sulla PWA compilata: 165 in totale. Le prove browser sono separate: verificano anche layout e interazioni effettive, con dati sintetici. `npm run format:check` controlla la formattazione dei nuovi sorgenti. I risultati sul database reale sono documentati in [AUDIT_MIGRATION.md](AUDIT_MIGRATION.md).

## Architettura e confini

`src/main.tsx` avvia un solo runtime e una sola radice React. `src/app.tsx` contiene accesso, navigazione, scelta della stagione e struttura responsive. Le rotte hash mantengono link diretti, ricaricamento e cronologia senza richiedere un server applicativo. React è un client della piattaforma Supabase; questa implementazione non introduce SSR o Next.js.

`src/pages.tsx` contiene le liste di allenamenti, partite e rosa, le riunioni e gli strumenti. `src/communications.tsx` gestisce ricerca, filtri, pubblicazione, scadenze e rimozione. Oltre 80 messaggi usa TanStack Virtual con altezze misurate e overscan, mantenendo la lista scorrevole; le liste brevi restano normali contenuti HTML. Il testo delle comunicazioni viene reso come testo semplice, con ritorni a capo e protezione dall'HTML eseguibile.

`src/runtime.ts` espone azioni e uno store con snapshot per `useSyncExternalStore`. Il presentation adapter in `app-part1.js` impedisce ai moduli operativi di sostituire la radice gestita da React. Le notifiche delle comunicazioni aggiornano uno snapshot separato e non ricreano gli editor o cancellano le selezioni di un report.

La migrazione è incrementale. Dashboard, report, registro e presenze effettive conservano il rendering dei moduli ES JavaScript, ospitato da `FeatureSurface` in un contenitore isolato. Anche gli editor sportivi, le schede e la gestione amministrativa restano nei moduli collaudati. Non sono ancora componenti React né sono controllati integralmente da TypeScript (`allowJs: true`, `checkJs: false`). Le future conversioni devono mantenere revisioni, atomicità, audit, controllo squadra e comportamento dei conflitti, aggiungendo verifiche prima di sostituire ogni editor. Non aggiungere nuove scritture alla radice `#app` o modifiche dell'HTML tramite sostituzioni di stringhe.

## Componenti e stile

Tailwind CSS 4 e componenti locali secondo le convenzioni shadcn/ui, basati su primitive Radix per dialoghi, tooltip e composizione dei pulsanti. `components.json` documenta alias e configurazione. I componenti appartengono al progetto e sono in `src/components/ui`; non dipendono da una libreria di componenti remota al caricamento della pagina.

Il CSS operativo precedente è importato nel layer `legacy`. I token e le utility del nuovo frontend hanno precedenza esplicita. Club Office usa navigazione navy, superfici bianche su fondo grigio azzurrato, azioni principali navy con testo bianco e oro riservato a stati di attenzione e focus; caratteri di sistema, controlli da almeno 44 px, bordi leggibili. Lucide fornisce le nuove icone. Le animazioni usano CSS e Web Animations API, senza la dipendenza Motion: indicatore della navigazione selezionata e brevi transizioni, con rispetto di `prefers-reduced-motion` e della navigazione da tastiera.

La navigazione desktop è una sidebar; sotto 1024 px diventa una barra a cinque voci. La barra superiore e il contenuto riservano gli inset della safe area anche su iPhone in orizzontale. La bozza delle presenze resta separata dalle risposte WhatsApp. La pubblicazione delle comunicazioni ha protezione dagli invii doppi, conservazione dei campi dopo errore e conferma prima di abbandonare una bozza.

## Permessi e Realtime

La UI usa il ruolo restituito da `team_context`; le policy RLS e le funzioni server restano l'autorità per ogni operazione. Solo l'amministratore vede la gestione delle utenze. L'allenatore non modifica la rosa; il segretario consulta le attività sportive e gestisce la parte amministrativa. Il livello React non concede permessi aggiuntivi.

Le comunicazioni mantengono una sola sottoscrizione privata per squadra, senza polling del database. Broadcast, riconnessione e ritorno online ricaricano i messaggi autorizzati. Un orologio locale aggiorna le scadenze visibili senza richieste di rete. La rimozione definitiva alla scadenza rimane affidata alla pulizia server esistente.

## Build, PWA e distribuzione

`vite.config.ts` emette in `dist` bundle con nomi hash, CSS, configurazione pubblica, manifest, icone e jsPDF. I sorgenti, test, documentazione e fixture non sono copiati nella distribuzione. `config.js` è lo script classico di configurazione pubblica. jsPDF resta un file statico caricato soltanto al primo export, tramite il loader condiviso con timeout e possibilità di riprovare; non è nello script iniziale né nel bundle principale. Il plugin copia i file necessari e i test ne verificano la disponibilità. La configurazione contiene solo URL e chiave anonima pubblica; nessuna chiave amministrativa deve entrare nel frontend.

`src/sw-template.js` genera il worker della build, con l'elenco effettivo degli asset. Conserva solo risorse statiche, verifica il MIME dei file JS/CSS, lascia fuori le API e non elimina cache di altre applicazioni. Il manifest usa percorsi assoluti, così funziona anche quando Vite lo pubblica nella cartella `assets`. Le icone PNG da 180, 192, 512 px e la maskable separata sono mantenute.

Un aggiornamento attende il comando Ricarica. La UI evita il ricaricamento durante salvataggi e richiede conferma per le bozze. La modalità offline rende disponibile la struttura già installata; non promette salvataggi o dati di squadra disponibili senza connessione.

Vercel usa la root `eburum`, Node.js 24, `npm ci`, `npm run build`, output `dist`, come descritto in `vercel.json`. Per distribuire verificare il commit effettivo, lo stato READY e gli asset sul dominio. La cronologia precedente statica rimane recuperabile dal relativo deployment.

## Club Office e nominativi dello staff

La home mostra il nome salvato dal server o un saluto neutro quando manca. In Gestione staff, un amministratore inserisce nome e cognome alla creazione e può modificarli anche per le utenze esistenti, inclusa la propria. Il nominativo non concede permessi e non cambia email o password. Le modifiche del proprio nome aggiornano immediatamente la home. Il server normalizza gli spazi e Unicode, limita ogni campo a 80 caratteri e rifiuta i caratteri di controllo.

Altro raggruppa gli strumenti della squadra secondo i permessi. Messaggi comprende gli inviti alle riunioni e gli appuntamenti precedenti; scadenze, utenti ed Economia mantengono le rispettive autorizzazioni. La migrazione `20261010212740_staff_personal_names.sql` aggiunge i nomi senza modificare i registri sportivi. La funzione `manage-users` mantiene autenticazione e controllo del ruolo sul server, anche negli ambienti locali e preview esplicitamente autorizzati da CORS.

Il precedente bootstrap `app-main.js` e il worker sorgente `sw.js` sono rimossi. Il bootstrap attivo è `src/main.tsx`, la registrazione delle estensioni passa dal runtime e la build genera il worker da `src/sw-template.js`.


## Riallineamento al prototipo Club Office

Gli editor di allenamenti e partite sono montati in `#workspaceEditor`, un contenitore esterno alle pagine React, tramite `setWorkspaceEditorPresenter`. Il presenter non usa ricerca e sostituzione del markup. `closeWorkspaceEditors` mantiene le protezioni per bozze e salvataggi, e blocca la navigazione mentre un dialogo annidato è aperto. L'uscita dalla sessione rimuove anche gli editor. Le azioni di salvataggio e i controlli del database rimangono quelli dei moduli operativi.

L'allenamento separa Risposte WhatsApp e Presenze effettive. Una risposta non diventa una presenza prima della verifica e conferma; le date future restano protette. I comandi di salvataggio rimangono visibili durante lo scorrimento. La partita mette a disposizione Gol, Ammonizione, Sostituzione e altri eventi dalla cronologia. Le modalità di minuti manuali e automatici mantengono lo storico.

La rosa è un elenco per ruolo con iniziali, nome, ruolo e avvisi disciplinari; scheda, modifica e rimozione/restauro sono accessibili dalla scheda o dal menu della riga. I report usano un selettore giocatore/periodo e un unico documento; Personalizzato espone le date. Dettagli degli indicatori, grafici, storico, copia e PDF restano operativi. Le comunicazioni hanno ricerca, filtri e aggiornamento in una barra compatta e una colonna esplicativa sul desktop.

Verifica browser del riallineamento: 9 pagine a 7 larghezze (320, 390, 586, 614, 768, 1280 e 1440 px), 63 combinazioni senza overflow orizzontale o campi sotto 16 px sui telefoni. Le catture includono editor, staff e il formato 586×884 del browser dell'utente. I dati browser sono sintetici e isolati; non vengono scritti nel database reale.

## Revisione del 13 ottobre 2026

Il compilatore rifiuta ora import e parametri inutilizzati. Economia usa la guardia di sessione condivisa anche quando lo stesso utente rientra nella stessa squadra. I listener della PWA vengono rimossi allo smontaggio. Gli override CSS duplicati e gli indicatori di navigazione sostituiti sono stati rimossi; entrambe le palette conservano gli stessi componenti e controlli. `npm run verify` e `npm run format:check` costituiscono i controlli locali richiesti.

Allenamenti mostra esclusivamente attività in programma e presenze da confermare. Il Registro evidenzia anche le attività annullate o senza sessione e collega alle schede degli allenamenti. Le schede aperte dal Registro mantengono pagina e giorno selezionato alla chiusura; le policy sportive restano quelle esistenti.


## Verifica browser e handoff del 25 ottobre 2026

`npm --prefix tests run browser` esegue Playwright Chromium con il runtime effettivo e dati sintetici isolati. Il server locale viene avviato e fermato dal runner. Richiede prima `npm ci`, `npm --prefix tests ci` e `npm --prefix tests exec -- playwright install chromium`.

Il workflow `.github/workflows/verify.yml` nella root del repository contiene un job browser dopo `verify`: sei sezioni, temi chiaro/scuro, telefono/desktop, controlli axe WCAG 2 A/AA e 2.1 AA, conferme, bozza riunione fallita/ritentata, safe area e uscita dei dialoghi. Conserva report, screenshot e tracce di errore per sette giorni. Il job e gli eventuali check obbligatori diventano attivi su GitHub dopo la pubblicazione dei sorgenti; i controlli locali non dimostrano che le regole di protezione dei branch siano configurate.

Le 24 baseline in `tests/browser/baselines/` verificano geometria e palette, con tolleranza di 2 px per le misure. Le catture PNG rimangono nel report HTML per la revisione visiva. Non è un confronto pixel per pixel né un test Safari o hardware. Per aggiornare le baseline dopo una modifica intenzionale, impostare `EBURUM_UPDATE_LAYOUT=1` e avviare il runner localmente, quindi rivedere catture e diff; il runner vieta gli aggiornamenti in CI.

L’osservatore globale della navigazione segue solo l’inserimento/rimozione delle barre. Gli attributi e i testi vengono osservati nei singoli contenitori, con disconnessione alla rimozione; il termine del feedback di pressione riallinea l’indicatore. La pagina viene rimontata solo al cambio della pagina accettata dal runtime, mai per una semplice variazione della query o un refresh: le guardie delle bozze restano operative.

Le azioni asincrone usano `confirmDialog`; le guardie di navigazione con contratto sincrono conservano la conferma nativa per continuare a bloccare correttamente l’abbandono. La conversione restante richiede prima un protocollo asincrono condiviso, con regressioni sui conflitti e sullo scarto delle bozze. La migrazione degli editor legacy resta incrementale: non eliminare i moduli operativi mentre `FeatureSurface` li usa.

Lo stato puntuale dell’handoff e le condizioni esterne ancora necessarie sono in [HANDOFF-STATUS-2026-10-25.md](HANDOFF-STATUS-2026-10-25.md).
