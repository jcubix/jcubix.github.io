# Eburum — esecuzione dell’analisi completa UI/UX del 2 novembre 2026

Esecuzione ripresa il 3 novembre. Base `fc69d56`; branch `fix/ui-ux-complete-analysis`.

Questa revisione confronta il nuovo documento con il rilascio del precedente audit, senza ripetere correzioni già presenti. Dati, ruoli, API, scritture e regole sulle presenze restano quelli esistenti. Le proposte facoltative e quelle che suggerivano una conclusione non dimostrata dai dati sono indicate nella tabella.

## Esiti per ID

| ID | Esito | Nota | 1280px | 390px |
|---|---|---|---|---|
| P1-01 | Fatto, già risolto | Spazio finale dock + safe area su tutte le liste. I moduli riservano il footer e nascondono la navigazione mobile durante il lavoro, evitando due barre sovrapposte. Geometrie e ultimo contenuto ricontrollati. | [Schermata](output/complete-audit-nov02/1280-light/training.png) | [Schermata](output/complete-audit-nov02/390-light/training.png) |
| P1-02 | Fatto | Atteso è neutro. Un solo comando Assente (nome accessibile Segna assente), reversibile con Annulla. Nessuna spunta verde preaccesa. Le presenze confermate restano nel registro separato. | [Schermata](output/complete-audit-nov02/1280-light/training-editor.png) | [Schermata](output/complete-audit-nov02/390-light/training-editor.png) |
| P1-03 | Fatto, già accessibile | Allenamenti conserva Nuovo allenamento come aria-label e suggerimento. Partite ha Nuova gara visibile anche su telefono. Messaggi conserva Nuova comunicazione. Non viene duplicata l’azione negli stati vuoti. | [Schermata](output/complete-audit-nov02/1280-light/training.png) | [Schermata](output/complete-audit-nov02/390-light/training.png) |
| P1-04 | Fatto | La lista e la gestione hanno già pagine diverse. Le due fasi interne diventano tab sottolineate compatte, distinguibili dal selettore Prossimi/Da confermare. | [Schermata](output/complete-audit-nov02/1280-light/training-editor.png) | [Schermata](output/complete-audit-nov02/390-light/training-editor.png) |
| P1-05 | Fatto | Assenti previsti 0 è neutro nel riepilogo; nel dettaglio il rosso compare solo con assenze maggiori di zero. | [Schermata](output/complete-audit-nov02/1280-light/training.png) | [Schermata](output/complete-audit-nov02/390-light/training.png) |
| P1-06 | Fatto | Copia elenco assenti è nascosto con zero assenti e secondario quando serve. Conferma presenze resta l’azione principale della fase effettiva, con gli stessi limiti temporali e di ruolo. | [Schermata](output/complete-audit-nov02/1280-light/training-editor.png) | [Schermata](output/complete-audit-nov02/390-light/training-editor.png) |
| P2-01 | Fatto | Giocatori mostrati Cognome Nome anche in disponibilità e nei nomi accessibili dei comandi; gli altri percorsi usavano già questo ordine. I nomi degli autori dello staff mantengono la loro identità. | [Schermata](output/complete-audit-nov02/1280-light/training-editor.png) | [Schermata](output/complete-audit-nov02/390-light/training-editor.png) |
| P2-02 | Fatto | Formato condiviso per le schede: mar 3 nov. Oggi/Domani/Tra N giorni è accanto alla data nella Home. Usato anche per risultati, allenamenti, riunioni e schede in sola lettura. Tabelle, campi nativi ed esportazioni mantengono i rispettivi formati; dati mancanti espliciti. | [Schermata](output/complete-audit-nov02/1280-light/dashboard-training.png) | [Schermata](output/complete-audit-nov02/390-light/dashboard-training.png) |
| P2-03 | Fatto, verificato | EBVRVM resta il logotipo. Testi e strumenti usano Eburum; uniformata anche l’intestazione del testo copiabile delle assenze. | [Schermata](output/complete-audit-nov02/1280-light/more.png) | [Schermata](output/complete-audit-nov02/390-light/more.png) |
| P2-04 | Fatto | Il badge di Altro descrive N documenti da verificare ai lettori di schermo. Il conteggio è già presente anche su Scadenze e tesseramenti. Nessuna eliminazione di segnalazioni reali o numero inventato. | [Schermata](output/complete-audit-nov02/1280-light/more.png) | [Schermata](output/complete-audit-nov02/390-light/more.png) |
| P2-05 | Fatto, verificato | Da completare include già presenze da confermare, risultati mancanti e avvisi da leggere quando i dati lo richiedono. documentSummary espone il totale dei giocatori da verificare, non una ripartizione certificati/tesseramenti: non inventata né divisa arbitrariamente. | [Schermata](output/complete-audit-nov02/1280-light/dashboard.png) | [Schermata](output/complete-audit-nov02/390-light/dashboard.png) |
| P2-06 | Non fatto, facoltativo | Conservata la griglia desktop a due colonne. Il documento considera accettabile lo spazio libero; non aggiunti contenuti né spostate altre sezioni per riempirlo. | [Schermata](output/complete-audit-nov02/1280-light/dashboard-training.png) | [Schermata](output/complete-audit-nov02/390-light/dashboard-training.png) |
| P2-07 | Fatto, con correzione semantica | Senza segnalazioni diventa una nota discreta; infortunati e squalificati sono i due indicatori principali. Non si scrive Tutti disponibili: l’assenza di segnalazioni non prova disponibilità o partecipazione. | [Schermata](output/complete-audit-nov02/1280-light/dashboard-training.png) | [Schermata](output/complete-audit-nov02/390-light/dashboard-training.png) |
| P2-08 | Fatto | Pareggio ha testo scuro su grigio più evidente. La Home affianca al simbolo la parola Pareggio (o Vittoria/Sconfitta secondo il risultato reale). | [Schermata](output/complete-audit-nov02/1280-light/dashboard.png) | [Schermata](output/complete-audit-nov02/390-light/dashboard.png) |
| P2-09 | Fatto | Forma recente dalla più recente a sinistra; indicazione esplicita e caratteri di almeno 13px per spiegazione ed esiti. I risultati salvati non vengono riordinati nei dati. | [Schermata](output/complete-audit-nov02/1280-light/matches.png) | [Schermata](output/complete-audit-nov02/390-light/matches.png) |
| P2-10 | Fatto, già risolto | Cartellini rimane in fondo alle Partite e consultabile anche da Altro. Il vecchio titolo Calendario gare è già stato eliminato. | [Schermata](output/complete-audit-nov02/1280-light/matches.png) | [Schermata](output/complete-audit-nov02/390-light/matches.png) |
| P2-11 | Fatto, adattato | Stato vuoto con icona, titolo e indicazione su come creare la gara. Rimane un’unica azione Nuova gara nell’intestazione, evitando il duplicato appena eliminato nel precedente audit. | [Schermata](output/complete-audit-nov02/1280-light/matches.png) | [Schermata](output/complete-audit-nov02/390-light/matches.png) |
| P2-12 | Fatto | Suggerimento già eliminato, filtri su una riga con sfumatura. Aggiorna è nascosto quando il canale è effettivamente SUBSCRIBED; resta disponibile durante connessione e interruzioni. I filtri successivi sono raggiungibili scorrendo o da tastiera. | [Schermata](output/complete-audit-nov02/1280-light/communications-empty.png) | [Schermata](output/complete-audit-nov02/390-light/communications-empty.png) |
| P2-13 | Fatto | Nel raggruppamento per ruolo la tabella ha una sola colonna, senza intestazioni visive ripetute. Con ordinamento per cognome resta la colonna Ruolo nell’elenco non raggruppato. Righe normali circa 48–52px, freccia e azione di almeno 44px; segnalazioni lunghe non vengono troncate. | [Schermata](output/complete-audit-nov02/1280-light/players.png) | [Schermata](output/complete-audit-nov02/390-light/players.png) |
| P2-14 | Fatto, già risolto | Nessuna colonna Numero quasi vuota: il numero è accanto al nome solamente quando presente. | [Schermata](output/complete-audit-nov02/1280-light/players.png) | [Schermata](output/complete-audit-nov02/390-light/players.png) |
| P2-15 | Fatto | Nessun badge Programmato negli allenamenti futuri. Quelli senza registro alla data odierna o precedenti indicano Da confermare come stato della vista, senza riscrivere lo stato salvato. | [Schermata](output/complete-audit-nov02/1280-light/training.png) | [Schermata](output/complete-audit-nov02/390-light/training.png) |
| P3-01 | Fatto | Selettore stagione nel menu account su tutte le larghezze. Rimosso il duplicato centrale e la regola che nascondeva quello dell’account su desktop. Stagione corrente sempre leggibile sotto il logo mobile. | [Schermata](output/complete-audit-nov02/1280-light/dashboard.png) | [Schermata](output/complete-audit-nov02/390-light/dashboard.png) |
| P3-02 | Fatto, già presente e ricontrollato | Guida ha nome accessibile e tooltip visibile anche al focus da tastiera. | [Schermata](output/complete-audit-nov02/1280-light/more.png) | [Schermata](output/complete-audit-nov02/390-light/more.png) |
| P3-03 | Fatto | Rimosso il vecchio ramo inline e il suo testo permanente Nessuna modifica da salvare. Il contatore esistente compare quando ci sono modifiche; Salva è nel footer dedicato. | [Schermata](output/complete-audit-nov02/1280-light/training-editor.png) | [Schermata](output/complete-audit-nov02/390-light/training-editor.png) |
| P3-04 | Fatto | Azioni principali piene e secondarie bordate. Nella Home la larghezza segue il contenuto, compreso Apri Rosa. Il pulsante oro della scheda blu conserva la scelta approvata nel precedente audit e il contrasto verificato. | [Schermata](output/complete-audit-nov02/1280-light/dashboard-training.png) | [Schermata](output/complete-audit-nov02/390-light/dashboard-training.png) |
| P3-05 | Fatto | Titoli dei gruppi Altro a 13px, con spaziatura e colore semantico più leggibile nei due temi. | [Schermata](output/complete-audit-nov02/1280-light/more.png) | [Schermata](output/complete-audit-nov02/390-light/more.png) |
| P3-06 | Fatto | Il conteggio Da confermare non viene renderizzato quando vale zero; la voce del filtro resta disponibile. | [Schermata](output/complete-audit-nov02/1280-light/training.png) | [Schermata](output/complete-audit-nov02/390-light/training.png) |

