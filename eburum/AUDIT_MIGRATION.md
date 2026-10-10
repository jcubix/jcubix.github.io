# Verifica della migrazione — 10 ottobre 2026

La revisione comprende il frontend React effettivo, i moduli operativi conservati, i flussi sportivi, la funzione amministrativa, i permessi e il database Supabase distribuito. Le prove locali usano fixture; le prove SQL sul database reale terminano tutte con `ROLLBACK`. Non sono stati modificati account, password o ruoli dello staff e non è stato eliminato alcun dato operativo.

## Ammonizioni: causa e correzione

Le **6 ammonizioni erano ancora presenti** in `match_events`: 5 contro Picentina 2022 e 1 contro Pellezzano. Tutte erano collegate a un giocatore esistente. Il pulsante React “Cartellini e diffide” chiamava direttamente `disciplineModal(playerId)`: React passava l'evento del clic come primo argomento, interpretato dal vecchio editor come filtro giocatore. L'indice risultava vuoto.

`src/runtime.ts` ora espone un'azione senza argomenti per aprire l'indice generale. La scheda individuale conserva il filtro esplicito per identificativo. I test montano l'app React e verificano entrambi gli ingressi, da Partite e da Altro, conteggio, storico, cambio stagione, soglie e consultazione del segretario. La fixture include un giocatore con 5 gialli: la conferma manuale della gara scontata resta disponibile soltanto allo staff sportivo autorizzato.

## Integrità dei dati

Conteggi rilevati sul database reale durante questa revisione:

| Dataset | Record |
| --- | ---: |
| Giocatori | 30 |
| Sessioni | 20 |
| Presenze | 587 |
| Revisioni dello storico presenze | 41 |
| Partite | 2 |
| Eventi partita | 22: 6 ammonizioni, 6 gol, 10 sostituzioni |
| Attività | 23 |
| Righe delle convocazioni / risposte | 90 |
| Schede tecniche delle attività | 2 |
| Account Auth / membri della squadra | 3 / 3 |

- Nessuna presenza, convocazione o evento orfano, anche rispetto alla squadra di appartenenza.
- Nessuna coppia sessione/giocatore o attività/giocatore duplicata.
- Nessuna partita o sessione senza l'attività collegata; nessun account senza squadra.
- Tutti i 30 giocatori e le 527 presenze dell'importazione iniziale risultano ancora collegati allo storico operativo. Nessuna sessione dell'importazione risulta mancante.
- Confrontate le impronte del contenuto completo di **17 dataset**, prima e dopo tutti i test SQL: nessuna differenza di conteggio o contenuto. Il confronto comprende account, membri, dati sportivi, audit e archivio dell'importazione; sono stati restituiti soltanto conteggi e digest, senza credenziali.
- RLS attiva su tutte le 13 tabelle pubbliche e nessun vincolo non validato.
- Trigger delle comunicazioni presenti; pulizia delle scadenze attiva, con le ultime tre esecuzioni controllate riuscite.

Il confronto con il seed copre l'importazione iniziale e il confronto delle impronte dimostra che questa verifica non ha alterato i dati. Non è disponibile una fotografia completa immediatamente precedente alla migrazione React: questi controlli non costituiscono una prova universale dell'assenza di qualsiasi modifica storica. Per le ammonizioni segnalate, la presenza nel database e la causa della mancata visualizzazione sono state verificate direttamente.

## Correzioni e pulizia del codice

| Problema | Intervento |
| --- | --- |
| Indice cartellini vuoto dopo il clic | Azione React senza argomenti, separata dal filtro per giocatore. |
| Uscita dall'account con bozza presenze modificata | Conferma prima di scartarla; logout bloccato durante il salvataggio. La navigazione interna conserva la bozza. |
| Offset della lista virtualizzata dopo un cambio dei filtri | Rimisurazione del contenitore quando cambiano le righe, oltre al ridimensionamento della finestra. |
| Funzioni non più richiamate | Rimosse `notifiedBadge`, `pollReminder`, `trainingActivity` e `surveyHub`, con i relativi export. |
| Import inutilizzati | Rimossi quattro import dai moduli delle operazioni, della pianificazione e dei workflow. |

