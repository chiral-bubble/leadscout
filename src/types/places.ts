import { Lead } from './database';

export interface PlacesSearchParams {
  niche: string;
  location: string;
  radiusMiles: number;
  maxResults: number;
  onlyNoWebsite?: boolean;
}

export interface PlacesProvider {
  name: string;
  search(params: PlacesSearchParams): Promise<Omit<Lead, 'id' | 'created_at' | 'updated_at'>[]>;
}
