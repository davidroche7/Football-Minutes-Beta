/* eslint-env node */
import type { VercelResponse } from '@vercel/node';

export function ok<T>(res: VercelResponse, data: T): void {
  res.status(200).json(data);
}

export function created<T>(res: VercelResponse, data: T): void {
  res.status(201).json(data);
}

export function noContent(res: VercelResponse): void {
  res.status(204).send('');
}
