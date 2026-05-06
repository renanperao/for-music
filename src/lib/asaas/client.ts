// HTTP client para a API Asaas v3.
// Docs: https://docs.asaas.com/

import { requireAsaas } from '@/lib/env';

export class AsaasError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly body: unknown,
  ) {
    super(message);
  }
}

type Method = 'GET' | 'POST' | 'PUT' | 'DELETE';

async function request<T>(
  method: Method,
  path: string,
  body?: unknown,
  query?: Record<string, string | number | undefined>,
): Promise<T> {
  const { apiUrl, apiKey } = requireAsaas();

  const url = new URL(`${apiUrl.replace(/\/$/, '')}${path}`);
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
    }
  }

  const res = await fetch(url, {
    method,
    headers: {
      access_token: apiKey,
      'Content-Type': 'application/json',
      'User-Agent': 'for-music/1.0',
    },
    body: body ? JSON.stringify(body) : undefined,
    cache: 'no-store',
  });

  const text = await res.text();
  let parsed: unknown = undefined;
  if (text) {
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = text;
    }
  }

  if (!res.ok) {
    throw new AsaasError(res.status, `Asaas ${method} ${path} → ${res.status}`, parsed);
  }
  return parsed as T;
}

export const asaas = {
  get:  <T>(p: string, q?: Record<string, string | number | undefined>) => request<T>('GET', p, undefined, q),
  post: <T>(p: string, b?: unknown) => request<T>('POST', p, b),
  put:  <T>(p: string, b?: unknown) => request<T>('PUT', p, b),
  del:  <T>(p: string) => request<T>('DELETE', p),
};
