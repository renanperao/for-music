'use client';
import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import type { DeliveryRow, OrderStatus } from '@/types/database';

type OrderMeta = {
  id: string;
  status: OrderStatus;
  contractor_id: string;
  musician_id: string | null;
  revision_count: number;
};

type Props = {
  order: OrderMeta;
  userId: string;
  currentDelivery: DeliveryRow | null;
  currentDeliveryUrl?: string;
  hasReview: boolean;
};

const MAX_REVISIONS = 2;

export default function OrderActions({ order, userId, hasReview }: Props) {
  const isContractor = order.contractor_id === userId;
  const isMusician = order.musician_id === userId;

  if (order.status === 'OPEN') {
    if (isContractor) {
      return (
        <Panel title="Aguardando aceite">
          <p className="text-sm text-zinc-400">
            Seu pedido está disponível para músicos aceitarem.
          </p>
        </Panel>
      );
    }
    return <AcceptPanel orderId={order.id} />;
  }

  if (order.status === 'ACCEPTED') {
    if (isContractor) return <CheckoutPanel orderId={order.id} />;
    return (
      <Panel title="Aguardando pagamento">
        <p className="text-sm text-zinc-400">
          O contratante precisa realizar o pagamento para você poder entregar.
        </p>
      </Panel>
    );
  }

  if (order.status === 'PAID' || order.status === 'IN_REVISION') {
    if (isMusician) return <DeliveryUploader orderId={order.id} />;
    return (
      <Panel title={order.status === 'IN_REVISION' ? 'Em revisão' : 'Em produção'}>
        <p className="text-sm text-zinc-400">
          {order.status === 'IN_REVISION'
            ? 'O músico está trabalhando na revisão.'
            : 'O músico está produzindo a entrega.'}
        </p>
      </Panel>
    );
  }

  if (order.status === 'DELIVERED') {
    if (isContractor) {
      return (
        <DeliveredActions orderId={order.id} revisionCount={order.revision_count} />
      );
    }
    return (
      <Panel title="Entrega enviada">
        <p className="text-sm text-zinc-400">Aguardando aprovação do contratante.</p>
      </Panel>
    );
  }

  if (order.status === 'COMPLETED') {
    if (!hasReview && (isContractor || isMusician)) {
      return <ReviewForm orderId={order.id} />;
    }
    return (
      <Panel title="Pedido concluído">
        <p className="text-sm text-zinc-400">
          {hasReview ? 'Você já avaliou este pedido.' : 'Pedido finalizado com sucesso.'}
        </p>
      </Panel>
    );
  }

  if (order.status === 'DISPUTED') {
    return (
      <Panel title="Pedido em disputa">
        <p className="text-sm text-rose-400">
          Este pedido está em disputa. Entre em contato com o suporte.
        </p>
      </Panel>
    );
  }

  return null;
}

// ─── Accept ──────────────────────────────────────────────────────────────────

function AcceptPanel({ orderId }: { orderId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function accept() {
    setLoading(true);
    setError(null);
    const res = await fetch(`/api/orders/${orderId}/accept`, { method: 'POST' });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) { setError(data.error ?? 'Erro'); return; }
    router.refresh();
  }

  return (
    <Panel title="Pedido aberto">
      <p className="text-sm text-zinc-400 mb-4">
        Aceite este pedido para começar o trabalho.
      </p>
      <Btn onClick={accept} loading={loading}>Aceitar pedido</Btn>
      {error && <Err msg={error} />}
    </Panel>
  );
}

// ─── Checkout ────────────────────────────────────────────────────────────────

