# Soft Club · rilascio dell’11 ottobre 2026

Pubblicato su https://eburum.vercel.app dal pacchetto statico verificato in anteprima. Deployment produzione: `dpl_pnjpQ8boZYExJg897QxLxaJhBvTH`; anteprima: `dpl_5NCm2TraVzJMJcsjByvPCP8WYLFm`. Versione precedente conservata per eventuale rollback: `dpl_BtJYXHLK93bPi5hqWP9qvX3F27sd`.

## Cambiamenti

Design Soft Club approvato: canvas chiaro, navy/crema/oro, dock flottante unico con capsula grigia animata e icone Lucide, header con iniziali dello staff, titoli a sinistra e comandi circolari su telefono. Home collegata ai dati reali, con orario/luogo dell’allenamento, risposte e solleciti. Tutte le funzioni e i permessi esistenti sono mantenuti; nessuna migrazione o pulizia del database eseguita.

Il nuovo stylesheet è `src/soft-club.css`; `styles.css` conserva il supporto degli editor operativi, con 22 regole del layout/sidebar ritirato rimosse. Rimossi stato, componenti e import della sidebar non più presente. La copia dei file toccati prima di questa integrazione è conservata fuori dal repository in `../../soft-club-baseline`.

## Verifiche

- `npm run verify`: build TypeScript/Vite, 33 test di dominio, 19 test React e 2 test della build PWA, tutti superati.
- Browser sul runtime reale con fixture esclusivamente iniettata da Playwright: nove schermate a 320/390/614/768/1280/1440 px; 54 verifiche senza overflow o errori, una destinazione corrente, dock almeno 44px, campi mobile a 16px. Editor partita/allenamento e accessibilità del pulsante aggiungi preservati.
- Inset iOS simulati: 59px sopra e 34px sotto. Header, dock e chiusura gestione utenti raggiungibili. Tastiera/viewport coperti dai test React esistenti; nessun test su iPhone fisico rivendicato.
- Revisione indipendente: quattro osservazioni corrette e valutate risolte nel verdetto circoscritto `ship`, in `../.impeccable/review/soft-club-integration/fix-verdict.md`. Design e sidecar schema v2 aggiornati.
- Anteprima e produzione: 21 asset HTTP 200, hash corrispondenti alla build (HTML verificato per disponibilità), login senza overflow a 320/390/1440 px, service worker attivo e apple-touch-icon PNG 180px, nessun errore JavaScript rilevato.

Nessun mock, credenziale di test, file di documentazione o strumento di QA incluso nel pacchetto pubblicato. I controlli autenticati usano fixture e test automatizzati, non un login manuale con credenziali dello staff in produzione. La nuova PWA segue il meccanismo esistente di aggiornamento esplicito che protegge le bozze.
