// Helpers para responder de forma consistente em route handlers.

import { NextResponse } from 'next/server';
import { ZodError, type ZodSchema } from 'zod';

export class HttpError extends Error {
  constructor(public readonly status: number, message: string, public readonly details?: unknown) {
    super(message);
  }
}

export function jsonError(status: number, message: string, details?: unknown) {
  return NextResponse.json({ error: message, ...(details ? { details } : {}) }, { status });
}

export function jsonOk<T>(body: T, status = 200) {
  return NextResponse.json(body, { status });
}

// Parse + validação Zod num único passo. Lança HttpError em falha.
export async function parseJson<T>(req: Request, schema: ZodSchema<T>): Promise<T> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    throw new HttpError(400, 'JSON inválido');
  }
  try {
    return schema.parse(raw);
  } catch (err) {
    if (err instanceof ZodError) {
      throw new HttpError(422, 'Dados inválidos', err.flatten());
    }
    throw err;
  }
}

// Wrapper para handlers — converte HttpError em response consistente.
export function withErrorHandling<TArgs extends unknown[]>(
  handler: (...args: TArgs) => Promise<Response>,
) {
  return async (...args: TArgs): Promise<Response> => {
    try {
      return await handler(...args);
    } catch (err) {
      if (err instanceof HttpError) {
        return jsonError(err.status, err.message, err.details);
      }
      console.error('[unhandled route error]', err);
      return jsonError(500, 'Erro interno');
    }
  };
}
