/* eslint-env node */
import type { ZodError, ZodSchema } from 'zod';
import { ApiError } from './errors';

export function parseWithSchema<T>(schema: ZodSchema<T>, data: unknown, errorCode: string): T {
  try {
    return schema.parse(data);
  } catch (error) {
    const zodError = error as ZodError;
    throw new ApiError(422, errorCode, 'Validation failed', zodError.flatten());
  }
}
