/* eslint-env node */
import { query } from '../db/client';

export interface Season {
  id: string;
  name: string;
  year: number;
  ageGroup: string | null;
  startsOn: string | null;
  endsOn: string | null;
}

export async function listSeasons(): Promise<Season[]> {
  const result = await query<{
    id: string;
    name: string;
    year: number;
    age_group: string | null;
    starts_on: string | null;
    ends_on: string | null;
  }>(
    `SELECT id, name, year, age_group, starts_on, ends_on
     FROM season
     ORDER BY starts_on DESC NULLS LAST, year DESC`
  );

  return result.rows.map((row) => ({
    id: row.id,
    name: row.name,
    year: row.year,
    ageGroup: row.age_group,
    startsOn: row.starts_on,
    endsOn: row.ends_on,
  }));
}
