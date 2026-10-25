# Eburum Team Manager

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Staff di una squadra di calcio: amministratore, team manager, allenatore, segretario, collaboratore tecnico, presidente e tesoriere. Solo gli amministratori creano utenze e modificano le password altrui. Il segretario consulta i dati sportivi e gestisce i dati amministrativi e le scadenze. Il collaboratore registra risposte, presenze, risultati ed eventi e aggiorna le osservazioni tecniche, senza modificare organizzazione, convocazioni o modulo. Il presidente consulta i dati sportivi, lo stato sintetico delle scadenze e l'economia e pubblica comunicazioni; non amministra gli accessi o i dati riservati. Il tesoriere gestisce fondi, movimenti, ricevute, verifiche e rendiconti; consulta i dati sportivi e pubblica comunicazioni, senza modifiche sportive né accesso a osservazioni tecniche, documenti e contatti amministrativi riservati o gestione utenti. La matrice completa è in `eburum/STAFF_ROLES.md`.

## Product Purpose

Registrare e consultare il lavoro quotidiano della squadra, con flussi distinti per allenamenti e partite, utilizzabili da smartphone e desktop.

## Operating Context

I sondaggi degli allenamenti vengono creati su WhatsApp. Lo staff trascrive le risposte nella webapp, identifica chi non ha risposto e copia i nomi da sollecitare. Durante o dopo l'allenamento conferma le presenze effettive, precompilate dalle risposte; chi non ha risposto resta da confermare. Una risposta prevista non è una presenza effettiva.

Per le partite lo staff inserisce direttamente la distinta dei convocati, titolari e panchina, poi risultato, gol, cartellini, sostituzioni e note. Non serve un sondaggio nella scheda partita. I minuti delle nuove partite si calcolano dagli eventi e dalla durata impostata. I minuti storici manuali vengono preservati.

## Capabilities and Constraints

