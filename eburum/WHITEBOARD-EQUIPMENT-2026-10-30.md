# Lavagna: squadre e attrezzi

## Funzioni consegnate

- Eburum: pedina circolare azzurra. Avversari: pedina a rombo rosa. La distinzione usa forma, colore e nome, anche su smartphone e nell’esportazione.
- I sei strumenti di disegno occupano una sola riga sul telefono; sotto, i comandi Eburum, Avversari e Attrezzi hanno etichette visibili. Gli strumenti mantengono bersagli di almeno 44 px anche a 320 px.
- Selettore con cinesina, conetto, asta, sagoma da barriera, pallone, ostacolo, scaletta, porticina e cerchio agilità. Ogni tocco sul campo inserisce una copia. Sposta, elimina, annulla/ripristina ed esportazione utilizzano le operazioni esistenti.
- Sagome SVG condivise tra selettore, campo ed esportazione; attrezzi e numeri restano diritti nel campo verticale. Gli ingombri degli attrezzi sono limitati al campo in entrambe le orientazioni.
- Il selettore usa il dialogo accessibile del progetto, con descrizione, navigazione da tastiera e ritorno del focus al comando Attrezzi. Gli elementi inseriti hanno nomi accessibili e restano selezionabili dall’elenco alternativo.
- La chiusura superiore e quella in fondo condividono la stessa azione e puliscono il percorso correttamente: una lavagna salvata può essere riaperta immediatamente. Rimane la protezione delle modifiche non salvate.
- Guida in-app aggiornata. Nessuna nuova dipendenza.

## Compatibilità e dati

La struttura del documento resta `background` + `marks`. I tipi precedenti restano validi; non si riscrivono i documenti esistenti. Nove nuovi tipi a punto singolo estendono il validatore client e il trigger server. Invariati foto JPEG nel documento, limite di 200 elementi, dimensioni massime, controllo squadra/ruolo, RLS e gestione dei conflitti di revisione.

Migrazione `20261030203103_tactical_board_training_equipment.sql` applicata al progetto collegato prima del frontend. La versione locale coincide con quella registrata sul server. Il corpo remoto è stato confrontato con quello revisionato. Cambiano solo l’elenco dei tipi ammessi e il loro vincolo a un punto.

## Verifiche

- `npm run verify`: 175 test superati (39 dominio, 132 interazioni React, 4 build); formato, lint e compilazione superati. Ultima compilazione ripetuta dopo la rifinitura del nome accessibile del selettore.
- Chromium completo: 146 superati, 2 esclusioni previste per la safe area sui desktop.
- WebKit: 16 superati a 320 e 390 px, nei temi chiaro e scuro.
- Prove browser: inserimento di entrambe le squadre e tutti gli attrezzi; salvataggio/riapertura; modifica da tastiera, cancellazione e ripristino; PNG reale; accessibilità del selettore; assenza di overflow. Conservati i test su foto, ruoli, conflitti e prestazioni del documento fotografico.
- Controllo visivo di campo, selettore e PNG su telefono chiaro e desktop scuro. Artefatti locali in `output/equipment-review/`.
- SQL eseguito come `authenticated`: creazione e aggiornamento con tutti i nove tipi, lettura identica al documento inviato, rifiuto di attrezzi con due punti. Ulteriore prova di rifiuto di tipi sconosciuti e coordinate fuori campo. Tutte le prove annullate tramite rollback, nessun dato di test persistente.
- Advisor Supabase: nessun nuovo rilievo di sicurezza. Restano i rilievi precedenti sulla tabella privata `finance_requests` e sulla protezione password compromesse non disponibile nel piano scelto. Nessun indice o permesso modificato.
