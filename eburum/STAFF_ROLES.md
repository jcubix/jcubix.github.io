# Ruoli dello staff

L'amministratore assegna i ruoli da **Altro → Gestione utenti**, alla creazione o su un'utenza esistente. Gli account esistenti conservano il proprio ruolo. Presidente è una carica di supervisione, distinta dall'amministrazione degli accessi.

| Funzione | Amministratore | Team manager | Allenatore | Segretario | Collaboratore tecnico | Presidente | Tesoriere |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Calendario, rosa, presenze, eventi, report e PDF | Consulta | Consulta | Consulta | Consulta | Consulta | Consulta | Consulta |
| Pubblicazione comunicazioni | Sì | Sì | Sì | Sì | Sì | Sì | Sì |
| Creazione attività e organizzazione | Sì | Sì | Sì | No | No | No | No |
| Risposte WhatsApp e presenze | Modifica | Modifica | Modifica | Consulta | Modifica | Consulta | Consulta |
| Risultati, eventi e durata della gara | Modifica | Modifica | Modifica | Consulta | Modifica | Consulta | Consulta |
| Provvedimenti da espulsione e conferma delle gare scontate | Gestisce | Gestisce | Gestisce | Consulta | Gestisce | Consulta | Consulta |
| Convocazioni, titolari e posizione | Modifica | Modifica | Modifica | Consulta | Consulta | Consulta | Consulta |
| Modulo tattico | Modifica | Nessun accesso | Modifica | Nessun accesso | Consulta | Nessun accesso | Nessun accesso |
| Osservazioni tecniche riservate | Modifica | Nessun accesso | Modifica | Nessun accesso | Modifica | Nessun accesso | Nessun accesso |
| Lavagna tattica, foto e annotazioni | Gestisce | Nessun accesso | Gestisce | Nessun accesso | Gestisce | Nessun accesso | Nessun accesso |
| Rosa e dati amministrativi | Modifica | Modifica | Nessuna gestione | Modifica | Nessuna gestione | Stato sintetico | Nessuna gestione |
| Fondi, movimenti, ricevute, verifiche e rendiconti | Gestisce | No | No | No | No | Consulta | Gestisce |
| Utenti, ruoli e password altrui | Gestisce | No | No | No | No | No | No |

Il collaboratore registra i dati operativi su attività esistenti. Non modifica data, campo, ritrovo, organizzazione, modalità dei minuti, convocati o modulo. I cambi continuano a calcolare automaticamente i minuti dei giocatori. Le osservazioni hanno un salvataggio dedicato con controllo della revisione, senza riscrivere una distinta eventualmente modificata da un altro utente.

Il presidente vede certificati e documenti come **In regola / In scadenza / Scaduto / Da verificare** e lo stato del tesseramento. La proiezione server non restituisce date né contatti di emergenza. La Home presenta la situazione della squadra e azioni di consultazione.

Il tesoriere ha una Home dedicata ai fondi. Opera su **Altro → Economia**, senza permessi di modifica sui flussi sportivi e senza accesso ai dati amministrativi riservati. Il presidente consulta Economia in sola lettura. Modalità di registrazione, storni, ricevute, periodi chiusi ed esportazioni sono documentati in [TREASURY.md](TREASURY.md).

## Implementazione e verifica

- `app-roles.js`: etichette, descrizioni e capacità condivise dalle schermate React e dagli editor di dominio. I controlli dell'interfaccia non sostituiscono l'autorizzazione server.
- `supabase/migrations/20261011161158_technical_assistant_president_roles.sql`: ruoli ammessi, creazione account gestita, RLS, controlli dei campi del collaboratore, RPC sportive e comunicazioni/Realtime.
- `supabase/migrations/20261011161339_private_president_summary.sql`: proiezione privilegiata nel solo schema privato, wrapper API con privilegi dell'utente e controllo di ruolo/squadra nella funzione interna.
- `manage-users` versione 10: accetta entrambi i ruoli per creazione e assegnazione; verifica sessione e ruolo amministratore dalla membership corrente.
- `supabase/tests/staff_roles.sql`: squadra e account sintetici isolati, test di operazioni ammesse e negate, presenze, cambi 60/30 minuti, privacy e isolamento fra squadre. Transazione sempre annullata. Eseguito sul database prima e dopo l'applicazione delle migrazioni.
- `supabase/tests/managed_auth_creation.sql`: verifica tutti e sei i ruoli seguendo l'ordine reale di creazione Auth (insert, aggiornamento metadati, trigger differito), inclusi i tentativi di registrazione non autorizzata; eseguito sul database con rollback.
- `npm run verify`: 33 test di dominio, 25 integrazioni React e 2 test PWA, tutti superati. Gestione utenti testata anche contro metadati falsificati, utenti senza privilegi e tentativi fra squadre.
- Browser: 30 controlli su due ruoli e larghezze 320/390/1440 px, senza overflow o errori JavaScript; editor partita e riepilogo scadenze verificati anche visivamente.
- Conteggi e impronte dei dati invariati: 30 giocatori, 20 sessioni, 587 presenze, 2 partite, 22 eventi, 3 utenze. Nessun account reale creato o riassegnato per i test. La API utenti pubblicata rifiuta richieste anonime con HTTP 401.

Gli advisor non segnalano nuove anomalie rispetto alla situazione precedente. Restano i due avvisi preesistenti sul vecchio import iniziale e sulla protezione delle password compromesse, fuori da questo intervento. Riferimenti: [database linter](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable), [password security](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).

Le schermate autenticate sono state testate con fixture browser e integrazioni; non viene attestato un collaudo manuale con account reali dello staff né su iPhone fisico.

## Pubblicazione

L'11 ottobre 2026 la build è stata verificata in anteprima (`dpl_7FTot8V5QdxW6h8ScezrPLkFegtL`) anche con 30 controlli delle schermate dei due ruoli su dati sintetici. Gli stessi file sono stati pubblicati in produzione (`dpl_4yLienZHjQFgh7e6GWJBc6oZBcnu`), READY su https://eburum.vercel.app. Il controllo del dominio conferma 21 asset disponibili e coerenti con la build, assenza di errori JavaScript, login senza overflow a 320/390/1440 px, service worker attivo e icona PNG per iOS. Nessun commit o push eseguito; le modifiche preesistenti del workspace sono conservate.
