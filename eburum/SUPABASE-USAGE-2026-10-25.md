# Supabase: utilizzi e correzione del 25 ottobre 2026

## Risultato

La MFA dell'account Supabase risulta attiva (due metodi registrati oggi).
Il piano resta Free. Nessun dato della squadra o file caricato è stato eliminato.

Il problema era una richiesta PostgREST bloccata nel retry del conflitto
«Attività modificata nel frattempo. Riaprila.»: 8.638.530 errori in 24 ore,
tutti sullo stesso processo PostgreSQL. Il backend 773063 è stato fermato dopo
aver verificato ruolo, applicazione e chiamata `save_team_activity`.

## Utilizzi verificati

Dashboard, ciclo 6 ottobre–6 novembre 2026:

| Risorsa | Utilizzo | Quota |
| --- | --- | --- |
| Database | 0,038 GB (8%) | 0,5 GB |
| File Storage | 0 GB; SQL conferma zero oggetti | 1 GB |
| Traffico in uscita | 0,096 GB (2%) | 5 GB |
| Utenti attivi | 25 | 50.000 |
| Edge Functions | 146 chiamate | 500.000 |
| Log ingeriti | 179,352 GB | 1 GB, indicatore Upcoming |

La misura SQL corrente del database è 22.615.731 byte; la dashboard aggiorna
i valori periodicamente e riporta anche il massimo del periodo.
Il consumo dei log è cumulativo nel ciclo: non rappresenta file dell'app da
cancellare, e cancellare righe applicative non lo azzera.

## Correzione applicata in produzione

Migrazione `20261025195710_prevent_business_conflict_retry_loops.sql`:
sostituisce i conflitti applicativi SQLSTATE `40001` con `PT409` nelle dieci
funzioni già presenti per attività, presenze, partite, lavagne, squalifiche e
movimenti economici. Mantiene firme, permessi, transazioni e controlli di revisione.
Il frontend riconosce sia il vecchio codice sia il nuovo durante il rilascio.

Il codice `40001` è riservato alle vere serialization failure. PostgREST 14.18
lo ripete automaticamente; un conflitto di revisione richiede invece una risposta
HTTP 409 che chieda di ricaricare la versione aggiornata.

Fonte ufficiale: [Supabase: SQLSTATE 40001 e retry infiniti](https://supabase.com/kb/troubleshooting/high-cpu-and-infinite-transaction-retries-when-using-custom-error-codes-in-rpc-functions).

## Verifiche

- Processo problematico non più presente.
- Zero funzioni applicative residue che sollevano `40001`; dieci con `PT409`.
- Prova SQL con revisione obsoleta respinta con `PT409`, interamente in rollback.
- 53 test di dominio superati, compresi entrambi i codici di conflitto:
  un solo invio, bozza conservata, azione di ricaricamento disponibile.
- Rosa e presenze invariate: 30 giocatori, 707 registrazioni.
- Logging di connessioni e query lente già disattivato; nessuna riduzione
  dei controlli di sicurezza o soppressione degli errori effettuata.

## Limiti e prossimi controlli

I log sono gestiti dalla retention Supabase; non è stata effettuata una cancellazione
manuale né promesso un azzeramento del contatore mensile. La dashboard indica che
il nuovo misuratore log non è ancora soggetto a enforcement, con periodo di grazia
fino all'inizio del 2027; le condizioni vanno ricontrollate prima di quella data.
Le nuove quote possono differire fra la versione Markdown e quella HTML delle
documentazioni: per questo rapporto sono state usate le quote dell'account.

Il progetto indica «No backups»: non è stato attivato alcun piano a pagamento
e non è stata eseguita una prova di ripristino. La migrazione React già in corso
è un intervento separato e resta non completata.