## Sistema visivo e verifica

- Palette e Figtree conservati. Raggi comuni delle schede a 20px, controlli a 12px, chip a 999px. I comandi circolari del guscio e la navigazione esistente mantengono la propria forma.
- Etichette richieste e badge portati ad almeno 13px; invariata la navigazione già approvata. Focus blu in chiaro e oro in scuro.
- Matrice Chromium a 320/390/1280 nei due temi: schede, leggibilità, contrasto, accessibilità WCAG A/AA, nessun overflow, spazio finale con safe area da 34px e footer separato.
- Nuove verifiche per attesi neutri, annullamento dell’assenza, nessuna copia vuota, contatore reversibile, nomi coerenti, ordine della forma recente, tabella raggruppata compatta e menu stagione desktop.
- Formattazione, lint, build e suite del codice: 176 test. Test dedicato del formato data per valori mancanti, date invalide e passaggi all’ora legale/solare.
- Verifiche WebKit a 320 e 390px nei due temi su disponibilità, salvataggio e colonne dei giocatori; conferma isolata di un caso dopo una mancata interazione nel batch concorrente.
- La CI esegue nuovamente tutti i test del codice e la suite browser completa prima del merge: moduli, errori e riprova, ruoli, utenti, notifiche, report PDF/Excel, Economia, Lavagna e presenze effettive.

