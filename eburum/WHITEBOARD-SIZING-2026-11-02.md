# Dimensionamento degli attrezzi

I nuovi attrezzi partono dal 60% della misura precedente. Il controllo Dimensione nuovi attrezzi permette di scegliere dal 25% al 200%, con incrementi del 5%. La scelta vale per gli inserimenti successivi e non modifica la lavagna finché non viene inserito un elemento.

Per modificare un elemento esistente: Sposta → tocca l’attrezzo → regola Dimensione. Il nome dell’attrezzo e la percentuale indicano il destinatario della modifica. Il controllo è accessibile anche dalla tastiera e dall’elenco alternativo degli elementi.

La variazione è immediata e ogni trascinamento o ripetizione del tasto costituisce un solo passaggio di annulla/ripristina. Salvataggio, riapertura e PNG utilizzano la stessa misura. Gli ingombri vengono ricalcolati e mantenuti dentro il campo anche quando si ingrandisce vicino a un bordo.

Su smartphone lo spazio dei controlli resta stabile tra selezione e ridimensionamento: il campo non si sposta durante un semplice tocco, evitando movimenti involontari degli elementi.

## Dati e compatibilità

`Mark.scale` è facoltativo, numerico e ammesso solo per gli attrezzi nell’intervallo 0.25–2. I documenti precedenti senza scale mantengono il 100%; nessun dato preesistente viene riscritto. La dimensione di giocatori, note e disegni resta invariata.

Migrazione `20261102192426_tactical_board_equipment_scale.sql` applicata sul progetto collegato. Aggiunge solo la validazione del campo facoltativo: non cambia RLS, ruoli, proprietà della squadra, revisioni o formato delle foto. Nessuna nuova dipendenza.

## Verifiche

- `npm run verify`: 175 test superati, formato/lint/compilazione corretti.
- Chromium: 20 prove della lavagna nei temi chiaro/scuro e su telefono/desktop.
- WebKit: 20 prove della lavagna a 320 e 390 px nei due temi.
- Test ampliati per tutti i nove attrezzi: misure minime/intermedie/massime, bordi nei due orientamenti e rifiuto di dimensioni non valide.
- Browser: dimensione iniziale, estremi del controllo, regolazione da tastiera e trascinamento reale, annulla come singola operazione, salvataggio/riapertura, vecchi documenti al 100%, PNG effettivo, accessibilità e assenza di overflow.
- Controllo visivo telefono chiaro e desktop scuro, con PNG di attrezzi al 25/60/100%; artefatti locali in `output/equipment-size-review/`.
- SQL come utente autenticato: 36 salvataggi/letture con i nove attrezzi alle quattro dimensioni di prova; rifiutati numeri fuori intervallo, null, stringhe, oggetti, booleani e scale sui giocatori. Verificato anche un elemento precedente privo di scale. Tutte le prove sono state annullate tramite rollback.
- Advisor di sicurezza senza nuovi rilievi rispetto al controllo precedente.
