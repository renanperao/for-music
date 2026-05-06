'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { UserRow } from '@/types/database';

export default function ProfileForm({ profile }: { profile: UserRow }) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    full_name: profile.full_name ?? '',
    role: profile.role,
    bio: profile.bio ?? '',
    pix_key: profile.pix_key ?? '',
    pix_key_type: profile.pix_key_type ?? '',
  });

  function field(name: keyof typeof form) {
    return (
      e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>,
    ) => {
      setSuccess(false);
      setForm((f) => ({ ...f, [name]: e.target.value }));
    };
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(false);

    const body: Record<string, unknown> = {
      full_name: form.full_name || undefined,
      role: form.role,
      bio: form.bio || null,
    };

    if (form.pix_key && form.pix_key_type) {
      body.pix_key = form.pix_key;
      body.pix_key_type = form.pix_key_type;
    } else if (!form.pix_key && !form.pix_key_type) {
      body.pix_key = null;
      body.pix_key_type = null;
    }

    const res = await fetch('/api/me', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const data = await res.json();
    setSaving(false);

    if (!res.ok) {
      setError(data.error ?? 'Erro ao salvar');
      return;
    }

    setSuccess(true);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <Field label="Email">
        <input
          type="email"
          value={profile.email}
          disabled
          className={`${inputCls} opacity-50 cursor-not-allowed`}
        />
      </Field>

      <Field label="Nome completo">
        <input
          type="text"
          value={form.full_name}
          onChange={field('full_name')}
          placeholder="Seu nome completo"
          className={inputCls}
        />
      </Field>

      <Field label="Papel na plataforma">
        <select value={form.role} onChange={field('role')} className={inputCls}>
          <option value="contractor">Contratante</option>
          <option value="musician">Músico</option>
          <option value="both">Ambos</option>
        </select>
      </Field>

      <Field label="Bio" hint="Apresente-se para outros usuários">
        <textarea
          value={form.bio}
          onChange={field('bio')}
          rows={4}
          placeholder="Conte um pouco sobre você e sua experiência..."
          className={inputCls}
        />
      </Field>

      <div className="border-t border-zinc-800 pt-5">
        <h2 className="text-sm font-medium text-zinc-300 mb-4">
          Chave PIX{' '}
          <span className="text-zinc-600 font-normal">(para receber pagamentos)</span>
        </h2>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Tipo de chave">
            <select value={form.pix_key_type} onChange={field('pix_key_type')} className={inputCls}>
              <option value="">Selecione...</option>
              <option value="cpf">CPF</option>
              <option value="cnpj">CNPJ</option>
              <option value="email">Email</option>
              <option value="phone">Telefone</option>
              <option value="evp">Chave aleatória (EVP)</option>
            </select>
          </Field>
          <Field label="Chave PIX">
            <input
              type="text"
              value={form.pix_key}
              onChange={field('pix_key')}
              placeholder={
                form.pix_key_type === 'cpf'
                  ? '00000000000'
                  : form.pix_key_type === 'email'
                    ? 'seu@email.com'
                    : 'Sua chave PIX'
              }
              className={inputCls}
            />
          </Field>
        </div>
        <p className="text-xs text-zinc-600 mt-2">
          Preencha ambos os campos ou deixe ambos em branco.
        </p>
      </div>

      {error && (
        <div className="rounded-lg bg-rose-900/30 border border-rose-800 px-4 py-3 text-sm text-rose-300">
          {error}
        </div>
      )}
      {success && (
        <div className="rounded-lg bg-emerald-900/30 border border-emerald-800 px-4 py-3 text-sm text-emerald-300">
          Perfil atualizado com sucesso.
        </div>
      )}

      <button
        type="submit"
        disabled={saving}
        className="bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white font-medium px-6 py-2.5 rounded-xl transition-colors"
      >
        {saving ? 'Salvando...' : 'Salvar alterações'}
      </button>
    </form>
  );
}

const inputCls =
  'w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2.5 text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition';

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-sm text-zinc-400 mb-1.5">{label}</label>
      {children}
      {hint && <p className="text-xs text-zinc-600 mt-1">{hint}</p>}
    </div>
  );
}
