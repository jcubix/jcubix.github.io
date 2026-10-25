# Eburum — verifica e applicazione dell’handoff

25 ottobre 2026. Pacchetto esaminato: `eburum-handoff-completo.zip`, 18 file, SHA256 `0c711eeb2e5ab8951ba8b91287b5ee438454441cc66adb13ca58e6b0908e8edf`. Base indicata: `498863d`, con numerose modifiche successive non committate. Non sono state applicate le patch alla cieca né ripristinati file vecchi.

## Esito operativo

La parte funzionale e grafica del pacchetto era in larga misura già implementata. Sono state completate le lacune circoscritte descritte sotto, aggiunti controlli browser ripetibili e documentati i requisiti che restano esterni o architetturali. Questo rapporto non dichiara chiusa l’intera migrazione React, né un collaudo server che non è stato eseguito.

## Confronto punto per punto

| Richiesta | Stato verificato e intervento |
|---|---|
| Errori login in italiano | Già presenti nel componente di accesso; conservate traduzione e protezione dei dettagli tecnici. La patch precedente non è necessaria. |
| Tastiera numerica per maglia e minuti | Già presenti `inputmode` numerico, tipo e validazioni nei moduli operativi. Nessuna duplicazione di form. |
| Header sicurezza e cache | Già presenti in `vercel.json`: CSP, X-Frame-Options, nosniff, Referrer/Permissions Policy, HSTS e cache degli asset con hash. Verifica della risposta pubblica annotata nella sezione pubblicazione. |
| Spazio sotto la navbar | Già corretto con clearance condivisa e safe area; preservata anche la correzione iPhone appena pubblicata. I test browser proteggono barra superiore e bersagli di almeno 44 px. |
| Chevron dei collassabili | Già implementati, con rotazione e percorso senza movimento; nessuna seconda libreria di icone. |
| Spaziature, larghezze e colonne partita | Già disciplinate dai token e dalle regole responsive attuali. Non riapplicate le vecchie misure che precedono la scheda partita semplificata. |
| Primario dark, stato attività, salva partita | Già presenti palette semantica, badge e barra di salvataggio nei layout previsti. I test aggiunti verificano sei sezioni, entrambi i temi e due formati. |
| Radius, ripetizione WhatsApp, KPI | Il sistema attuale usa token approvati (10 px controlli, 16 px card); i KPI vanno a capo e la duplicazione della prima voce è già stata eliminata. Conservate queste scelte anziché importare i valori alternativi del vecchio handoff. |
| Uscita dialog e overlay | Completata. CSS di apertura/uscita e struttura Radix corretta: il positioner è posseduto da Content, che attende la fine dell’animazione. Verificati i nomi delle animazioni effettive e lo smontaggio; con movimento ridotto la chiusura è immediata. |
| Entrata pagina | Ora anima il contenitore completo; la chiave usa la pagina accettata dal runtime, non la query o un percorso respinto dalle guardie. Nessun remount causato dal semplice aggiornamento dei dati. |
| Press e hover | Un solo press dei controlli a 0,97, escluso da tastiera e con movimento ridotto; il feedback delle icone nav resta distinto. Hover discreto sulle righe interattive. Le card statiche non sono trasformate in falsi pulsanti. |
| Motion / peso bundle | Rimossa la dipendenza Motion e le sue primitive per il solo fade delle comunicazioni. Riutilizzati CSS e Web Animations API. Riduzione del bundle principale: circa 79 KB non compressi rispetto al pacchetto precedente. |
| MutationObserver | Il body osserva solo inserimento/rimozione delle barre; classi, ARIA e testo sono osservati nei contenitori registrati. Gli observer si scollegano alla rimozione. I cambi di classe estranei non schedulano frame; nuova barra e nuova selezione continuano ad aggiornarsi. |
| Font e ruolo dell’oro | Scelte opzionali di identità, non difetti funzionali: mantenuti il font dei titoli e la palette approvati in DESIGN.md. Non serve aggiungere una variante visiva concorrente. |
| Rifiniture minori | Risolto l’accavallamento dei toast: il nuovo feedback sostituisce il precedente. Corretta anche la superficie interna della ricerca dark. Non aggiunti sweep decorativi o maschere che oscurino i filtri: restano suggerimenti facoltativi, non bug. |
| Lazy-load jsPDF | Già presente `app-pdf-loader.js`, condiviso da report, tabellino ed Economia, con timeout, retry e messaggio di errore. Non è caricato dallo script iniziale; resta disponibile nel pacchetto/PWA. |
| CI su PR | Il job `verify` esisteva già. Aggiunto un job browser successivo, con dipendenze e action bloccate a versioni/revisioni precise, report e tracce. Workflow pronto localmente; non è stato effettuato un push e non si dichiara attivata la protezione branch su GitHub. |
| Playwright, regressione, axe | Nuova suite eseguibile: 38 casi applicabili su Chromium, 24 controlli di pagina con axe WCAG 2 A/AA e 2.1 AA, screenshot e 24 baseline di geometria/palette. Tolleranza geometrica 2 px; non è un confronto pixel per pixel. Due casi notch non si applicano ai progetti desktop. I dati sono sintetici e le richieste HTTP esterne sono bloccate. |
| Dati mirati | Il caricamento per stagione e le comunicazioni mirate esistevano già. Attivazione/disattivazione giocatore ora applica la riga autorevole restituita dal server senza ricaricare presenze, eventi o storico. Gli altri salvataggi sportivi conservano il refresh della stagione per coerenza dei dati collegati; non si dichiara un sistema incrementale completo. |
| Vincoli DB | Verificati in sola lettura sul DB reale: stati attività/presenze, minuti 0–130, collegamenti squadra e altri vincoli sono già validati. Mancava il CHECK per la maglia non negativa: migrazione locale `supabase/migrations/20261025185548_player_shirt_number_integrity.sql` pronta; preflight reale con zero maglie negative. Non applicata: il pacchetto richiede prima staging, che non risulta configurato. |
| Finanze / Tesoreria | Audit in sola lettura: RLS attiva sulle cinque tabelle; lettura limitata a squadra e ruoli admin/tesoriere/presidente; nessun grant diretto di scrittura ad anon/authenticated. RPC pubbliche invoker, mutazione privata con ruolo admin/tesoriere, request-id e lock squadra. Test client presenti e passati; test SQL transazionali esistenti non rieseguiti sulla produzione. |
| confirm → dialogo | Helper e conferme distruttive erano già presenti. Convertite altre nove azioni asincrone, incluso aggiornamento PWA con bozza, revisione partita, apertura report e ritorno dalle presenze. Restano 14 punti con conferma nativa, legati a contratti sincroni di chiusura/navigazione: sostituirli con una Promise senza modificare il protocollo farebbe perdere il blocco della navigazione. Il pacchetto stesso subordina questo lavoro alla migrazione. |
| Osservabilità | Non configurato un servizio esterno di errori client o uptime continuativo: manca la scelta/configurazione del destinatario. Non aggiunti SDK inerti né invii di dati personali. Report automatici CI e log esistenti non sono presentati come sostituti del monitoraggio della produzione. |
| Migrazione completa React e rimozione legacy | Rimane il piano incrementale dell’handoff, non un risultato già ottenuto. `FeatureSurface` e gli editor ancora in uso non vengono cancellati. FRONTEND.md documenta confini e invarianti: permessi server, atomicità, revisioni, request-id, audit, isolamento squadra e bozze. Una sostituzione completa richiede queste verifiche per ogni editor e un ambiente server di prova. |

