# Lavagna tattica: confronto con Easy2Coach

Il confronto riguarda il prodotto **Tactics**, dalla preparazione alla condivisione. Fonti: [panoramica ufficiale](https://www.easy2coach.net/en/football-tactics-board/) e [guide di Tactics Academy](https://www.easy2coach.net/academy/taktik/). L'area autenticata non è stata provata: il browser di lavoro non era abilitato.

| Flusso | Eburum dopo questo intervento | Differenze rispetto al riferimento |
| --- | --- | --- |
| Disegnare uno schema | Campi interi e mezzi campi, fondo bianco, prospettiva rialzata o foto. Sagome Eburum e avversarie, attrezzi, frecce anche libere e tratteggiate, cerchi e note su più righe. Elementi spostabili e duplicabili; colori, tratteggio e testo della nota modificabili dopo il disegno. | Restano fuori il catalogo esteso, la rotazione, la selezione multipla e il controllo dei livelli. |
| Preparare una formazione | Inserimento di 11 sagome senza numeri in 4-3-3, 4-4-2, 3-5-2 o 4-2-3-1 su campo intero. Posizioni modificabili. | Non ci sono ancora foto e nomi presi dalla rosa o il catalogo di esercizi e calci piazzati. |
| Spiegare un movimento | Fino a otto fasi. Si duplica una posizione, si spostano giocatori e pallone, poi si riproduce il movimento. Le note e i segni possono cambiare in ogni fase. Annulla e ripristina valgono anche per la sequenza. | Movimento lineare e durata uguale tra fasi; non c'è export video. |
| Ritrovare e riutilizzare | Ricerca per titolo in tutta la libreria, copia separata e collegamento facoltativo a partita o allenamento. Il salvataggio rimane esplicito. | Non ci sono cartelle e sottocartelle. |
| Condividere o stampare | Link riservato allo staff tecnico, PNG e stampa della fase visualizzata, esportazione e reimportazione dell'intera lavagna in formato Eburum. | I file Easy2Coach non sono compatibili. Niente link pubblico o integrazioni esterne. |

Per provare il flusso, crea una lavagna, inserisci un modulo, premi **Aggiungi fase**, sposta le sagome e usa **Riproduci sequenza**. **Stampa** apre il dialogo del browser, da cui puoi anche salvare un PDF. Per una stampa su cui scrivere a mano, scegli lo sfondo bianco.

Le fasi sono nello stesso documento e seguono i permessi e il controllo delle revisioni delle lavagne esistenti. Applicare la migrazione `20261110142837_tactical_board_phases.sql` prima del rilascio dell'editor: controlla ogni fase con gli stessi limiti usati per un disegno statico, senza riscrivere le lavagne salvate.
