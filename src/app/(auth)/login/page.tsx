'use client';
import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });
    setLoading(false);
    if (error) setError(error.message);
    else setSent(true);
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-zinc-950 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="text-5xl mb-3">🎵</div>
          <h1 className="text-2xl font-bold text-zinc-100">for-music</h1>
          <p className="text-zinc-400 text-sm mt-1">Marketplace de músicos profissionais</p>
        </div>

        {sent ? (
          <div className="rounded-2xl bg-zinc-900 border border-zinc-800 p-8 text-center">
            <div className="text-4xl mb-4">✉️</div>
            <p className="font-medium text-zinc-100">Verifique seu email</p>
            <p className="text-zinc-400 text-sm mt-2">
              Enviamos um link de acesso para{' '}
              <span className="text-zinc-200 font-medium">{email}</span>
            </p>
            <button
              onClick={() => setSent(false)}
              className="mt-4 text-xs text-zinc-500 hover:text-zinc-300 underline"
            >
              Usar outro email
            </button>
          </div>
        ) : (
          <form
            onSubmit={handleSubmit}
            className="rounded-2xl bg-zinc-900 border border-zinc-800 p-6 space-y-4"
          >
            <div>
              <label className="block text-sm text-zinc-400 mb-1.5">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoFocus
                placeholder="seu@email.com"
                className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2.5 text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition"
              />
            </div>
            {error && <p className="text-rose-400 text-sm">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white font-medium py-2.5 rounded-xl transition-colors"
            >
              {loading ? 'Enviando...' : 'Entrar com link mágico'}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
