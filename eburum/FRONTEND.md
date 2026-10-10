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

`verify` esegue TypeScript, build, 32 test dei moduli operativi e del collegamento React, e 2 test sulla PWA compilata. Le prove browser sono separate: verificano anche layout e interazioni effettive, con dati sintetici. `npm run format:check` controlla la formattazione dei nuovi sorgenti.

## Architettura e confini

`src/main.tsx` avvia un solo runtime e una sola radice React. `src/app.tsx` contiene accesso, navigazione, scelta della stagione e struttura responsive. Le rotte hash mantengono link diretti, ricaricamento e cronologia senza richiedere un server applicativo. React è un client della piattaforma Supabase; questa implementazione non introduce SSR o Next.js.

`src/pages.tsx` contiene le liste di allenamenti, partite e rosa, le riunioni e gli strumenti. `src/communications.tsx` gestisce ricerca, filtri, pubblicazione, scadenze e rimozione. Oltre 80 messaggi usa TanStack Virtual con altezze misurate e overscan, mantenendo la lista scorrevole; le liste brevi restano normali contenuti HTML. Il testo delle comunicazioni viene reso come testo semplice, con ritorni a capo e protezione dall'HTML eseguibile.

`src/runtime.ts` espone azioni e uno store con snapshot per `useSyncExternalStore`. Il presentation adapter in `app-part1.js` impedisce ai moduli operativi di sostituire la radice gestita da React. Le notifiche delle comunicazioni aggiornano uno snapshot separato e non ricreano gli editor o cancellano le selezioni di un report.

La migrazione è incrementale. Dashboard, report, registro e presenze effettive conservano il rendering dei moduli ES JavaScript, ospitato da `FeatureSurface` in un contenitore isolato. Anche gli editor sportivi, le schede e la gestione amministrativa restano nei moduli collaudati. Non sono ancora componenti React né sono controllati integralmente da TypeScript (`allowJs: true`, `checkJs: false`). Le future conversioni devono mantenere revisioni, atomicità, audit, controllo squadra e comportamento dei conflitti, aggiungendo verifiche prima di sostituire ogni editor. Non aggiungere nuove scritture alla radice `#app` o modifiche dell'HTML tramite sostituzioni di stringhe.

## Componenti e stile

Tailwind CSS 4 e componenti locali secondo le convenzioni shadcn/ui, basati su primitive Radix per dialoghi, tooltip e composizione dei pulsanti. `components.json` documenta alias e configurazione. I componenti appartengono al progetto e sono in `src/components/ui`; non dipendono da una libreria di componenti remota al caricamento della pagina.

Il CSS operativo precedente è importato nel layer `legacy`. I token e le utility del nuovo frontend hanno precedenza esplicita. Palette navy, crema e oro conservata; caratteri di sistema, controlli da almeno 44 px, bordi leggibili. Lucide fornisce le nuove icone. Motion usa `LazyMotion`: indicatore della navigazione selezionata e brevi transizioni delle comunicazioni, con rispetto di `prefers-reduced-motion`.

La sidebar desktop è comprimibile e ricorda la preferenza locale. Sotto 1024 px viene sostituita dalla navigazione a cinque voci, con spazio per la safe area. La bozza delle presenze resta separata dalle risposte WhatsApp. La pubblicazione delle comunicazioni ha protezione dagli invii doppi, conservazione dei campi dopo errore e conferma prima di abbandonare una bozza.

## Permessi e Realtime

La UI usa il ruolo restituito da `team_context`; le policy RLS e le funzioni server restano l'autorità per ogni operazione. Solo l'amministratore vede la gestione delle utenze. L'allenatore non modifica la rosa; il segretario consulta le attività sportive e gestisce la parte amministrativa. Il livello React non concede permessi aggiuntivi.

Le comunicazioni mantengono una sola sottoscrizione privata per squadra, senza polling del database. Broadcast, riconnessione e ritorno online ricaricano i messaggi autorizzati. Un orologio locale aggiorna le scadenze visibili senza richieste di rete. La rimozione definitiva alla scadenza rimane affidata alla pulizia server esistente.

## Build, PWA e distribuzione

`vite.config.ts` emette in `dist` bundle con nomi hash, CSS, configurazione pubblica, manifest, icone e jsPDF. I sorgenti, test, documentazione e fixture non sono copiati nella distribuzione. I due script classici `config.js` e jsPDF sono intenzionali: Vite segnala che non sono bundlati, ma il plugin li copia e i test ne verificano la disponibilità. La configurazione contiene solo URL e chiave anonima pubblica; nessuna chiave amministrativa deve entrare nel frontend.

`src/sw-template.js` genera il worker della build, con l'elenco effettivo degli asset. Conserva solo risorse statiche, verifica il MIME dei file JS/CSS, lascia fuori le API e non elimina cache di altre applicazioni. Il manifest usa percorsi assoluti, così funziona anche quando Vite lo pubblica nella cartella `assets`. Le icone PNG da 180, 192, 512 px e la maskable separata sono mantenute.

Un aggiornamento attende il comando Ricarica. La UI evita il ricaricamento durante salvataggi e richiede conferma per le bozze. La modalità offline rende disponibile la struttura già installata; non promette salvataggi o dati di squadra disponibili senza connessione.

Vercel usa la root `eburum`, Node.js 24, `npm ci`, `npm run build`, output `dist`, come descritto in `vercel.json`. Per distribuire verificare il commit effettivo, lo stato READY e gli asset sul dominio. La cronologia precedente statica rimane recuperabile dal relativo deployment.
