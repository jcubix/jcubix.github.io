# Frontend Eburum

React 19, TypeScript strict e Vite. Supabase gestisce autenticazione, dati, policy e aggiornamenti delle comunicazioni. La UI usa una sola radice React: non esistono renderer HTML legacy o binder paralleli.

## Avvio e controlli

Con Node.js 24, dalla cartella `eburum`:

```sh
npm ci
npm --prefix tests ci
npm run dev
npm run typecheck
npm run lint
npm run verify
npm --prefix tests run browser
```

`verify` controlla formattazione, lint Hooks/accessibilità senza warning, tipi, build, test del dominio e dei componenti reali, distribuzione e cache PWA. La suite browser separata usa fixture sintetiche e blocca le richieste esterne. Le baseline geometriche hanno tolleranza 2 px: aggiornarle solo per cambiamenti intenzionali verificati visivamente, mai per mascherare un difetto.

## Struttura

- `main.tsx` crea runtime e radice React; `app.tsx` contiene accesso, shell responsive e navigazione hash con link diretti e cronologia.
- `runtime.ts` espone snapshot, azioni e guardie. `domain-state.ts` inizializza completamente lo stato tipizzato; `data-query.ts` mantiene la paginazione condivisa.
- `app-roles.ts` e `app-data.ts` sono controllati dal compilatore. Gli altri moduli `app-*.js` rimangono logica operativa di dominio, non renderer: non eliminarli mentre sono importati dagli editor.
- `matches/`, `training/`, `people/`, `finance/`, `whiteboard/`, `reports/` separano componenti, sezioni e hook. Gli import puntano ai moduli utilizzati, senza contenitori che carichino intere funzionalità estranee.
- Economia, lavagna, report e registro sono rotte caricate su richiesta con `React.lazy` e `Suspense`. La navigazione resta attiva durante il caricamento; una risposta tardiva non cambia la pagina scelta successivamente.
- `operational-surfaces.tsx` associa le schede aperte ai componenti. `ui-service.ts` e `useEditor` mantengono conferme, errori, guardie delle bozze, chiusura e contesto della cronologia.

## Stile e componenti

Tailwind 4, componenti locali in `components/ui`, primitive Radix e icone Lucide. Identità approvata Club Office: palette semantica chiara/scura, Figtree, controlli da almeno 44 px, radius condivisi, dock mobile e navigazione desktop. Nessun nuovo design è introdotto dalla riorganizzazione.

I fogli globali sono `styles.css` e `design-system.css`. Il CSS di report e lavagna appartiene ai rispettivi moduli caricati su richiesta. Ordine della cascata: `theme, base, legacy, utilities, components, overrides`; le regole applicative condividono `components` per preservare specificità e priorità, incluse quelle importanti. `app.css` rimane importato nel layer `legacy` finché contiene regole necessarie.

I token semantici guidano tutte le superfici: i vecchi alias cromatici `--swatch-*` sono stati rimossi. Le tinte delle annotazioni e del campo tattico restano colori del contenuto, indipendenti dal tema. Le animazioni mantengono un percorso senza movimento; non reintrodurre dipendenze solo per fade o feedback di pressione.

## Dati, permessi e sicurezza

L'applicazione usa il ruolo autorevole della membership; i controlli client modellano la UI e non sostituiscono RLS, RPC e autorizzazioni server. Ogni risposta asincrona e ogni conferma deve ricontrollare utente, proprietario, ruolo e sessione. Conservare revisioni, richieste idempotenti, audit, retry e atomicità.

Gli allenamenti correnti raccolgono soltanto le assenze comunicate: gli altri giocatori sono attesi, ma il registro viene scritto solo alla conferma finale dello staff. `sessions.attendance_mode` distingue il nuovo metodo `absence_notice` dai vecchi sondaggi `poll`; la modalità resta immutabile nelle correzioni e le vecchie risposte non vengono riscritte. I report non trasformano dati mancanti in assenze e contano come risposte WhatsApp soltanto lo storico `poll`. Gli export seguono periodo e ordinamento; la squadra usa `.xlsx` e PDF. ExcelJS e jsPDF rimangono su richiesta; la cache PWA contiene solo asset statici, mai tabelle o risposte API. La lavagna controlla nuovamente il contesto prima di scaricare un'immagine generata in modo asincrono.

I salvataggi sportivi usano `reloadAffected` con un ambito tipizzato: giocatori, amministrazione, disciplina, attività, gara o sessione. I record collegati sono riletti insieme e applicati soltanto dopo il successo di tutte le letture; le operazioni mirate sono serializzate e subordinate a contesto, stagione e generazione del caricamento completo. Le date iniziali sono rilette solo quando cambiano date o record; eliminare una gara aggiorna anche le conferme disciplinari. Accesso, cambio stagione, recupero da errore e modifiche del contesto utente conservano il caricamento completo. I report reagiscono alle nuove righe senza cambiare periodo o ordinamento.

## Documenti correnti

- `CONFIRMED-TRAINING-UI-2026-10-29.md`: riepilogo leggibile delle presenze salvate, filtri per stato e azioni distanziate.
- `SAVE-BARS-LAYOUT-2026-10-29.md`: zona di salvataggio separata dal modulo, icone centrate e disponibilità degli allenamenti.
- `TRAINING-ABSENCE-WORKFLOW-2026-10-29.md`: assenze comunicate, conferma effettiva, compatibilità storica e prove server.
- `CODE-REVIEW-IMPLEMENTATION-2026-10-27.md`: confronto con l'handoff, scelte, misure, verifiche e limiti.
- `TARGETED-REFRESH-PALETTE-2026-10-28.md`: chiusura degli aggiornamenti mirati e della palette di compatibilità.
- `REACT-MIGRATION-2026-10-27.md`: conclusione della migrazione dei renderer e copertura precedente.
- `TEAM-REPORT-2026-10-27.md`, `TREASURY.md`, `WHITEBOARD.md`, `STAFF_ROLES.md`: regole delle funzionalità.
- `tests/README.md`: test effettivamente presenti; `supabase/tests/`: verifiche server separate.

Le note di pubblicazione e di audit più vecchie documentano esecuzioni storiche, non lo stato corrente dei file o dei servizi.
