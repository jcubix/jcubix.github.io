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

## Integrazione Club Office — verifica supplementare

Applicata la migrazione additiva dei nominativi staff; distribuita `manage-users` versione 9, con verifica del token attraverso Auth e ruolo amministratore corrente nel database. CORS consente il dominio di produzione, i due ambienti locali 4197/4198 e lo spazio preview del progetto Eburum; il controllo non sostituisce autenticazione e permessi.

45 test automatici e le nove suite SQL (`staff_names`, `managed_auth_creation`, `training_attendance`, `attendance_review`, `team_operations`, `secretary_role`, `match_minutes`, `disciplinary_clearances`, `staff_communications`) passati. La prova API reale verifica quattro ruoli, creazione/login, errore email duplicata, reset password, rifiuto della precedente password, cambio ruolo su token già emesso e nominativi aggiornati in `team_context`. Le cinque utenze temporanee e il giocatore di test sono stati rimossi; il controllo finale trova zero utenti di quei test.

Le impronte MD5 dei record completi, ordinate con chiavi stabili, coincidono prima e dopo l'intervento: players 30, sessions 20, attendance 587, matches 2, match_events 22, activities 23, activity_roster 90, disciplinary_clearances 0. Le ammonizioni sono ancora 6. Le chiavi composite usate per le impronte sono session_id/player_id per attendance e activity_id/player_id per activity_roster. Nessun dato sportivo storico è stato modificato.

54 combinazioni browser: Dashboard, Allenamenti, Partite, Rosa, Comunicazioni, Altro, Report, Registro e Riunioni a 320, 390, 614, 768, 1280 e 1440px. Nessun overflow orizzontale né errore JavaScript; controlli input mobili da 16px. Gli screenshot e le interazioni nel browser usano fixture sintetiche isolate; la prova API/SQL verifica separatamente il backend reale. Non equivale a una prova su iPhone fisico.

Il revisore indipendente ha richiesto tre correzioni: contrasto delle date, leggibilità dei contatori e destinatari delle comunicazioni, righe distinte nell'anteprima home. Dopo build e ricattura dei 20 screenshot, lo stesso revisore ha segnato tutte e tre come risolte, disposizione `ship`. Il passaggio finale copre questi finding; non è una nuova revisione completa.

Anteprima Vercel `dpl_9WSvRa3Xcwr4qD2hN8GgmbooRAaV` READY: https://eburum-e86ww5or9-giacomocubicciotti-4377.vercel.app. Verificati da Chromium i 20 asset distribuiti: tutti HTTP 200, impronte SHA-1 coincidenti con la build locale (l'HTML include la toolbar Vercel). Login a 390 e 1440px senza overflow o errori JavaScript; richiesta amministrativa senza autenticazione rifiutata con 401 dal backend reale, con CORS funzionante dall'anteprima. La nuova UI non è ancora promossa sul dominio principale. Migrazione dei nomi e `manage-users` versione 9 sono già sul backend reale. Nessun push Git o deploy di produzione effettuato.


## Controllo in sola lettura dopo il riallineamento grafico

L'11 ottobre 2026 una query aggregata sul database distribuito conferma 30 giocatori, 20 sessioni, 587 presenze, 2 partite, 22 eventi, 23 attività e 90 righe di convocazioni/disponibilità. Gli eventi di tipo Ammonizione rimangono 6. I conteggi coincidono con la verifica conclusiva precedente. Questo controllo conferma i conteggi, non sostituisce le impronte di tutte le righe registrate nell'audit precedente; il riallineamento del frontend non applica migrazioni o cancellazioni sul database.


## Chiusura del riallineamento Club Office

49 test superati (31 dominio, 16 React, 2 PWA), TypeScript/build e formattazione verificati; lint ES dei moduli senza rilievi. Le 63 combinazioni di layout sono state ricontrollate, con 71 schermate principali e otto stati supplementari. Il revisore ha segnato tutte le sei correzioni richieste come risolte, disposizione ship limitata ai finding assegnati. Il menu usa un indicatore statico e hover #1b3159 distinto dalla selezione #22396f; comandi eventi 44px e cronologia senza spazio riservato superfluo.

