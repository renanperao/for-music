import { z } from 'zod';

export const checkoutSchema = z
  .object({
    billingType: z.enum(['PIX', 'CREDIT_CARD']),
    payerCpfCnpj: z
      .string()
      .trim()
      .regex(/^\d{11}$|^\d{14}$/, 'CPF (11) ou CNPJ (14) — apenas dígitos'),
    payerPhone: z
      .string()
      .trim()
      .regex(/^\d{10,11}$/, 'Telefone — DDD + número, apenas dígitos')
      .optional(),
  })
  .strict();

export type CheckoutInput = z.infer<typeof checkoutSchema>;
