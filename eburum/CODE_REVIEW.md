# Revisione corrente — 13 ottobre 2026

La scansione degli import dal bootstrap trova 42 moduli applicativi, tutti raggiungibili: nessun file applicativo orfano. Rimossi due import React inutilizzati, 59 dichiarazioni CSS sovrascritte e 29 regole vuote o legate al vecchio indicatore della navigazione. Conservati i moduli ES ancora usati dagli editor, la libreria PDF e licenza, i test e le migrazioni storiche.

Corretto un difetto nell’Economia: una richiesta iniziata prima del logout non può più risultare valida dopo un nuovo accesso con identici utente, squadra e ruolo. La regressione simula una risposta pendente e il rientro dello stesso account. Corretti anche la pulizia dei listener PWA e il ripristino del tema Sistema quando viene svuotato lo storage; il colore della barra del browser è allineato alla nuova palette chiara.

TypeScript abilita noUnusedLocals/noUnusedParameters. Tutti i sorgenti React e CSS rispettano format:check. npm audit, incluse dipendenze di sviluppo, riporta zero vulnerabilità note: questo controllo non sostituisce un penetration test. Nessuna migrazione o modifica dei record reali durante questa review. Verifiche SQL e API storiche descritte sotto si riferiscono alle date delle rispettive revisioni.

# Revisione precedente — integrazione Club Office

La versione corrente adotta Club Office nel frontend reale. Sono stati rimossi il bootstrap vanilla `app-main.js`, il worker sorgente sostituito dalla build, quattro import non usati e 86 regole della precedente Dashboard. Il prototipo `design-lab` è stato archiviato fuori dal repository dopo l'estrazione dello stile selezionato in `DESIGN.md` e `.impeccable/design.json`; nessun codice del prototipo viene distribuito. Le regole condivise con gli editor e il rendering del test harness restano necessarie. Il test del vecchio worker è sostituito dai due test del worker effettivamente compilato; non viene meno la copertura PWA.

L'amministrazione aggiunge nomi e cognomi senza concedere nuovi permessi. Corretto il binding dell'elenco paginato tramite una mappa degli utenti; protetti doppio invio, bozze dopo errore e richieste di una squadra/sessione superata. Il ripristino presenze rispetta la guardia della navigazione. I test del gestore utenti ora eseguono le verifiche sequenzialmente anziché usare due flussi concorrenti sulla stessa fixture.

La suite corrente contiene 45 test automatici. Nove suite SQL sul database reale terminano con rollback. Una prova API effettiva ha creato e autenticato utenze sintetiche nei quattro ruoli, verificato RLS, modifica nominativo, ruolo e password, quindi rimosso le cinque utenze temporanee e il giocatore sintetico. Nessuna password o ruolo dello staff è stato modificato. La matrice browser verifica nove schermate su sei larghezze; i campi mobili sono da 16px e non compare overflow orizzontale.

Non vengono rimossi migrazioni storiche, audit, tabelle sportive o indici solo perché poco usati. React ospita ancora editor nei moduli ES collaudati: una conversione ulteriore richiede mantenere atomicità, revisioni e conflitti. I paragrafi seguenti documentano le revisioni precedenti e i relativi risultati al momento della loro esecuzione.

# Revisione del progetto — 9 ottobre 2026

Per la verifica successiva alla migrazione React, la correzione delle ammonizioni, il controllo del database reale e i 43 test attuali, vedere [Verifica della migrazione — 10 ottobre 2026](AUDIT_MIGRATION.md). Il documento qui sotto conserva la revisione precedente; l'architettura corrente è descritta in [FRONTEND.md](FRONTEND.md).

La revisione comprende i moduli applicativi, il caricamento degli asset, il service worker, la funzione amministrativa, le migrazioni, i test e le policy del database attualmente distribuito. Portfolio e blog presenti nello stesso repository hanno riferimenti attivi e restano separati dall'applicazione della squadra.

## Difetti corretti

