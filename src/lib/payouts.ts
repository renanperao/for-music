// Cálculo do split entre plataforma (fee) e músico (payout).
// Centavos in / centavos out — sempre inteiros.

import { env } from '@/lib/env';

export type PayoutBreakdown = {
  totalCents: number;
  feeCents: number;
  payoutCents: number;
  feePercent: number;
};

export function computePayout(totalCents: number): PayoutBreakdown {
  if (!Number.isInteger(totalCents) || totalCents <= 0) {
    throw new Error(`totalCents inválido: ${totalCents}`);
  }
  const feePercent = env.platform.feePercent;
  // Arredonda fee para baixo — músico nunca recebe menos por arredondamento
  const feeCents = Math.floor((totalCents * feePercent) / 100);
  const payoutCents = totalCents - feeCents;
  return { totalCents, feeCents, payoutCents, feePercent };
}

export function centsToBRL(cents: number): string {
  return (cents / 100).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
}

// Asaas usa BRL em decimal (e.g. 49.90), não centavos.
export function centsToAsaasValue(cents: number): number {
  return Math.round(cents) / 100;
}
