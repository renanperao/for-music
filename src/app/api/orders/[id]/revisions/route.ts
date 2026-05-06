// POST /api/orders/[id]/revisions
// Contratante pede revisão da entrega vigente. Limite: 2 por pedido.
// Transição: DELIVERED → IN_REVISION (incrementa revision_count).

import { type NextRequest } from 'next/server';
import { z } from 'zod';

import { requireUser } from '@/lib/auth';
import { env } from '@/lib/env';
import { HttpError, jsonOk, parseJson, withErrorHandling } from '@/lib/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const schema = z.object({
  feedback: z.string().trim().min(10).max(4000),
});

export const POST = withErrorHandling(
  async (req: NextRequest, ctx: { params: { id: string } }) => {
    const { supabase, userId } = await requireUser();
    const input = await parseJson(req, schema);
    const max = env.platform.maxRevisions;

    const { data: order } = await supabase
      .from('orders')
      .select('id, contractor_id, status, revision_count')
      .eq('id', ctx.params.id)
      .single();

    if (!order) throw new HttpError(404, 'Pedido não encontrado');
    if (order.contractor_id !== userId) {
      throw new HttpError(403, 'Apenas o contratante pode pedir revisão');
    }
    if (order.status !== 'DELIVERED') {
      throw new HttpError(409, `Revisão só permitida em DELIVERED (atual: ${order.status})`);
    }
    if (order.revision_count >= max) {
      throw new HttpError(409, `Limite de ${max} revisões atingido`);
    }

    // Pega delivery vigente (referência da revisão)
    const { data: currentDelivery } = await supabase
      .from('deliveries')
      .select('id')
      .eq('order_id', order.id)
      .eq('is_current', true)
      .single();

    if (!currentDelivery) {
      throw new HttpError(409, 'Não há entrega vigente para revisar');
    }

    // Insere revisão e atualiza pedido em duas etapas (RLS exige ambos
    // como o próprio user)
    const { data: revision, error: revErr } = await supabase
      .from('revisions')
      .insert({
        order_id: order.id,
        delivery_id: currentDelivery.id,
        contractor_id: userId,
        feedback: input.feedback,
      })
      .select()
      .single();

    if (revErr || !revision) {
      throw new HttpError(500, 'Falha ao registrar revisão', revErr?.message);
    }

    const { data: updated, error: updErr } = await supabase
      .from('orders')
      .update({
        status: 'IN_REVISION',
        revision_count: order.revision_count + 1,
        // Limpa janela de auto-aprovação — só volta quando músico re-entregar
        auto_approve_at: null,
        delivered_at: null,
      })
      .eq('id', order.id)
      .eq('status', 'DELIVERED')
      .select()
      .single();

    if (updErr || !updated) {
      throw new HttpError(409, 'Pedido mudou de estado durante a revisão');
    }

    return jsonOk({ revision, order: updated }, 201);
  },
);
