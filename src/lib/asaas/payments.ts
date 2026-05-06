// Cobranças (PIX e cartão). Sem split — o valor total fica retido na
// conta da plataforma até a aprovação do contratante. Na liberação,
// disparamos uma PIX Transfer para a chave PIX do músico (transfers.ts).

import { asaas } from '@/lib/asaas/client';
import { centsToAsaasValue } from '@/lib/payouts';

export type AsaasBillingType = 'PIX' | 'CREDIT_CARD' | 'BOLETO' | 'UNDEFINED';

export type AsaasPaymentStatus =
  | 'PENDING'
  | 'AWAITING_RISK_ANALYSIS'
  | 'CONFIRMED'
  | 'RECEIVED'
  | 'OVERDUE'
  | 'REFUNDED'
  | 'RECEIVED_IN_CASH'
  | 'CHARGEBACK_REQUESTED'
  | 'CHARGEBACK_DISPUTE'
  | 'AWAITING_CHARGEBACK_REVERSAL'
  | 'DUNNING_REQUESTED'
  | 'DUNNING_RECEIVED'
  | 'AWAITING_PAYMENT';

export type AsaasPayment = {
  id: string;
  customer: string;
  billingType: AsaasBillingType;
  status: AsaasPaymentStatus;
  value: number;
  netValue: number;
  dueDate: string;
  invoiceUrl: string;
  externalReference?: string;
  pixTransaction?: string | null;
};

export type AsaasPixQrCode = {
  encodedImage: string; // PNG base64
  payload: string;      // copia-e-cola
  expirationDate: string;
};

export type CreatePaymentInput = {
  customerId: string;
  billingType: AsaasBillingType;
  amountCents: number;
  dueDate: string;          // YYYY-MM-DD
  description: string;
  externalReference: string; // order.id da plataforma
};

export function createAsaasPayment(input: CreatePaymentInput) {
  return asaas.post<AsaasPayment>('/payments', {
    customer: input.customerId,
    billingType: input.billingType,
    value: centsToAsaasValue(input.amountCents),
    dueDate: input.dueDate,
    description: input.description,
    externalReference: input.externalReference,
  });
}

export function getAsaasPayment(id: string) {
  return asaas.get<AsaasPayment>(`/payments/${id}`);
}

// Busca o QR Code PIX gerado para uma cobrança PIX existente.
export function getPixQrCode(paymentId: string) {
  return asaas.get<AsaasPixQrCode>(`/payments/${paymentId}/pixQrCode`);
}
