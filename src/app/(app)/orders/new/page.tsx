'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function NewOrderPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    title: '',
    instrument: '',
    style: '',
    briefing: '',
    usage_rights: '',
    deadline: '',
    budget: '',
  });

  function field(name: keyof typeof form) {
    return (
      e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
    ) => setForm((f) => ({ ...f, [name]: e.target.value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const budgetCents = Math.round(parseFloat(form.budget) * 100);
    if (!isFinite(budgetCents)) {
      setError('Valor do orçamento inválido');
      return;
    }
    setLoading(true);
    setError(null);

    const res = await fetch('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: form.title,
        instrument: form.instrument,
        style: form.style,
        briefing: form.briefing,
        usage_rights: form.usage_rights,
        deadline: form.deadline,
        budget_cents: budgetCents,
      }),
    });

    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(data.error ?? 'Erro ao criar pedido');
      return;
    }

    router.push(`/orders/${data.order.id}`);
  }

  return (
    <div className="p-8 max-w-2xl">
      <h1 className="text-2xl font-bold mb-6">Novo Pedido</h1>

      <form onSubmit={handleSubmit} className="space-y-5">
        <Field label="Título" required>
          <input
            type="text"
            value={form.title}
            onChange={field('title')}
            required
            placeholder="Ex: Gravação de violino para trilha publicitária"
            className={inputCls}
          />
        </Field>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Instrumento" required>
            <input
              type="text"
              value={form.instrument}
              onChange={field('instrument')}
              required
              placeholder="Ex: Violino"
              className={inputCls}
            />
          </Field>
          <Field label="Estilo musical" required>
            <input
              type="text"
              value={form.style}
              onChange={field('style')}
              required
              placeholder="Ex: Clássico"
              className={inputCls}
            />
          </Field>
        </div>

        <Field
          label="Briefing"
          required
          hint="Descreva detalhadamente o que precisa (mín. 20 caracteres)"
        >
          <textarea
            value={form.briefing}
            onChange={field('briefing')}
            required
            rows={5}
            placeholder="Ex: Precisamos de uma melodia original de 60 segundos com tom emotivo..."
            className={inputCls}
          />
        </Field>

        <Field label="Direitos de uso" required hint="Como o material será utilizado">
          <textarea
            value={form.usage_rights}
            onChange={field('usage_rights')}
            required
            rows={3}
            placeholder="Ex: Uso comercial em campanha nacional, redes sociais e TV"
            className={inputCls}
          />
        </Field>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Prazo" required>
            <input
              type="datetime-local"
              value={form.deadline}
              onChange={field('deadline')}
              required
              className={inputCls}
            />
          </Field>
          <Field label="Orçamento" required hint="Mínimo R$ 50,00">
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 text-sm">
                R$
              </span>
              <input
                type="number"
                value={form.budget}
                onChange={field('budget')}
                required
                min="50"
                step="0.01"
                placeholder="0,00"
                className={`${inputCls} pl-9`}
              />
            </div>
          </Field>
        </div>

        {error && (
          <div className="rounded-lg bg-rose-900/30 border border-rose-800 px-4 py-3 text-sm text-rose-300">
            {error}
          </div>
        )}

        <div className="flex gap-3 pt-1">
          <button
            type="submit"
            disabled={loading}
            className="bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white font-medium px-6 py-2.5 rounded-xl transition-colors"
          >
            {loading ? 'Criando...' : 'Criar pedido'}
          </button>
          <a
            href="/orders"
            className="bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-medium px-6 py-2.5 rounded-xl transition-colors"
          >
            Cancelar
          </a>
        </div>
      </form>
    </div>
  );
}

const inputCls =
  'w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2.5 text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition';

function Field({
  label,
  required,
  hint,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-sm text-zinc-400 mb-1.5">
        {label}
        {required && <span className="text-violet-400 ml-0.5">*</span>}
      </label>
      {children}
      {hint && <p className="text-xs text-zinc-600 mt-1">{hint}</p>}
    </div>
  );
}
