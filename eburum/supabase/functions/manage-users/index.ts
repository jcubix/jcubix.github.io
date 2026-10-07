import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const origins = new Set(['https://eburum.vercel.app']);
Deno.serve(async (req: Request) => {
  const origin = req.headers.get('Origin') || '';
  const headers = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store',
    'Access-Control-Allow-Origin': origins.has(origin) ? origin : 'https://eburum.vercel.app',
    'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
    'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Vary': 'Origin' };
  const reply = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers });
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers });
  if (req.method !== 'POST') return reply(405, { error: 'Metodo non consentito' });
  const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
  if (!token) return reply(401, { error: 'Accedi per continuare' });
  const secretKeys = Deno.env.get('SUPABASE_SECRET_KEYS');
  const serverKey = secretKeys ? JSON.parse(secretKeys).default : Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const admin = createClient(Deno.env.get('SUPABASE_URL')!, serverKey!,
    { auth: { persistSession: false, autoRefreshToken: false } });
  // getUser checks the current Auth record, rather than trusting stale or user-editable claims.
  const { data: { user }, error: authError } = await admin.auth.getUser(token);
  if (authError || !user) return reply(401, { error: 'Sessione non valida' });
  if (user.app_metadata?.role !== 'admin') return reply(403, { error: 'Operazione riservata agli amministratori' });
  try {
    const body = await req.json();
    if (body.action === 'list') {
      const { data, error } = await admin.auth.admin.listUsers({ page: Math.max(1, Math.trunc(Number(body.page) || 1)), perPage: 50 });
      if (error) return reply(400, { error: 'Impossibile caricare gli utenti' });
      return reply(200, { users: data.users.map(u => ({ id: u.id, email: u.email, role: u.app_metadata?.role === 'admin' ? 'admin' : 'member', created_at: u.created_at })), nextPage: data.nextPage });
    }
    if (body.action !== 'create') return reply(400, { error: 'Azione non valida' });
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    const password = typeof body.password === 'string' ? body.password : '';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) return reply(400, { error: 'Inserisci una email valida' });
    if (password.length < 12 || password.length > 128) return reply(400, { error: 'Password da 12 a 128 caratteri' });
    // Creating administrators requires a separate, explicit server-side operation.
    const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true,
      app_metadata: { role: 'member', managed_account: true, created_by: user.id } });
    if (error) return reply(400, { error: error.code === 'email_exists' ? 'Email già registrata' : 'Creazione non riuscita. Controlla email e password.' });
    return reply(201, { user: { id: data.user.id, email: data.user.email, role: 'member' } });
  } catch { return reply(400, { error: 'Richiesta non valida' }); }
});
