// Helper de autenticação para route handlers.
// Devolve usuário + perfil. RLS continua como segunda barreira.

import { createServerClient } from '@/lib/supabase/server';
import { HttpError } from '@/lib/http';
import type { UserRow } from '@/types/database';

export type AuthContext = {
  supabase: ReturnType<typeof createServerClient>;
  userId: string;
  profile: UserRow;
};

export async function requireUser(): Promise<AuthContext> {
  const supabase = createServerClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) {
    throw new HttpError(401, 'Não autenticado');
  }

  const { data: profile, error: profileErr } = await supabase
    .from('users')
    .select('*')
    .eq('id', user.id)
    .single();

  if (profileErr || !profile) {
    throw new HttpError(403, 'Perfil não encontrado');
  }

  return { supabase, userId: user.id, profile };
}

export function requireRole(profile: UserRow, ...roles: UserRow['role'][]) {
  if (!roles.includes(profile.role)) {
    throw new HttpError(
      403,
      `Operação restrita a: ${roles.join(', ')}. Seu papel: ${profile.role}`,
    );
  }
}
