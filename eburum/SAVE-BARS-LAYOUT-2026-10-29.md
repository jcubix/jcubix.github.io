# Barre di salvataggio e disponibilità

29 ottobre 2026. Correzione delle sovrapposizioni segnalate nelle schede mobile, mantenendo palette, font, radius e navigazione del progetto.

## Comportamento

- Pianificazione degli allenamenti, presenze effettive, risultato e organizzazione delle partite usano una zona di azione separata dal contenuto. Il modulo occupa la parte scorrevole; Salva, Annulla, contatore ed eventuale errore hanno spazio proprio sopra la navigazione. Il contenuto non passa dietro la barra, anche con safe area o finestra più bassa.
- Le azioni delle altre schede restano nel flusso del modulo, eliminando i vecchi posizionamenti fissi e sticky che potevano coprire i campi. La lavagna conserva la propria barra già nel flusso.
- I pulsanti spunta e X della disponibilità hanno padding zero e centratura esplicita dell’SVG sia nella lista sia nella scheda completa; mantengono bersagli di almeno 44 px e nomi accessibili.
- La scheda si chiama **Disponibilità**, il filtro e il riepilogo usano **Assenti**. La riga indica **Ha avvisato: assente**; la copia produce un elenco di assenti previsti. La conferma delle presenze effettive resta distinta e il metodo di registrazione non cambia.

## Implementazione

`ActionBar` in `src/operational-ui.tsx` porta le azioni nel contenitore `workspaceActions` della shell. Il footer occupa una riga effettiva della viewport; il contenuto e l’editor scorrono nella riga superiore. Il cambio di scheda riparte dall’inizio del pannello. Colori e spaziature seguono i token esistenti.

I pulsanti submit fuori dal DOM del modulo conservano l’associazione HTML tramite `form`. Le azioni ricevono esplicitamente lo stato disabled durante il salvataggio e la visibilità della scheda: un portal non eredita il fieldset disabilitato o il form nascosto. Validazione nativa, protezione delle bozze, idempotenza e gestione degli errori restano attive.

Le quattro baseline degli Allenamenti cambiano soltanto il padding inferiore del contenuto a 24 px: lo spazio del footer è ora riservato dalla struttura, senza il vecchio padding compensativo. Header, navigazione, palette e tolleranze restano identici.

Nessuna migrazione, variazione dei permessi o modifica dei dati della squadra. Nessuna dipendenza aggiunta.

## Verifiche

- `npm run verify`: 172 test superati; formattazione, lint senza warning, tipi, build e PWA verificati. Le 130 interazioni React conservano bozze, ruoli, errori, retry e protezioni dei salvataggi.
- Chromium: 114 controlli superati nei due temi, mobile e desktop; 2 esclusioni notch previste sui desktop. I nuovi casi verificano la separazione geometrica fra modulo e footer, il centro di tutte le 60 icone della rosa sintetica, safe area, finestra ridotta, associazione al form, blocco dei campi obbligatori e creazione dell’allenamento una sola volta.
- WebKit: 24 casi superati a 320/390 px nei due temi, inclusi salvataggio, cambio scheda, presenze effettive, form e controlli di accessibilità.
- Ispezionate in due passaggi le viste inline e la scheda completa a 390/1280 px nei due temi: ultimo campo raggiungibile e nessuna sovrapposizione. Scansione layout Impeccable senza rilievi sui file interessati.
- Il test dei dettagli report attende esplicitamente il cambio giocatore e il caricamento della relativa rotta: conteggi identici fra giocatori non sono più usati come segnale di fine caricamento.

Le prove browser usano fixture sintetiche e bloccano le richieste esterne; non attestano una nuova verifica dell’autenticazione fra account reali.
