# Eburum — handoff della coordinatrice al collaboratore

25 ottobre 2026. Aggiornamento dopo la revisione UI, la correzione iPhone e l’integrazione del pacchetto `eburum-handoff-completo.zip`.

## Stato da cui ripartire

- Applicazione: https://eburum.vercel.app
- Ultimo deployment verificato: `dpl_889BZpuJVZyQ76pRNzMeP38beqSF`, stato READY.
- Commit locale: `498863d243a263d8d1363a288b0a0ace83c222e4`.
- **Il lavoro successivo è nel working tree, non nel commit. Non sono stati eseguiti commit o push.** Non usare il solo HEAD per valutare ciò che è implementato; non resettare, pulire o sovrascrivere il checkout.
- Cartella applicazione: `C:/Users/Giacomo/Documents/Codex/2026-10-07/files-pasted-by-the-user-codex/work/repository/eburum`.
- Root Git: la cartella superiore `work/repository`; il workflow è in `.github/workflows/verify.yml` nella root Git.
- Nei riferimenti dei sorgenti usare il nome Git `src/app.tsx`, minuscolo, anche se Windows accetta `App.tsx`.

Il pacchetto originale è stato confrontato semanticamente con il codice attuale. **Non riapplicare le vecchie patch automaticamente:** molte descrivono difetti già risolti e alcuni valori di stile sono stati sostituiti da decisioni più recenti dell’utente.

## Già presente prima dell’ultima integrazione

Confermati errori di login tradotti, tastiere numeriche per maglia/minuti, header di sicurezza e cache Vercel, jsPDF condiviso caricato su richiesta, chevron dei collassabili, badge attività, palette chiara/scura, barre di salvataggio e spazio per la navigazione. Conferme distruttive e helper `confirmDialog` erano già in uso. Il caricamento sportivo era già limitato alla stagione e le comunicazioni avevano aggiornamenti mirati.

Il confronto completo è in `HANDOFF-STATUS-2026-10-25.md`: contiene anche le prove e le eccezioni, non solo una checklist di completamento.

## Modifiche eseguite

### 1. Revisione dei controlli e del layout

- Corretti contrasto degli stati selezionati delle presenze in dark, azioni troppo compresse e testi tagliati sugli schermi stretti.
- Presenze e Nota condividono un gruppo di quattro azioni; disposizione mobile 2×2.
- Sistemati filtri e date di Economia, scelta del tipo evento, righe giocatore con avviso disciplinare e larghezze del dock.
- Tab partita con una sola tappa Tab, frecce/Home/End, associazioni `aria-controls`/`aria-labelledby` e protezione delle bozze.
- Button/Input/Dialog usano i token approvati. Chiusure legacy normalizzate con l’icona outline condivisa.
- Token da preservare: controlli 10 px, card/dialog 16 px; palette navy/oro e Figtree per il corpo. Non sostituire questi valori con quelli suggeriti nel vecchio pacchetto.

File principali: `app-dialogs.js`, `app-part3.js`, `app-team.js`, `src/design-system.css`, `src/components/ui/button.tsx`, `input.tsx`, `dialog.tsx`.

### 2. Correzione specifica iPhone e Home

- Una regola mobile sovrascriveva il padding con safe area: i comandi finivano nella zona dell’orologio/notch. La barra mantiene ora un’altezza utile minima di 64 px più inset superiore e rispetta gli inset laterali anche in orizzontale.
- Eliminata la somma di margine e padding sopra il contenuto: restano 20 px sotto la barra.
- Benvenuto mobile a 28 px, nome senza a capo forzato, data con distanza di 8 px.
- Rimosso il selettore stagione duplicato sotto il benvenuto e il relativo gestore. La stagione è indicata sotto il marchio; **su telefono si modifica dal menu delle iniziali dell’account**. Su desktop resta anche il selettore superiore.
- Il menu account scorre se l’altezza disponibile è ridotta.

File: `src/app.tsx`, `src/design-system.css`, `src/runtime.ts`, `app-operations.js`. Non reintrodurre `[data-home-season]` o il relativo listener.

### 3. Animazioni e alleggerimento

