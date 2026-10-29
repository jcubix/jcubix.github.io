# Scheda allenamento: presenze confermate

29 ottobre 2026. Rifinitura dello stato già registrato, che mostrava elenchi uniti da virgole, azioni troppo vicine e istruzioni per una conferma ancora da eseguire.

## Risultato

- Il testo indica che il registro è salvato e mostra la data dell’allenamento. Le istruzioni per confermare restano soltanto per le attività non ancora registrate.
- I tre conteggi Presenti, Assenti e Infortunati sono anche filtri. Se ci sono assenti si apre inizialmente il loro elenco; altrimenti i presenti. Ogni nome ha una riga distinta, ordinata per cognome; su desktop la lista utilizza due colonne. Lo stato vuoto è esplicito.
- Correggi presenze resta l’azione principale; Copia presenze e Storico modifiche hanno uno spazio dedicato e un intervallo di 12 px. Su smartphone le due azioni secondarie occupano righe separate.
- Le etichette dei menu diventano Sondaggio e Presenze per le sessioni precedenti. I dati WhatsApp storici rimangono consultabili nel primo menu. Per gli allenamenti correnti il primo menu resta Disponibilità.
- Palette, font, radius, navigazione e workflow di correzione restano quelli dell’app. Non vengono aggiunte dipendenze o migrazioni e nessun dato salvato è convertito.

## Implementazione e verifica

`src/training/confirmed-attendance.tsx` legge le presenze della sessione e gestisce soltanto il filtro locale. La scheda conserva i gestori esistenti di correzione, copia e cronologia. CSS specifico per griglia, bersagli tattili, nomi lunghi e spaziature; nessuna baseline modificata.

- `npm run verify`: 172 test superati; tipi, lint, formattazione, build, interazioni React e PWA.
- Chromium: 118 controlli superati, 2 esclusioni notch previste sui desktop. Il nuovo caso usa 30 giocatori, 24 presenti e 6 assenti: verifica filtri, ordinamento, bersagli da almeno 44 px, contrasto/accessibilità, spazi fra le azioni, stato senza infortunati e apertura della correzione senza scritture.
- WebKit: 16 casi superati a 320/390 px nei due temi, comprese scheda confermata, lista delle disponibilità, accessibilità degli editor e salvataggio delle presenze effettive.
- Ispezione visiva a 390/1280 px nei due temi. I test React verificano anche la consultazione dello storico e il cambio fra elenchi senza invocare salvataggi.

Le verifiche usano dati sintetici e non attestano un nuovo collaudo di autenticazione fra account reali.
