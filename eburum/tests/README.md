# Verifiche Eburum

I test locali e browser usano dati sintetici: non richiedono credenziali e non scrivono nel progetto di produzione.

## Comandi

Dalla cartella `eburum`, con Node.js 24:

```sh
npm ci
npm --prefix tests ci
npm run typecheck
npm run lint
npm run verify
npm --prefix tests run browser
```

Per il browser installare prima Chromium tramite il CLI Playwright della cartella `tests`. Il runner avvia il server locale quando necessario. Il workflow GitHub esegue `verify` e poi `browser`, conserva il report e impedisce l'aggiornamento delle baseline in CI.

## Copertura attuale

| File | Verifica |
| --- | --- |
| `staff-access.cjs` | Handler utenti: ruoli autorevoli, isolamento, creazione, aggiornamento e rimozione, account proprietario protetto. |
| `daily-workflows.cjs` | Presentazione, date e passaggi dei workflow. |
| `match-minutes.cjs`, `match-report.cjs` | Minuti, sostituzioni, espulsioni, attribuzione degli eventi e tabellino/PDF. |
| `runtime-safety.cjs` | Sessione, ruolo e risposte tardive; nessuna riscrittura della radice React. |
| `domain-workflows.cjs` | Moduli di produzione per presenze, storico, disciplina, export e realtime. |
| `team-report.cjs` | Report squadra, ordinamento, celle Excel numeriche/testuali, filtri e intestazioni bloccate; PDF multipagina. |
| `react-boundary.cjs` | Assenza di renderer HTML e binder, incluse le sottocartelle React. |
| `quality-gates.cjs` | Il lint rileva hook condizionali, dipendenze mancanti e JSX inaccessibile; consente regioni di scorrimento raggiungibili da tastiera. |
| `frontend-interactions.cjs` | Componenti React reali: ruoli, bozze, salvataggi, errori, retry, invii ripetuti, logout e cambio contesto. |
| `frontend-build.cjs` | Avvio della build, manifest, asset, chunk su richiesta, budget del bundle e cache PWA senza dati API. |
| `types/domain-contracts.ts` | Casi negativi controllati da TypeScript per date, tabelle, ruoli e snapshot. Non vengono eseguiti nel browser. |
| `browser/ui.spec.cjs` | Temi mobile/desktop, geometria, axe, focus, safe area, editor, esportazioni reali, caricamento ritardato delle rotte e download negato dopo revoca del ruolo. |

I test di dominio compilano i moduli distribuiti con Vite. Le interazioni React compilano gli stessi componenti della produzione; non esiste un renderer di prova alternativo. La suite browser blocca HTTP verso servizi esterni.

## Baseline e prove server

Le baseline geometriche in `browser/baselines/` ammettono 2 px di tolleranza. Non aggiornarle per far passare una regressione. Screenshot e tracce restano nel report HTML e vengono rivisti prima della pubblicazione.

`managed-auth-live.cjs` e gli script `../supabase/tests/` sono verifiche separate dei servizi reali e non fanno parte dei test locali. I test SQL in transazione terminano con rollback; vanno eseguiti consapevolmente, preferibilmente su staging. Le prove persistenti richiedono account sintetici dedicati e pulizia: non usare utenze dello staff o registrare credenziali nei log.

`../supabase/tests/training_absence_notices.sql` verifica pianificazione senza presenze, nuovo metodo di registrazione, intera rosa, assenza di risposte al sondaggio inventate, retry, revisioni, correzioni e compatibilità dei client precedenti. Crea attività e sessioni sintetiche in transazione e termina con rollback, senza modificare le presenze reali. Richiede la migrazione `training_absence_notices` e la configurazione bootstrap del progetto.

Il passaggio dei test con fixture non equivale a un nuovo collaudo di RLS, inviti tra due account o hardware iPhone. Lo stato dell'ultima integrazione è in `../CODE-REVIEW-IMPLEMENTATION-2026-10-27.md`.