La ricerca dei riferimenti comprende sorgenti e test. Sono conservati il caricatore dei moduli operativi e il worker storico, ancora usati dalle verifiche di compatibilità: la build distribuisce soltanto il worker generato da `src/sw-template.js`. Migrazioni, test, fixture e documentazione sono esclusi dagli asset pubblicati.

## Verifiche eseguite

**43 test automatici superati** tramite `npm run verify`:

- 32 test dei moduli operativi: presenze e risposte WhatsApp distinte, revisioni, conflitti, bozze, ruoli, report individuali e PDF, cartellini e squalifiche, sostituzioni e minuti, comunicazioni, Realtime, stagione e sicurezza del runtime.
- 9 nuovi test compilano e montano i componenti React effettivi in JSDom: ingressi all'indice cartellini, permessi, storico stagionale e completo, bozza presenze, logout e pubblicazione delle comunicazioni con errore e doppio invio.
- 2 test della PWA compilata: asset, precache, manifest, icone, esclusione di API e fixture, MIME e attivazione degli aggiornamenti.

TypeScript strict, controllo aggiuntivo di locali e parametri inutilizzati e formattazione superati. `npm audit` non segnala vulnerabilità nelle dipendenze del frontend né in quelle dei test.

**9 suite SQL sul database reale, tutte concluse con rollback**:

`managed_auth_creation.sql`, `attendance_review.sql`, `team_operations.sql`, `staff_communications.sql`, `secretary_role.sql`, `training_attendance.sql`, `match_minutes.sql`, `disciplinary_clearances.sql` e `tests/survey_to_attendance.sql`.

Verificano l'ordine Auth e l'assegnazione dei quattro ruoli, isolamento delle squadre, autorizzazioni, atomicità e revisioni, collegamento dell'allenamento, convocazioni, TTL delle comunicazioni e conferma manuale delle squalifiche. Per i minuti comprendono ingresso al 65° con ripartizione 65/25, catene di cambi, espulsioni, durata, correzioni, cancellazioni e conservazione dei minuti manuali delle gare storiche.

Nel browser, sulla build effettiva con dati sintetici: indice con 6 gialli e soglia di squalifica, lista di 160 comunicazioni, filtri e raggiungimento dell'ultimo messaggio a 320, 390, 768 e 1440 px. Nessuno scorrimento orizzontale e nessun errore JavaScript durante queste prove. I test non sostituiscono una verifica su iPhone fisico. Non è stato usato un account reale dello staff per accedere alla UI o provare il cambio password.

## Database: elementi conservati e avvisi

Non sono emersi record operativi dimostrabilmente inutili. Tabelle vuote di comunicazioni, schede amministrative e squalifiche sono funzioni attive; l'archivio privato dell'importazione serve alla verifica e al recupero. Gli otto indici segnalati come non utilizzati non vengono rimossi basandosi soltanto su statistiche recenti di un database piccolo. [Indicazioni Supabase sugli indici inutilizzati](https://supabase.com/docs/guides/database/database-linter?lint=0005_unused_index).

Gli advisor riportano ancora due avvisi di sicurezza:

1. Protezione Auth contro password compromesse disattivata, disponibile dal piano Pro. Il piano e la configurazione non sono stati cambiati. [Requisiti e configurazione](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).
2. `claim_eburum_seed` è una RPC `SECURITY DEFINER` eseguibile dagli autenticati. La definizione controllata richiede sessione, blocca la riga di assegnazione e verifica il codice per la prima importazione; con il seed già assegnato respinge gli altri utenti. La funzione resta collegata al recupero iniziale e non abilita la registrazione pubblica. [Descrizione dell'avviso](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable).

Le due tabelle private di seed prive di chiave primaria sono un archivio storico, estraneo alle scritture operative. [Descrizione dell'avviso](https://supabase.com/docs/guides/database/database-linter?lint=0004_no_primary_key).

La revisione non certifica l'assenza di qualsiasi vulnerabilità: gli avvisi sopra sono espliciti e la gestione amministrativa è stata verificata con revisione del codice, test simulati e test SQL, senza cambiare le credenziali dello staff.
