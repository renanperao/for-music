// POST /api/orders/[id]/approve
// Contratante aprova manualmente a entrega vigente. Transição:
// DELIVERED → COMPLETED, e dispara releasePayment() (PIX Transfer 90%).

import { type NextRequest } from 'next/server';

import { requireUser } from '@/lib/auth';
import { HttpError, jsonOk, withErrorHandling } from '@/lib/http';
import { ReleaseError, releasePayment } from '@/lib/release';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const POST = withErrorHandling(
  async (_req: NextRequest, ctx: { params: { id: string } }) => {
    const { supabase, userId } = await requireUser();

    const { data: order } = await supabase
      .from('orders')
      .select('id, contractor_id, status')
      .eq('id', ctx.params.id)
      .single();

    if (!order) throw new HttpError(404, 'Pedido não encontrado');
    if (order.contractor_id !== userId) {
      throw new HttpError(403, 'Apenas o contratante pode aprovar');
    }
    if (order.status !== 'DELIVERED') {
      throw new HttpError(409, `Aprovação só permitida em DELIVERED (atual: ${order.status})`);
    }

    // Update condicional para evitar dupla-aprovação concorrente
    const { data: updated, error } = await supabase
      .from('orders')
      .update({ status: 'COMPLETED', completed_at: new Date().toISOString() })
      .eq('id', order.id)
      .eq('status', 'DELIVERED')
      .select()
      .single();

    if (error || !updated) {
      throw new HttpError(409, 'Pedido mudou de estado durante a aprovação');
    }

    // Dispara repasse. Se a Asaas falhar, devolvemos 502 mas o pedido
    // permanece COMPLETED — admin pode retentar via /internal/release.
    try {
      const result = await releasePayment(supabase, updated.id);
      return jsonOk({ order: updated, release: result });
    } catch (err) {
      if (err instanceof ReleaseError) {
        return jsonOk(
          {
            order: updated,
            release: { error: err.message, code: err.code, details: err.details },
          },
          err.code === 'NO_PIX_KEY' ? 422 : 502,
        );
      }
      throw err;
    }
  },
);
