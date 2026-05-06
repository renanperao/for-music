// Edge Function — auto-approve-runner
//
// Como o pg_cron já transiciona DELIVERED→COMPLETED, esta função apenas
// garante o repasse: busca pedidos COMPLETED sem asaas_transfer_id e
// dispara a release-payment do app via HTTP autenticado.
//
// Pode ser invocada por:
//   1) Schedule do Supabase (Cron Jobs) a cada 15 minutos, OU
//   2) Trigger no banco via pg_net.http_post no momento do auto-approve.
//
// Variáveis de ambiente esperadas (configurar com `supabase secrets set`):
//   APP_URL              ex: https://for-music.app
//   INTERNAL_JOB_TOKEN   mesmo valor configurado no app

// deno-lint-ignore-file no-explicit-any
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

Deno.serve(async (_req: Request) => {
  const appUrl = Deno.env.get('APP_URL');
  const token = Deno.env.get('INTERNAL_JOB_TOKEN');
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!appUrl || !token || !supabaseUrl || !serviceKey) {
    return json({ error: 'env ausente' }, 500);
  }

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false },
  });

  // Pedidos completados que ainda não tiveram repasse disparado.
  const { data: pending, error } = await supabase
    .from('orders')
    .select('id')
    .eq('status', 'COMPLETED')
    .is('asaas_transfer_id', null)
    .limit(100);

  if (error) return json({ error: error.message }, 500);
  if (!pending || pending.length === 0) {
    return json({ released: 0, message: 'sem pendências' });
  }

  const res = await fetch(`${appUrl}/api/internal/release-payment`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ orderIds: pending.map((p: any) => p.id) }),
  });

  const body = await res.text();
  return new Response(body, {
    status: res.status,
    headers: { 'content-type': res.headers.get('content-type') ?? 'application/json' },
  });
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}
