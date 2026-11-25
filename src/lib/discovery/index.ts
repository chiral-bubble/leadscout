import { PlacesProvider } from '@/types/places';
import { OsmProvider } from './osm-provider';
import { ApifyPlacesProvider } from './apify-provider';
import { CompaniesHouseProvider } from './companies-house-provider';
import { FhrsProvider } from './fhrs-provider';

export type DiscoveryProviderType = 'osm' | 'apify' | 'companies_house' | 'fhrs';

export function getPlacesProvider(overrideProvider?: string): PlacesProvider {
  const providerType = (overrideProvider || process.env.PLACES_PROVIDER || 'osm').toLowerCase();

  if (providerType === 'fhrs') {
    return new FhrsProvider();
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
