# Eburum Team Manager

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Staff di una squadra di calcio: amministratore, team manager, allenatore e segretario. Solo gli amministratori creano utenze e modificano le password altrui. Il segretario consulta i dati sportivi e gestisce i dati amministrativi e le scadenze.

## Product Purpose

Registrare e consultare il lavoro quotidiano della squadra, con flussi distinti per allenamenti e partite, utilizzabili da smartphone e desktop.

## Operating Context

I sondaggi degli allenamenti vengono creati su WhatsApp. Lo staff trascrive le risposte nella webapp, identifica chi non ha risposto e copia i nomi da sollecitare. Durante o dopo l'allenamento conferma le presenze effettive, precompilate dalle risposte; chi non ha risposto resta da confermare. Una risposta prevista non è una presenza effettiva.

Per le partite lo staff inserisce direttamente la distinta dei convocati, titolari e panchina, poi risultato, gol, cartellini, sostituzioni e note. Non serve un sondaggio nella scheda partita. I minuti delle nuove partite si calcolano dagli eventi e dalla durata impostata. I minuti storici manuali vengono preservati.

## Capabilities and Constraints

- Allenamenti e Partite sono sezioni autonome; non una scheda generica con un selettore del tipo.
- Le presenze degli allenamenti sono Presente, Assente o Infortunato, con nota facoltativa. Solo la conferma definitiva aggiorna i report.
- Le riunioni restano una funzione secondaria.
- Lo storico, i report per giocatore, i grafici e i PDF devono restare consultabili.
- Le comunicazioni dello staff durano 1, 3 o 7 giorni e scadono sul server.
- Le squalifiche per cinque ammonizioni richiedono conferma manuale della gara saltata.

## Brand Commitments

Nome EBVRVM/Eburum. Interfaccia business minimale, coerente con i colori sociali navy e crema e dettagli oro; chiarezza dei bordi, dei contrasti e degli stati su mobile e desktop.

## Product Principles

- Distinguere risposta prevista, presenza effettiva e convocazione.
- Ridurre le azioni durante allenamenti e partite senza trasformare supposizioni in dati definitivi.
- Preservare storico e permessi della squadra condivisa.
