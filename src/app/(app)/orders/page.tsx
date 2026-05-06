import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createServerClient } from '@/lib/supabase/server';
import { StatusBadge } from '../status-badge';
import { formatCents, formatDate } from '@/lib/format';
import type { OrderStatus } from '@/types/database';

const STATUSES: OrderStatus[] = [
  'OPEN',
  'ACCEPTED',
  'PAID',
  'DELIVERED',
  'IN_REVISION',
  'COMPLETED',
  'DISPUTED',
];

const STATUS_LABELS: Record<OrderStatus, string> = {
  OPEN: 'Aberto',
  ACCEPTED: 'Aceito',
  PAID: 'Pago',
  DELIVERED: 'Entregue',
  IN_REVISION: 'Em revisão',
  COMPLETED: 'Concluído',
  DISPUTED: 'Disputado',
};

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: { scope?: string; status?: string };
}) {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single();

  const role = profile?.role ?? 'contractor';
  const scope = searchParams.scope;
  const statusFilter = searchParams.status as OrderStatus | undefined;

  let query = supabase
    .from('orders')
    .select('id, title, instrument, style, status, budget_cents, deadline, created_at')
    .order('created_at', { ascending: false })
    .limit(50);

  if (scope === 'open') {
    query = query.eq('status', 'OPEN');
  } else if (scope === 'mine') {
    query = query.or(`contractor_id.eq.${user.id},musician_id.eq.${user.id}`);
  } else {
    if (role === 'contractor') {
      query = query.eq('contractor_id', user.id);
    } else {
      query = query.or(
        `status.eq.OPEN,contractor_id.eq.${user.id},musician_id.eq.${user.id}`,
      );
    }
  }

  if (statusFilter) {
    query = query.eq('status', statusFilter);
  }

  const { data: orders } = await query;
  const list = orders ?? [];

  const scopeBase = scope ? `scope=${scope}` : '';

  return (
    <div className="p-8 max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Pedidos</h1>
        {(role === 'contractor' || role === 'both') && (
          <Link
            href="/orders/new"
            className="bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
          >
            + Novo pedido
          </Link>
        )}
      </div>

      <div className="flex gap-2 mb-4 flex-wrap">
        <ScopeTab href="/orders" label="Meus" active={!scope} />
        {(role === 'musician' || role === 'both') && (
          <ScopeTab href="/orders?scope=open" label="Abertos" active={scope === 'open'} />
        )}
        <ScopeTab href="/orders?scope=mine" label="Participando" active={scope === 'mine'} />
      </div>

      <div className="flex gap-1.5 mb-6 flex-wrap">
        <FilterChip
          href={scope ? `/orders?${scopeBase}` : '/orders'}
          label="Todos"
          active={!statusFilter}
        />
        {STATUSES.map((s) => (
          <FilterChip
            key={s}
            href={`/orders?${scopeBase ? `${scopeBase}&` : ''}status=${s}`}
            label={STATUS_LABELS[s]}
            active={statusFilter === s}
          />
        ))}
      </div>

      {list.length === 0 ? (
        <div className="text-center py-16 text-zinc-500">
          <p className="text-lg mb-2">Nenhum pedido encontrado</p>
          {(role === 'contractor' || role === 'both') && (
            <Link
              href="/orders/new"
              className="text-sm text-violet-400 hover:text-violet-300 underline"
            >
              Criar o primeiro pedido
            </Link>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {list.map((order) => (
            <Link
              key={order.id}
              href={`/orders/${order.id}`}
              className="flex items-start justify-between bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3.5 hover:border-zinc-700 transition-colors group"
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-zinc-100 group-hover:text-white truncate">
                  {order.title}
                </p>
                <p className="text-xs text-zinc-500 mt-0.5">
                  {order.instrument} · {order.style} · prazo {formatDate(order.deadline)}
                </p>
              </div>
              <div className="flex items-center gap-3 shrink-0 ml-4">
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

function ScopeTab({
  href,
  label,
  active,
}: {
  href: string;
  label: string;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
        active
          ? 'bg-violet-600 text-white'
          : 'bg-zinc-800 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-700'
      }`}
    >
      {label}
    </Link>
  );
}

function FilterChip({
  href,
  label,
  active,
}: {
  href: string;
  label: string;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
        active
          ? 'bg-zinc-700 text-zinc-100 border-zinc-600'
          : 'bg-transparent text-zinc-500 border-zinc-800 hover:border-zinc-700 hover:text-zinc-300'
      }`}
    >
      {label}
    </Link>
  );
}
