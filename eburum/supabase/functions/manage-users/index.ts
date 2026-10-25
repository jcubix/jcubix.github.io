import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const origins = new Set(["https://eburum.vercel.app"]);
// Exact local development hosts and this project's Vercel preview namespace.
// Origin acceptance never replaces the verified token and authoritative admin role below.
const allowedOrigin = (origin: string) =>
  origins.has(origin) ||
  /^http:\/\/(?:127\.0\.0\.1|localhost):419[78]$/.test(origin) ||
  /^https:\/\/eburum-[a-z0-9]+-giacomocubicciotti-4377\.vercel\.app$/.test(
    origin,
  );
Deno.serve(async (req: Request) => {
  const origin = req.headers.get("Origin") || "";
  const headers = {
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
    "Access-Control-Allow-Origin": allowedOrigin(origin)
      ? origin
      : "https://eburum.vercel.app",
    "Access-Control-Allow-Headers":
      "authorization, apikey, content-type, x-client-info",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    Vary: "Origin",
  };
  const reply = (status: number, body: unknown) =>
    new Response(JSON.stringify(body), { status, headers });
  if (req.method === "OPTIONS")
    return new Response(null, { status: 204, headers });
  if (req.method !== "POST")
    return reply(405, { error: "Metodo non consentito" });
  const token = (req.headers.get("Authorization") || "").replace(
    /^Bearer\s+/i,
    "",
  );
  if (!token) return reply(401, { error: "Accedi per continuare" });
  const secretKeys = Deno.env.get("SUPABASE_SECRET_KEYS");
  const serverKey = secretKeys
    ? JSON.parse(secretKeys).default
    : Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, serverKey!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  // getUser checks the current Auth record, rather than trusting stale or user-editable claims.
  const {
    data: { user },
    error: authError,
  } = await admin.auth.getUser(token);
  if (authError || !user) return reply(401, { error: "Sessione non valida" });
  const { data: member } = await admin
    .from("team_members")
    .select("owner_id,role")
    .eq("user_id", user.id)
    .single();
  if (member?.role !== "admin")
    return reply(403, { error: "Operazione riservata agli amministratori" });
  try {
    const body = await req.json();
    if (body.action === "delete") {
      if (typeof body.userId !== "string" || body.userId === user.id)
        return reply(400, { error: "Non puoi eliminare il tuo account" });
      if (body.userId === member.owner_id)
        return reply(400, { error: "Il proprietario della squadra non può essere eliminato" });
      const { data: target, error: targetError } = await admin
        .from("team_members")
        .select("user_id,display_name")
        .eq("user_id", body.userId)
        .eq("owner_id", member.owner_id)
        .maybeSingle();
      if (targetError)
        return reply(503, { error: "Impossibile verificare l’utenza. Riprova." });
      if (!target)
        return reply(404, { error: "Utente della squadra non trovato. Riapri l’elenco utenti." });
      if (typeof body.confirmEmail !== "string" ||
          body.confirmEmail.trim().toLowerCase() !== target.display_name.toLowerCase())
        return reply(409, { error: "Utenza modificata nel frattempo. Riapri l’elenco prima di eliminarla." });
      // Preserve accounting references; the Auth trigger revokes membership in the same transaction.
      const { error } = await admin.auth.admin.deleteUser(target.user_id, true);
      if (error)
        return reply(503, { error: "Eliminazione non confermata. Riapri l’elenco utenti prima di riprovare." });
      return reply(200, { deleted: true });
    }
    if (body.action === "list") {
      const page = Math.max(1, Math.trunc(Number(body.page) || 1));
      const { data, error } = await admin
        .from("team_members")
        .select("user_id,role,display_name,first_name,last_name,created_at")
        .eq("owner_id", member.owner_id)
        .order("created_at")
        .order("user_id")
        .range((page - 1) * 50, page * 50 - 1);
      if (error)
        return reply(400, { error: "Impossibile caricare gli utenti" });
      return reply(200, {
        users: data.map((u) => ({
          id: u.user_id,
          email: u.display_name,
          first_name: u.first_name,
          last_name: u.last_name,
          role: u.role,
          created_at: u.created_at,
        })),
        nextPage: data.length === 50 ? page + 1 : null,
      });
    }
    const personalNames = () => {
      const first_name =
        typeof body.first_name === "string"
          ? body.first_name.trim().normalize("NFC")
          : "";
      const last_name =
        typeof body.last_name === "string"
          ? body.last_name.trim().normalize("NFC")
          : "";
      if (
        [first_name, last_name].some(
          (value) => value.length > 80 || /[\u0000-\u001f\u007f]/u.test(value),
        )
      )
        throw Error(
          "Nome e cognome devono contenere al massimo 80 caratteri, senza caratteri di controllo",
        );
      return { first_name, last_name };
    };
    if (body.action === "profile") {
      if (typeof body.userId !== "string")
        return reply(400, { error: "Seleziona un utente della squadra" });
      const names = personalNames();
      const { data, error } = await admin
        .from("team_members")
        .update(names)
        .eq("user_id", body.userId)
        .eq("owner_id", member.owner_id)
        .select("user_id")
        .maybeSingle();
      if (error)
        return reply(400, { error: "Nome e cognome non aggiornati. Riprova." });
      if (!data)
        return reply(404, { error: "Utente della squadra non trovato" });
      return reply(200, { updated: true });
    }
    if (body.action === "role") {
      if (
        ![
          "admin",
          "manager",
          "coach",
          "secretary",
          "technical_assistant",
          "president",
          "treasurer",
        ].includes(body.role) ||
        typeof body.userId !== "string"
      )
        return reply(400, { error: "Ruolo non valido" });
      const { data: target } = await admin
        .from("team_members")
        .select("user_id,owner_id")
        .eq("user_id", body.userId)
        .eq("owner_id", member.owner_id)
        .single();
      if (!target)
        return reply(404, { error: "Utente della squadra non trovato" });
      if (target.user_id === member.owner_id && body.role !== "admin")
        return reply(400, {
          error: "Il proprietario deve restare amministratore",
        });
      const { error } = await admin
        .from("team_members")
        .update({ role: body.role })
        .eq("user_id", target.user_id)
        .eq("owner_id", member.owner_id);
      if (error) return reply(400, { error: "Ruolo non aggiornato" });
      return reply(200, { updated: true });
    }
    if (body.action === "email") {
      const email =
        typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
      if (
        typeof body.userId !== "string" ||
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
        email.length > 254
      )
        return reply(400, {
          error: "Seleziona un utente e inserisci una email valida",
        });
      const { data: target } = await admin
        .from("team_members")
        .select("user_id")
        .eq("user_id", body.userId)
        .eq("owner_id", member.owner_id)
        .single();
      if (!target)
        return reply(404, { error: "Utente della squadra non trovato" });
      const { data: existing, error: readError } =
        await admin.auth.admin.getUserById(target.user_id);
      if (readError || !existing.user)
        return reply(503, {
          error: "Impossibile verificare l’utenza. Riprova.",
        });
      const previous = (existing.user.email || "").toLowerCase();
      if (previous === email) return reply(200, { updated: true, email });
      if (
        typeof body.previousEmail !== "string" ||
        previous !== body.previousEmail.trim().toLowerCase()
      )
        return reply(409, {
          error: "Email modificata nel frattempo. Riapri la gestione utenti.",
        });
      const { error } = await admin.auth.admin.updateUserById(target.user_id, {
        email,
        email_confirm: true,
      });
      if (error) {
        if (["email_exists", "user_already_exists"].includes(error.code || ""))
          return reply(409, {
            error:
              "Email già utilizzata da un’altra utenza. Scegli un indirizzo diverso.",
          });
        return reply(400, {
          error: "Email non aggiornata. Controlla l’indirizzo e riprova.",
        });
      }
      return reply(200, { updated: true, email });
    }
    if (body.action === "password") {
      const password = typeof body.password === "string" ? body.password : "";
      if (typeof body.userId !== "string" || body.userId === user.id)
        return reply(400, { error: "Seleziona un altro utente della squadra" });
      if (password.length < 12 || password.length > 128)
        return reply(400, { error: "Password da 12 a 128 caratteri" });
      const { data: target } = await admin
        .from("team_members")
        .select("user_id")
        .eq("user_id", body.userId)
        .eq("owner_id", member.owner_id)
        .single();
      if (!target)
        return reply(404, { error: "Utente della squadra non trovato" });
      const { error } = await admin.auth.admin.updateUserById(target.user_id, {
        password,
      });
      if (error)
        return reply(400, {
          error:
            "Password non aggiornata. Controlla la nuova password e riprova.",
        });
      return reply(200, { updated: true });
    }
    if (body.action !== "create")
      return reply(400, { error: "Azione non valida" });
    const email =
      typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const password = typeof body.password === "string" ? body.password : "";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254)
      return reply(400, { error: "Inserisci una email valida" });
    if (password.length < 12 || password.length > 128)
      return reply(400, { error: "Password da 12 a 128 caratteri" });
    const role = body.role ?? "manager";
    if (
      ![
        "admin",
        "manager",
        "coach",
        "secretary",
        "technical_assistant",
        "president",
        "treasurer",
      ].includes(role)
    )
      return reply(400, { error: "Ruolo non valido" });
    const names = personalNames();
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      app_metadata: {
        role: role === "admin" ? "admin" : "member",
        team_role: role,
        managed_account: true,
        created_by: user.id,
      },
    });
    if (error) {
      const code = error.code || "auth_error";
      if (["email_exists", "user_already_exists"].includes(code))
        return reply(409, {
          error:
            "Email gia registrata. Usa l'utenza esistente o un'altra email.",
          code,
        });
      if (["weak_password", "validation_failed"].includes(code))
        return reply(400, {
          error:
            "Email o password non accettate. Usa una email valida e una password robusta da 12 a 128 caratteri.",
          code,
        });
      if (code === "over_request_rate_limit" || error.status === 429)
        return reply(429, {
          error: "Troppe richieste. Attendi qualche minuto e riprova.",
          code,
        });
      // Only log safe diagnostics: never credentials, tokens or the complete request.
      console.error(
        JSON.stringify({
          operation: "create_staff",
          code,
          status: error.status || 500,
        }),
      );
      return reply(503, {
        error:
          "Il servizio non ha completato la creazione. Riprova tra poco; se il problema persiste contatta l'amministratore.",
        code: "staff_creation_unavailable",
      });
    }
    if (!data.user)
      return reply(503, {
        error:
          "Creazione non confermata dal servizio. Ricarica l'elenco prima di riprovare.",
        code: "staff_creation_unconfirmed",
      });
    const { data: assigned, error: assignmentError } = await admin
      .from("team_members")
      .select("owner_id,role")
      .eq("user_id", data.user.id)
      .single();
    if (
      assignmentError ||
      assigned?.owner_id !== member.owner_id ||
      assigned?.role !== role
    )
      return reply(503, {
        error:
          "Associazione alla squadra non confermata. Contatta l'amministratore prima di riprovare.",
        code: "staff_assignment_unconfirmed",
      });
    const { error: namesError } = await admin
      .from("team_members")
      .update(names)
      .eq("user_id", data.user.id)
      .eq("owner_id", member.owner_id);
    if (namesError)
      return reply(201, {
        user: { id: data.user.id, email: data.user.email, role },
        warning: "Utenza creata. Completa nome e cognome dall’elenco staff.",
      });
    return reply(201, {
      user: { id: data.user.id, email: data.user.email, role },
    });
  } catch (error) {
    return reply(400, {
      error:
        error instanceof Error && error.message.startsWith("Nome e cognome")
          ? error.message
          : "Richiesta non valida",
    });
  }
});
