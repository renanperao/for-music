// Transferências PIX da conta Asaas da plataforma para a chave PIX do
// músico. Disparadas no momento da liberação do escrow (status COMPLETED).

import { asaas } from '@/lib/asaas/client';
import { centsToAsaasValue } from '@/lib/payouts';
import type { PixKeyType } from '@/types/database';

export type AsaasTransferStatus =
  | 'PENDING'
  | 'BANK_PROCESSING'
  | 'DONE'
  | 'CANCELLED'
  | 'FAILED';

export type AsaasTransfer = {
  id: string;
  status: AsaasTransferStatus;
  value: number;
  netValue: number;
  transferFee: number;
  scheduleDate?: string;
  authorized?: boolean;
  pixAddressKey?: string;
  pixAddressKeyType?: string;
};

// Mapa do nosso enum para o que a Asaas espera
const PIX_KEY_TYPE_MAP: Record<PixKeyType, string> = {
  cpf:   'CPF',
  cnpj:  'CNPJ',
  email: 'EMAIL',
  phone: 'PHONE',
  evp:   'EVP',
};

export type CreatePixTransferInput = {
  amountCents: number;
  pixKey: string;
  pixKeyType: PixKeyType;
  description: string;        // descrição visível no extrato
  externalReference: string;  // order.id
};

export function createPixTransfer(input: CreatePixTransferInput) {
  return asaas.post<AsaasTransfer>('/transfers', {
    operationType: 'PIX',
    value: centsToAsaasValue(input.amountCents),
    pixAddressKey: input.pixKey,
    pixAddressKeyType: PIX_KEY_TYPE_MAP[input.pixKeyType],
    description: input.description,
    externalReference: input.externalReference,
  });
}

export function getAsaasTransfer(id: string) {
  return asaas.get<AsaasTransfer>(`/transfers/${id}`);
}
