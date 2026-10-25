# Flussi quotidiani dello staff

Estensione dello stile Soft Club, 11 ottobre 2026. La navigazione e tutte le funzioni di Altro restano disponibili.

## Percorsi

- Home: priorità coerenti con il ruolo, risposte degli allenamenti futuri, presenze trascorse ancora da confermare, avvisi importanti da leggere e documenti da verificare. Un allenamento con presenze registrate mostra il registro effettivo e non solleciti di vecchi sondaggi.
- Allenamenti: Risposte WhatsApp, Presenze da confermare, Storico. Lo storico apre le presenze effettive, con riepilogo, copia per WhatsApp e cronologia; le eventuali risposte originali rimangono consultabili separatamente. Una risposta storica mancante non viene trattata come assenza.
- Partite: Gara, Convocati, Impostazioni. La gara apre direttamente risultato ed eventi; nella distinta si assegnano titolari e panchina senza aprire schede aggiuntive. Organizzazione e stato si modificano nelle impostazioni. Il riepilogo controlla risultato, titolari, durata ed entrate/uscite; la conclusione senza risultato è rifiutata anche dal database. Lo 0–0 è valido. I controlli segnalano le anomalie della distinta senza riscrivere i dati storici.
- Rosa: la scheda collega presenze effettive, convocazioni, minuti, gol, cartellini e il report individuale con esportazione PDF. Le statistiche sintetiche seguono la stagione; nel report si può selezionare tutto lo storico.
- Comunicazioni: filtri Generali, Per giocatore, Da confermare e In scadenza. Alla pubblicazione si può richiedere una conferma di lettura. Aprire un avviso non lo conferma: ogni utente registra esplicitamente la propria lettura. Nomi e data delle conferme sono consultabili dallo staff della stessa squadra. La scadenza originale di 1/3/7 giorni resta valida.
- Scadenze: distingue Mancante, Da verificare, In scadenza e Scaduto. Il presidente continua a vedere soltanto la proiezione sintetica, senza date e contatti riservati.

Le risposte non sono nuovi sondaggi interni: il sondaggio rimane su WhatsApp. Nessuna chat IA o monitoraggio dei ritardi è stato aggiunto. I permessi dei sei ruoli restano quelli di STAFF_ROLES.md.

## Database

Migrazione applicata: `20261011171426_daily_workflow_history_and_receipts.sql`.

`communication_receipts` conserva una conferma per messaggio e lettore. La RPC verifica squadra, autenticazione, richiesta di conferma e scadenza; il server assegna lettore, nome e data. Le conferme non sono modificabili e vengono eliminate con la comunicazione scaduta. Realtime usa il canale privato già esistente.

`activity_history` registra dal server organizzazione, risposte/convocazioni, risultato ed eventi. Lo staff della stessa squadra può leggerlo, senza inserire o alterare la cronologia. È disponibile dall'attivazione: non inventa autore e cronologia delle modifiche precedenti. Lo storico delle presenze mantiene il proprio audit esistente.

La migrazione non converte presenze, minuti manuali o cartellini. Conteggi e impronte complete delle righe confrontati prima e dopo: 30 giocatori, 20 sessioni, 587 registrazioni di presenza, 2 partite, 22 eventi e 4 membership, invariati.

## Verifica

- `npm run verify`: 37 test di dominio, 27 integrazioni React, 2 test PWA; tutti superati.
- `npm run format:check` e `git diff --check`: superati.
- `supabase/tests/daily_workflows.sql`: eseguito sul database con fixture isolate e rollback, verificando conferme idempotenti, lettore/squadra/scadenza, cronologia immutabile, autore server e conclusione della partita.
- `supabase/tests/staff_roles.sql`: rieseguito sul database con rollback, inclusi permessi e minuti automatici delle sostituzioni.
- Browser: 39 controlli a 320/390/768/1440 px su quattro ruoli, senza overflow o errori JavaScript. 16 acquisizioni mobile/desktop; revisione Impeccable indipendente `ship`.

Le schermate autenticate sono state collaudate con fixture browser e integrazioni. Non viene attestato un collaudo manuale con account reali o su iPhone fisico.

## Pubblicazione

Anteprima `dpl_9ima72EGEXeZ1DfszPT3fMygEkJo`: 39 controlli browser delle schermate autenticate su dati sintetici, 21 asset verificati, login responsive e PWA attiva. Gli stessi file sono pubblicati in produzione, deployment `dpl_BpEsHpzXxXbpTtR64TypGQhQ7sHZ`, READY su https://eburum.vercel.app. Sul dominio sono confermati asset coerenti, service worker attivo, icona PNG iOS e assenza di overflow/errori JavaScript nel login. Non sono inclusi sorgenti, test o fixture nel pacchetto pubblicato. Nessun commit o push eseguito; il lavoro preesistente è conservato.

Rollback applicativo disponibile: precedente produzione `dpl_4yLienZHjQFgh7e6GWJBc6oZBcnu`. La migrazione è additiva e compatibile con quella build; un rollback applicativo non richiede la cancellazione della nuova cronologia o delle letture.

## Tabellino gara — 18 ottobre 2026

Nella scheda di una partita salvata, **Esporta tabellino** apre l'anteprima con formazione titolare, cronologia degli eventi e risultato. **Copia testo** prepara il contenuto da incollare su WhatsApp; **Scarica PDF** genera il documento sul dispositivo. Le modifiche in bozza devono essere salvate prima dell'esportazione.