function CheckoutPanel({ orderId }: { orderId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pixData, setPixData] = useState<{
    payload: string;
    encodedImage: string;
    expiresAt: string;
  } | null>(null);
  const [invoiceUrl, setInvoiceUrl] = useState<string | null>(null);
  const [form, setForm] = useState({
    billingType: 'PIX',
    payerCpfCnpj: '',
    payerPhone: '',
  });

  function field(name: keyof typeof form) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm((f) => ({ ...f, [name]: e.target.value }));
  }

  async function handleCheckout(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const res = await fetch(`/api/orders/${orderId}/checkout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        billingType: form.billingType,
        payerCpfCnpj: form.payerCpfCnpj.replace(/\D/g, ''),
        payerPhone: form.payerPhone.replace(/\D/g, '') || undefined,
      }),
    });

    const data = await res.json();
    setLoading(false);

    if (!res.ok) { setError(data.error ?? 'Erro ao gerar cobrança'); return; }
    if (data.pix) setPixData(data.pix);
    if (data.invoiceUrl) setInvoiceUrl(data.invoiceUrl);
    router.refresh();
  }

  if (pixData) {
    return (
      <Panel title="Pague via PIX">
        <div className="space-y-4">
          {pixData.encodedImage && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={`data:image/png;base64,${pixData.encodedImage}`}
              alt="QR Code PIX"
              className="w-48 h-48 mx-auto rounded-xl"
            />
          )}
          <div>
            <p className="text-xs text-zinc-500 mb-1">Copia e cola:</p>
            <div className="bg-zinc-800 rounded-lg p-3 break-all text-xs text-zinc-300 font-mono select-all cursor-text">
              {pixData.payload}
            </div>
          </div>
          <p className="text-xs text-zinc-500">
            Expira em {new Date(pixData.expiresAt).toLocaleString('pt-BR')}
          </p>
        </div>
      </Panel>
    );
  }

  if (invoiceUrl) {
    return (
      <Panel title="Pagamento gerado">
        <a
          href={invoiceUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          Acessar fatura →
        </a>
      </Panel>
    );
  }

  return (
    <Panel title="Realizar pagamento">
      <form onSubmit={handleCheckout} className="space-y-4">
        <div>
          <label className="block text-xs text-zinc-500 mb-1">Forma de pagamento</label>
          <select value={form.billingType} onChange={field('billingType')} className={inputCls}>
            <option value="PIX">PIX</option>
            <option value="CREDIT_CARD">Cartão de crédito</option>
          </select>
        </div>
        <div>
          <label className="block text-xs text-zinc-500 mb-1">CPF ou CNPJ (só dígitos)</label>
          <input
            type="text"
            value={form.payerCpfCnpj}
            onChange={field('payerCpfCnpj')}
            required
            placeholder="00000000000"
            maxLength={18}
            className={inputCls}
          />
        </div>
        <div>
          <label className="block text-xs text-zinc-500 mb-1">Telefone (opcional)</label>
          <input
            type="text"
            value={form.payerPhone}
            onChange={field('payerPhone')}
            placeholder="11999999999"
            className={inputCls}
          />
        </div>
        {error && <Err msg={error} />}
        <Btn type="submit" loading={loading}>
          {form.billingType === 'PIX' ? 'Gerar QR Code PIX' : 'Gerar fatura'}
        </Btn>
      </form>
    </Panel>
  );
}

// ─── Delivery uploader ───────────────────────────────────────────────────────

function DeliveryUploader({ orderId }: { orderId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [notes, setNotes] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    const file = fileRef.current?.files?.[0];
    if (!file) return;

    setLoading(true);
    setError(null);
    setProgress(5);

    try {
      const urlRes = await fetch(`/api/orders/${orderId}/deliveries/upload-url`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileName: file.name, mimeType: file.type, sizeBytes: file.size }),
      });
      if (!urlRes.ok) {
        const d = await urlRes.json();
        throw new Error(d.error ?? 'Erro ao gerar URL de upload');
      }
      const { fileKey, uploadUrl } = await urlRes.json();
      setProgress(20);

      const putRes = await fetch(uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': file.type },
        body: file,
      });
      if (!putRes.ok) throw new Error('Erro ao enviar arquivo');
      setProgress(80);

      const deliveryRes = await fetch(`/api/orders/${orderId}/deliveries`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          file_key: fileKey,
          file_name: file.name,
          file_size_bytes: file.size,
          mime_type: file.type,
          notes: notes || undefined,
        }),
      });
      if (!deliveryRes.ok) {
        const d = await deliveryRes.json();
        throw new Error(d.error ?? 'Erro ao registrar entrega');
      }

      setProgress(100);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro inesperado');
    } finally {
      setLoading(false);
      setTimeout(() => setProgress(null), 800);
    }
  }

  return (
    <Panel title="Enviar entrega">
      <form onSubmit={handleUpload} className="space-y-3">
        <div>
          <label className="block text-xs text-zinc-500 mb-1.5">Arquivo de áudio</label>
          <input
            ref={fileRef}
            type="file"
            accept=".wav,.mp3,.aiff,.aif"
            required
            disabled={loading}
            className="text-sm text-zinc-400 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-medium file:bg-violet-600 file:text-white hover:file:bg-violet-500 disabled:opacity-50 cursor-pointer"
          />
          <p className="text-xs text-zinc-600 mt-1">WAV, MP3, AIFF — máx. 200 MB</p>
        </div>
        <div>
          <label className="block text-xs text-zinc-500 mb-1">Observações (opcional)</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            placeholder="Notas sobre a entrega..."
            disabled={loading}
            className={inputCls}
          />
        </div>
        {progress !== null && (
          <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-violet-500 transition-all duration-500 rounded-full"
              style={{ width: `${progress}%` }}
            />
          </div>
        )}
        {error && <Err msg={error} />}
        <Btn type="submit" loading={loading}>
          {loading ? `Enviando... ${progress ?? 0}%` : 'Enviar entrega'}
        </Btn>
      </form>
    </Panel>
  );
}

// ─── Delivered actions ───────────────────────────────────────────────────────

function DeliveredActions({
  orderId,
  revisionCount,
}: {
  orderId: string;
  revisionCount: number;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showRevision, setShowRevision] = useState(false);
  const [feedback, setFeedback] = useState('');

  async function approve() {
    setLoading(true);
    setError(null);
    const res = await fetch(`/api/orders/${orderId}/approve`, { method: 'POST' });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) { setError(data.error ?? 'Erro'); return; }
    router.refresh();
  }

  async function requestRevision(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await fetch(`/api/orders/${orderId}/revisions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ feedback }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) { setError(data.error ?? 'Erro'); return; }
    router.refresh();
  }

  const remaining = MAX_REVISIONS - revisionCount;

  return (
    <Panel title="Entrega recebida">
      {!showRevision ? (
        <div className="space-y-3">
          <p className="text-sm text-zinc-400">Ouça o material acima e decida:</p>
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={approve}
              disabled={loading}
              className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
            >
              {loading ? 'Aprovando...' : 'Aprovar e liberar pagamento'}
            </button>
            {remaining > 0 && (
              <button
                onClick={() => setShowRevision(true)}
                disabled={loading}
                className="bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 text-zinc-200 text-sm font-medium px-4 py-2 rounded-lg transition-colors"
              >
                Pedir revisão ({remaining} restante{remaining !== 1 ? 's' : ''})
              </button>
            )}
          </div>
          {error && <Err msg={error} />}
        </div>
      ) : (
        <form onSubmit={requestRevision} className="space-y-3">
          <div>
            <label className="block text-xs text-zinc-500 mb-1">Feedback para o músico</label>
            <textarea
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              required
              rows={4}
              placeholder="Descreva o que precisa ser ajustado..."
              className={inputCls}
            />
          </div>
          {error && <Err msg={error} />}
          <div className="flex gap-2 items-center">
            <Btn type="submit" loading={loading}>Enviar pedido de revisão</Btn>
            <button
              type="button"
              onClick={() => setShowRevision(false)}
              className="text-sm text-zinc-500 hover:text-zinc-300 transition-colors"
            >
              Cancelar
            </button>
          </div>
        </form>
      )}
    </Panel>
  );
}