- Rimossa la dipendenza `motion` e le primitive usate per il solo fade dei messaggi. Riutilizzati CSS e Web Animations API.
- Bundle principale: 362.812 → 283.615 byte, **79.197 byte in meno**, non compressi. È il confronto con la versione precedente, non la dimensione totale dell’app.
- Entrata della pagina sul contenitore completo; `key={snapshot.page}` usa la pagina accettata dal runtime. Non sostituire la chiave con query, revisione o percorso ancora da approvare: si rischia di cancellare lo stato delle bozze.
- Press comune a 0,97 per i controlli; percorso immediato da tastiera e con movimento ridotto. Il feedback delle icone nav resta distinto.
- Uscita dialog e dissolvenza overlay completate. In `dialog.tsx`, **Radix Content possiede il positioner**; il pannello visivo è interno. Questa struttura permette di attendere l’animazione prima dello smontaggio, conservando focus e chiusura.
- MutationObserver: sul body solo inserimento/rimozione delle barre; classi, ARIA e testo osservati nei contenitori registrati. Disconnessione alla rimozione e riallineamento al termine del press.
- Toast ravvicinati: il nuovo sostituisce il precedente. Corretto lo sfondo interno della ricerca dark.

File: `src/app.tsx`, `src/communications.tsx`, `src/navigation-motion.ts`, `src/components/ui/dialog.tsx`, `src/design-system.css`, `src/soft-club-reference.css`, `app-part1.js`, `package.json` e lockfile.

### 4. Conferme e dati

- Convertite altre **nove azioni asincrone** a `confirmDialog`: cambio tab creazione utente, cambio sessione presenze, controllo finale partita, ricaricamento partita, apertura report da scheda, passaggio alle presenze, ritorni dalle presenze e aggiornamento PWA con bozza.
- **Restano 14 conferme native nei percorsi con contratto sincrono.** Non sostituirle meccanicamente con Promise: chiusura e navigazione devono continuare a poter rifiutare l’abbandono. La conversione richiede prima un protocollo condiviso e test delle guardie.
- Attivazione/disattivazione del giocatore: la UI usa la riga autorevole restituita dal server e non ricarica lo storico sportivo. Gli altri salvataggi mantengono il refresh di stagione dove serve a riallineare dati collegati.

File: `app-admin.js`, `app-part3.js`, `app-team.js`, `app-training-planning.js`, `app-workflows.js`, `src/pwa.tsx`, `src/runtime.ts`.

### 5. Test e CI

- `npm run verify`: **165 test superati**, suddivisi in 51 dominio/runtime, 111 frontend e 3 build/PWA.
- `npm --prefix tests run browser`: **38 casi superati**; due casi notch non applicabili ai progetti desktop.
- Sei sezioni × due temi × telefono/desktop: 24 verifiche con axe WCAG 2 A/AA e 2.1 AA; screenshot e 24 baseline di geometria/palette con tolleranza di 2 px.
- Coperti anche cancellazione/annullamento di un messaggio, bozza riunione dopo errore, retry senza duplicati, safe area, uscita dei dialoghi e movimento ridotto.
- Il runner usa client e dati sintetici; blocca richieste HTTP verso origini esterne. Nessuna credenziale reale richiesta.
- Aggiunto un job browser dopo `verify` in `.github/workflows/verify.yml`, con versioni/revisioni fissate e conservazione degli artefatti per sette giorni. **Workflow pronto nel working tree, non attivato da questa sessione su GitHub.** Protezione branch e check obbligatori non configurati/verificati.
- Dipendenze aggiunte solo ai test: `@playwright/test@1.64.1`, `@axe-core/playwright@4.14.0`.

File: `tests/playwright.config.cjs`, `tests/browser/ui.spec.cjs`, `tests/browser/baselines/`, `tests/fixtures/browser.html`, `tests/fixtures/react-entry.tsx`, test Node aggiornati, `tests/package.json` e lockfile, workflow nella root Git.

Comandi dalla cartella `eburum`:

```sh
npm ci
npm --prefix tests ci
npm run verify
npm --prefix tests exec -- playwright install chromium
npm --prefix tests run browser
```

Non aggiornare le baseline per far passare un difetto. `EBURUM_UPDATE_LAYOUT=1` è riservato all’aggiornamento locale dopo una modifica intenzionale e revisione delle immagini; il runner lo vieta in CI. Le baseline sono geometriche/cromatiche, **non un confronto pixel per pixel**.

## Database: verificato e non modificato

Audit in sola lettura sul progetto `xwbbaruyhyzsnnfcahss`:

