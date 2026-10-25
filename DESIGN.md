---
name: "Eburum — Club Office"
description: "Il lavoro reale della squadra, con navy, oro e superfici quiete su telefono e desktop."
colors:
  bg: "#e9edf4"
  surface: "#fff"
  surface-muted: "#f1f4f9"
  ink: "#0f1b3d"
  ink-2: "#4a5672"
  ink-3: "#5b6982"
  primary: "#0d1e45"
  primary-foreground: "#fff"
  primary-soft: "#e4eaf5"
  accent: "#e9c46a"
  accent-soft: "#fbf1d6"
  accent-ink: "#735117"
  border: "#dce2ec"
  control-border: "#738099"
  success: "#187447"
  success-soft: "#e3f5ec"
  warning: "#895308"
  warning-soft: "#fdf0dd"
  danger: "#a72e3f"
  danger-soft: "#fbe6e6"
  neutral: "#53617c"
  neutral-soft: "#eceff4"
  hero: "#0d1e45"
  hero-text: "#fff"
  hero-muted: "#d2dbed"
  overlay: "rgba(15, 27, 61, 0.38)"
  focus-soft: "rgba(233, 196, 106, 0.3)"
  focus: "#0d1e45"
  primary-ink: "#0d1e45"
  dark-bg: "#0b1426"
  dark-surface: "#142239"
  dark-surface-muted: "#1c2e48"
  dark-ink: "#eef2fa"
  dark-ink-2: "#c2cde0"
  dark-ink-3: "#abbdd6"
  dark-primary: "#416ba4"
  dark-primary-foreground: "#fff"
  dark-primary-soft: "#294568"
  dark-accent: "#e9c46a"
  dark-accent-soft: "#413720"
  dark-accent-ink: "#f0d48d"
  dark-border: "#354a66"
  dark-control-border: "#6e85a4"
  dark-success: "#a4e2be"
  dark-success-soft: "#183c30"
  dark-warning: "#f0cf87"
  dark-warning-soft: "#423620"
  dark-danger: "#ffbec7"
  dark-danger-soft: "#482d3a"
  dark-neutral: "#c3cfe0"
  dark-neutral-soft: "#273951"
  dark-overlay: "rgba(3, 9, 20, 0.65)"
  dark-primary-ink: "#c6d9ff"
  dark-focus: "#e9c46a"
typography:
  headline-mobile:
    fontFamily: "-apple-system, BlinkMacSystemFont, \"Segoe UI\", sans-serif"
    fontSize: "32px"
    fontWeight: 800
    lineHeight: 1.1
    letterSpacing: "-0.02em"
  headline-desktop:
    fontFamily: "-apple-system, BlinkMacSystemFont, \"Segoe UI\", sans-serif"
    fontSize: "36px"
    fontWeight: 800
    lineHeight: 1.1
    letterSpacing: "-0.02em"
  section:
    fontFamily: "-apple-system, BlinkMacSystemFont, \"Segoe UI\", sans-serif"
    fontSize: "20px"
    fontWeight: 700
    letterSpacing: "-0.02em"
  card:
    fontFamily: "-apple-system, BlinkMacSystemFont, \"Segoe UI\", sans-serif"
    fontSize: "17px"
    fontWeight: 700
    letterSpacing: "-0.02em"
  body:
    fontFamily: "Figtree, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.45
  metadata:
    fontFamily: "Figtree, system-ui, sans-serif"
    fontSize: "13px"
    lineHeight: 1.45
  uppercase-label:
    fontFamily: "Figtree, system-ui, sans-serif"
    fontSize: "12px"
    fontWeight: 700
    letterSpacing: "0.06em"
  badge:
    fontFamily: "Figtree, system-ui, sans-serif"
    fontSize: "12px"
    fontWeight: 600
  field:
    fontFamily: "Figtree, system-ui, sans-serif"
    fontSize: "16px"
  nav-label:
    fontFamily: "Figtree, system-ui, sans-serif"
    fontSize: "12px"
    fontWeight: 500
  hero-title:
    fontFamily: "-apple-system, BlinkMacSystemFont, \"Segoe UI\", sans-serif"
    fontSize: "28px"
    lineHeight: 1.12
    letterSpacing: "-0.02em"
rounded:
  card: "16px"
  control: "10px"
  pill: "999px"
  icon-tile: "12px"
  circle: "50%"
