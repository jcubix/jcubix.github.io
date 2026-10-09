# Verifica dei flussi

Da questa cartella: `npm ci` e `npm test`. I test JavaScript usano account e dati simulati: nessuna credenziale o scrittura in produzione.

`workflows-ui.cjs` verifica sondaggio separato dalle presenze, risposte rapide, filtri e solleciti, salvataggio dell’intera rosa, importazione delle risposte senza trasformare una disponibilità in presenza effettiva, date future, fasi della partita, eventi, protezione delle bozze, report per periodo, dettagli e permessi.

I test SQL `attendance_review.sql`, `team_operations.sql` e `survey_to_attendance.sql` sono eseguibili sul progetto inizializzato con un collegamento amministrativo. Ogni file apre una transazione e termina con `ROLLBACK`: i dati sintetici non vengono conservati. Verificano anche conflitti, atomicità, autore delle modifiche e isolamento delle squadre.

I test `report-pdf.cjs` verificano report esclusivamente individuali, grafici, inclusione del giocatore uscito nelle sostituzioni e PDF su piu pagine. Impostando `REPORT_PDF_OUTPUT` si salvano due PDF dimostrativi per il controllo visivo.

`secretary-ui.cjs` verifica scadenze, schede amministrative e consultazione dei dati sportivi. `supabase/tests/secretary_role.sql` verifica il trigger di assegnazione e le policy RLS, con dati sintetici annullati tramite rollback.

`supabase/tests/managed_auth_creation.sql` verifica l�ordine reale di creazione Auth e l�assegnazione atomica dei quattro ruoli. `managed-auth-live.cjs` � una verifica opzionale sulle API reali, esclusa da `npm test`: richiede un amministratore temporaneo con email `codex-auth-e2e-�@example.invalid` e le variabili `AUTH_TEST_EMAIL` / `AUTH_TEST_PASSWORD`. Crea utenze sintetiche, verifica accesso, permessi, duplicati, cambio password e cambio ruolo. Elimina il giocatore sintetico; restituisce gli identificativi delle utenze da rimuovere con accesso amministrativo, insieme all�amministratore temporaneo. Eseguire preferibilmente in staging, non utilizzare account dello staff, non conservare credenziali nei file o nei log.

`discipline-ui.cjs` verifica il conteggio stagionale dagli eventi, diffide a 4 e 9 gialli, soglie ripetute, esclusione di gare future/annullate e cartellini senza giocatore, conferma e annullamento della gara scontata, ricalcolo dopo correzioni e consultazione del segretario. `supabase/tests/disciplinary_clearances.sql` verifica conferme, duplicati, autore, isolamento della squadra e permessi con rollback.
