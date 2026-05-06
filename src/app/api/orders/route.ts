import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';

import { requireUser, requireRole } from '@/lib/auth';
import { jsonOk, parseJson, withErrorHandling } from '@/lib/http';
import { createOrderSchema } from '@/lib/validations/orders';
import type { OrderStatus } from '@/types/database';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// ─────────────────────────────────────────────────────────────────────
// POST /api/orders
// Contratante cria um novo pedido (status OPEN).
// ─────────────────────────────────────────────────────────────────────
export const POST = withErrorHandling(async (req: NextRequest) => {
  const { supabase, userId, profile } = await requireUser();
  requireRole(profile, 'contractor', 'both');

  const input = await parseJson(req, createOrderSchema);

  const { data: order, error } = await supabase
    .from('orders')
    .insert({
      contractor_id: userId,
      title: input.title,
      instrument: input.instrument,
      style: input.style,
      briefing: input.briefing,
      usage_rights: input.usage_rights,
      deadline: input.deadline.toISOString(),
      budget_cents: input.budget_cents,
      status: 'OPEN',
    })
    .select()
    .single();

  if (error || !order) {
    return NextResponse.json(
      { error: 'Falha ao criar pedido', details: error?.message },
      { status: 500 },
    );
  }

  return jsonOk({ order }, 201);
});

// ─────────────────────────────────────────────────────────────────────
// GET /api/orders
// - Sem filtro: musician/both vê OPEN; contractor vê os próprios.
// - ?scope=mine: somente os pedidos onde o usuário é parte (contractor
//   ou musician aceitante). Útil pro dashboard.
// - ?status=PAID: filtra por status (combina com scope).
// ─────────────────────────────────────────────────────────────────────
const listQuerySchema = z.object({
  scope: z.enum(['open', 'mine']).optional(),
  status: z
    .enum(['OPEN', 'ACCEPTED', 'PAID', 'DELIVERED', 'IN_REVISION', 'COMPLETED', 'DISPUTED'])
    .optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export const GET = withErrorHandling(async (req: NextRequest) => {
  const { supabase, userId, profile } = await requireUser();

  const url = new URL(req.url);
  const params = listQuerySchema.parse({
    scope: url.searchParams.get('scope') ?? undefined,
    status: url.searchParams.get('status') ?? undefined,
    limit: url.searchParams.get('limit') ?? undefined,
  });

  let query = supabase
    .from('orders')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(params.limit);

  if (params.scope === 'mine') {
    query = query.or(`contractor_id.eq.${userId},musician_id.eq.${userId}`);
  } else if (params.scope === 'open') {
    query = query.eq('status', 'OPEN' satisfies OrderStatus);
  } else {
    // Default: musician/both vê OPEN; contractor puro vê só os seus
    if (profile.role === 'contractor') {
      query = query.eq('contractor_id', userId);
    } else {
      query = query.or(`status.eq.OPEN,contractor_id.eq.${userId},musician_id.eq.${userId}`);
    }
  }

  if (params.status) {
    query = query.eq('status', params.status);
  }

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: 'Falha ao listar', details: error.message }, { status: 500 });
  }

  return jsonOk({ orders: data ?? [] });
});
