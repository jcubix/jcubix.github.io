# Gestione accessi

La funzione `manage-users` verifica la sessione con Auth e la membership corrente sul server. Solo gli amministratori della squadra possono elencare e creare utenti, assegnare ruoli o cambiare le password degli altri utenti della stessa squadra. Le nuove utenze sono associate alla stessa squadra dell'amministratore. I dati delle altre squadre restano isolati tramite RLS.

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

Il cambio password usa `auth.admin.updateUserById` sul server e accetta soltanto il campo password (12–128 caratteri). Il client richiede conferma, non legge password esistenti e cancella i campi dopo il successo. Le richieste per utenti di altre squadre o per lo stesso amministratore sono respinte.

# Flusso operativo

Allenamento rapido distingue Sondaggio (disponibilità pianificate in `activity_roster`) e Presenze (registrazioni effettive in `attendance`). Il sondaggio usa il salvataggio atomico dell’attività; non crea sessioni di presenza. L’apertura delle presenze importa solo le risposte ricevute, mantenendo separata la disponibilità prevista. Lo staff conferma l’intera sessione nel riepilogo e modifica solo le eccezioni reali. Il collegamento server già esistente conclude la stessa attività pianificata, conservandone le risposte.

Le fasi Prima, Durante e Dopo della partita sono suggerite in base a data, orari e stato; non simulano cronometri o minuti. Gli eventi e il risultato mantengono salvataggi espliciti. Modifiche in bozza e conflitti restano visibili; i campi sono bloccati durante le richieste.

La Dashboard mostra risposte da registrare, attività trascorse da completare e scadenze entro 30 giorni. I dettagli si aprono sulla lista pertinente. Le percentuali della squadra si riferiscono agli ultimi 30 giorni e alle registrazioni effettive.

I report distinguono presenze effettive, disponibilità previste e impiego. Ogni indicatore apre le registrazioni del periodo; i dettagli dei giocatori mantengono lo stesso intervallo. Le percentuali usano come denominatore le registrazioni di presenza, non il numero attuale di giocatori. Gol e cartellini dei giocatori richiedono un giocatore associato; le attività annullate sono escluse dai dati sportivi e dalle disponibilità previste.

## Ruoli dello staff

| Funzione | Amministratore | Team manager | Allenatore | Segretario |
| --- | --- | --- | --- | --- |
| Consultare agenda, presenze, partite e report | Si | Si | Si | Si |
| Registrare presenze, convocati, risultati ed eventi | Si | Si | Si | No |
| Creare e aggiornare rosa, tesseramenti e scadenze | Si | Si | No | Si |
| Leggere e aggiornare note tecniche riservate | Si | No | Si | No |
| Creare utenze, assegnare ruoli, cambiare password altrui | Si | No | No | No |
| Eliminare definitivamente dati sportivi | Si | No | No | No |

Le autorizzazioni usano la membership nel database, non i metadati modificabili dall'utente. Il ruolo Segretario e selezionabile da Gestione utenti sia in creazione sia sulle utenze esistenti. Nessuna utenza esistente viene riassegnata automaticamente. Le scadenze compaiono nella Dashboard e in Altro > Scadenze e tesseramenti. I dati amministrativi sono modificabili dalla scheda del giocatore. Le modifiche sportive sono bloccate dalle policy RLS anche per chiamate API dirette.
