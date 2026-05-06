// POST /api/orders/[id]/deliveries/upload-url
// Músico solicita uma URL presigned PUT do R2 para subir o áudio.
// Em seguida, deve chamar POST /deliveries para registrar a entrega.

import { type NextRequest } from 'next/server';
import { z } from 'zod';

import { requireUser } from '@/lib/auth';
import { HttpError, jsonOk, parseJson, withErrorHandling } from '@/lib/http';
import { R2_LIMITS, createDeliveryUploadTarget } from '@/lib/r2/client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const schema = z.object({
  fileName: z.string().trim().min(1).max(255),
  mimeType: z.enum(R2_LIMITS.ALLOWED_MIME),
  sizeBytes: z.number().int().positive().max(R2_LIMITS.MAX_AUDIO_BYTES),
});

export const POST = withErrorHandling(
  async (req: NextRequest, ctx: { params: { id: string } }) => {
    const { supabase, userId } = await requireUser();
    const input = await parseJson(req, schema);

    // Confirma que o usuário é o músico do pedido e que ele aceita uploads
    const { data: order } = await supabase
      .from('orders')
      .select('id, musician_id, status')
      .eq('id', ctx.params.id)
      .single();

    if (!order) throw new HttpError(404, 'Pedido não encontrado');
    if (order.musician_id !== userId) {
      throw new HttpError(403, 'Você não é o músico deste pedido');
    }
    if (order.status !== 'PAID' && order.status !== 'IN_REVISION') {
      throw new HttpError(
        409,
        `Upload só permitido em status PAID ou IN_REVISION (atual: ${order.status})`,
      );
    }

    const target = await createDeliveryUploadTarget({
      orderId: order.id,
      fileName: input.fileName,
      mimeType: input.mimeType,
    });

    return jsonOk(target);
  },
);
