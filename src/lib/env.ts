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
  asaas: {
    apiUrl: process.env.ASAAS_API_URL ?? 'https://api-sandbox.asaas.com/v3',
    apiKey: optional('ASAAS_API_KEY'),
    webhookToken: optional('ASAAS_WEBHOOK_TOKEN'),
    platformWalletId: optional('ASAAS_PLATFORM_WALLET_ID'),
  },
  r2: {
    accountId: optional('R2_ACCOUNT_ID'),
    accessKeyId: optional('R2_ACCESS_KEY_ID'),
    secretAccessKey: optional('R2_SECRET_ACCESS_KEY'),
    bucketName: optional('R2_BUCKET_NAME'),
    publicBaseUrl: optional('R2_PUBLIC_BASE_URL'),
  },
  platform: {
    appUrl: process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000',
    feePercent: intEnv('PLATFORM_FEE_PERCENT', 10),
    autoApproveAfterDays: intEnv('AUTO_APPROVE_AFTER_DAYS', 5),
    maxRevisions: intEnv('MAX_REVISIONS', 2),
  },
  internalJobToken: optional('INTERNAL_JOB_TOKEN'),
} as const;

// Helpers que falham apenas quando o módulo correspondente é usado
export function requireAsaas() {
  if (!env.asaas.apiKey) {
    throw new Error('ASAAS_API_KEY ausente — configure para usar pagamentos');
  }
  return env.asaas as typeof env.asaas & { apiKey: string };
}

export function requireR2() {
  const { accountId, accessKeyId, secretAccessKey, bucketName } = env.r2;
  if (!accountId || !accessKeyId || !secretAccessKey || !bucketName) {
    throw new Error('Credenciais R2 ausentes — configure para uploads');
  }
  return env.r2 as Required<typeof env.r2>;
}

export function requireServiceRole() {
  if (!env.supabase.serviceRoleKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY ausente — necessária para jobs internos');
  }
  return env.supabase.serviceRoleKey;
}

export function requireInternalJobToken() {
  if (!env.internalJobToken) {
    throw new Error('INTERNAL_JOB_TOKEN ausente — necessário para jobs internos');
  }
  return env.internalJobToken;
}
