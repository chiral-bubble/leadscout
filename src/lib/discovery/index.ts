import { PlacesProvider } from '@/types/places';
import { OsmProvider } from './osm-provider';
import { GooglePlacesProvider } from './google-provider';
import { ApifyPlacesProvider } from './apify-provider';
import { CompaniesHouseProvider } from './companies-house-provider';

export type DiscoveryProviderType = 'osm' | 'google' | 'apify' | 'companies_house';

export function getPlacesProvider(overrideProvider?: string): PlacesProvider {
  const providerType = (overrideProvider || process.env.PLACES_PROVIDER || 'osm').toLowerCase();

  if (providerType === 'google') {
    return new GooglePlacesProvider();
  }

  if (providerType === 'companies_house') {
    return new CompaniesHouseProvider();
  }

  if (providerType === 'apify') {
    return new ApifyPlacesProvider();
  }

  // Default to OsmProvider (free Overpass API & Nominatim)
  return new OsmProvider();
}