## Verifiche e prove

- `npm run verify`: 165 test superati, 51 dominio/runtime + 111 frontend + 3 build/PWA.
- `npm --prefix tests run browser`: 38 casi superati e 2 casi notch non applicabili ai progetti desktop. La suite include annullamento/conferma dell’eliminazione di un messaggio, bozza riunione dopo errore e retry senza duplicati, safe area e uscita dei dialoghi.
- `tests/browser/baselines/`: 24 baseline controllate; `tests/playwright-report/`: PNG e risultati axe. I file dei report sono ignorati da Git e non entrano nella distribuzione.
- `.impeccable/review/handoff-2026-10-25/detector.json`: nessuna segnalazione nel controllo dei file coinvolti.
- `output/handoff-completo-audit-2026-10-25/readonly-evidence.json`: progetti, assenza di branch di prova, advisor e catalogo DB. Nessuna scrittura su dati reali.
- `output/playwright/handoff-verify-release.txt`, `handoff-browser-release.txt`: esecuzioni finali. Il workflow CI Linux è preparato ma non eseguito da questa sessione Windows.

## Cosa manca fuori dal codice pronto

1. **Staging Supabase**: la connessione restituisce un solo progetto e nessun branch di sviluppo. Serve prima di applicare/validare la nuova migrazione e provare salvataggi server e messaggi tra due account. I test sintetici non dimostrano un E2E reale.
2. **Impostazioni proprietario**: l’advisor conferma leaked-password protection disabilitata. [Supabase documenta che richiede Pro o superiore](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection). Non effettuati acquisti né modifiche a MFA o backup; stato di MFA/PITR non verificato.
3. **Seed bootstrap**: `claim_eburum_seed` è ancora eseguibile dagli autenticati, come segnala [l’advisor](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable). Il pacchetto riserva la rimozione al proprietario dopo conferma dell’importazione. La funzione non è stata eliminata o alterata.
4. **Monitoraggio produzione e GitHub**: scegliere/configurare il servizio di errori senza PII e uptime; pubblicare i sorgenti e selezionare i check obbligatori nelle regole del branch. Nessun commit, push o impostazione remota del branch modificata.
5. **Migrazione architetturale**: proseguire per schermata con test delle invarianti; solo allora eliminare i moduli legacy e convertire le guardie sincrone residue.

Il rilievo INFO su `private_access.finance_requests` (RLS senza policy) riguarda una tabella interna gestita dalla funzione privilegiata: non è stato aperto accesso client per far scomparire un avviso. I documenti originari sono preservati; l’unico documento mancante, ANIMATION-PUNCHLIST.md, è stato aggiunto alla cartella handoff nella root del repo. Il confronto dell’archivio è salvato in `archive-comparison.json`.

## Pubblicazione

Pubblicato su https://eburum.vercel.app, deployment `dpl_889BZpuJVZyQ76pRNzMeP38beqSF` (READY). Tutti i 23 file pubblici coincidono tramite SHA256 con il pacchetto compilato verificato. Avvio pubblico a 390×844: accesso visibile, nessun errore JavaScript o console, nessuna fixture. I sei header di sicurezza richiesti risultano presenti. Evidenze: `output/handoff-release.json`, `output/handoff-public-assets.json`, `output/handoff-security-headers.json`, `output/playwright/handoff-production-smoke.txt`. Il workflow CI e la migrazione locale non sono attivati dalla pubblicazione statica: restano le condizioni indicate sopra.

## Limiti del collaudo

Chromium su Windows, dati sintetici e safe area simulata. Non verificati hardware iPhone/Android, Safari/WebKit, tastiera nativa, ricezione server tra due account o migrazioni in un DB di prova. axe e baseline geometriche non equivalgono a una certificazione WCAG o a una revisione pixel per pixel di tutte le viste.