Nuova anteprima dpl_2yHRzzFdv6Tar78ChbVM5kPK9d1N READY: https://eburum-gz0ur5rdv-giacomocubicciotti-4377.vercel.app. Da Chromium isolato, tutti i 21 asset distribuiti sono HTTP 200 e corrispondono alla build locale mediante SHA-1 (l'HTML ha la toolbar Vercel). Login a 390/1440px senza overflow o errori JavaScript, service worker attivo, apple-touch-icon PNG 180px; endpoint gestione utenti senza autenticazione respinto con 401, CORS funzionante. Questi controlli sul deploy sono sul login e sui file distribuiti; le interazioni autenticate della UI sono coperte da fixture e test, separatamente dall'audit reale precedente del backend. Nessun push, promozione in produzione o modifica ai dati sportivi in questo riallineamento.


## Pubblicazione autorizzata in produzione

L'utente ha approvato esplicitamente la pubblicazione della versione Club Office. Deployment di produzione dpl_5W96UCRwk5U7zNrP9FzF34UsrtFZ READY, dominio https://eburum.vercel.app assegnato e verificato tramite API Vercel. Distribuiti gli stessi asset statici della preview approvata, senza rebuild dei sorgenti o modifica delle variabili del backend. Versione precedente di riferimento: dpl_36BQsrc88fVDudqZ8PEcysUhTaUe.

Controlli Chromium sul dominio principale: 21 asset HTTP 200, impronte coerenti con la build; login 390/1440px senza overflow o errori JavaScript; service worker attivo e apple-touch-icon PNG; gestione utenti anonima respinta con 401, CORS funzionante. Nessun errore runtime trovato dal controllo Vercel nell'intervallo selezionato; nessun drain configurato. Nessuna nuova scrittura al database o push Git in questa pubblicazione. I 49 test funzionali e i controlli di fedeltà precedenti restano riferiti alla medesima build; non è stata rieseguita una sessione autenticata dello staff sul dominio principale.

## Correzione delle aree sicure PWA iOS — 11 ottobre 2026

Le immagini dello staff mostrano intestazione e chiusura della gestione utenti sotto la barra di stato. Il layout React riserva ora gli inset superiore e laterali, mentre le finestre operative sottraggono gli inset dall'altezza massima e mantengono la testata raggiungibile durante lo scorrimento. Login, navigazione mobile e contenuto rispettano le aree sicure. Anche i dialoghi Radix usano un contenitore centrato nell'area disponibile, aggiornato tramite VisualViewport quando cambia altezza o offset con la tastiera; i listener sono rimossi alla chiusura.

Verifiche: 31 test di dominio, 17 React e 2 PWA superati, TypeScript/build e formattazione corretti. Il nuovo test React verifica ridimensionamento, spostamento del viewport e pulizia dei listener. In Chromium, su build reale e dati sintetici, controllati apertura/chiusura e testata dopo scorrimento per Gestione utenti e Nuova comunicazione in cinque scenari: 390×844 con inset 59/34, 375×667 con inset superiore 20, 844×390 con inset laterali 59 e inferiore 21, 390×400 come area ridotta e desktop 1440×900. Nessun overflow orizzontale o errore JavaScript. Gli inset sono sostituiti esplicitamente nel CSS della prova: il browser desktop non emula la barra di stato di iOS. La verifica non equivale a una prova su iPhone fisico né a una tastiera iOS reale.

Pubblicata la stessa build statica sul progetto Eburum: deployment `dpl_HYagresmRdAMrYZVThBrpaEs4Uk4` READY, alias https://eburum.vercel.app. Tutti i 21 asset del dominio principale sono HTTP 200 e le impronte SHA-1 coincidono con la build locale. Un primo tentativo di deployment non ha superato l'inizializzazione per il percorso radice del progetto; la pubblicazione riuscita conserva il percorso `eburum` e distribuisce gli asset già compilati. Nessuna modifica al database, alle credenziali dello staff o push Git. Il service worker generato usa una nuova identità di cache per questo aggiornamento; l'utente può attivare l'aggiornamento disponibile nell'app installata.

## Integrazione audit esterno frontend (11 ottobre 2026)

Applicate le tre patch del pacchetto `eburum-handoff` dopo `git apply --check`: messaggi di login in italiano, tastiera numerica per numero maglia e minuti giocati. I messaggi sconosciuti non espongono dettagli interni del server. I grafici report esistenti restano barre CSS; il piano di migrazione è una guida, non una modifica al database.