// ─── Review form ─────────────────────────────────────────────────────────────

function ReviewForm({ orderId }: { orderId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await fetch(`/api/orders/${orderId}/reviews`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rating, comment: comment || undefined }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) { setError(data.error ?? 'Erro'); return; }
    router.refresh();
  }

  return (
    <Panel title="Avalie o trabalho">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs text-zinc-500 mb-2">Nota</label>
          <div className="flex gap-1">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setRating(n)}
                className={`text-2xl leading-none transition-colors ${
                  n <= rating ? 'text-amber-400' : 'text-zinc-700 hover:text-zinc-500'
                }`}
              >
                ★
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="block text-xs text-zinc-500 mb-1">Comentário (opcional)</label>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={3}
            placeholder="Conte como foi a experiência..."
            className={inputCls}
          />
        </div>
        {error && <Err msg={error} />}
        <Btn type="submit" loading={loading}>Enviar avaliação</Btn>
      </form>
    </Panel>
  );
}

// ─── Shared primitives ────────────────────────────────────────────────────────

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
      <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">
        {title}
      </h2>
      {children}
    </div>
  );
}

function Btn({
  children,
  loading,
  onClick,
  type = 'button',
}: {
  children: React.ReactNode;
  loading?: boolean;
  onClick?: () => void;
  type?: 'button' | 'submit';
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={loading}
      className="bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
    >
      {children}
    </button>
  );
}

function Err({ msg }: { msg: string }) {
  return (
    <div className="rounded-lg bg-rose-900/30 border border-rose-800 px-3 py-2 text-sm text-rose-300">
      {msg}
    </div>
  );
}

const inputCls =
  'w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition';