Il formato usa i cognomi e aggiunge il prefisso del nome necessario per distinguere gli omonimi, ad esempio Verderame S / C e Pirozzi Ant / Ani. Titolari e cambi includono anche i giocatori ora inattivi. Le sostituzioni riportano prima l'uscente, poi il subentrato. Scrivere RIG o Rigore nei dettagli di un gol produce l'indicazione (RIG). I dettagli degli altri eventi vengono conservati.

In trasferta l'avversario e il suo punteggio vengono prima di Eburum. Il risultato proviene dai punteggi salvati, non dal conteggio degli eventi; uno 0-0 è valido e un risultato mancante resta da registrare. Per gare ancora programmate nella data corrente/futura la dicitura è Risultato registrato, senza dichiarare la gara conclusa. Le partite annullate restano esplicitamente indicate.

L'esportazione è disponibile anche nella scheda in consultazione: non concede permessi di modifica e non include osservazioni tecniche o dati amministrativi riservati. Il PDF supporta più pagine; se il caricamento del modulo fallisce si può riprovare. Il cambio di account o la chiusura dell'anteprima annullano le esportazioni ancora in attesa.

## Gestione rapida della gara — 18 ottobre 2026

**Gara** mostra subito il risultato e i comandi Gol Eburum, Gol avversari, Ammonizione, Sostituzione e Altro evento. Il modulo dell'evento si apre nella pagina, senza finestre sovrapposte. Altro evento mantiene accessibili anche espulsioni e note. Per i cambi si selezionano minuto, uscente e subentrato; gli elenchi seguono i convocati e gli eventi già registrati. Il calcolo automatico assegna al subentrato i minuti rimanenti, considerando anche eventuali cambi successivi ed espulsioni.

Un gol con un giocatore indicato incrementa Eburum; un gol senza giocatore incrementa gli avversari ed è descritto come **Gol Squadra avversaria**, anche nel tabellino. Modificare l'attribuzione o eliminare un gol rettifica il risultato nella stessa transazione. Il punteggio rimane correggibile manualmente. La migrazione `20261018112516_match_event_score_sync.sql` agisce solo sulle modifiche successive: non ricalcola lo storico dai gol e non converte i minuti manuali.

**Convocati** permette di selezionare i giocatori e assegnare Titolare/Panchina direttamente nella riga. Dettagli conserva posizione e minuti manuali. Formazione e note tecniche sono raccolte nella stessa scheda, secondo i permessi esistenti. **Impostazioni** contiene data, avversario, casa/trasferta, ritrovo e stato. I salvataggi di una partita esistente mantengono aperta la scheda e ricaricano soltanto i dati della gara.

Le bozze restano protette durante la navigazione. Un errore mantiene i campi compilati; un nuovo tentativo dopo una risposta persa riusa l'identificativo dell'evento. Se l'evento è salvato ma la lettura aggiornata fallisce, Ricarica gara ripete solo la lettura. Le revisioni server impediscono di sovrascrivere una gara modificata nel frattempo.

## Espulsioni e provvedimenti — 18 ottobre 2026

**Altro → Cartellini e diffide → Espulsioni** riunisce gli eventi associati ai giocatori, anche inattivi, con data, avversario, minuto, provvedimento e gare confermate. È raggiungibile anche dal pulsante Cartellini in Partite e dalla scheda del giocatore. Il filtro evita di anteporre il riepilogo delle ammonizioni; la spiegazione dei conteggi resta in Come leggere i cartellini.

1. Registra l'espulsione nella partita e associa il giocatore. Le espulsioni senza giocatore vengono segnalate e non ricevono una squalifica presunta.
2. Con Registra provvedimento inserisci le giornate oppure la data finale inclusa stabilita dal comunicato, con riferimento e note facoltative. Il sistema non deduce la pena dal cartellino e non rileva automaticamente una doppia ammonizione come espulsione.
3. Per una squalifica a giornate usa Conferma gara scontata per ogni gara effettivamente saltata nella competizione prevista dal provvedimento. Servono una gara successiva già disputata, risultato registrato e nessun minuto del giocatore. La stessa gara non copre contemporaneamente una squalifica da ammonizioni o un'altra da espulsione. Il residuo si aggiorna solo dopo conferma esplicita.
4. Per una squalifica fino a una data, il giorno indicato è compreso; in seguito compare Termine raggiunto. Le giornate non vengono scalate da questa modalità.

Le conferme si possono annullare e i provvedimenti correggere o annullare conservandone lo storico. Se cambia il giocatore o il tipo dell'evento, un provvedimento attivo va prima annullato; prima di riassegnarlo occorre rimuovere le eventuali conferme incompatibili. L'eliminazione dell'espulsione elimina anche provvedimento e conferme collegate, con avviso esplicito.

I provvedimenti aperti di stagioni precedenti rimangono visibili. Una correzione ai minuti o l'annullamento della gara può rendere una conferma Da verificare. La distinta e la Rosa mostrano un avviso informativo: non bloccano automaticamente la convocazione e non certificano l'idoneità federale del giocatore. Le assenze dagli allenamenti non scalano squalifiche.

Amministratore, team manager, allenatore e collaboratore tecnico registrano i provvedimenti e le conferme; gli altri ruoli consultano. La migrazione `20261018125054_dismissal_sanctions.sql` aggiunge tabelle con RLS, controlli server, revisioni e audit; non modifica gli eventi o i dati storici esistenti. I controlli di sicurezza preesistenti restano invariati.
