// POST /api/internal/release-payment
// Endpoint chamado pela Edge Function `auto-approve-runner` (Supabase)
// após o pg_cron auto-aprovar pedidos. Autenticado por bearer token
// compartilhado (INTERNAL_JOB_TOKEN), não por sessão de usuário.
//
// Body: { orderIds: string[] }
// Resposta: { results: ReleaseResult[] }

import { type NextRequest } from 'next/server';
import { z } from 'zod';

import { requireInternalJobToken } from '@/lib/env';
import { HttpError, jsonError, jsonOk, parseJson, withErrorHandling } from '@/lib/http';
import { ReleaseError, releasePayment } from '@/lib/release';
import { createServiceClient } from '@/lib/supabase/service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const schema = z.object({
  orderIds: z.array(z.string().uuid()).min(1).max(200),
});

export const POST = withErrorHandling(async (req: NextRequest) => {
  const expected = requireInternalJobToken();
  const got = req.headers.get('authorization');
  if (got !== `Bearer ${expected}`) {
    return jsonError(401, 'Token interno inválido');
  }

  const { orderIds } = await parseJson(req, schema);
  const supabase = createServiceClient();

  const results = await Promise.allSettled(
    orderIds.map((id) => releasePayment(supabase, id)),
  );

  const out = results.map((r, i) => {
    if (r.status === 'fulfilled') return { ok: true, ...r.value };
    const reason = r.reason;
    if (reason instanceof ReleaseError) {
      return { ok: false, orderId: orderIds[i], code: reason.code, message: reason.message };
    }
    if (reason instanceof HttpError) {
      return { ok: false, orderId: orderIds[i], message: reason.message };
    }
    return { ok: false, orderId: orderIds[i], message: 'unknown error' };
  });

  return jsonOk({ results: out });
});
