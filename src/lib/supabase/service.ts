// Cliente Supabase com service-role key. Bypassa RLS — usar APENAS em
// código server-side confiável (webhooks, jobs internos, edge functions).

import { createClient } from '@supabase/supabase-js';

import { env, requireServiceRole } from '@/lib/env';
import type { Database } from '@/types/database';

export function createServiceClient() {
  const key = requireServiceRole();
  return createClient<Database>(env.supabase.url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