| Priorità | Problema | Correzione |
| --- | --- | --- |
| Alta | Due caricamenti della stessa sessione potevano terminare fuori ordine e ripristinare dati o un ruolo precedenti. | Generazione per ogni caricamento; soltanto la richiesta corrente aggiorna lo stato. |
| Alta | Un controllo Auth pendente poteva ripristinare la sessione dopo il logout; i dataset della squadra restavano in memoria. | Controllo della generazione Auth, svuotamento di tutti i dataset e invalidazione delle richieste al logout. |
| Alta | Risposte di salvataggio di eventi e squalifiche potevano aggiornare lo stato dopo un cambio di sessione o squadra. | Guardie condivise su utente, squadra, ruolo ed epoca della sessione, estese anche agli editor di attività, risultati, rosa e presenze. |
| Media | Il cambio password accettava invii simultanei e lasciava modificare i campi durante la richiesta. | Una sola richiesta, campi bloccati durante l'invio, ripristino dopo errore e cancellazione dopo successo. |
| Media | Un errore di rete nell'eliminazione di un evento lasciava i comandi bloccati. | Gestione dell'errore e ripristino dei controlli con `finally`. |
| Media | La scheda giocatore conteggiava convocazioni e minuti anche da attività diverse dalle partite o annullate. | Stesso perimetro sportivo dei report; conversione esplicita dei minuti a numero. |
| Media | Il service worker poteva conservare risposte HTTP fallite, restituire HTML al posto di JavaScript e cancellare cache di altre applicazioni. | Cache solo per asset riusciti, fallback HTML solo per navigazione e pulizia limitata al prefisso Eburum. |
| Bassa | Mancavano tre indici compositi sulle chiavi esterne di squalifiche e comunicazioni. | Migrazione `20261009201417_review_foreign_key_indexes.sql`, applicata e verificata tramite gli advisor. |

## Pulizia effettuata

- Rimossi `brand.css`, `styles.css` e `ui.css`: nessun riferimento nel documento, nei moduli o nel service worker.
- Consolidati navigazione, shell e gestione della rosa; eliminata la costruzione di markup poi scartato o modificato tramite sostituzioni di stringhe.
- Rimosso il vecchio editor autonomo della partita. Il controllo sul database non ha trovato gare senza un'attività collegata; la gestione corrente usa l'editor unico dell'Agenda.
- Rimossa la precedente Dashboard aggregata, mantenendo l'importazione iniziale per la squadra vuota.
- Eliminati i rami del report di squadra, i conteggi dei ritardi non utilizzati e le regole CSS dei template rimossi.
- Corrette documentazione, caratteri danneggiati e descrizione dei permessi dello storico presenze.

Le migrazioni storiche, i test SQL, la libreria PDF e la sua licenza sono necessari. Il campo storico `delay_minutes` rimane compatibile con database, audit e salvataggi: non vengono distrutti dati preesistenti.

## Accessi e database

La funzione `manage-users` verifica il token con Auth e il ruolo corrente in `team_members`. Creazione delle utenze, assegnazione dei ruoli e cambio password altrui richiedono un amministratore della stessa squadra. Le policy RLS distinguono Amministratore, Team manager, Allenatore e Segretario; le note tecniche e i dati amministrativi hanno permessi distinti. Le credenziali di servizio non sono distribuite nel client.

