// GET /auth/callback?code=...
// Callback do Supabase Auth (Google OAuth e magic link).
// Troca o ?code pelo cookie de sessão e redireciona para `next` ou /.

import { NextResponse, type NextRequest } from 'next/server';

import { createServerClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const next = url.searchParams.get('next') ?? '/';

  if (!code) {
    return NextResponse.redirect(new URL('/?auth_error=missing_code', url.origin));
  }

  const supabase = createServerClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    const target = new URL('/', url.origin);
    target.searchParams.set('auth_error', error.message);
    return NextResponse.redirect(target);
  }

  return NextResponse.redirect(new URL(next, url.origin));
}
