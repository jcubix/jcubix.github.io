# Eburum — integrazione della code review, 27 ottobre 2026

Base verificata: `ba32dbc`, successiva all'export Excel. Fonti: `CODE-REVIEW-PUNCHLIST.md` (SHA256 `030aab57a6ced149d1909bd0f9593fddb6244e63ea069a733d13696a80ddfc9f`) e `eburum-handoff-completo.zip` (SHA256 `8eb279633fbd72996505e811a9ae0e8c8315ad8ef40612549693e6c8aec8e992`). L'archivio contiene anche proposte del vecchio commit `498863d`: non sono state riapplicate patch superate o ripristinati vecchi renderer.

## Nuova punch-list

| Voce | Applicazione verificabile |
| --- | --- |
| 1. CSS | I cinque fogli globali diventano due: `styles.css` per fondazione/Tailwind e `design-system.css` per il sistema visivo. Assorbiti e rimossi `soft-club.css`, `soft-club-reference.css` e `dark-theme.css`. Eliminate 202 dichiarazioni sovrascritte e i relativi blocchi vuoti. |
| 2. Tipi | `app-roles.js` e `app-data.js` convertiti in TypeScript, con firme, tabelle figlie e snapshot tipizzati. Lo stato iniziale completo è in `src/domain-state.ts`; la paginazione condivisa in `src/data-query.ts`. Eliminati i cast dello stato e del client in `runtime.ts`. `npm run typecheck` include anche quattro casi negativi in `tests/types/domain-contracts.ts`. |
| 3. ESLint | `npm run lint`, con regole Hooks e accessibilità JSX, eseguito da `verify` prima della build e quindi nel gate CI esistente. Zero errori e zero warning; `--max-warnings 0` impedisce nuove eccezioni silenziose. Due test dimostrano che il gate rileva realmente gli errori. |
| 4. File grandi | I sei moduli sono separati in cartelle `matches/`, `training/`, `finance/`, `whiteboard/`, `reports/`, `people/`. Componenti per sezione, hook per stato/operazioni e modelli condivisi. Rimossi i vecchi sei contenitori; import diretti aggiornati. Il file più grande di questi gruppi scende da 2.034 a circa 520 righe; gli altri restano intorno o sotto 500. |
| 5. Rotte | `React.lazy` e `Suspense` per Economia, lavagna, report e registro. Il contenitore e la navigazione restano operativi durante il caricamento. I dettagli condivisi dei report sono separati dal modulo della rotta, evitando di trascinarlo nel bundle iniziale. |
| 6. Richiami storici | Conservati caricamento per stagione, aggiornamenti già mirati e token semantici esistenti. L'invalidazione selettiva di tutte le scritture e la sostituzione completa degli swatch di compatibilità restano lavori distinti; non sono dichiarati conclusi da questa consegna. |

### Scelte di compatibilità

La cascata dichiara `theme, base, legacy, utilities, components, overrides`. Le regole applicative globali e specialistiche condividono `components`: la loro specificità e l'ordine relativo rimangono invariati, anche per `!important`. Il CSS precedente importato da `app.css` resta isolato in `legacy`. Separare ogni epoca di stile in un layer diverso avrebbe cambiato il risultato degli override; la verifica non giustificava tale regressione.

`styles.css` è ancora necessario: nel giro di controllo sono stati osservati blocchi corrispondenti a oltre 200 delle sue regole. Non è stato eliminato CSS attivo per soddisfare una riduzione del numero di file. La rimozione riguarda soltanto dichiarazioni dimostrabilmente sovrascritte da una regola successiva con lo stesso selettore, contesto e priorità; le dichiarazioni di fallback nello stesso blocco e i keyframe sono conservati.

Il dry-run di coverage confronta i blocchi osservati da Chromium con 1.712 regole nei cinque sorgenti originari: 1.044 corrispondenze testuali e 668 candidate non osservate. Le corrispondenze di blocchi identici sono conservative, non una percentuale di byte effettivamente necessari. Hover, stampa, ruoli e stati rari non osservati non sono stati cancellati automaticamente.

