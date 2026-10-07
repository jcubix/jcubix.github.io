# Gestione accessi

La funzione `manage-users` verifica la sessione con Auth e la membership corrente sul server. Solo gli amministratori della squadra possono elencare e creare utenti o assegnare ruoli. Le nuove utenze sono associate alla stessa squadra dell'amministratore. I dati delle altre squadre restano isolati tramite RLS.

Il trigger `eburum_require_managed_account` blocca la creazione di utenti senza `app_metadata.managed_account = true`. I metadati applicativi sono assegnabili soltanto dal backend privilegiato: passare `user_metadata`, anche con nomi identici, non consente la registrazione. Le nuove utenze vanno create dalla schermata Utenti; la creazione diretta dal dashboard richiede il medesimo metadato applicativo.

Il primo amministratore viene individuato dal proprietario registrato in `private_import.bootstrap_state`, senza inserire identificativi o email nel repository. Gli utenti condividono i dati della squadra attraverso `team_members`: non vengono create copie della rosa o dello storico. Il proprietario resta amministratore; gli altri ruoli sono modificabili dalla schermata Utenti.

La funzione usa i segreti standard del runtime Supabase, mai esposti al client. La sessione è verificata esplicitamente con `getUser(token)` prima di qualsiasi operazione amministrativa. Il controllo JWT legacy del gateway è disattivato per compatibilità con le chiavi publishable e le firme asimmetriche, come descritto nella [documentazione Supabase](https://supabase.com/docs/guides/getting-started/migrating-to-new-api-keys). Le richieste anonime o con token falsificati ricevono 401; gli utenti senza ruolo amministratore ricevono 403. Si consiglia inoltre di disattivare "Allow new users to sign up" nelle impostazioni Auth: il trigger protegge la registrazione anche senza questa impostazione.

Le password iniziali sono scelte dall'amministratore (almeno 12 caratteri); la creazione non invia email automaticamente.

# Presenze e correzioni

`save_attendance_session` salva sessione e presenze in una sola transazione con i permessi dell'utente. Le nuove sessioni includono tutta la rosa attiva; le correzioni conservano i partecipanti originali, anche se oggi inattivi. La revisione impedisce di sovrascrivere correzioni concorrenti. Un identificativo di richiesta rende sicuro riprovare una nuova sessione dopo un errore di rete: il payload deve coincidere con quello già salvato.

I trigger assegnano autore e orario sul server e scrivono le differenze in `attendance_history`, leggibile soltanto dal proprietario e non modificabile dal client. Le modifiche antecedenti alle migrazioni non vengono ricostruite. Lo storico appartiene alla sessione e viene rimosso se questa viene eliminata.

Il test SQL `tests/attendance_review.sql` verifica atomicità, ripetizione del salvataggio, conflitti, audit, giocatori inattivi e isolamento tra utenti; termina con `ROLLBACK`. Va eseguito con un collegamento amministrativo sul progetto inizializzato, preferibilmente in staging.

# Agenda e squadra condivisa

`activities` collega appuntamenti, partite e sessioni registrate. Le partite create dalla schermata Partite compaiono nell'Agenda; le presenze completano l'attività programmata dello stesso giorno e tipo. Convocazioni, risposte ricevute, titolari, panchina, posizioni e minuti sono conservati in `activity_roster`. I minuti effettivi sono inseriti dallo staff; le sostituzioni registrano entrato, uscito e minuto senza inventare durata o recupero della partita.

`save_team_activity` salva attività, convocazioni e note tecniche in una transazione, verifica la revisione e blocca la ripetizione di una richiesta di creazione già conclusa. Sono consentiti al massimo 11 titolari e l'impiego è riservato alle partite. I collegamenti tra giocatori e attività sono vincolati alla stessa squadra con chiavi esterne composite.

Amministratori e team manager gestiscono rosa e `player_administration` (scadenze, tesseramento, recapito di emergenza). Amministratori e allenatori accedono a `activity_technical` (modulo e note tecniche). Lo staff legge attività, risultati e presenze; le eliminazioni definitive delle tabelle storiche sono riservate agli amministratori. I controlli sono sul database, oltre che nell'interfaccia.

`tests/team_operations.sql` verifica con `ROLLBACK` condivisione dello staff, isolamento tra squadre, blocco degli accessi anonimi, scadenze protette, note tecniche protette, salvataggio atomico, conflitti, ripetizione delle richieste e collegamento tra allenamento programmato e presenze.
