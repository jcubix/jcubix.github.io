# Gestione accessi

La funzione `manage-users` verifica la sessione con Auth e il ruolo in `app_metadata` sul server. Solo gli amministratori possono elencare e creare utenti. Le nuove utenze sono membri; i dati restano isolati dalle policy RLS esistenti.

Il trigger `eburum_require_managed_account` blocca la creazione di utenti senza `app_metadata.managed_account = true`. I metadati applicativi sono assegnabili soltanto dal backend privilegiato: passare `user_metadata`, anche con nomi identici, non consente la registrazione. Le nuove utenze vanno create dalla schermata Utenti; la creazione diretta dal dashboard richiede il medesimo metadato applicativo.

Il primo amministratore viene individuato dal proprietario registrato in `private_import.bootstrap_state`, senza inserire identificativi o email nel repository. Nessun dato della squadra è copiato ai nuovi utenti.

La funzione usa i segreti standard del runtime Supabase, mai esposti al client. La sessione è verificata esplicitamente con `getUser(token)` prima di qualsiasi operazione amministrativa. Il controllo JWT legacy del gateway è disattivato per compatibilità con le chiavi publishable e le firme asimmetriche, come descritto nella [documentazione Supabase](https://supabase.com/docs/guides/getting-started/migrating-to-new-api-keys). Le richieste anonime o con token falsificati ricevono 401; gli utenti senza ruolo amministratore ricevono 403. Si consiglia inoltre di disattivare "Allow new users to sign up" nelle impostazioni Auth: il trigger protegge la registrazione anche senza questa impostazione.

Le password iniziali sono scelte dall'amministratore (almeno 12 caratteri); la creazione non invia email automaticamente.
