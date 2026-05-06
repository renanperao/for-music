// POST /api/orders/[id]/accept — músico aceita um pedido OPEN.

import { type NextRequest } from 'next/server';

import { requireUser, requireRole } from '@/lib/auth';
import { HttpError, jsonOk, withErrorHandling } from '@/lib/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const POST = withErrorHandling(
  async (_req: NextRequest, ctx: { params: { id: string } }) => {
    const { supabase, userId, profile } = await requireUser();
    requireRole(profile, 'musician', 'both');

    if (!profile.pix_key || !profile.pix_key_type) {
      throw new HttpError(
        400,
        'Cadastre sua chave PIX no perfil antes de aceitar pedidos',
      );
    }

    // Update condicional: só transiciona se ainda estiver OPEN e sem músico.
    // Evita race quando dois músicos clicam ao mesmo tempo.
    const { data: updated, error } = await supabase
      .from('orders')
      .update({
        musician_id: userId,
        status: 'ACCEPTED',
        accepted_at: new Date().toISOString(),
      })
      .eq('id', ctx.params.id)
      .eq('status', 'OPEN')
      .is('musician_id', null)
      .select()
      .single();

    if (error || !updated) {
      throw new HttpError(409, 'Pedido não está mais disponível');
    }

    if (updated.contractor_id === userId) {
      // Pode acontecer com role 'both' tentando aceitar próprio pedido.
      // Reverte e devolve 400. Detecção pós-update porque RLS é por usuário.
      await supabase
        .from('orders')
        .update({ musician_id: null, status: 'OPEN', accepted_at: null })
        .eq('id', updated.id);
      throw new HttpError(400, 'Você não pode aceitar seu próprio pedido');
    }

    return jsonOk({ order: updated });
  },
);
