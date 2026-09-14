import { apiRequest } from './apiClient';

export interface Season {
  id: string;
  name: string;
  year: number;
  ageGroup: string | null;
  startsOn: string | null;
  endsOn: string | null;
}

export async function fetchSeasons(signal?: AbortSignal): Promise<Season[]> {
  const response = await apiRequest<{ data: Season[] }>('/seasons', { signal });
  return Array.isArray(response?.data) ? response.data : [];
}
