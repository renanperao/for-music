// Liberação do escrow: dispara PIX Transfer Asaas para o músico.
//
// Idempotente: se o pedido já tem asaas_transfer_id, devolve ele.
// Usa o cliente passado (autenticado ou service-role) para todas as
// operações de leitura/escrita do banco.

import type { SupabaseClient } from '@supabase/supabase-js';

import { AsaasError } from '@/lib/asaas/client';
import { createPixTransfer } from '@/lib/asaas/transfers';
import { computePayout } from '@/lib/payouts';
import type { Database } from '@/types/database';

export type ReleaseResult = {
  orderId: string;
  transferId: string;
  amountCents: number;
  feeCents: number;
  alreadyReleased: boolean;
};

export class ReleaseError extends Error {
  constructor(
    message: string,
    public readonly code: 'ORDER_NOT_FOUND' | 'BAD_STATUS' | 'NO_PIX_KEY' | 'ASAAS_FAILED',
    public readonly details?: unknown,
  ) {
    super(message);
  }
}

export async function releasePayment(
  supabase: SupabaseClient<Database>,
  orderId: string,
): Promise<ReleaseResult> {
  const { data: order, error } = await supabase
    .from('orders')
    .select(`
      id, status, budget_cents, musician_id,
      asaas_transfer_id,
      musician:musician_id ( pix_key, pix_key_type, full_name )
    `)
    .eq('id', orderId)
    .single();

  if (error || !order) {
    throw new ReleaseError('Pedido não encontrado', 'ORDER_NOT_FOUND', error?.message);
  }

  if (order.status !== 'COMPLETED') {
    throw new ReleaseError(
      `Repasse só pode ser disparado em COMPLETED (atual: ${order.status})`,
      'BAD_STATUS',
    );
  }

  if (order.asaas_transfer_id) {
    return {
      orderId: order.id,
      transferId: order.asaas_transfer_id,
      amountCents: computePayout(order.budget_cents).payoutCents,
      feeCents: computePayout(order.budget_cents).feeCents,
      alreadyReleased: true,
    };
  }

  const musician = Array.isArray(order.musician) ? order.musician[0] : order.musician;
  if (!musician?.pix_key || !musician.pix_key_type) {
    throw new ReleaseError('Músico sem chave PIX cadastrada', 'NO_PIX_KEY');
  }

  const { payoutCents, feeCents } = computePayout(order.budget_cents);

  let transfer;
  try {
    transfer = await createPixTransfer({
      amountCents: payoutCents,
      pixKey: musician.pix_key,
      pixKeyType: musician.pix_key_type,
      description: `for-music — pedido ${order.id.slice(0, 8)}`,
      externalReference: order.id,
    });
  } catch (err) {
    const details = err instanceof AsaasError ? err.body : (err as Error).message;
    throw new ReleaseError('Falha na PIX Transfer Asaas', 'ASAAS_FAILED', details);
  }

  const { error: updateErr } = await supabase
    .from('orders')
    .update({
      asaas_transfer_id: transfer.id,
      released_at: new Date().toISOString(),
    })
    .eq('id', order.id);

  if (updateErr) {
    // Transfer foi disparada mas não conseguimos persistir o id.
    // Logamos com loud detail; o webhook/admin reconcilia.
    console.error('[release] transfer disparada mas falhou ao gravar', {
      orderId: order.id,
      transferId: transfer.id,
      error: updateErr.message,
    });
  }

  return {
    orderId: order.id,
    transferId: transfer.id,
    amountCents: payoutCents,
    feeCents,
    alreadyReleased: false,
  };
}
