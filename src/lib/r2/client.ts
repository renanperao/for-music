// Cliente Cloudflare R2 (S3-compatível). Gera presigned PUT URLs para o
// browser fazer upload direto, sem proxar bytes pelo nosso servidor.

import { S3Client } from '@aws-sdk/client-s3';
import { GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomUUID } from 'node:crypto';

import { requireR2 } from '@/lib/env';
import type { AudioMimeType } from '@/types/database';

const MAX_AUDIO_BYTES = 200 * 1024 * 1024; // 200MB

let cached: S3Client | null = null;

function client(): S3Client {
  if (cached) return cached;
  const r2 = requireR2();
  cached = new S3Client({
    region: 'auto',
    endpoint: `https://${r2.accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: r2.accessKeyId as string,
      secretAccessKey: r2.secretAccessKey as string,
    },
  });
  return cached;
}

export type DeliveryUploadTarget = {
  fileKey: string;
  uploadUrl: string;
  expiresInSeconds: number;
  maxBytes: number;
};

// Gera URL para PUT direto. A `fileKey` retornada é gravada na tabela
// deliveries e usada depois para gerar URLs de leitura assinadas.
export async function createDeliveryUploadTarget(params: {
  orderId: string;
  fileName: string;
  mimeType: AudioMimeType;
}): Promise<DeliveryUploadTarget> {
  const r2 = requireR2();
  const ext = sanitizeExtension(params.fileName);
  const fileKey = `orders/${params.orderId}/${randomUUID()}${ext}`;

  const cmd = new PutObjectCommand({
    Bucket: r2.bucketName,
    Key: fileKey,
    ContentType: params.mimeType,
    // R2 honra o ContentLength assinado para limitar o tamanho
    ContentLength: undefined,
  });

  const expiresInSeconds = 60 * 10; // 10 min
  const uploadUrl = await getSignedUrl(client(), cmd, { expiresIn: expiresInSeconds });

  return { fileKey, uploadUrl, expiresInSeconds, maxBytes: MAX_AUDIO_BYTES };
}

// URL assinada de leitura para o contratante ouvir/baixar o áudio.
export async function createDeliveryDownloadUrl(fileKey: string, expiresInSeconds = 60 * 10) {
  const r2 = requireR2();
  const cmd = new GetObjectCommand({ Bucket: r2.bucketName, Key: fileKey });
  return getSignedUrl(client(), cmd, { expiresIn: expiresInSeconds });
}

function sanitizeExtension(fileName: string): string {
  const dot = fileName.lastIndexOf('.');
  if (dot < 0) return '';
  const ext = fileName.slice(dot).toLowerCase();
  if (!/^\.[a-z0-9]{1,8}$/.test(ext)) return '';
  return ext;
}

export const R2_LIMITS = {
  MAX_AUDIO_BYTES,
  ALLOWED_MIME: [
    'audio/wav',
    'audio/x-wav',
    'audio/mpeg',
    'audio/aiff',
    'audio/x-aiff',
  ] as const satisfies readonly AudioMimeType[],
};
