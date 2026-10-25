# Coerenza grafica — 25 ottobre 2026

Correzioni riferite alle sei fotografie dell'utente, mantenendo l'identità navy/oro.

- Ricerca Rosa e Messaggi: stessa superficie, icona nel flusso, un solo bordo
  e un solo focus esterno. Il campo interno resta trasparente e senza contorno.
- Filtri Messaggi: tutti e sei visibili, senza scorrimento orizzontale; selezione
  sulla superficie del tema, testo leggibile e nessun riempimento navy dominante.
  Tre colonne sul telefono, due sotto 360 px, sei sui desktop ampi.
- Selettori condivisi: stessa palette e raggi a capsula; i contenitori su più
  righe usano il raggio delle schede. I normali controlli mantengono 10 px,
  le schede 16 px e i comandi solo icona della testata 44×44 px circolari.
- Schede della Home e liste: superfici comuni nei due temi, separazione uniforme
  tra sezioni, testo secondario di peso normale, badge aderenti al contenuto.
- Ultimo allenamento e anteprima Messaggi: titolo, descrizione e azione separati
  con spazi espliciti; le schede non ereditano la tipografia dei pulsanti.
- Rimosse le vecchie dichiarazioni di palette concorrenti nel CSS scuro e le
  regole duplicate per la ricerca. Gli adattatori legacy usano token semantici.

## Verifiche

- `npm run verify`: superato (53 test dominio, 111 integrazioni frontend,
  3 controlli build/PWA, TypeScript e formattazione).
- Suite Chromium: 46 superati, 2 non applicabili al desktop; 24 combinazioni
  pagina/tema/viewport senza violazioni WCAG A/AA rilevate da axe.
- WebKit: 12 superati su 320 e 390 px, entrambi i temi, con controlli di focus,
  selezione, schede, pulsanti della testata e safe area simulata.
- Ispezione grafica di 16 schermate: Home, Rosa, Messaggi e Allenamenti,
  390/1280 px, chiaro/scuro; nessun overflow orizzontale.
- Le baseline geometriche restano invariate. Aggiornato soltanto il token dello
  sfondo chiaro da `#e9edf3` al valore canonico `#e9edf4` del design system.

Le schermate usano fixture sintetiche; nessun dato reale o permesso è modificato.
WebKit su Windows non sostituisce una verifica su iPhone fisico con tastiera iOS.
La migrazione React in corso è esclusa dal rilascio grafico; le verifiche GitHub
sul commit della PR controllano la combinazione esatta destinata alla produzione.
