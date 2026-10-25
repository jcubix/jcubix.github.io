# Economia e tesoriere

La sezione **Altro → Economia** gestisce fondi effettivi della squadra, indipendenti dalla stagione sportiva. Il periodo si sceglie con Dal/Al. Per iniziare, l'amministratore assegna il ruolo Tesoriere da Gestione utenti e apre almeno una cassa o un conto con data e saldo reale iniziale. Nessun ruolo esistente viene cambiato automaticamente.

## Permessi

Amministratore e tesoriere aprono fondi, registrano entrate/uscite, trasferimenti, storni, ricevute e verifiche. Il presidente consulta tutti i fondi, i rendiconti, le ricevute e la cronologia, senza modifiche. Gli altri ruoli non accedono all'area economica. I controlli valgono anche sul database, attraverso RLS e RPC autorizzate; nascondere un pulsante non costituisce la protezione.

Il tesoriere consulta calendario e dati sportivi pubblici della squadra e pubblica comunicazioni. Non modifica rosa, presenze, convocazioni, risultati o utenti e non legge osservazioni tecniche riservate, documenti e contatti amministrativi. La sua Home presenta disponibilità, entrate e uscite e l'accesso a Economia; le altre sezioni restano nel menu.

## Registrazioni

- Importi salvati come centesimi interi. Si accettano virgola o punto e massimo due decimali, senza separatori delle migliaia.
- Solo incassi e pagamenti effettivi, con categoria, descrizione, data e attività facoltativa. Le date future non sono consentite.
- Il saldo iniziale non è un incasso. Disponibilità finale = saldo precedente + saldi iniziali del periodo + entrate nette − uscite nette.
- Un trasferimento ha due registrazioni opposte nella stessa transazione. Non cambia la disponibilità totale e non conta come entrata/uscita.
- Le correzioni si effettuano con storno; originale e rettifica restano consultabili. Lo storno di un trasferimento rettifica entrambi i fondi atomicamente. Non si cancellano registrazioni né si modifica un saldo iniziale già registrato.
- La verifica confronta il saldo osservato con quello registrato, senza creare movimenti. Se coincidono si può chiudere il fondo fino a quella data. Dopo la chiusura sono consentite rettifiche con data successiva; non è prevista la riapertura del periodo.
- Salvataggi con identificativo univoco e riuso della stessa risposta in caso di retry, serializzazione per squadra, conferma esplicita dei possibili duplicati, autore determinato sul server e audit.

## Ricevute ed esportazioni

PDF, JPEG, PNG e WebP fino a 10 MB, in bucket privato `finance-receipts`. Amministratore e tesoriere caricano; presidente consulta. Nessun URL pubblico. Se il movimento è salvato ma l'allegato fallisce, la schermata dichiara lo stato e permette di riprovare solo il caricamento. L'uscita dalla bozza richiede conferma.

PDF e CSV compatibile con Excel esportano tutti i movimenti del periodo, con paginazione oltre 500 righe. Il CSV conserva gli importi numerici e neutralizza le formule nei campi testuali. Non è un file XLSX. Originali, storni e trasferimenti rimangono nel dettaglio esportato.

La schermata mostra inizialmente gli ultimi 100 movimenti; Carica tutti recupera il periodo completo. Le verifiche mostrano le ultime 30 righe e l'audit le ultime 50, con limite dichiarato. Richieste di rimborso e approvazioni non fanno parte di questa prima versione.

## Verifica

`npm run verify`: build TypeScript/Vite, test di dominio, interazioni React e PWA. I test mirati coprono sette ruoli, accessi diretti, denaro al centesimo, doppio invio, errore/ripresa degli allegati, cambio squadra, esportazione di 501 righe e protezione formule CSV.

`supabase/tests/treasury.sql`: squadra sintetica isolata, rollback finale; saldi, trasferimenti e storni atomici, replay, duplicati, periodi chiusi, date future, ricevute private, presidente in sola lettura e isolamento fra squadre. Eseguiti anche `staff_roles.sql` e `managed_auth_creation.sql` sul database.

Fingerprint prima/dopo identici per 30 giocatori, 20 sessioni, 587 presenze, 2 partite, 22 eventi e 4 utenze. Nessun dato di prova conservato. Verifica browser a 390 e 1440 px, controlli di overflow a 320 e 768 px. Nessun test su iPhone fisico disponibile.

L'advisor segnala intenzionalmente RLS senza policy su `private_access.finance_requests`: è un archivio privato accessibile soltanto dalla funzione autorizzata. Restano i rilievi preesistenti su [claim del seed](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable) e [protezione password compromesse](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection), estranei alla nuova area.

## Pubblicazione 11 ottobre 2026

80 test automatici superati. Download PDF e CSV verificati; PDF aperto e renderizzato. Anteprima dpl_96wKAG8i9fcufrveJLqPjzavhKv1 verificata nel browser con dati isolati. Produzione dpl_6o3m3cXvzcGFMnbb5i385KF5KrHS READY, alias https://eburum.vercel.app. Nessun conto finanziario reale o utente di prova creato. Accessi e permessi verificati sul database con fixture in rollback; nessuna creazione di utenze reali tramite browser.
