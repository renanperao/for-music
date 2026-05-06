import { z } from 'zod';

// Mínimo R$ 50,00 — alinhado com a CHECK constraint em orders.budget_cents.
const MIN_BUDGET_CENTS = 5_000;
const MAX_BUDGET_CENTS = 100_000_00; // R$ 100.000,00 — sanity cap
const MIN_DEADLINE_HOURS = 24;

export const createOrderSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(3, 'Título deve ter ao menos 3 caracteres')
      .max(120, 'Título deve ter no máximo 120 caracteres'),

    instrument: z
      .string()
      .trim()
      .min(2, 'Instrumento inválido')
      .max(60),

    style: z
      .string()
      .trim()
      .min(2, 'Estilo musical inválido')
      .max(60),

    briefing: z
      .string()
      .trim()
      .min(20, 'Briefing muito curto (mínimo 20 caracteres)')
      .max(4000, 'Briefing muito longo (máximo 4000 caracteres)'),

    usage_rights: z
      .string()
      .trim()
      .min(5, 'Descreva o uso pretendido do material')
      .max(1000),

    deadline: z.coerce
      .date()
      .refine(
        (d) => d.getTime() > Date.now() + MIN_DEADLINE_HOURS * 60 * 60 * 1000,
        { message: `Prazo deve ser pelo menos ${MIN_DEADLINE_HOURS}h no futuro` },
      ),

    budget_cents: z
      .number({ invalid_type_error: 'budget_cents deve ser um número inteiro' })
      .int('budget_cents deve ser um inteiro')
      .min(MIN_BUDGET_CENTS, `Orçamento mínimo é R$ ${(MIN_BUDGET_CENTS / 100).toFixed(2)}`)
      .max(MAX_BUDGET_CENTS, `Orçamento máximo é R$ ${(MAX_BUDGET_CENTS / 100).toFixed(2)}`),
  })
  .strict();

export type CreateOrderInput = z.infer<typeof createOrderSchema>;
