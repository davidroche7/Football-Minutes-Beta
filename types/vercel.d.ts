declare module '@vercel/node' {
  import type { IncomingMessage, ServerResponse } from 'node:http';

  export interface VercelRequest extends IncomingMessage {
    method?: string;
    query: Record<string, string | string[] | undefined>;
    body?: unknown;
  }

  export interface VercelResponse extends ServerResponse {
    status(code: number): VercelResponse;
    json(body: unknown): void;
    send(body: unknown): void;
  }
}

declare module '@vercel/postgres' {
  export const sql: <T = unknown>(strings: TemplateStringsArray, ...values: unknown[]) => Promise<{
    rows: T[];
  }>;
}
