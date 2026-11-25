import { PlacesProvider, PlacesSearchParams } from '@/types/places';
import { Lead } from '@/types/database';
import { normalizeUKPhone } from '@/lib/uk/phone';
import { classifyWebsite } from '@/lib/utils/website-classifier';
import { extractUKPostcode } from '@/lib/uk/postcode';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

// Cache configuration: 24 hours TTL
const CACHE_DIR = path.resolve(process.cwd(), '.cache', 'overpass');
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

function getCachedOverpass(hash: string): any | null {
  try {
    const file = path.join(CACHE_DIR, `${hash}.json`);
    if (fs.existsSync(file)) {
      const stats = fs.statSync(file);
      if (Date.now() - stats.mtimeMs < CACHE_TTL_MS) {
        return JSON.parse(fs.readFileSync(file, 'utf8'));
      }
    }
  } catch {
    // ignore cache read failure
  }
  return null;
}

function setCachedOverpass(hash: string, data: any) {
  try {
    if (!fs.existsSync(CACHE_DIR)) {
      fs.mkdirSync(CACHE_DIR, { recursive: true });
    }
    fs.writeFileSync(path.join(CACHE_DIR, `${hash}.json`), JSON.stringify(data), 'utf8');
  } catch {
    // ignore cache write failure
  }
}

// Nominatim 1 request per second rate-limiter
let lastNominatimTime = 0;

async function rateLimitedNominatimFetch(url: string): Promise<Response> {
  const elapsed = Date.now() - lastNominatimTime;
  if (elapsed < 1100) {
    await new Promise((res) => setTimeout(res, 1100 - elapsed));
  }
  lastNominatimTime = Date.now();
  return fetch(url, {
    headers: {
      'User-Agent': 'LeadScoutUK/1.0 (contact@leadscout.co.uk)',
    },
  });
}

/**
 * OpenStreetMap (OSM) Discovery Provider.
 * Free, keyless discovery using Nominatim (geocoding) and Overpass API (place extraction).
 */
export class OsmProvider implements PlacesProvider {
  name = 'OsmProvider';

  async search(params: PlacesSearchParams): Promise<Omit<Lead, 'id' | 'created_at' | 'updated_at'>[]> {
    const { niche, location, radiusMiles, maxResults, onlyNoWebsite } = params;

    // 1. Geocode location using Nominatim (max 1 req/sec)
    const geoUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
      `${location}, UK`
    )}&limit=1`;

    const geoResponse = await rateLimitedNominatimFetch(geoUrl);
    if (!geoResponse.ok) {
      throw new Error(`Nominatim geocoding failed with status ${geoResponse.status}`);
    }

    const geoData = await geoResponse.json();
    if (!geoData || geoData.length === 0) {
      throw new Error(`Location "${location}" could not be geocoded by Nominatim. Please enter a valid UK town, city, or postcode.`);
    }

    const { lat, lon } = geoData[0];
    const radiusMeters = Math.min(Math.round(radiusMiles * 1609.34), 32000); // 1-20 miles to meters

    // 2. Build Overpass API query for the specified niche
    const filterClauses = this.buildNicheFilters(niche, radiusMeters, lat, lon);

    const overpassQuery = `