Le immagini usano esclusivamente fixture sintetiche locali e una data fissa per rendere i casi riproducibili. Le immagini lunghe mostrano il dock al primo viewport; la raggiungibilità dell’ultimo elemento viene misurata separatamente. I rendering di dettaglio mostrano il pannello scrollabile sopra il footer.

Non effettuati salvataggi sui dati reali né collaudo live con due account Supabase. Il controllo sull’iPhone fisico resta al proprietario, come concordato. Nessuna migrazione o dipendenza aggiunta.

## Schermate complete

| Larghezza | Chiaro | Scuro |
|---|---|---|
| 320px | [Cartella](output/complete-audit-nov02/320-light/) | [Cartella](output/complete-audit-nov02/320-dark/) |
| 390px | [Cartella](output/complete-audit-nov02/390-light/) | [Cartella](output/complete-audit-nov02/390-dark/) |
| 1280px | [Cartella](output/complete-audit-nov02/1280-light/) | [Cartella](output/complete-audit-nov02/1280-dark/) |

## File e manutenzione

Componenti interessati: `src/training`, `src/dashboard.tsx`, `src/pages.tsx`, `src/communications.tsx`, `src/matches/read-only-activity.tsx`, `src/app.tsx` e guida. Il formato breve è condiviso in `app-presentation.js`; esportazioni e campi data non lo utilizzano.

Eliminati il ramo di gestione inline non più chiamato, la relativa didascalia e i selettori CSS diventati inutili per la spunta attesa e il vecchio suggerimento dei filtri. I report HTML di Playwright vengono ignorati per non entrare nella scansione automatica delle classi CSS del build.
