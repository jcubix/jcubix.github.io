# Allenamenti: assenze comunicate e conferma dello staff

29 ottobre 2026. Sostituisce il sondaggio per gli allenamenti ancora da confermare; conserva i registri già salvati.

## Come si usa

1. Crea o apri l’allenamento in Allenamenti. In **Assenze comunicate** tutti i giocatori sono inizialmente attesi; premi la X soltanto per chi ha avvisato. Puoi inserire un motivo facoltativo. Il segno di spunta ritira una segnalazione. Il filtro Assenze comunicate e il riepilogo mostrano i due gruppi.
2. Premi **Salva** nella barra di lavoro: il contatore indica quanti giocatori hanno una disponibilità o un motivo modificato. Questo salvataggio conserva la previsione, senza creare una presenza effettiva.
3. Il giorno dell’allenamento o successivamente, apri **Presenze effettive → Conferma presenze**. La bozza propone Presente per gli attesi e Assente per chi aveva avvisato, riportando l’eventuale motivo. Correggi chi ha partecipato diversamente o si è infortunato, apri il riepilogo e conferma tutta la squadra. Solo questa conferma aggiorna il Registro e i report.
4. Le correzioni successive si aprono dal Registro. Il sistema carica gli stati effettivamente salvati, senza ricostruirli dalla previsione. Le comunicazioni precedenti restano consultabili e non si modificano dopo la conferma.

Le date future consentono di registrare le assenze comunicate, senza confermare anticipatamente il registro. Annullamento, permessi di ruolo, protezione delle bozze e revisioni rimangono attivi. La Home non richiede più risposte o solleciti ai sondaggi.

## Compatibilità e dati

- La migrazione applicata `20261029205839_training_absence_notices.sql` aggiunge esclusivamente `sessions.attendance_mode`: `poll` per le sessioni precedenti e `absence_notice` per il nuovo flusso. Non converte presenze o risposte storiche.
- La previsione continua a utilizzare `activity_roster.availability` e `response_note`. Indisponibile indica un’assenza comunicata; per un allenamento non confermato, gli altri valori o una riga mancante indicano un atteso. Il salvataggio normalizza la previsione corrente, senza riscrivere registri esistenti.
- Il nuovo registro salva `notified = null`: non inventa risposte a un sondaggio. I grafici delle risposte WhatsApp contano soltanto le sessioni `poll`, identificate esplicitamente come storico. I report di presenza, i PDF e l’Excel squadra continuano a usare le presenze confermate.
- La RPC conserva invoker security, `search_path` vuoto, ACL, RLS, ambito squadra, controllo della rosa completa, revisioni e idempotenza. La modalità di una sessione salvata non può cambiare. Le nuove sessioni `absence_notice` accettano soltanto Allenamento e rifiutano valori `notified` diversi da null.
- Un vecchio client che omette la modalità può ancora creare una sessione `poll`; nelle correzioni l’omissione conserva la modalità esistente. Il rollback applicativo non richiede rimozioni di colonne o cancellazioni di dati.

## Verifiche

- `npm run verify`: 172 test superati, inclusi formattazione, lint, tipi, build e PWA; 39 test di dominio/qualità, 130 interazioni React e 3 verifiche della distribuzione.
- Chromium: 106 controlli superati nei temi chiaro e scuro, mobile e desktop; 2 casi notch esclusi intenzionalmente sui desktop. Nessuna baseline geometrica aggiornata.
- WebKit: 20 casi mirati superati a 320 e 390 px nei due temi, inclusi modifica/ritiro dell’assenza, barra di salvataggio, conferma dalla Home e report.
- Revisione visiva di 8 viste del nuovo flusso: 390/1280 px, due temi, elenco iniziale e assenza con motivo. Dati sintetici, senza richieste esterne.
- Test server `supabase/tests/training_absence_notices.sql`: due prove della migrazione con rollback, poi esecuzione dopo l’applicazione. Verifica pianificazione senza presenze, motivo, rosa completa, conferma, retry, correzione, revisione obsoleta, modalità immutabile, rifiuto di risposte inventate e compatibilità con i vecchi client. Tutte le fixture vengono rimosse dal rollback.
- Confronto delle impronte complete prima e dopo, escludendo soltanto la nuova colonna dalle sessioni: invariati 26 sessioni, 767 presenze, 31 attività, 300 righe di distinta/disponibilità e 233 variazioni di presenza. Tutte le 26 sessioni precedenti mantengono `poll`.
- Nessuna nuova segnalazione di sicurezza Supabase. Restano le segnalazioni preesistenti: [tabella privata con RLS e nessuna policy](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy), quindi accesso diretto negato, e [protezione dalle password compromesse disabilitata](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection), coerente con la scelta di mantenere il piano gratuito.

Le verifiche browser usano fixture; le prove server usano transazioni con rollback sul progetto configurato. Non costituiscono un nuovo collaudo dell’autenticazione fra due account reali. Nessuna dipendenza, modifica al piano o riscrittura dei dati della squadra.
