// GET  /api/me — perfil do usuário autenticado
// PATCH /api/me — atualiza role, full_name, bio, pix_key etc.

import { type NextRequest } from 'next/server';

import { requireUser } from '@/lib/auth';
import { HttpError, jsonOk, parseJson, withErrorHandling } from '@/lib/http';
import { updateProfileSchema } from '@/lib/validations/profile';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = withErrorHandling(async () => {
  const { profile } = await requireUser();
  return jsonOk({ profile });
});

export const PATCH = withErrorHandling(async (req: NextRequest) => {
  const { supabase, userId } = await requireUser();
  const input = await parseJson(req, updateProfileSchema);

  const { data, error } = await supabase
    .from('users')
    .update(input)
    .eq('id', userId)
    .select()
    .single();

  if (error || !data) {
    throw new HttpError(500, 'Falha ao atualizar perfil', error?.message);
  }

  return jsonOk({ profile: data });
});
