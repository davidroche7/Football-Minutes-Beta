/* eslint-env node */
import type { VercelRequest } from '@vercel/node';

export async function readJsonBody<T = unknown>(req: VercelRequest): Promise<T> {
  if (req.body && typeof req.body === 'object') {
    return req.body as T;
  }

  const chunks: Buffer[] = [];
  await new Promise<void>((resolve, reject) => {
    req.on('data', (chunk: Buffer | string) => {
      const bufferChunk = typeof chunk === 'string' ? Buffer.from(chunk) : chunk;
      chunks.push(bufferChunk);
    });
    req.on('end', () => resolve());
    req.on('error', reject);
  });

  if (chunks.length === 0) {
    return {} as T;
  }

  const raw = Buffer.concat(chunks).toString('utf8');
  if (!raw) {
    return {} as T;
  }

  try {
    return JSON.parse(raw) as T;
  } catch (error) {
    throw new Error('INVALID_JSON_BODY');
  }
}
