'use client';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export default function SignOutButton() {
  const router = useRouter();

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/login');
  }

  return (
    <button
      onClick={signOut}
      className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors text-left"
    >
      Sair
    </button>
  );
}
