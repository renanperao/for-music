// Acesso tipado a variáveis de ambiente. Falha cedo se obrigatórias faltarem.

function required(name: string): string {
  const v = process.env[name];
  if (!v || v.length === 0) {
    throw new Error(`Variável de ambiente ausente: ${name}`);
  }
  return v;
}

function optional(name: string): string | undefined {
  const v = process.env[name];
  return v && v.length > 0 ? v : undefined;
}

function intEnv(name: string, fallback: number): number {
  const v = process.env[name];
  if (!v) return fallback;
  const n = Number.parseInt(v, 10);
  if (!Number.isFinite(n)) {
    throw new Error(`Variável ${name} deve ser um inteiro, recebeu: ${v}`);
  }
  return n;
}

export const env = {
  supabase: {
    url: required('NEXT_PUBLIC_SUPABASE_URL'),
    anonKey: required('NEXT_PUBLIC_SUPABASE_ANON_KEY'),
    serviceRoleKey: optional('SUPABASE_SERVICE_ROLE_KEY'),
  },
  platform: {
    feePercent: intEnv('PLATFORM_FEE_PERCENT', 10),
    autoApproveAfterDays: intEnv('AUTO_APPROVE_AFTER_DAYS', 5),
    maxRevisions: intEnv('MAX_REVISIONS', 2),
  },
} as const;