Il progetto usa TypeScript 7. `typescript-eslint` 8.72.1 dichiara un peer TypeScript `<6.1`; non è stato forzato né è stato retrocesso il compilatore. ESLint usa il parser TypeScript/JSX di Babel 8; il controllo semantico resta affidato a `tsc`. ESLint 9 è fissato alla famiglia compatibile con il peer corrente di `eslint-plugin-jsx-a11y`. Non sono usati `--force` o `--legacy-peer-deps`.

## Invarianti e correzioni

- ExcelJS resta un `await import("exceljs")`; jsPDF resta nel loader esistente. Export Excel, PDF, periodo e ordinamento sono conservati.
- Le guardie continuano a verificare utente, squadra, ruolo, richieste tardive, bozze e salvataggi atomici. Le dipendenze degli effetti sono state corrette senza disattivare il lint.
- Le API scoped di Economia e lavagna rimangono protette. I componenti sono rimontati con chiave di squadra/ruolo e al cambio di autenticazione.
- La generazione PNG della lavagna è separata dal download: il contesto viene ricontrollato dopo la generazione. Una revoca del ruolo durante il rendering non può più far scaricare il file precedente. Nuova regressione browser dedicata.
- Il test del calendario attende i sette giorni prima di misurarli, perché il Registro ora viene caricato su richiesta. Restano le verifiche di allineamento e di assenza di overflow, senza modifiche alle baseline.
- Il test che vieta renderer HTML e binder legacy ora visita anche le sottocartelle dei componenti.

## Dimensioni e resa visiva

Confronto delle build di produzione, dimensioni non compresse riportate da Vite:

| Asset | Prima | Dopo |
| --- | ---: | ---: |
| Chunk applicativo principale | 459,93 KB | 369,16 KB |
| CSS iniziale | 222,05 KB | 210,66 KB |
| CSS complessivo, incluse le rotte | 222,05 KB | 218,08 KB |

Economia, lavagna, report e registro hanno chunk separati, non precaricati dall'HTML. Tutti i chunk, incluso Excel, restano nella cache statica PWA; il worker non intercetta o conserva dati delle API.

Confronto su 64 catture di viewport, chiaro/scuro e 390/1280 px, incluse schede ed editor: immagini prima/dopo identiche. I valori CSS e la geometria coincidono nelle 63 viste con snapshot DOM confrontabile; nella restante il rilevamento DOM ha preceduto la fine del caricamento, mentre la cattura successiva e il test completo del report sono verificati separatamente. Nessuna baseline geometrica è stata aggiornata per far passare la suite.

## Vecchio handoff

Già presenti e conservati: errori login italiani, tastiere numeriche, header/CSP/cache, spazio per dock e safe area, chevron, radius e temi, barre di salvataggio, dialoghi stilizzati, navigazione animata, loader PDF, report/tabellino, workflow interamente React, CI con verify/browser e controlli axe. Le proposte facoltative che cambiano identità visiva o reintroducono una libreria di animazione non sono necessarie per correggere il codice attuale.

Nessuna migrazione, modifica di piani, rimozione di funzioni DB, servizio di monitoraggio esterno o scrittura sui dati reali. L'handoff precedente sui vincoli e sulle policy rimane valido come evidenza storica; non equivale a nuovi test server eseguiti in questa consegna. Le prove persistenti con due account richiedono staging; destinazione e configurazione del monitoraggio senza PII restano da definire. Il piano gratuito scelto dall'utente è conservato; MFA è stata dichiarata attivata dal proprietario.

## Verifica

`npm run verify`: formattazione, lint senza warning, TypeScript, build, 30 test di dominio/qualità, 126 interazioni React e 3 controlli PWA: 159 superati. Chromium completo: 106 superati, 2 esclusioni previste per il notch su desktop. WebKit aggiuntivo a 320/390 px nei due temi: 28 superati, inclusi presenze effettive, grafici/calendario, lavagna, revoca del ruolo, rotte lente ed export squadra. Evidenze sintetiche e dry-run in `output/`, esclusi dalla pubblicazione.

Non verificati iPhone fisico, nuove scritture server tra account reali, backup/PITR o configurazione di un servizio esterno di monitoraggio.
