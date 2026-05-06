import type { OrderStatus } from '@/types/database';

const CONFIG: Record<OrderStatus, { label: string; classes: string }> = {
  OPEN:        { label: 'Aberto',     classes: 'bg-zinc-800 text-zinc-300 border-zinc-700' },
  ACCEPTED:    { label: 'Aceito',     classes: 'bg-blue-900/50 text-blue-300 border-blue-800' },
  PAID:        { label: 'Pago',       classes: 'bg-violet-900/50 text-violet-300 border-violet-800' },
  DELIVERED:   { label: 'Entregue',   classes: 'bg-amber-900/50 text-amber-300 border-amber-800' },
  IN_REVISION: { label: 'Em revisão', classes: 'bg-orange-900/50 text-orange-300 border-orange-800' },
  COMPLETED:   { label: 'Concluído',  classes: 'bg-emerald-900/50 text-emerald-300 border-emerald-800' },
  DISPUTED:    { label: 'Disputado',  classes: 'bg-rose-900/50 text-rose-300 border-rose-800' },
};

export function StatusBadge({ status }: { status: OrderStatus }) {
  const { label, classes } = CONFIG[status] ?? CONFIG.OPEN;
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${classes}`}
    >
      {label}
    </span>
  );
}