spacing:
  space-4: "4px"
  space-8: "8px"
  space-12: "12px"
  space-16: "16px"
  space-20: "20px"
  space-24: "24px"
  space-32: "32px"
  space-40: "40px"
  space-48: "48px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.primary-foreground}"
    rounded: "{rounded.control}"
    padding: "12px 16px"
    height: "48px"
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "12px 16px"
    height: "48px"
  input:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    typography: "{typography.field}"
    rounded: "{rounded.control}"
    padding: "12px"
    height: "48px"
  navigation-mobile:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink-3}"
    rounded: "{rounded.pill}"
    padding: "6px"
    height: "80px"
    width: "min(480px, calc(100% - 32px))"
  navigation-desktop:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink-3}"
    padding: "24px 16px"
    width: "240px"
    height: "100dvh"
  navigation-active:
    backgroundColor: "{colors.primary-soft}"
    textColor: "{colors.primary-ink}"
    rounded: "{rounded.pill}"
  badge-warning:
    backgroundColor: "{colors.warning-soft}"
    textColor: "{colors.warning}"
    typography: "{typography.badge}"
    rounded: "{rounded.pill}"
    padding: "4px 10px"
    height: "24px"
  card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.card}"
    padding: "20px"
  hero:
    backgroundColor: "{colors.hero}"
    textColor: "{colors.hero-text}"
    rounded: "{rounded.card}"
    padding: "24px"
  filter-active:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.primary-foreground}"
    rounded: "{rounded.pill}"
    padding: "8px 16px"
    height: "44px"
---
# Design System: Eburum — Club Office

## Overview

**Creative North Star: "Club Office — il lavoro reale della squadra"**

Una tela grigio-azzurra, superfici opache e gerarchie compatte accompagnano il lavoro quotidiano dello staff. Oro e crema mantengono l’identità del club; la gerarchia rende leggibili priorità, nomi e contesto anche a bordo campo. Il corpo Figtree affianca i titoli di sistema già presenti.

Club Office conserva navy, oro, crema e Figtree. Il brief operativo del 25 ottobre 2026 prevale sul primo brief grafico: titoli meno grandi, raggi contenuti, focus blu nel tema chiaro e superfici organizzate per compito. Il riferimento implementato è `eburum/src/design-system.css`, ultimo import di stile in `eburum/src/main.tsx`; le classi legacy Soft Club restano nomi tecnici. Logo SVG e PNG del club restano invariati.

**Key Characteristics:**

- Tela grigio-azzurra, superfici opache e accento oro misurato.
- Titoli di sistema, corpo Figtree e metadati leggibili.
- Dock mobile e sidebar desktop con la stessa gerarchia di destinazioni per ruolo.
- Stati semantici espliciti, editor nel shell e comandi persistenti accessibili.

## Colors

Il frontmatter è normativo per i colori estratti. Le chiavi senza prefisso descrivono il tema chiaro; `dark-*` registra gli override del tema scuro. In produzione si usano le variabili CSS senza prefisso: `html[data-theme="dark"]` cambia i valori. Le proprietà non ridefinite, incluso il pannello hero, ereditano il valore base.

### Primary

Primary è il navy dei comandi pieni. Hero mantiene il navy del club anche nel tema scuro. Primary-ink serve ai link e alle icone: nel tema scuro è più chiaro del primary dei pulsanti pieni. Primary-foreground e hero-text rendono espliciti i testi sulle superfici scure; hero-muted sostiene il contesto del pannello.

### Secondary

Accent è l’oro dell’identità e degli stati marcati; sostiene anche il focus nel tema scuro. Accent-soft è la crema dei fondi; accent-ink è il testo scuro leggibile su quei fondi. L’oro brillante non va usato come testo ordinario su bianco.

### Neutral

Bg è la tela grigio-azzurra, surface raccoglie le attività e surface-muted distingue superfici secondarie e controlli disabilitati. Ink, ink-2 e ink-3 ordinano lettura e contesto. Border separa i gruppi; control-border rende riconoscibili i campi, inclusi ricerca e selezione della stagione. Overlay oscura lo sfondo dei dialoghi. Focus risolve a primary-ink nel tema chiaro e ad accent nel tema scuro; focus-soft è il solo alone supplementare legacy dell’accesso, mai l’unico indicatore.

Success, warning, danger e neutral, ciascuno con il proprio soft, esprimono esito e stato. I colori pieni del tema chiaro sono più scuri dei valori indicativi del brief per mantenere il contrasto del testo. Warning distingue ciò che richiede verifica, danger scadenze o problemi, success stato positivo e vittoria, neutral attesa o pareggio secondo l’etichetta.

