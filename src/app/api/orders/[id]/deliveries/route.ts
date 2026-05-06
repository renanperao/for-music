// POST /api/orders/[id]/deliveries
// Músico confirma que o áudio foi subido para o R2 e cria o registro
// de delivery. Transita pedido para DELIVERED e calcula auto_approve_at.

import { type NextRequest } from 'next/server';
import { z } from 'zod';

import { requireUser } from '@/lib/auth';
import { env } from '@/lib/env';
import { HttpError, jsonOk, parseJson, withErrorHandling } from '@/lib/http';
import { R2_LIMITS } from '@/lib/r2/client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const schema = z.object({
  file_key: z.string().trim().min(1),
  file_name: z.string().trim().min(1).max(255),
  file_size_bytes: z.number().int().positive().max(R2_LIMITS.MAX_AUDIO_BYTES),
  mime_type: z.enum(R2_LIMITS.ALLOWED_MIME),
  duration_seconds: z.number().int().positive().optional(),
  notes: z.string().trim().max(2000).optional(),
});

export const POST = withErrorHandling(
  async (req: NextRequest, ctx: { params: { id: string } }) => {
    const { supabase, userId } = await requireUser();
    const input = await parseJson(req, schema);

    const { data: order } = await supabase
      .from('orders')
      .select('id, musician_id, status, delivered_at')
      .eq('id', ctx.params.id)
      .single();

    if (!order) throw new HttpError(404, 'Pedido não encontrado');
    if (order.musician_id !== userId) {
      throw new HttpError(403, 'Você não é o músico deste pedido');
    }
    if (order.status !== 'PAID' && order.status !== 'IN_REVISION') {
      throw new HttpError(
        409,
        `Entrega só permitida em status PAID ou IN_REVISION (atual: ${order.status})`,
      );
    }

    // Marca entregas anteriores como histórico (is_current=false) para
    // liberar o índice único parcial antes de inserir a nova.
    {
      const { error } = await supabase
        .from('deliveries')
        .update({ is_current: false })
        .eq('order_id', order.id)
        .eq('is_current', true);
      if (error) throw new HttpError(500, 'Falha ao arquivar entrega anterior', error.message);
    }

    const { data: delivery, error: insertErr } = await supabase
      .from('deliveries')
      .insert({
        order_id: order.id,
        musician_id: userId,
        file_key: input.file_key,
        file_name: input.file_name,
        file_size_bytes: input.file_size_bytes,
        mime_type: input.mime_type,
        duration_seconds: input.duration_seconds ?? null,
        notes: input.notes ?? null,
        is_current: true,
      })
      .select()
      .single();

    if (insertErr || !delivery) {
      throw new HttpError(500, 'Falha ao registrar entrega', insertErr?.message);
    }

    const now = new Date();
    const autoApproveAt = new Date(
      now.getTime() + env.platform.autoApproveAfterDays * 24 * 60 * 60 * 1000,
    );

    const { data: updated, error: updErr } = await supabase
      .from('orders')
      .update({
        status: 'DELIVERED',
        delivered_at: now.toISOString(),
        auto_approve_at: autoApproveAt.toISOString(),
      })
      .eq('id', order.id)
      .select()
      .single();

    if (updErr || !updated) {
      throw new HttpError(500, 'Falha ao atualizar pedido', updErr?.message);
    }

    return jsonOk({ delivery, order: updated }, 201);
  },
);