Il nuovo modulo `app-confirm.js` integra il dialogo di conferma con la gestione esistente di focus, inert, Escape, ripristino del pannello sottostante e safe area PWA. Testo inserito con textContent; focus iniziale su Annulla; una sola conferma attiva. Integrato nelle cinque azioni effettivamente usate: eliminazione evento, eliminazione partita, ricalcolo minuti automatici, eliminazione comunicazione React e rimozione dalla rosa React. Blocco immediato del doppio invio e verifica di sessione/squadra/ruolo dopo l'attesa. Il controllo visivo ha rilevato e corretto il pannello di conferma coperto dall'editor evento, assegnando alla conferma un livello superiore.

Non è una sostituzione indiscriminata dei 14 confirm citati nel pacchetto: rimangono native le conferme sincrone di navigazione/abbandono bozza e i percorsi legacy di comunicazioni, rosa e annullamento squalifica. La loro conversione deve preservare i contratti sincroni di chiusura e navigazione. I percorsi React principali usano il nuovo dialogo.

Verifica finale: 53 test passati (33 dominio, 18 React, 2 build PWA), TypeScript e build superati, formattazione verificata. Tre regressioni nuove coprono traduzioni login, dialoghi annidati con testo non interpretabile come HTML e rifiuto di eliminazioni duplicate/sessioni obsolete. Chromium sulla build compilata verifica annullamento rosa, inputmode maglia, annullamento ed eliminazione di un evento sintetico, focus iniziale, isolamento del pannello sottostante e pulsante effettivamente visibile tramite elementFromPoint. Ricontrollati cinque layout con safe area simulate, inclusi paesaggio e viewport ridotto. Nessuna prova su iPhone fisico e nessuna eliminazione sul backend reale.

Sicurezza: nessuna migrazione o DROP eseguita. La protezione password compromesse resta un intervento di configurazione del proprietario, con piano e disponibilità da verificare. `claim_eburum_seed` è ancora richiamata da `app-part1.js` nella Dashboard della squadra vuota: prima di eliminarla occorre decidere come gestire importazione e recupero, verificando anche lo stato server. Il file SQL dell'audit non è stato eseguito. Conservate le modifiche pregresse della working tree; nessun commit cumulativo o push Git.

Pubblicazione audit: deployment `dpl_Feb6XxcrPxfL2Lznj1PqqLm2irrU` READY, alias https://eburum.vercel.app. I 21 asset pubblicati hanno impronte SHA-1 uguali alla build locale. La nuova identità del service worker rende disponibile l'aggiornamento PWA senza cancellare dati o bozze utente.

## Registro leggibile e ordine casa/trasferta (11 ottobre 2026)

I giorni con sessioni hanno fondo azzurro chiaro e numero blu scuro; il giorno selezionato ha fondo blu, numero bianco e bordo oro. Hover e focus sono distinti, le frecce hanno nomi accessibili, il mese è annunciato e i pulsanti data espongono data completa, presenza di attività e aria-pressed. Il focus viene ripristinato sul giorno scelto dopo il ridisegno.

Il modulo condiviso app-match-display.js ordina squadra e risultato secondo casa/trasferta. Applicato alle card React e legacy, al titolo attività/agenda, alla convocazione copiata e alla consultazione segretario. Nell'editor il campo avversaria precede Eburum in trasferta; il cambio del campo riordina gli elementi esistenti senza perdere valori. goals_for e goals_against conservano il significato originale relativo a Eburum e non vengono invertiti nel database.

54 test superati (33 dominio, 19 React, 2 PWA). La nuova regressione segue una trasferta, cambia campo e punteggio, salva e verifica il payload e il risultato riaperto; copre anche selezione calendario. Browser Chromium a 390/1440px: ordine squadre/punteggio corretto, navigazione mesi, mantenimento focus, nessun overflow o errore. Contrasto testo/fondo del calendario 11,15:1 selezionato, 16,61:1 con attività, 14,88:1 ordinario, 11,41:1 hover. Safe area mobile simulate 59/34px; nessuna prova su iPhone fisico. Le prove di scrittura usano solo fixture sintetiche, nessuna modifica dei dati reali.

Deployment dpl_BtJYXHLK93bPi5hqWP9qvX3F27sd READY su https://eburum.vercel.app: verificati i 21 asset mediante SHA-1, tutti uguali alla build locale. TypeScript, build, formattazione e controllo whitespace superati. Nessun push Git o migrazione DB.