[out:json][timeout:25];
(
${filterClauses}
);
out center tags ${Math.min(maxResults * 2, 150)};
`;

    // 3. Query Overpass API with redundant mirrors, 25s timeout and 24h query caching (Stage 5A-1 Requirement 11)
    const queryHash = crypto.createHash('md5').update(overpassQuery).digest('hex');
    let overpassData: any = getCachedOverpass(queryHash);

    if (overpassData) {
      console.log(`[OSM] Using 24h cached Overpass results for query hash ${queryHash}`);
    } else {
      const OVERPASS_ENDPOINTS = [
        'https://ovp.dresel.systems/api/interpreter',
        'https://overpass-api.de/api/interpreter',
        'https://overpass.kumi.systems/api/interpreter',
        'https://overpass.private.coffee/api/interpreter',
      ];

      let lastError: string = '';

      for (const endpoint of OVERPASS_ENDPOINTS) {
        try {
          const overpassResponse = await fetch(endpoint, {
            method: 'POST',
            signal: AbortSignal.timeout(25000),
            headers: {
              'User-Agent': 'LeadScoutUK/1.0 (contact@leadscout.co.uk)',
              'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: 'data=' + encodeURIComponent(overpassQuery),
          });

          if (overpassResponse.ok) {
            overpassData = await overpassResponse.json();
            setCachedOverpass(queryHash, overpassData);
            break;
          } else {
            lastError = `HTTP ${overpassResponse.status} from ${endpoint}`;
          }
        } catch (err: any) {
          lastError = err.message || `Failed to fetch ${endpoint}`;
        }
      }

      if (!overpassData) {
        throw new Error(`Overpass API request failed across all mirrors: ${lastError}`);
      }
    }

    const rawElements = overpassData.elements || [];

    // 4. Map OSM tags to Lead fields
    const leads: Omit<Lead, 'id' | 'created_at' | 'updated_at'>[] = [];

    for (const elem of rawElements) {
      const tags = elem.tags;
      if (!tags || !tags.name) continue;

      const street = tags['addr:street'] || tags['addr:housename'] || '';
      const housenumber = tags['addr:housenumber'] || '';
      const city = tags['addr:city'] || tags['addr:town'] || location;
      const postcode = tags['addr:postcode'] || extractUKPostcode(street) || null;

      const addressParts = [housenumber, street, city, postcode].filter(Boolean);
      const address = addressParts.length > 0 ? addressParts.join(', ') : `${location}, UK`;

      const rawPhone = tags.phone || tags['contact:phone'] || tags['phone:mobile'] || null;
      const phoneInfo = normalizeUKPhone(rawPhone);

      const websiteUrl = tags.website || tags['contact:website'] || tags.url || null;
      const classification = classifyWebsite(websiteUrl);
      const hasWebsite = classification.has_website;

      // Apply "only businesses with no website tag" filter
      if (onlyNoWebsite && hasWebsite) {
        continue;
      }

      const hasContactRoute = Boolean(rawPhone || phoneInfo.phone_e164);

      leads.push({
        place_id: `osm-${elem.type}-${elem.id}`,
        name: tags.name,
        address,
        postcode,
        phone_raw: rawPhone,
        phone_e164: phoneInfo.phone_e164,
        phone_type: phoneInfo.phone_type,
        whatsapp_likely: phoneInfo.whatsapp_likely,
        website: websiteUrl,
        has_website: hasWebsite,
        website_type: classification.website_type,
        rating: null, // Ratings are null for OSM
        review_count: null, // Stage 5A-1 Requirement 7: Store review_count as null (not 0) when unknown
        has_contact_route: hasContactRoute, // Stage 5A-1 Requirement 10
        categories: [niche.toLowerCase()],
        opening_hours: tags.opening_hours ? { raw: tags.opening_hours } : null,
        google_maps_url: `https://www.openstreetmap.org/${elem.type}/${elem.id}`,
        business_status: 'OPERATIONAL',
        status: 'discovered',
        is_suppressed: false,
        outreach_class: 'individual_or_unknown',
      });
    }

    // Stage 5A-1 Requirement 10: Sort actionable leads above non-contactable leads
    leads.sort((a, b) => {
      const aRoute = a.has_contact_route ? 1 : 0;
      const bRoute = b.has_contact_route ? 1 : 0;
      return bRoute - aRoute;
    });

    return leads.slice(0, maxResults);
  }

  private buildNicheFilters(niche: string, radiusMeters: number, lat: string, lon: string): string {
    const n = niche.toLowerCase().trim();

    if (n.includes('barber') || n.includes('hair')) {
      return `
  node["shop"="hairdresser"](around:${radiusMeters},${lat},${lon});
  way["shop"="hairdresser"](around:${radiusMeters},${lat},${lon});
  node["shop"="barber"](around:${radiusMeters},${lat},${lon});
  way["shop"="barber"](around:${radiusMeters},${lat},${lon});
  node["amenity"="barber"](around:${radiusMeters},${lat},${lon});`;
    }

    if (n.includes('dentist')) {
      return `
  node["amenity"="dentist"](around:${radiusMeters},${lat},${lon});
  way["amenity"="dentist"](around:${radiusMeters},${lat},${lon});
  node["healthcare"="dentist"](around:${radiusMeters},${lat},${lon});`;
    }

    if (n.includes('plumb')) {
      return `
  node["craft"="plumber"](around:${radiusMeters},${lat},${lon});
  way["craft"="plumber"](around:${radiusMeters},${lat},${lon});
  node["shop"="plumber"](around:${radiusMeters},${lat},${lon});`;
    }

    if (n.includes('restaurant') || n.includes('cafe')) {
      return `
  node["amenity"="restaurant"](around:${radiusMeters},${lat},${lon});
  way["amenity"="restaurant"](around:${radiusMeters},${lat},${lon});
  node["amenity"="cafe"](around:${radiusMeters},${lat},${lon});`;
    }

    if (n.includes('estate agent')) {
      return `
  node["office"="estate_agent"](around:${radiusMeters},${lat},${lon});
  way["office"="estate_agent"](around:${radiusMeters},${lat},${lon});`;
    }

    if (n.includes('gym') || n.includes('fitness')) {
      return `
  node["leisure"="fitness_centre"](around:${radiusMeters},${lat},${lon});
  way["leisure"="fitness_centre"](around:${radiusMeters},${lat},${lon});`;
    }

    if (n.includes('accountant')) {
      return `
  node["office"="accountant"](around:${radiusMeters},${lat},${lon});
  way["office"="accountant"](around:${radiusMeters},${lat},${lon});`;
    }

    if (n.includes('photograph')) {
      return `
  node["shop"="photo"](around:${radiusMeters},${lat},${lon});
  node["craft"="photographer"](around:${radiusMeters},${lat},${lon});`;
    }

    // Generic fallback for any other niche
    return `
  node["shop"~"${n}"](around:${radiusMeters},${lat},${lon});
  way["shop"~"${n}"](around:${radiusMeters},${lat},${lon});
  node["amenity"~"${n}"](around:${radiusMeters},${lat},${lon});
  node["craft"~"${n}"](around:${radiusMeters},${lat},${lon});
  node["office"~"${n}"](around:${radiusMeters},${lat},${lon});`;
  }
}
