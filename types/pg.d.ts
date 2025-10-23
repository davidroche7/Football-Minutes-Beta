declare module 'pg' {
  export interface QueryResult<T = unknown> {
    rows: T[];
    rowCount: number;
  }

  export interface PoolConfig {
    connectionString?: string;
    max?: number;
    ssl?: boolean | { rejectUnauthorized?: boolean };
  }

  export interface PoolClient {
    query<T = unknown>(text: string, params?: unknown[]): Promise<QueryResult<T>>;
    release(): void;
  }

  export class Pool {
    constructor(config?: PoolConfig);
    query<T = unknown>(text: string, params?: unknown[]): Promise<QueryResult<T>>;
    connect(): Promise<PoolClient>;
    end(): Promise<void>;
  }
}
