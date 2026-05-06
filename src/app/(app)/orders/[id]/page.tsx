import { notFound, redirect } from 'next/navigation';
import { createServerClient } from '@/lib/supabase/server';
import { StatusBadge } from '../../status-badge';
import { formatCents, formatDate, formatDateTime } from '@/lib/format';
import { createDeliveryDownloadUrl } from '@/lib/r2/client';
import OrderActions from './order-actions';
import type { DeliveryRow, OrderRow, OrderStatus, RevisionRow, ReviewRow } from '@/types/database';

type OrderWithParties = OrderRow & {
  contractor: { full_name: string | null; email: string } | null;
  musician: { full_name: string | null; email: string } | null;
};

export default async function OrderDetailPage({ params }: { params: { id: string } }) {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const [orderRes, deliveriesRes, revisionsRes, reviewsRes] = await Promise.all([
    supabase
      .from('orders')
      .select('*, contractor:contractor_id(full_name, email), musician:musician_id(full_name, email)')
      .eq('id', params.id)
      .single(),
    supabase
      .from('deliveries')
      .select('*')
      .eq('order_id', params.id)
      .order('delivered_at', { ascending: false }),
    supabase
      .from('revisions')
      .select('*')
      .eq('order_id', params.id)
      .order('requested_at', { ascending: false }),
    supabase.from('reviews').select('*').eq('order_id', params.id),
  ]);

  const order = orderRes.data as unknown as OrderWithParties | null;
  if (!order) notFound();

  const isContractor = order.contractor_id === user.id;
  const isMusician = order.musician_id === user.id;
  const isParticipant = isContractor || isMusician;

  if (!isParticipant && order.status !== 'OPEN') notFound();

  const deliveries = (deliveriesRes.data ?? []) as DeliveryRow[];
  const revisions = (revisionsRes.data ?? []) as RevisionRow[];
  const reviews = (reviewsRes.data ?? []) as ReviewRow[];

  const currentDelivery = deliveries.find((d) => d.is_current) ?? null;
  let currentDeliveryUrl: string | undefined;
  if (currentDelivery && isParticipant) {
    try {
      currentDeliveryUrl = await createDeliveryDownloadUrl(currentDelivery.file_key);
    } catch {
      // R2 not configured in this environment
    }
  }

  const myReview = reviews.find((r) => r.reviewer_id === user.id);

  const contractorName =
    order.contractor?.full_name ?? order.contractor?.email ?? '—';
  const musicianName = order.musician
    ? (order.musician.full_name ?? order.musician.email)
    : 'Aguardando aceite';

  return (
    <div className="p-8 max-w-3xl">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-start gap-4 justify-between mb-2">
          <h1 className="text-2xl font-bold leading-snug">{order.title}</h1>
          <div className="shrink-0 mt-1">
            <StatusBadge status={order.status as OrderStatus} />
          </div>
        </div>
        <p className="text-zinc-400 text-sm">
          {order.instrument} · {order.style} · {formatCents(order.budget_cents)} · prazo{' '}
          {formatDate(order.deadline)}
        </p>
      </div>

      {/* Parties */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
          <p className="text-xs text-zinc-500 mb-0.5">Contratante</p>
          <p className="text-sm text-zinc-100">{contractorName}</p>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
          <p className="text-xs text-zinc-500 mb-0.5">Músico</p>
          <p className="text-sm text-zinc-100">{musicianName}</p>
        </div>
      </div>

      {/* Briefing */}
      <Section title="Briefing">
        <p className="text-sm text-zinc-200 whitespace-pre-wrap">{order.briefing}</p>
      </Section>

      {/* Usage rights */}
      <Section title="Direitos de uso">
        <p className="text-sm text-zinc-200">{order.usage_rights}</p>
      </Section>

      {/* Status actions */}
      {isParticipant && (
        <div className="mb-6">
          <OrderActions
            order={{
              id: order.id,
              status: order.status as OrderStatus,
              contractor_id: order.contractor_id,
              musician_id: order.musician_id,
              revision_count: order.revision_count,
            }}
            userId={user.id}
            currentDelivery={currentDelivery}
            currentDeliveryUrl={currentDeliveryUrl}
            hasReview={!!myReview}
          />
        </div>
      )}

      {/* Current delivery audio player */}
      {currentDeliveryUrl && isParticipant && (
        <Section title="Entrega atual">
          <div className="space-y-2">
            <p className="text-sm text-zinc-300">{currentDelivery?.file_name}</p>
            <audio controls src={currentDeliveryUrl} className="w-full" />
            {currentDelivery?.notes && (
              <p className="text-xs text-zinc-400">{currentDelivery.notes}</p>
            )}
          </div>
        </Section>
      )}

      {/* Delivery history */}
      {deliveries.length > 0 && (
        <Section title={`Histórico de entregas (${deliveries.length})`}>
          <div className="space-y-2">
            {deliveries.map((d) => (
              <div
                key={d.id}
                className="flex items-center justify-between bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3"
              >
                <div>
                  <p className="text-sm text-zinc-200">{d.file_name}</p>
                  <p className="text-xs text-zinc-500">{formatDateTime(d.delivered_at)}</p>
                </div>
                {d.is_current && (
                  <span className="text-xs text-emerald-400 font-medium">atual</span>
                )}
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Revisions */}
      {revisions.length > 0 && (
        <Section title={`Revisões (${revisions.length})`}>
          <div className="space-y-2">
            {revisions.map((r) => (
              <div
                key={r.id}
                className="bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3"
              >
                <p className="text-xs text-zinc-500 mb-1">{formatDateTime(r.requested_at)}</p>
                <p className="text-sm text-zinc-200 whitespace-pre-wrap">{r.feedback}</p>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Reviews */}
      {reviews.length > 0 && (
        <Section title="Avaliações">
          <div className="space-y-2">
            {reviews.map((r) => (
              <div
                key={r.id}
                className="bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3"
              >
                <p className="text-amber-400 mb-1">
                  {'★'.repeat(r.rating)}
                  <span className="text-zinc-700">{'★'.repeat(5 - r.rating)}</span>
                </p>
                {r.comment && <p className="text-sm text-zinc-200">{r.comment}</p>}
              </div>
            ))}
          </div>
        </Section>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-6">
      <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">
        {title}
      </h2>
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">{children}</div>
    </section>
  );
}
