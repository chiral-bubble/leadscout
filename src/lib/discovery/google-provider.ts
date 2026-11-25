import { PlacesProvider, PlacesSearchParams } from '@/types/places';
import { Lead } from '@/types/database';
import { searchGooglePlaces } from '@/lib/services/google-places';

export class GooglePlacesProvider implements PlacesProvider {
  name = 'GooglePlacesProvider';

  async search(params: PlacesSearchParams): Promise<Omit<Lead, 'id' | 'created_at' | 'updated_at'>[]> {
    const dataMode = process.env.DATA_MODE || 'live';
    const apiKey = process.env.GOOGLE_PLACES_API_KEY;

    if (!apiKey || apiKey.trim() === '' || apiKey === 'your-google-places-api-key') {
      if (dataMode === 'live') {
        throw new Error(
          'GooglePlacesProvider error: GOOGLE_PLACES_API_KEY is missing in live mode. Please set GOOGLE_PLACES_API_KEY in .env.local or use PLACES_PROVIDER=osm.'
        );
      }
    }

    const result = await searchGooglePlaces({
      niche: params.niche,
      location: params.location,
      radiusMiles: params.radiusMiles,
      maxResults: params.maxResults,
    });

    if (result.error && dataMode === 'live') {
      throw new Error(`GooglePlacesProvider error: ${result.error}`);
    }

    let leads = result.leads;
    if (params.onlyNoWebsite) {
      leads = leads.filter((l) => !l.has_website || l.website_type === 'none');
    }

    return leads;
  }
}
