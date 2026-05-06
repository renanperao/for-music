import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createServerClient } from '@/lib/supabase/server';
import SignOutButton from './sign-out-button';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('users')
    .select('full_name, email, role')
    .eq('id', user.id)
    .single();

  const displayName = profile?.full_name ?? user.email ?? 'Usuário';
  const isContractor = profile?.role === 'contractor' || profile?.role === 'both';

  return (
    <div className="flex min-h-screen">
      <nav className="w-56 shrink-0 bg-zinc-900 border-r border-zinc-800 flex flex-col py-6">
        <div className="px-5 mb-6">
          <span className="text-xl font-bold text-violet-400">for-music</span>
        </div>

        <div className="flex-1 px-2 space-y-0.5">
          <NavLink href="/dashboard">Dashboard</NavLink>
          <NavLink href="/orders">Pedidos</NavLink>
          {isContractor && <NavLink href="/orders/new">Novo Pedido</NavLink>}
          <NavLink href="/profile">Perfil</NavLink>
        </div>

        <div className="px-5 pt-4 border-t border-zinc-800">
          <p className="text-xs text-zinc-300 truncate mb-0.5">{displayName}</p>
          <p className="text-xs text-zinc-600 capitalize mb-2">{profile?.role ?? '—'}</p>
          <SignOutButton />
        </div>
      </nav>

      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  );
}

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="flex items-center px-3 py-2 rounded-lg text-sm text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-colors"
    >
      {children}
    </Link>
  );
}