- Vincoli su stati attività/presenze, minuti 0–130 e collegamenti squadra già presenti e validati.
- RLS sulle cinque tabelle finanziarie; lettura per squadra e ruoli admin/tesoriere/presidente. Nessun grant diretto di scrittura ad anon/authenticated.
- Mutazioni finanziarie private con controllo admin/tesoriere, request-id e lock squadra. I test SQL esistono, ma non sono stati rieseguiti sulla produzione.
- Mancava il CHECK per maglia non negativa. Preflight: zero valori negativi. Preparata `supabase/migrations/20261025185548_player_shirt_number_integrity.sql`, **non applicata**, perché l’handoff richiede prima staging.
- Risulta un solo progetto Supabase e nessun branch di sviluppo: staging non disponibile.

Nessuna scrittura su dati reali, nessuna migrazione applicata, nessuna modifica a utenze o fondi.

## Pubblicazione verificata

Deployment READY `dpl_889BZpuJVZyQ76pRNzMeP38beqSF` sul dominio Eburum. I 23 file pubblici coincidono tramite SHA256 con il pacchetto compilato verificato. Accesso pubblico visibile senza errori JavaScript o console; nessuna fixture pubblicata. Presenti i sei header di sicurezza richiesti.

**Il deploy statico non pubblica il workflow GitHub né applica migrazioni Supabase.** I sorgenti successivi a HEAD restano locali.

## Attività ancora aperte, in ordine consigliato

1. Predisporre uno staging separato; poi applicare e validare la migrazione della maglia ed eseguire i test SQL e i flussi server con due account.
2. Verificare/pubblicare il working tree in modo controllato; attivare la CI e selezionare i check obbligatori su GitHub. Nessun reset o push indiscriminato.
3. Configurare monitoraggio errori client senza PII e uptime: servizio/destinatario ancora da scegliere e configurare.
4. Decisioni del proprietario: leaked-password protection risulta disabilitata; MFA e backup/PITR non verificati. `claim_eburum_seed` è ancora eseguibile dagli autenticati: la rimozione resta subordinata alla conferma dell’importazione prevista dall’handoff. Non eliminare la funzione senza tale conferma.
5. Proseguire la migrazione legacy una schermata per volta. `FeatureSurface` e gli editor operativi sono ancora usati: non cancellarli. Preservare permessi server, atomicità, revisioni, request-id, audit, isolamento squadra e bozze; convertire poi le guardie sincrone residue.
6. Collaudo su iPhone/Android fisici e Safari/WebKit, inclusi tastiera e safe area reali.

Non aggiungere policy pubbliche a `private_access.finance_requests` per eliminare il rilievo INFO dell’advisor: è una tabella interna gestita dalla funzione privilegiata.

## Evidenze nel checkout

- `HANDOFF-STATUS-2026-10-25.md`: confronto completo con il pacchetto originale.
- `output/handoff-release.json`, `output/handoff-public-assets.json`, `output/handoff-security-headers.json`: release e pubblicazione.
- `output/playwright/handoff-verify-release.txt`, `handoff-browser-release.txt`, `handoff-production-smoke.txt`: esiti finali.
- `output/handoff-completo-audit-2026-10-25/readonly-evidence.json`: audit DB in sola lettura.
- `.impeccable/review/handoff-2026-10-25/detector.json`: nessuna segnalazione sui file controllati.
- `.impeccable/review/iphone-header-2026-10-25/IPHONE-HEADER.md`: correzione iPhone e relative misure.
- `.impeccable/review/control-audit-2026-10-25/CONTROL-AUDIT.md`: revisione precedente dei controlli.

I report precedenti riportano 162 test e altri campioni visuali: sono evidenze storiche con ambito diverso. Il riferimento per l’ultima release è **165 + 38**, non la somma dei conteggi dei report.

## Limiti e contenuto dell’archivio

Verifiche browser su Chromium/Windows, dati sintetici e inset simulati. Non certificano l’intero standard WCAG né provano salvataggi/realtime su un DB di staging o hardware iPhone/Safari.

Lo ZIP di consegna contiene questo handoff, i rapporti e i metadati di release. **Non contiene il progetto completo o una patch del working tree**, né password o chiavi riservate. Chi non ha accesso al checkout attuale non può ricostruire i sorgenti dell’ultima release dal solo commit o da questo archivio.