**The Required Boundary Rule.** I bordi e gli indicatori necessari a riconoscere controlli e stati devono raggiungere almeno 3:1 rispetto alle superfici adiacenti applicabili; i divisori decorativi non sostituiscono il bordo di un campo. Il testo normale richiede almeno 4,5:1, quello grande almeno 3:1.

**The Semantic State Rule.** Usare la coppia testo/sfondo soft dello stesso stato e accompagnarla con parole o icone accessibili; il colore da solo non basta.

`src/design-system.css` conserva inoltre 140 swatch di compatibilità per grafici e superfici specialistiche. Sono un inventario migrato, non una seconda palette per nuove UI. I colori di contenuto dei PDF e dei disegni tattici conservano il proprio significato di dominio.

## Typography

**Display Font:** la famiglia di sistema dei titoli nel frontmatter.  
**Body Font:** Figtree con fallback di sistema; file regular e semibold auto-ospitati in `src/assets/fonts/`. La licenza OFL è emessa dalla build in `fonts/OFL.txt`.

**Character:** titoli compatti e decisi, corpo aperto e leggibile. Il contratto H1 è desktop 32–36px e telefono 28–32px; l’implementazione corrente sceglie i due massimi, registrati nel frontmatter. I ruoli headline-mobile e headline-desktop guidano saluto, pagine ed editor; section e card distinguono le sezioni dalle singole attività. Il pannello prossimo impegno usa hero-title, più compatto del titolo pagina.

Metadata mantiene la dimensione di lettura minima per le didascalie. Uppercase-label è riservato alle etichette brevi; badge e nav-label sono gli altri usi intenzionali da 12px. Il desktop usa testo navigazione da 15px. Punteggi, orari e conteggi sportivi usano cifre tabellari. Gli input mantengono il ruolo field; il testo può andare a capo senza altezza rigida che lo tagli.

**The Operational Hierarchy Rule.** Titoli, nomi e conteggi guidano la lettura; i metadati usano il ruolo metadata e i campi mantengono field sul telefono.

## Layout

Il shell cambia a (1024px): da questa larghezza una sidebar fissa a sinistra occupa (240px), con logo in alto e navigazione verticale. Il workspace è largo `calc(100% - 240px)` e ha margine sinistro corrispondente. Sotto il breakpoint resta il dock centrato, largo viewport meno (32px), massimo (480px), altezza minima (80px), a (12px + safe-area inferiore) dal fondo. Le sue voci hanno minimo (60px), icone (22px) e label sempre visibili.

Il contenitore ha max-width (1160px), padding orizzontale (20px): l’area utile massima è quindi (1120px). Il ritmo segue la scala del frontmatter; sezioni distanti (32px), titolo/contenuto distanti (12px). Nelle pagine di consultazione il dock-clearance equivale ad altezza dock + (24px) + safe area. Negli editor operativi mobili il dock è nascosto: rimane una sola barra di lavoro sticky, con Annulla/Salva o i comandi pertinenti e spazio per safe area. La programmazione compatta dell’allenamento ha larghezza massima (760px). Sul desktop i comandi di salvataggio sono centrati nel workspace, massimo (1120px), a (24px) dal fondo.

La Home sportiva ordina prossimo impegno, attività da completare, ultime attività e riepiloghi della squadra. Sul desktop si divide in colonne (2fr / 1fr), gap (32px): futuro, urgenze e ultimo allenamento a sinistra; comunicazioni e riepiloghi a destra. Il prossimo impegno è il primo evento futuro reale tra allenamenti e partite; senza eventi futuri il vuoto resta compatto e lascia emergere attività e riepiloghi disponibili. L’ultimo allenamento resta una superficie chiara compatta. Le home specifiche di ruolo conservano i propri accessi.

Liste ed editor si adattano al viewport senza scorrimento orizzontale della pagina. I sei filtri messaggi fanno eccezione deliberata: una sola riga interna scorrevole. Il loro target minimo è (44px), ampliato rispetto ai (36px) indicativi del brief per l’accessibilità. Safe area, contenuti finali e barre persistenti vanno verificati a pagina scorsa fino in fondo.

## Elevation & Depth

Superfici opache, ombre leggere condivise e divisori creano profondità. Card e contenitori ordinari usano card-shadow senza bordo aggiuntivo; un bordo oro segnala la partita di oggi e una linea laterale sottile segnala il messaggio in attesa di conferma. Le superfici semantiche rispettano il tema. Ombre e overlay sono variabili centrali; i valori esatti e la motion grammar sono nella sidecar.

