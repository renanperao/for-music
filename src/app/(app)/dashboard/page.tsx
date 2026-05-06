import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createServerClient } from '@/lib/supabase/server';
import { StatusBadge } from '../status-badge';
import { formatCents } from '@/lib/format';
import type { OrderStatus } from '@/types/database';

export default async function DashboardPage() {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const [{ data: profile }, { data: orders }] = await Promise.all([
    supabase.from('users').select('full_name, role').eq('id', user.id).single(),
    supabase
      .from('orders')
      .select('id, title, instrument, status, budget_cents, created_at')
      .or(`contractor_id.eq.${user.id},musician_id.eq.${user.id}`)
      .order('created_at', { ascending: false })
      .limit(20),
  ]);

  const myOrders = orders ?? [];
  const active = myOrders.filter(
    (o) => !['COMPLETED', 'DISPUTED', 'OPEN'].includes(o.status),
  ).length;
  const completed = myOrders.filter((o) => o.status === 'COMPLETED').length;
  const open = myOrders.filter((o) => o.status === 'OPEN').length;

  const firstName = profile?.full_name?.split(' ')[0] ?? 'por aí';
  const isContractor = profile?.role === 'contractor' || profile?.role === 'both';
  const isMusician = profile?.role === 'musician' || profile?.role === 'both';

  return (
    <div className="p-8 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold">Olá, {firstName}</h1>
        <p className="text-zinc-400 text-sm mt-1">Bem-vindo ao seu painel</p>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-8">
        <Stat label="Ativos" value={active} accent="text-violet-400" />
        <Stat label="Concluídos" value={completed} accent="text-emerald-400" />
        <Stat label="Abertos" value={open} accent="text-zinc-300" />
      </div>

      <div className="flex gap-3 mb-8">
        {isContractor && (
          <Link
            href="/orders/new"
            className="bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
          >
            + Novo pedido
          </Link>
        )}
        {isMusician && (
          <Link
            href="/orders?scope=open"
            className="bg-zinc-800 hover:bg-zinc-700 text-zinc-100 text-sm font-medium px-4 py-2 rounded-lg transition-colors"
          >
            Ver pedidos abertos
          </Link>
        )}
      </div>

      <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">
        Pedidos recentes
      </h2>
      {myOrders.length === 0 ? (
        <p className="text-zinc-500 text-sm">Nenhum pedido ainda.</p>
      ) : (
        <div className="space-y-2">
          {myOrders.slice(0, 8).map((order) => (
            <Link
              key={order.id}
              href={`/orders/${order.id}`}
              className="flex items-center justify-between bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 hover:border-zinc-700 transition-colors group"
            >
              <div>
                <p className="text-sm font-medium text-zinc-100 group-hover:text-white">
                  {order.title}
                </p>
                <p className="text-xs text-zinc-500">{order.instrument}</p>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <span className="text-sm text-zinc-300">{formatCents(order.budget_cents)}</span>
                <StatusBadge status={order.status as OrderStatus} />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent: string;
}) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
      <p className={`text-2xl font-bold ${accent}`}>{value}</p>
      <p className="text-xs text-zinc-500 mt-1">{label}</p>
    </div>
  );
}
