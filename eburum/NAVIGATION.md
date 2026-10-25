# Navigazione e inviti di riunione

La barra principale mostra **Home · Allenamenti · Comunicazioni · Partite · Altro**. Per presidente e tesoriere mostra **Home · Comunicazioni · Economia · Partite · Altro**. La **Rosa** resta completamente operativa in **Altro → Rosa**, con ordinamento, ricerca, schede e gestione secondo ruolo.

Le nuove riunioni si creano da **Comunicazioni → + → Riunione**. Amministratore, team manager e allenatore indicano titolo, data, ora, luogo facoltativo e ordine del giorno. Tutto lo staff legge l’invito e conferma esplicitamente di averlo letto: la conferma non equivale a una risposta sulla partecipazione.

Il filtro **Riunioni** raccoglie gli inviti attivi. Gli avvisi mantengono la durata di 1, 3 o 7 giorni dalla pubblicazione; per le riunioni il conteggio parte dalla data/ora dell’appuntamento, nel fuso Europe/Rome. L’invito resta quindi visibile anche se pubblicato molto prima. Sono ammesse riunioni da oggi fino a un anno avanti; alla scadenza opera la rimozione automatica già presente.

Le riunioni già inserite non sono cancellate, duplicate né convertite in messaggi soggetti a scadenza: sono conservate in **Comunicazioni → Riunioni già registrate**, per la stagione selezionata. Il vecchio collegamento `#/meetings` apre Comunicazioni con il filtro Riunioni. Gli editor precedenti restano accessibili dall’archivio, rispettando i permessi preesistenti.

Non sono state aggiunte risposte Partecipo/Non partecipo, presenze alle riunioni, promemoria push o permessi di pianificazione per altri ruoli. La guida nell’app descrive il nuovo percorso.

Migrazione: `supabase/migrations/20261019212012_meeting_communications.sql`. Test SQL: `supabase/tests/meeting_communications.sql`; frontend e navigazione per tutti i ruoli in `tests/frontend-interactions.cjs`.

Verifica e pubblicazione del 19/10/2026: `npm run verify` superato (141 test, controllo tipi, formattazione e build). Prove browser con dati sintetici nei temi chiaro e scuro a 320, 390 e 1280 px: creazione invito, conferma di lettura, filtro Riunioni e percorso Altro → Rosa. Migrazione applicata e test SQL superati per tutti i sette ruoli; i dati esistenti restano invariati (28 attività, inclusa una riunione). Pubblicazione Vercel `dpl_AGWFrkp7AegTnyaxNG7zCtGGVhaM` pronta su https://eburum.vercel.app; tutti i 21 file pubblicati corrispondono alla build locale. Accesso pubblico verificato a 320, 390 e 1440 px senza overflow né errori JavaScript. Nessun accesso effettuato con account reali dello staff; nessuna prova su iPhone fisico.
