# Ripristino della coerenza grafica dopo React — 27 ottobre 2026

Riferimento: versione precedente alla migrazione, commit `1420144898dbdfdea7f0ed144a3e27315b817b1e`. Partenza: `776f53b3f387411638de54469ca520a1924ee45d`.

## Problema e correzioni

La conversione in JSX aveva sostituito diversi nomi di classe e cambiato la struttura degli elementi. Gli stili esistenti non raggiungevano più le righe delle risposte, i contatori e il risultato nella Home. Il ripristino riusa gli stili originali; il rendering rimane interamente React.

- **Home:** data sotto il saluto; tipografia e metadati dell’impegno; pulsante del messaggio vuoto; anteprime con categoria, scadenza e autore; risultato con squadre e punteggi su due righe, badge e azione finale.
- **Allenamenti:** data e riepilogo dell’attività; collegamento alla lavagna per i ruoli tecnici; nome e stato su due righe; tre azioni distanziate con stato selezionato; riepilogo a tre colonne; pulsanti e icone; collegamento al Registro. Ripristino sia nella pagina sia nella scheda aperta dalla Home.
- **Schede:** classi specifiche sul pannello corretto. Il contenitore focalizzato all’apertura non disegna un bordo attorno all’intera pagina; i controlli mantengono l’indicatore di focus. I feedback vuoti non occupano spazio.
- **Report:** ripristinati contenitori, scala e riempimenti dei grafici, con colori distinti per presenze, risposte e minuti; selezione giocatore e periodo impaginate come prima.
- **Registro:** intestazione e calendario a sette colonne; gruppi delle presenze con conteggi e nomi; rimosso il fondale aggiuntivo attorno alle schede.
- **Formazione:** riusati i gruppi e i giocatori dell’anteprima originale, compresi numero, cognome e posizione.

La barra flottante di salvataggio, il contatore delle modifiche, i permessi, la gestione degli errori e le conferme delle modifiche non salvate restano operativi. Nessuna dipendenza, migrazione o modifica ai dati.

## Verifiche

- Confronto renderizzato con il riferimento: stessi dati sintetici e orologio; 390 e 1280 px, chiaro e scuro. Misure e immagini in `output/parity-*` (artefatti locali esclusi da Git).
- Le misure di larghezza/altezza dei blocchi risultato, selettore delle fasi, riepilogo risposte e grafici coincidono con il riferimento; coincidono anche colori, font e radius campionati. Il Registro coincide su desktop; su mobile i pulsanti React possono aggiungere circa 2 px all’altezza complessiva.
- `npm run verify`: formattazione, TypeScript, build, 24 test di dominio/confini, 118 interazioni React e 3 controlli PWA.
- Suite Chromium: 86 verifiche superate; 2 esclusioni previste per il notch su desktop. Copre quattro combinazioni di viewport/tema, accessibilità WCAG e operazioni simulate.
- WebKit: 16 verifiche superate a 320 e 390 px nei due temi, inclusi notch e schede degli allenamenti.
- Nuovi controlli ripetibili: saluto/data impilati, colonne dei punteggi, pulsante del messaggio vuoto, nome/stato separati, azioni di risposta allineate, riepilogo a tre colonne, grafici colorati e calendario.

Le prove di scrittura usano esclusivamente fixture sintetiche. WebKit è una verifica del motore di Safari: non sostituisce una prova su iPhone fisico.
