import { createServerClient as createSupabaseServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';

import { env } from '@/lib/env';
import type { Database } from '@/types/database';

// Cliente Supabase para Route Handlers e Server Components.
// Usa o cookie da sessão do usuário — RLS aplica como `auth.uid()`.
export function createServerClient() {
  const cookieStore = cookies();

  return createSupabaseServerClient<Database>(
    env.supabase.url,
    env.supabase.anonKey,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value, ...options });
          } catch {
            // Server Components não permitem setar cookies; ignorado.
          }
        },
        remove(name: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value: '', ...options });
          } catch {
            // idem
          }
        },
      },
    },
  );
}
