// GET /auth/confirm?token_hash=...&type=...&next=/
// Confirmação de OTP/magic-link via token_hash (fluxo PKCE Supabase).

import { NextResponse, type NextRequest } from 'next/server';
import type { EmailOtpType } from '@supabase/supabase-js';

import { createServerClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const token_hash = url.searchParams.get('token_hash');
  const type = url.searchParams.get('type') as EmailOtpType | null;
  const next = url.searchParams.get('next') ?? '/';

  if (!token_hash || !type) {
    return NextResponse.redirect(new URL('/?auth_error=missing_token', url.origin));
  }

  const supabase = createServerClient();
  const { error } = await supabase.auth.verifyOtp({ token_hash, type });

  if (error) {
    const target = new URL('/', url.origin);
    target.searchParams.set('auth_error', error.message);
    return NextResponse.redirect(target);
  }

  return NextResponse.redirect(new URL(next, url.origin));
}