Hover cromatico (150ms ease-out), pressione con scala (0.98) in (120ms), ingresso pagina con opacità e spostamento verticale (8px) in (200ms). Skeleton (1.4s) e indicatore Realtime (2.8s) hanno animazioni leggere. `prefers-reduced-motion` disattiva animazioni e transizioni CSS; MotionConfig segue la preferenza utente. I conteggi della Home hanno un ingresso di (400ms) al primo caricamento, con valore finale accessibile; la preferenza di movimento ridotto lo salta.

**The Quiet Surface Rule.** Le card ordinarie usano superficie opaca e ombra condivisa; i bordi accentati restano riservati agli stati che li richiedono.

## Shapes

Card e dialoghi condividono card; pulsanti e input control. Il contratto ammette schede da 12–16px e controlli da 8–10px; i valori implementati sono nel frontmatter. Gli alias legacy club-field-radius e club-control-radius risolvono a control, club-dialog-radius a card. Badge, controlli segmentati e dock mantengono pill; i selettori della stagione usano control. Le tile icona sono quadrati morbidi (40px), raggio icon-tile, con SVG (20px). Avatar messaggi (36px) e icone degli stati vuoti (56px) sono cerchi. Una tile decorativa può essere più piccola di un target: i controlli rimangono di almeno (44px). I divisori degli strumenti partono dopo l’icona, senza tagliare tutta la superficie.

## Components

### Buttons

Comandi pieni primary/primary-foreground, secondari surface/ink con border, distruttivi danger-soft/danger. Minimo ordinario (48px), peso (600), control; le icone autonome conservano almeno (44px). Il padding React predefinito estratto è (12px 16px), mentre varianti di dominio possono adattarlo. Focus visibile con outline focus (2px), offset (2px); blu nel tema chiaro, oro nel tema scuro; disabilitato conserva il feedback e impedisce l’azione. Le altezze del frontmatter descrivono minimi, salvo dimensioni geometriche deliberate.

### Inputs / Fields

Surface, control-border e testo ink; placeholder ink-3, min-height (48px). Il focus accesso aggiunge bordo primary (2px) e alone focus-soft; l’outline focus resta l’indicatore riconoscibile. La ricerca usa lo stesso focus intorno al gruppo, senza un secondo outline interno. Errori locali danger con icona, testo esplicito e campo invalido. Password con mostra/nascondi da (44px); invio disabilitato e testo di caricamento durante l’accesso. Il recupero password usa l’assistenza e il reset amministrativo già esistenti.

### Chips

Stati da (24px) minimo, padding del frontmatter, testo badge e coppia semantica pieno/soft. Filtri operativi segmentati su surface-muted con selezione surface; i filtri messaggi sono pill indipendenti e la selezione usa primary/primary-foreground. Stato selezionato accessibile e focus visibile; non affidarsi al solo colore.

### Cards / Containers

Card ordinarie surface, card-shadow e card; padding comune (20px). Il prossimo impegno usa hero e padding (24px), etichetta oro, contesto hero-muted e azione chiara con testo scuro. Gli stati vuoti restano compatti, con titolo, frase breve e una sola azione quando permessi e contesto la consentono; un’icona è facoltativa. Skeleton riprende la forma delle card; errori di rete usano danger-soft con azione di riprova. Toast persistono il tempo utile sopra la navigazione.

### Navigation

Il set sportivo è Home, Allenamenti, Messaggi, Partite, Altro; Messaggi è anche il titolo della pagina e del blocco Home; comunicazione può restare il nome dell’oggetto nei testi e nel codice. Presidente e tesoriere mantengono il set esistente Home, Messaggi, Economia, Partite, Altro. Rosa resta raggiungibile da Altro. Sidebar e dock condividono destinazioni e stato corrente; solo un link espone `aria-current="page"`. La selezione ha primary-soft, primary-ink e peso (700), inattivi ink-3. Le icone sono SVG outline, con nome accessibile per comandi senza testo. La campanella usa un punto danger se ci sono elementi non letti. La stagione ha un selettore primario nel desktop e contesto riconoscibile nella Home mobile, anche a (320px); evitare selettori concorrenti. Negli editor mobili il dock cede il posto alla barra di lavoro.

### Operational patterns

