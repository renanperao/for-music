// GET /api/orders/[id] — detalhe do pedido com entregas e revisões.

import { type NextRequest } from 'next/server';

import { requireUser } from '@/lib/auth';
import { HttpError, jsonOk, withErrorHandling } from '@/lib/http';
import { createDeliveryDownloadUrl } from '@/lib/r2/client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = withErrorHandling(
  async (_req: NextRequest, ctx: { params: { id: string } }) => {
    const { supabase, userId } = await requireUser();
    const orderId = ctx.params.id;

    const { data: order, error } = await supabase
      .from('orders')
      .select('*')
      .eq('id', orderId)
      .single();

    if (error || !order) {
      throw new HttpError(404, 'Pedido não encontrado');
    }

    // RLS já filtraria — esta checagem é defensiva e mais explícita.
    const isParticipant =
      order.contractor_id === userId || order.musician_id === userId;
    const isOpenForAll = order.status === 'OPEN';
    if (!isParticipant && !isOpenForAll) {
      throw new HttpError(403, 'Sem acesso a este pedido');
    }

    const [{ data: deliveries }, { data: revisions }] = await Promise.all([
      supabase
        .from('deliveries')
        .select('*')
        .eq('order_id', orderId)
        .order('delivered_at', { ascending: false }),
      supabase
        .from('revisions')
        .select('*')
        .eq('order_id', orderId)
        .order('requested_at', { ascending: false }),
    ]);

    // Para participantes, gera URL assinada da entrega vigente
    let currentDeliveryUrl: string | undefined;
    const current = deliveries?.find((d) => d.is_current);
    if (current && isParticipant) {
      try {
        currentDeliveryUrl = await createDeliveryDownloadUrl(current.file_key);
      } catch {
        // R2 pode não estar configurado em dev; ignoramos
      }
    }

    return jsonOk({
      order,
      deliveries: deliveries ?? [],
      revisions: revisions ?? [],
      currentDeliveryUrl,
    });
  },
);
