// Webhook Asaas. Eventos relevantes:
//   PAYMENT_CONFIRMED   → cobrança paga (cartão confirmado / PIX recebido)
//   PAYMENT_RECEIVED    → mesma transição que CONFIRMED para fins do escrow
//   PAYMENT_REFUNDED    → estornado: voltamos para ACCEPTED (limpa payment_id)
//
// Validamos o header `asaas-access-token` contra ASAAS_WEBHOOK_TOKEN.
// Usamos service-role pois o webhook não tem sessão do usuário.

import { type NextRequest } from 'next/server';
import { z } from 'zod';

import { env } from '@/lib/env';
import { jsonError, jsonOk, withErrorHandling } from '@/lib/http';
import { createServiceClient } from '@/lib/supabase/service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const eventSchema = z.object({
  event: z.string(),
  payment: z
    .object({
      id: z.string(),
      status: z.string(),
      externalReference: z.string().nullish(),
    })
    .passthrough(),
});

export const POST = withErrorHandling(async (req: NextRequest) => {
  // 1) Auth do webhook
  const expected = env.asaas.webhookToken;
  const got = req.headers.get('asaas-access-token');
  if (!expected) {
    return jsonError(503, 'Webhook não configurado (ASAAS_WEBHOOK_TOKEN ausente)');
  }
  if (!got || got !== expected) {
    return jsonError(401, 'Token de webhook inválido');
  }

  // 2) Parse do body
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return jsonError(400, 'JSON inválido');
  }
  const parsed = eventSchema.safeParse(raw);
  if (!parsed.success) {
    return jsonError(422, 'Payload inválido', parsed.error.flatten());
  }

  const { event, payment } = parsed.data;
  const supabase = createServiceClient();

  // 3) Identifica o pedido — preferimos externalReference (order.id),
  //    mas caímos no asaas_payment_id como fallback.
  const orderQuery = payment.externalReference
    ? supabase.from('orders').select('*').eq('id', payment.externalReference).maybeSingle()
    : supabase.from('orders').select('*').eq('asaas_payment_id', payment.id).maybeSingle();

  const { data: order } = await orderQuery;
  if (!order) {
    // Webhook para cobrança que não é nossa — devolve 200 pra não retentar.
    return jsonOk({ ignored: true, reason: 'order não encontrado' });
  }

  // 4) Aplica transição
  const now = new Date().toISOString();

  if (event === 'PAYMENT_CONFIRMED' || event === 'PAYMENT_RECEIVED') {
    // Idempotência: só transiciona se ainda em ACCEPTED
    if (order.status !== 'ACCEPTED') {
      return jsonOk({ ignored: true, reason: `status atual: ${order.status}` });
    }
    const { error } = await supabase
      .from('orders')
      .update({ status: 'PAID', paid_at: now })
      .eq('id', order.id)
      .eq('status', 'ACCEPTED');
    if (error) return jsonError(500, 'Falha ao marcar como pago', error.message);
    return jsonOk({ orderId: order.id, status: 'PAID' });
  }

  if (event === 'PAYMENT_REFUNDED' || event === 'PAYMENT_DELETED') {
    if (!['PAID', 'ACCEPTED'].includes(order.status)) {
      return jsonOk({ ignored: true, reason: `status atual: ${order.status}` });
    }
    const { error } = await supabase
      .from('orders')
      .update({
        status: 'ACCEPTED',
        asaas_payment_id: null,
        paid_at: null,
      })
      .eq('id', order.id);
    if (error) return jsonError(500, 'Falha ao reverter cobrança', error.message);
    return jsonOk({ orderId: order.id, status: 'ACCEPTED' });
  }

  // Evento ignorado (overdue, awaiting risk, etc.)
  return jsonOk({ ignored: true, event });
});
