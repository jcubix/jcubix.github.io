# Lavagna tattica

Da **Altro → Lavagna tattica**, amministratore, allenatore e collaboratore tecnico possono creare, consultare, modificare ed eliminare le lavagne della propria squadra. Gli altri ruoli non ricevono i dati, anche accedendo direttamente alle API.

1. Premi **Nuova lavagna**, assegna un titolo e scegli un allenamento o una partita, oppure lascia **Lavagna libera**. In Allenamenti è disponibile anche **Crea lavagna per l’allenamento**, che preseleziona l’attività corrente.
2. Usa il campo oppure **Carica foto**. Sono accettate JPG, PNG e WebP fino a 10 MB e 40 megapixel; il browser ridimensiona la foto a un massimo di 1400 px e la converte in JPEG. Se il risultato supera il limite di salvataggio, viene richiesto un file più piccolo.
3. **Eburum** e **Avversario** inseriscono pedine distinte. Puoi assegnare un numero o una sigla fino a quattro caratteri. **Sposta** trascina gli elementi. Per una nota, scrivi il testo e tocca il punto in cui inserirla; penna, freccia e cerchio si disegnano trascinando. Il rosso è utile per indicare un errore, gli altri colori per distinguere movimenti e riferimenti.
4. **Annulla** e **Ripristina** conservano fino a 40 modifiche nella sessione aperta, anche dopo il salvataggio. **Elementi sulla lavagna** permette la selezione da tastiera: con il campo attivo, frecce per spostare, Maiusc per passi più ampi, Canc per eliminare, Ctrl/Cmd+Z per annullare.
5. **Salva lavagna** conserva foto e disegni per lo staff tecnico. **Esporta immagine** scarica una PNG con titolo e annotazioni, comprese le modifiche ancora non salvate. Il file esportato può essere condiviso manualmente.
6. **Chiudi lavagna** torna all’elenco. Durante il disegno la barra inferiore è nascosta per lasciare libero il campo; riappare alla chiusura. L’eliminazione richiede una conferma ed è definitiva.

## Uso da smartphone

Fino a 640 px il campo si dispone in verticale: pedine e note restano dritte, le note lunghe vanno a capo. **Dettagli lavagna** raccoglie titolo e collegamento all’attività. La barra strumenti rimane visibile mentre scorri il campo. All’apertura è selezionato **Scorri**, per muovere normalmente la pagina anche passando il dito sul campo; **Sposta** trascina gli elementi, gli altri strumenti disegnano. Le aree di selezione delle pedine sono più ampie del loro cerchio visibile. Le foto mantengono il proprio orientamento e non vengono ruotate.

Le coordinate salvate non cambiano passando tra smartphone e computer: non occorre convertire o ricreare le lavagne esistenti. L’esportazione PNG segue l’orientamento mostrato (1280 × 2100 px sul campo verticale, 2000 × 1380 px nella vista orizzontale, inclusa la fascia del titolo).

## Salvataggio e riservatezza

Il salvataggio richiede una connessione: le bozze sono in memoria, non costituiscono una copia offline. Navigazione e chiusura della pagina avvisano in presenza di modifiche non salvate. Un errore conserva il lavoro nell’editor. I retry usano lo stesso identificativo e non duplicano la lavagna. Se un collega ha salvato una versione diversa, il server rifiuta la sovrascrittura; puoi esportare la tua bozza e riaprire il lavoro salvato dall’elenco.

Non è prevista modifica simultanea in tempo reale. **Aggiorna elenco** ricarica i riepiloghi; riaprire una lavagna carica il contenuto aggiornato. L’elenco mostra 50 riepiloghi alla volta e offre **Carica altre lavagne**, senza scaricare le foto finché non apri il singolo lavoro.

Foto e geometrie condividono una riga privata in `tactical_boards`, protetta con RLS per squadra e ruolo. Nessun URL pubblico per le foto. Il documento contiene al massimo 200 elementi, 600 punti per tratto e 80 caratteri per nota. Il server valida dimensioni, coordinate, colori e tipi, applica le revisioni e registra gli identificativi degli autori. Il collegamento a un’attività è verificato alla creazione o alla sua modifica; cancellare l’attività non cancella la lavagna e non viene bloccato dalla lavagna.

La migrazione è `supabase/migrations/20261019205152_tactical_whiteboards.sql`; i test SQL sono in `supabase/tests/tactical_whiteboards.sql`. Non sono richiesti pacchetti frontend aggiuntivi.

Esclusi da questa versione: video, animazione delle azioni, puntatore live condiviso e modifica contemporanea.

## Verifica e pubblicazione

Il 19 ottobre 2026 la verifica completa ha superato 132 test (48 dominio, 82 integrazione React, 2 PWA), oltre a formattazione, typecheck e build. Il browser Chromium ha verificato campo/foto, spostamento, tastiera, undo/redo dopo salvataggio, riapertura ed esportazioni PNG, con catture chiaro/scuro a 390/1440 px e controllo overflow anche a 320 px. Le prove autenticate del frontend usano dati sintetici; non viene attestato un login manuale con account reali dello staff o un collaudo su iPhone fisico.

La migrazione e la suite SQL sono state verificate sul progetto Supabase con transazioni annullate prima e dopo l’applicazione definitiva. Confermati isolamento per squadra e ruolo, dati non validi, idempotenza, revisioni e cancellazione. L’accesso anonimo alle lavagne risponde HTTP 401. Nessun nuovo avviso negli advisor rispetto alla situazione precedente.

Produzione: `dpl_84ApRgTWhKo1jb7tFxDMigHcqPzD`, READY su https://eburum.vercel.app/#/whiteboard. Verificati HTTP 200 e hash SHA-256 identici alla build per tutti i 21 asset pubblicati. I dati sportivi preesistenti sono invariati: 30 giocatori, 22 sessioni, 647 presenze, 4 partite, 34 eventi, 27 attività; nessuna lavagna di prova lasciata nel database. Nessun commit o push eseguito.

### Adattamento smartphone del 20 ottobre 2026

Verifica completa superata: 143 test (48 dominio, 93 integrazione React, 2 PWA), formattazione, typecheck e build. Controlli layout chiaro/scuro a 320, 390, 640 e 1280 px senza overflow. Prove Chromium con tocco sintetizzato via CDP: inserimento pedina, trascinamento senza scorrimento involontario, scorrimento nativo con Scorri. Verificati foto non ruotate, coordinate conservate, annulla/ripristina, riapertura ed esportazioni PNG nelle tre varianti campo verticale, orizzontale e foto. Nessuna migrazione, modifica ai permessi o scrittura di dati reali richiesta.

Produzione aggiornata: `dpl_DbwiBCfKmMHJ5PUpu8oWBmkfJYQd`, READY su https://eburum.vercel.app/#/whiteboard. Tutti i 21 asset corrispondono alla build verificata; pagina di accesso pubblica controllata a 320, 390 e 1440 px senza overflow o errori JavaScript. Nessun collaudo su smartphone fisico o Safari iOS; le prove della lavagna usano dati sintetici locali.