La creazione allenamento mostra prima titolo, data, orari, campo e indicazioni; Risposte WhatsApp e Presenze effettive appartengono al dettaglio successivo. La nuova partita separa programmazione e preparazione di convocati/formazione. Allenamenti distingue Prossimi e Da confermare con conteggio reale; data e riepilogo risposte restano separati dalle presenze effettive. Registro e lavagna usano righe cliccabili con testo vicino all’icona, sottotitolo e chevron. Il cambio di ambito protegge le bozze. Consultazione e Correggi presenze restano distinte; uscita e Indietro controllano le modifiche effettive prima di cambiare modalità e ripristinano l’origine Registro con mese/giorno. Questa è la regola del percorso; la verifica reale di salvataggio e riapertura resta distinta dalla prova locale.

Messaggi mostra autore, ruolo noto oppure Staff, tempo relativo e anteprima di due righe espandibile. Il bordo accentato segue la conferma esplicita ancora pendente, usando le ricevute effettive; aprire il messaggio non conferma la lettura. Il riepilogo Realtime rimane compatto; il refresh è in un menu. La Home presenta fino alle tre comunicazioni attive più recenti.

Partite separa Prossima e Risultati; esito V/N/P dal punto di vista di Eburum, propria squadra evidenziata e punteggio verticale allineato a ogni squadra. Le gare future mostrano ora e conto alla rovescia; quella di oggi ha bordo accent (2px). Casa usa primary-soft, Trasferta solo bordo. Forma recente limitata alle ultime cinque gare concluse; footer azione leggibile con freccia.

Altro raggruppa Squadra, Attività e Amministrazione, in card separate (24px). Scadenze e tesseramenti è il nome coerente della sezione: filtri Mancanti, Scaduti, In scadenza e Tesseramento incompleto restano distinti. I conteggi dichiarano se misurano giocatori o date/documenti, senza equipararli. Le voci rimangono filtrate dai permessi, compresa Economia dove prevista. La disponibilità riassume l’ultimo allenamento effettivamente confermato e i provvedimenti aperti, con etichette che dichiarano la fonte temporale; non è una valutazione sanitaria corrente.

La Rosa usa una tabella compatta sul desktop e una lista sul telefono: nome, ruolo, numero e segnalazione sono confrontabili, i nomi lunghi vanno a capo. La scheda separa identità, dati personali, stagione e gestione; ricerca e contesto di ritorno restano riconoscibili.

Il report raggruppa Partecipazione, Impiego in gara e Disciplina con titoli, spazio e divisori, senza riquadri annidati. Sul telefono Giocatore occupa una riga e precede Periodo; il nome selezionato è visibile per intero. La didascalia “Presenze effettive · % sulle registrazioni” chiarisce il misuratore, insieme al denominatore di ogni riga. Grafici di presenze, risposte e minuti usano famiglie semantiche distinte, legenda, unità e periodo; i riquadri interni non hanno ombre. Zero, mancante e non applicabile seguono i dati disponibili, senza inventare distinzioni che il modello non registra. I dettagli cronologici partono dal più recente e le righe gara danno priorità a data e avversario.

La lavagna riserva spazio al campo: toolbar mobile compatta, strumenti e colori con nome accessibile e selezione evidente. Una bozza appena aperta è Bozza vuota; Modifiche non salvate segue modifiche effettive.

Editor allenamento e partita, dialoghi, salvataggi, storico, PDF e strumenti specialistici mantengono i flussi e i permessi esistenti. I dialoghi restano scrollabili e con focus gestito. Questa revisione visuale non autorizza nuovi backend, schemi o persistenza simulata.

## Do's and Don'ts

### Do:

- **Do** usare i token semantici centrali e verificare ogni nuova superficie nei temi chiaro e scuro.
- **Do** mantenere sidebar da desktop e dock sotto il breakpoint nelle pagine di consultazione, con una sola destinazione corrente; negli editor mobili usare una sola barra di lavoro.
- **Do** preservare metadati da 13px, campi da 16px, target interattivi di almeno 44px, focus blu nel tema chiaro, bordi necessari da almeno 3:1 e movimento ridotto.
- **Do** mantenere salvataggi e feedback liberi dalla navigazione, safe area, storico e protezione delle bozze.
- **Do** usare dati reali, font locali e logo del club invariato.

### Don't:

- **Don't** scrivere colori UI letterali nei componenti o riciclare uno swatch legacy come nuovo significato semantico.
- **Don't** confondere risposte WhatsApp, presenze effettive e convocazioni.
- **Don't** rappresentare il riepilogo dell’ultimo allenamento come disponibilità medica corrente.
- **Don't** inventare ruoli autore, conteggi, stati di lettura, dati demo o persistenza.
- **Don't** coprire contenuti o comandi con il dock o nascondere il nome accessibile di un’icona.