Gli advisor non segnalano più chiavi esterne senza indice nelle tabelle operative. Gli indici segnalati come mai utilizzati sono conservati: il database è recente e questo dato, da solo, non dimostra che siano superflui. [Indicazioni Supabase sugli indici inutilizzati](https://supabase.com/docs/guides/database/database-linter?lint=0005_unused_index).

Restano due avvisi di sicurezza da distinguere:

1. **Protezione contro password compromesse disattivata.** È una configurazione Auth, disponibile dal piano Pro; non è stata attivata né è stato modificato il piano. [Configurazione e requisiti](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).
2. **RPC di importazione iniziale con `SECURITY DEFINER`.** La definizione distribuita verifica sessione, codice monouso e assegnazione protetta con blocco della riga; dopo l'assegnazione respinge gli altri utenti. La funzione rimane intenzionalmente collegata all'importazione iniziale. Non è una registrazione pubblica. [Descrizione dell'avviso](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable).

Le due tabelle private di seed prive di chiave primaria sono materiale dell'importazione iniziale, escluso dai normali flussi operativi. [Descrizione dell'avviso](https://supabase.com/docs/guides/database/database-linter?lint=0004_no_primary_key).

## Verifiche e limiti

- Suite automatica: 16 test superati, comprese dieci regressioni mirate in `runtime-safety.cjs`.
- Analisi statica dei moduli caricati insieme: nessuna variabile inutilizzata o identificatore non definito rilevato.
- Policy e advisor verificati sul database distribuito; nessuna creazione di account reali durante questa revisione.
- Controlli di sintassi e coerenza degli asset, oltre alla verifica HTTP della release.

I test UI usano un DOM simulato: non sostituiscono una verifica visiva su dispositivi reali. La funzione amministrativa è coperta da test simulati e dalla revisione del controllo autorizzativo, senza cambiare password o ruoli dello staff.

## Aggiornamento PWA, Realtime e storico

Completato il passaggio a moduli ES con import ed export espliciti. Nell'architettura React corrente `src/main.tsx` avvia l'applicazione e `src/runtime.ts` registra le estensioni; `app-hooks.js` compone slot nominati per Dashboard, strumenti, partite e scheda giocatore. Le funzioni non vengono più ridefinite da file successivi e la composizione non cerca sottostringhe nelle classi HTML.

Le icone PNG 180, 192 e 512 sono derivate dall'emblema SVG esistente. Il manifest usa icone normali e una versione maskable separata, con il simbolo dentro l'area sicura; iOS riceve il PNG 180. Il service worker v27 include l'intero grafo di moduli e tutte le icone.

`app-data.js` carica attività, sessioni e partite della stagione selezionata e recupera i dati collegati tramite identificativi, in lotti paginati. Il selettore consente di consultare le stagioni precedenti. I report caricano separatamente il periodo richiesto, mantenendo “Tutto lo storico”, grafici e PDF. Un risultato di report obsoleto non può sovrascrivere un nuovo filtro o una nuova sessione.

La migrazione `20261009203300_staff_communications_private_realtime.sql` è applicata al database. Il trigger invia una notifica priva di contenuti a un canale privato della squadra su inserimento, modifica e cancellazione. La policy di `realtime.messages` autorizza soltanto i membri della squadra del canale. Il client rilegge i messaggi tramite RLS e aggiorna Dashboard e pannello: nessun polling del database. Al rientro online, al ritorno sulla pagina e alla riconnessione recupera gli aggiornamenti mancati; il logout rimuove il canale e scarta richieste obsolete. Le scadenze restano assegnate dal server, nascoste al termine e cancellate dal job ogni minuto.

È usato [Broadcast da trigger](https://supabase.com/docs/guides/realtime/broadcast), anziché Postgres Changes: non richiede di aggiungere la tabella alla publication e permette di isolare anche le cancellazioni senza trasmettere contenuti o identificativi di altre squadre. La [policy del canale privato](https://supabase.com/docs/guides/realtime/authorization) viene verificata dal server.

Verifica effettiva sul database di produzione con SDK Supabase 2.57.4 e WebSocket: account segretario collegato alla UI in DOM simulato, pubblicazione da un altro account, aggiornamento della Dashboard e del pannello aperto, cancellazione remota, pubblicazione e rimozione del segretario. Un account di un'altra squadra è stato respinto dal canale e non ha letto la riga via REST. Account, giocatore e comunicazioni sintetici erano isolati dallo staff e sono stati rimossi. Test SQL di durata, autore, permessi, scadenza e pulizia passati con rollback. Il job di pulizia risulta attivo, con esecuzioni recenti riuscite.

Suite: 20 test superati. Rimane il limite già indicato: i test UI sono eseguiti in un DOM simulato e non rappresentano una prova visiva su un iPhone fisico.


## Correzione della fedeltà Club Office (11 ottobre 2026)

Il prototipo scelto è il riferimento visivo. Il precedente redesign dimostrativo è archiviato fuori dal repository e non viene incluso nella build. Sono eliminati i vecchi selettori della home sostituita; `app-main.js` e il worker sorgente inattivo restano rimossi. Il rendering delle nuove schermate usa un solo runtime e il presenter esplicito per gli editor, conservando funzioni operative, permessi e audit. Le migrazioni e lo storico sportivo sono necessari e rimangono conservati.

La suite corrente comprende 31 prove dei moduli ES, 15 prove React e 2 prove sulla build PWA. Le due regressioni aggiunte verificano la conservazione delle risposte non salvate durante la navigazione e l'isolamento dell'editor ammonizioni. Il selettore compatto del periodo report conserva il caricamento dello storico completo senza sovrascrivere la stagione corrente. La verifica visiva è separata dai test funzionali e usa il prototipo approvato come riferimento.


La revisione statica dei moduli ES ha individuato un import mancante di `trackDialogDraft` nella scheda giocatore. Era mascherato dal test harness storico, che espone gli export nel contesto di test: i moduli reali richiedono un import esplicito. Corretto e coperto con una prova che monta il frontend React reale, apre la scheda amministrativa, modifica una scadenza e verifica che l'annullamento della chiusura conservi la bozza senza scritture. L'analisi ESLint `no-undef` e `no-unused-vars` dei moduli ES ora restituisce 0 rilievi. Le funzioni di registrazione indicate dalla scansione limitata ai file JS sono utilizzate da `src/runtime.ts` e vengono conservate.


Conclusione Club Office: tutti i sei finding di fedeltà assegnati sono risolti (verdetto in .impeccable/review/club-office-fidelity/rebuild-fix-verdict.md). 49 test passati e anteprima READY verificata; dettagli e limiti in AUDIT_MIGRATION.md. Rimosso anche il parametro mobile di NavItem divenuto inutilizzato dopo la sostituzione dell'indicatore animato. Restano intatti i moduli di dominio e i record storici utilizzati dai report.
