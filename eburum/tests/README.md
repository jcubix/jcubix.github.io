# Verifica dei flussi

Da questa cartella: `npm ci` e `npm test`. I test JavaScript usano account e dati simulati: nessuna credenziale o scrittura in produzione.

`workflows-ui.cjs` verifica sondaggio separato dalle presenze, risposte rapide, filtri e solleciti, salvataggio dell’intera rosa, importazione delle risposte senza trasformare una disponibilità in presenza effettiva, date future, fasi della partita, eventi, protezione delle bozze, report per periodo, dettagli e permessi.

I test SQL `attendance_review.sql`, `team_operations.sql` e `survey_to_attendance.sql` sono eseguibili sul progetto inizializzato con un collegamento amministrativo. Ogni file apre una transazione e termina con `ROLLBACK`: i dati sintetici non vengono conservati. Verificano anche conflitti, atomicità, autore delle modifiche e isolamento delle squadre.

I test `report-pdf.cjs` verificano report esclusivamente individuali, grafici, inclusione del giocatore uscito nelle sostituzioni e PDF su piu pagine. Impostando `REPORT_PDF_OUTPUT` si salvano due PDF dimostrativi per il controllo visivo.
