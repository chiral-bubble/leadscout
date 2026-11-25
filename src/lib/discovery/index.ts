import { PlacesProvider } from '@/types/places';
import { OsmProvider } from './osm-provider';
import { GooglePlacesProvider } from './google-provider';
import { ApifyPlacesProvider } from './apify-provider';

export function getPlacesProvider(): PlacesProvider {
  const providerType = (process.env.PLACES_PROVIDER || 'osm').toLowerCase();

  if (providerType === 'google') {
    return new GooglePlacesProvider();
  }

  if (providerType === 'apify') {
    return new ApifyPlacesProvider();
  }

  // Default to OsmProvider (free Overpass API & Nominatim)
  return new OsmProvider();
}
