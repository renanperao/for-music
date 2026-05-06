// POST /api/orders/[id]/reviews
// Avaliação pós-conclusão. Apenas em pedidos COMPLETED. RLS garante
// que o reviewer é um dos participantes e o reviewee é o outro.

import { type NextRequest } from 'next/server';
import { z } from 'zod';

import { requireUser } from '@/lib/auth';
import { HttpError, jsonOk, parseJson, withErrorHandling } from '@/lib/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const schema = z.object({
  rating: z.number().int().min(1).max(5),
  comment: z.string().trim().max(1000).optional(),
});

export const POST = withErrorHandling(
  async (req: NextRequest, ctx: { params: { id: string } }) => {
    const { supabase, userId } = await requireUser();
    const input = await parseJson(req, schema);

    const { data: order } = await supabase
      .from('orders')
      .select('id, contractor_id, musician_id, status')
      .eq('id', ctx.params.id)
      .single();

    if (!order) throw new HttpError(404, 'Pedido não encontrado');
    if (order.status !== 'COMPLETED') {
      throw new HttpError(409, 'Avaliação só após conclusão do pedido');
    }
    if (order.contractor_id !== userId && order.musician_id !== userId) {
      throw new HttpError(403, 'Apenas participantes avaliam');
    }
    if (!order.musician_id) {
      throw new HttpError(409, 'Pedido sem músico atribuído');
    }

    const revieweeId =
      userId === order.contractor_id ? order.musician_id : order.contractor_id;

    const { data: review, error } = await supabase
      .from('reviews')
      .insert({
        order_id: order.id,
        reviewer_id: userId,
        reviewee_id: revieweeId,
        rating: input.rating,
        comment: input.comment ?? null,
      })
      .select()
      .single();

    if (error || !review) {
      // 23505 = unique_violation (já avaliou)
      if (error?.code === '23505') {
        throw new HttpError(409, 'Você já avaliou este pedido');
      }
      throw new HttpError(500, 'Falha ao registrar avaliação', error?.message);
    }

    return jsonOk({ review }, 201);
  },
);