- Allenamenti e Partite sono sezioni autonome; non una scheda generica con un selettore del tipo.
- Le presenze degli allenamenti sono Presente, Assente o Infortunato, con nota facoltativa. Solo la conferma definitiva aggiorna i report.
- Le nuove riunioni sono inviti in Comunicazioni, con data, ora, luogo, ordine del giorno e conferma di lettura obbligatoria. Li pubblicano amministratore, team manager e allenatore; tutto lo staff può consultarli e confermare la lettura, senza dichiarazione di partecipazione. Le riunioni già presenti restano consultabili in Comunicazioni → Riunioni già registrate.
- Lo storico, i report per giocatore, i grafici e i PDF devono restare consultabili.
- Gli avvisi dello staff durano 1, 3 o 7 giorni dalla pubblicazione e scadono sul server. Gli inviti durano fino all’appuntamento e per 1, 3 o 7 giorni successivi, con data e ora riferite a Europe/Rome.
- Le squalifiche per cinque ammonizioni richiedono conferma manuale della gara saltata.
- Le espulsioni hanno un monitor dedicato con durata inserita dallo staff dal comunicato: giornate oppure data finale inclusa. Le gare scontate richiedono conferma esplicita; i provvedimenti aperti di stagioni precedenti restano visibili. Rosa e distinta segnalano le situazioni aperte senza bloccare automaticamente le convocazioni.
- Solo gli amministratori inseriscono e modificano nome e cognome delle utenze staff. La home saluta con il nome, oppure con «Bentornato» se manca; la gestione utenti mostra l’email quando il nominativo è vuoto.
- La home raccoglie le priorità operative pertinenti al ruolo nel gruppo Da completare: risposte, presenze, partite, comunicazioni da confermare e documenti da verificare, secondo dati e permessi disponibili.
- Allenamenti distingue Risposte WhatsApp, Presenze da confermare e Storico. Gli allenamenti conclusi aprono le presenze effettive; una risposta WhatsApp mancante nello storico non equivale a un’assenza. Il cambio di attività o ambito protegge le modifiche non salvate e i salvataggi in corso.
- La scheda partita distingue Gara, Convocati e Impostazioni. Risultato ed eventi si aggiornano nella stessa pagina; i titolari si assegnano direttamente nella distinta. Un gol con giocatore incrementa Eburum, un gol senza giocatore incrementa la squadra avversaria; modifica ed eliminazione rettificano il punteggio. I punteggi storici restano invariati all'attivazione. Prima della conclusione vengono verificati i dati mancanti; la navigazione protegge le bozze. Risultati, eventi e osservazioni restano registrazioni dello staff.
- La scheda giocatore riunisce i totali della stagione selezionata: convocazioni, minuti registrati, presenze effettive, gol e cartellini. Un unico ingresso Report e PDF del giocatore conduce al report e alla sua esportazione.
- Gli avvisi importanti possono richiedere conferma di lettura. Ogni utente conferma esplicitamente la propria lettura; aprire il messaggio non registra la conferma. La bacheca mostra conferme, lettori e date e filtra Tutte, Generali, Per giocatore, Da confermare e In scadenza.
- Lo storico modifiche proviene dal server e copre le modifiche registrate dall’attivazione della funzione; non ricostruisce retroattivamente le operazioni precedenti.
- Documenti e scadenze distingue date mancanti da verificare, documenti in scadenza entro 30 giorni e documenti scaduti. I dettagli amministrativi seguono i permessi esistenti; il presidente consulta lo stato sintetico.
- Copie WhatsApp di solleciti, convocazioni e riepiloghi riducono la trascrizione ripetuta; il contesto distingue dati salvati e bozze quando necessario. La webapp non invia questi messaggi automaticamente.
- Altro → Economia è accessibile ad amministratore e tesoriere per la gestione e al presidente in sola lettura, incluse ricevute e cronologia. Gli altri ruoli non accedono ai dati economici. La Home del tesoriere presenta disponibilità, entrate, uscite e l'ingresso Economia; calendario e sezioni sportive restano consultabili.
- La prima versione economica registra soltanto incassi e pagamenti effettivi, con importi in centesimi, categoria, descrizione, data e attività facoltativa. Casse e conti hanno un saldo iniziale distinto dagli incassi. Il periodo Dal/Al è indipendente dalla stagione sportiva; le date future non sono ammesse.
- I trasferimenti tra fondi producono due registrazioni opposte atomiche, senza cambiare la disponibilità totale o le entrate/uscite. Le correzioni avvengono con storno e conservano l'originale; lo storno di un trasferimento rettifica entrambi i fondi. La verifica confronta saldo osservato e registrato senza creare movimenti; se coincidono può chiudere il fondo fino alla data scelta. I periodi chiusi consentono soltanto rettifiche con data successiva, senza riapertura.
- Le ricevute PDF, JPG, PNG e WebP fino a 10 MB sono private. Se l'allegato fallisce dopo il salvataggio del movimento, l'interfaccia dichiara che la registrazione è salvata e permette di ritentare il solo allegato. Bozze e salvataggi sono protetti; identificativi di richiesta riutilizzati nei retry evitano duplicazioni, con controllo dei possibili duplicati e audit server.
- Il rendiconto esporta il periodo completo in PDF e CSV compatibile con Excel, anche oltre 500 movimenti; il CSV conserva importi numerici e protegge i campi testuali dalle formule. Non è prevista l'esportazione XLSX. La vista iniziale mostra gli ultimi 100 movimenti con Carica tutti; verifiche e audit mostrano rispettivamente le ultime 30 e 50 righe con limite dichiarato. Richieste di rimborso e approvazioni restano future. I dettagli operativi sono in `eburum/TREASURY.md`.
- Non sono introdotti chat IA, sondaggi interni o ritardi artificiali. La navbar ordinaria mostra Home, Allenamenti, Comunicazioni, Partite e Altro; presidente e tesoriere vedono Home, Comunicazioni, Economia, Partite e Altro. Altro conserva Rosa, Lavagna tattica, Report giocatori, Registro, Documenti e scadenze, Cartellini e diffide, Gestione utenti ed Economia, con la visibilità prevista dal ruolo.

## Brand Commitments

Nome EBVRVM/Eburum. Interfaccia business minimale, coerente con i colori sociali navy e crema e dettagli oro; chiarezza dei bordi, dei contrasti e degli stati su mobile e desktop.

## Product Principles

- Distinguere risposta prevista, presenza effettiva e convocazione.
- Ridurre le azioni durante allenamenti e partite senza trasformare supposizioni in dati definitivi.
- Preservare storico e permessi della squadra condivisa.
- La lavagna tattica consente ad amministratore, allenatore e collaboratore tecnico di disegnare su campo o foto private, spostare pedine, aggiungere frecce, cerchi e note e collegare il lavoro a un allenamento o a una partita. Le lavagne si salvano per lo staff tecnico e si esportano in PNG; i conflitti di revisione proteggono il lavoro dei colleghi. Non è una modifica simultanea in tempo reale. Dettagli in `eburum/WHITEBOARD.md`.
