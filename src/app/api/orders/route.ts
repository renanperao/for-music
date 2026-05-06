import { NextResponse, type NextRequest } from 'next/server';
import { ZodError } from 'zod';

import { createServerClient } from '@/lib/supabase/server';
import { createOrderSchema } from '@/lib/validations/orders';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const supabase = createServerClient();

  // 1) Autenticação (RLS exige sessão; checamos cedo para 401 explícito)
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  }

  // 2) Parse do body
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }

  // 3) Validação Zod
  let input;
  try {
    input = createOrderSchema.parse(raw);
  } catch (err) {
    if (err instanceof ZodError) {
      return NextResponse.json(
        { error: 'Dados inválidos', details: err.flatten() },
        { status: 422 },
      );
    }
    throw err;
  }

  // 4) Sanity check: o autor precisa de perfil contractor/both
  const { data: profile, error: profileErr } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single();

  if (profileErr || !profile) {
    return NextResponse.json(
      { error: 'Perfil não encontrado' },
      { status: 403 },
    );
  }

  if (profile.role !== 'contractor' && profile.role !== 'both') {
    return NextResponse.json(
      { error: 'Apenas contratantes podem criar pedidos' },
      { status: 403 },
    );
  }

  // 5) Insert (RLS reforça contractor_id = auth.uid())
  const { data: order, error: insertErr } = await supabase
    .from('orders')
    .insert({
      contractor_id: user.id,
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

  if (insertErr || !order) {
    return NextResponse.json(
      { error: 'Falha ao criar pedido', details: insertErr?.message },
      { status: 500 },
    );
  }

  return NextResponse.json({ order }, { status: 201 });
}
