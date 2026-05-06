// POST /api/orders/[id]/checkout
// Contratante gera cobrança PIX ou cartão para um pedido ACCEPTED.
// Resultado: invoiceUrl (cartão) ou QR Code PIX (copia-e-cola + base64).

import { type NextRequest } from 'next/server';

import { requireUser } from '@/lib/auth';
import { HttpError, jsonOk, parseJson, withErrorHandling } from '@/lib/http';
import { checkoutSchema } from '@/lib/validations/checkout';
import {
  createAsaasCustomer,
  type AsaasCustomer,
} from '@/lib/asaas/customers';
import {
  createAsaasPayment,
  getPixQrCode,
} from '@/lib/asaas/payments';
import { AsaasError } from '@/lib/asaas/client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const POST = withErrorHandling(
  async (req: NextRequest, ctx: { params: { id: string } }) => {
    const { supabase, userId, profile } = await requireUser();
    const input = await parseJson(req, checkoutSchema);

    // Carrega pedido e valida estado
    const { data: order, error: orderErr } = await supabase
      .from('orders')
      .select('*')
      .eq('id', ctx.params.id)
      .single();

    if (orderErr || !order) throw new HttpError(404, 'Pedido não encontrado');
    if (order.contractor_id !== userId) {
      throw new HttpError(403, 'Apenas o contratante pode pagar este pedido');
    }
    if (order.status !== 'ACCEPTED') {
      throw new HttpError(409, `Pedido em status ${order.status} não aceita pagamento`);
    }
    if (order.asaas_payment_id) {
      throw new HttpError(409, 'Pedido já possui cobrança ativa');
    }

    // Garante customer Asaas (cria se não existir)
    let customerId = profile.asaas_customer_id;
    if (!customerId) {
      let customer: AsaasCustomer;
      try {
        customer = await createAsaasCustomer({
          name: profile.full_name ?? profile.email,
          email: profile.email,
          cpfCnpj: input.payerCpfCnpj,
          mobilePhone: input.payerPhone,
          externalReference: userId,
        });
      } catch (err) {
        throw asaasToHttp(err);
      }
      customerId = customer.id;
      await supabase
        .from('users')
        .update({ asaas_customer_id: customerId })
        .eq('id', userId);
    }

    // Vencimento: 3 dias para PIX, 1 dia para cartão (sandbox aceita "hoje")
    const dueDate = formatDateBR(addDays(new Date(), input.billingType === 'PIX' ? 3 : 1));

    let payment;
    try {
      payment = await createAsaasPayment({
        customerId,
        billingType: input.billingType,
        amountCents: order.budget_cents,
        dueDate,
        description: `Pedido for-music — ${order.title}`,
        externalReference: order.id,
      });
    } catch (err) {
      throw asaasToHttp(err);
    }

    // Persiste o id da cobrança. Status só vira PAID via webhook.
    const { error: updateErr } = await supabase
      .from('orders')
      .update({ asaas_payment_id: payment.id })
      .eq('id', order.id);

    if (updateErr) {
      throw new HttpError(500, 'Cobrança criada mas falhou ao gravar', updateErr.message);
    }

    let pix: { payload: string; encodedImage: string; expiresAt: string } | undefined;
    if (input.billingType === 'PIX') {
      try {
        const qr = await getPixQrCode(payment.id);
        pix = {
          payload: qr.payload,
          encodedImage: qr.encodedImage,
          expiresAt: qr.expirationDate,
        };
      } catch (err) {
        throw asaasToHttp(err);
      }
    }

    return jsonOk({
      paymentId: payment.id,
      invoiceUrl: payment.invoiceUrl,
      billingType: input.billingType,
      pix,
    });
  },
);

function asaasToHttp(err: unknown): HttpError {
  if (err instanceof AsaasError) {
    return new HttpError(
      err.status >= 400 && err.status < 500 ? 400 : 502,
      'Falha na Asaas',
      err.body,
    );
  }
  return new HttpError(500, 'Erro inesperado ao integrar com Asaas');
}

function addDays(d: Date, n: number): Date {
  const c = new Date(d);
  c.setDate(c.getDate() + n);
  return c;
}

function formatDateBR(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}
