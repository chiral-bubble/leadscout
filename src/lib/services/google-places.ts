import { normalizeUKPhone } from '@/lib/uk/phone';
import { extractUKPostcode } from '@/lib/uk/postcode';
import { classifyWebsite } from '@/lib/utils/website-classifier';
import { Lead } from '@/types/database';

export interface PlacesFetchResult {
  leads: Omit<Lead, 'id' | 'created_at' | 'updated_at'>[];
  requestsMade: number;
  isMockData: boolean;
  error?: string;
}

export async function searchGooglePlaces(params: {
  niche: string;
  location: string;
  radiusMiles: number;
  maxResults: number;
}): Promise<PlacesFetchResult> {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  const dataMode = process.env.DATA_MODE || 'live';

  if (!apiKey || apiKey.trim() === '' || apiKey === 'your-google-places-api-key') {
    if (dataMode === 'live') {
      throw new Error('Google Places API key is not configured in DATA_MODE=live. Set GOOGLE_PLACES_API_KEY or use PLACES_PROVIDER=osm.');
    }
    // Generate realistic UK mock data only for demo mode
    return generateMockUKPlaces(params.niche, params.location, params.maxResults);
  }

  const query = `${params.niche} in ${params.location}, UK`;
  const endpoint = 'https://places.googleapis.com/v1/places:searchText';
  const fieldMask = [
    'places.id',
    'places.displayName',
    'places.formattedAddress',
    'places.nationalPhoneNumber',
    'places.internationalPhoneNumber',
    'places.websiteUri',
    'places.rating',
    'places.userRatingCount',
    'places.types',
    'places.regularOpeningHours',
    'places.googleMapsUri',
    'places.businessStatus',
    'places.addressComponents',
    'nextPageToken',
  ].join(',');

  const leads: Omit<Lead, 'id' | 'created_at' | 'updated_at'>[] = [];
  let pageToken: string | undefined = undefined;
  let requestsMade = 0;
  const maxPages = Math.ceil(params.maxResults / 20);

  try {
    for (let page = 0; page < maxPages; page++) {
      requestsMade++;
      const requestBody: Record<string, any> = {
        textQuery: query,
        pageSize: Math.min(20, params.maxResults - leads.length),
      };

      if (pageToken) {
        requestBody.pageToken = pageToken;
      }

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': apiKey,
          'X-Goog-FieldMask': fieldMask,
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Google Places API Error:', response.status, errorText);
        // If API key is invalid/unauthorized, fallback to mock data only in demo mode
        if (leads.length === 0) {
          if (dataMode === 'live') {
            throw new Error(`Google Places API returned ${response.status}: ${errorText.slice(0, 150)}`);
          }
          const mock = generateMockUKPlaces(params.niche, params.location, params.maxResults);
          return {
            ...mock,
            error: `Google Places API returned ${response.status}: ${errorText.slice(0, 150)}. Displaying generated UK preview places.`,
          };
        }
        break;
      }

      const data = await response.json();
      const rawPlaces = data.places || [];

      for (const p of rawPlaces) {
        const placeId = p.id;
        const name = p.displayName?.text || 'Unnamed Business';
        const address = p.formattedAddress || '';
        const rawPhone = p.nationalPhoneNumber || p.internationalPhoneNumber || null;
        const phoneData = normalizeUKPhone(rawPhone);
        const websiteClassification = classifyWebsite(p.websiteUri);
        const postcode = extractUKPostcode(address);

        leads.push({
          place_id: placeId,
          name,
          address,
          postcode,
          phone_raw: phoneData.phone_raw,
          phone_e164: phoneData.phone_e164,
          phone_type: phoneData.phone_type,
          whatsapp_likely: phoneData.whatsapp_likely,
          website: websiteClassification.normalized_url,
          has_website: websiteClassification.has_website,
          website_type: websiteClassification.website_type,
          rating: p.rating ? Number(p.rating) : null,
          review_count: p.userRatingCount || 0,
          categories: p.types || [],
          opening_hours: p.regularOpeningHours || null,
          google_maps_url: p.googleMapsUri || `https://www.google.com/maps/place/?q=place_id:${placeId}`,
          business_status: p.businessStatus || 'OPERATIONAL',
          status: 'discovered',
          is_suppressed: false,
        });

        if (leads.length >= params.maxResults) {
          break;
        }
      }

      pageToken = data.nextPageToken;
      if (!pageToken || leads.length >= params.maxResults) {
        break;
      }

      // Small delay between page token queries if required by API
      await new Promise(res => setTimeout(res, 300));
    }

    return {
      leads,
      requestsMade,
      isMockData: false,
    };
  } catch (err: any) {
    console.error('Failed to query Google Places:', err);
    if (dataMode === 'live') {
      throw new Error(`Network error querying Google Places: ${err.message}`);
    }
    const mock = generateMockUKPlaces(params.niche, params.location, params.maxResults);
    return {
      ...mock,
      error: `Network error querying Google Places: ${err.message}. Showing generated preview places.`,
    };
  }
}

/**
 * Generates realistic UK businesses with varied website_type, phone_type, and ratings
 * for immediate testing and verification without external credential dependency.
 */
function generateMockUKPlaces(
  niche: string,
  location: string,
  maxResults: number
): PlacesFetchResult {
  const count = Math.min(maxResults, 20);
  const leads: Omit<Lead, 'id' | 'created_at' | 'updated_at'>[] = [];

  const adjectives = ['Premier', 'Royal', 'Beacon', 'Heritage', 'Bespoke', 'Elite', 'Crown', 'Classic', 'Central', 'Urban'];
  const formats = ['Ltd', '& Co', 'Solutions', 'Studio', 'Services', 'Partnership', 'Hub'];

  // Realistic sample UK postcodes by outward code
  const samplePostcodes = ['SW1A 2AA', 'M1 4BT', 'B2 4QA', 'BS1 5HH', 'LS1 4DY', 'EH1 1YZ', 'CF10 1EP', 'CB2 1TN'];
  
  // Varied website archetypes to verify filtering
  const websiteScenarios: { type: 'none' | 'social_only' | 'builder' | 'own_site'; url: string | null }[] = [
    { type: 'own_site', url: 'https://example-business.co.uk' },
    { type: 'builder', url: 'https://mybusiness.wixsite.com/home' },
    { type: 'social_only', url: 'https://www.facebook.com/uklocalbiz' },
    { type: 'none', url: null },
    { type: 'builder', url: 'https://bristol-services.squarespace.com' },
    { type: 'social_only', url: 'https://instagram.com/uk_pro_services' },
  ];

  for (let i = 0; i < count; i++) {
    const adj = adjectives[i % adjectives.length];
    const fmt = formats[i % formats.length];
    const name = `${adj} ${niche.charAt(0).toUpperCase() + niche.slice(1)} ${fmt}`;
    const placeId = `ChIJ_UK_MOCK_${niche.toLowerCase().replace(/\s+/g, '_')}_${i}_${location.toLowerCase().replace(/\s+/g, '_')}`;
    const postcode = samplePostcodes[i % samplePostcodes.length];
    const address = `${10 + i * 3} High Street, ${location}, ${postcode}`;

    // Alternate between UK mobile (07...) and UK landline (01... / 02...)
    const isMobile = i % 2 === 0;
    const rawPhone = isMobile ? `07911 12345${i}` : `0161 496 012${i}`;
    const phoneData = normalizeUKPhone(rawPhone);

    const scenario = websiteScenarios[i % websiteScenarios.length];
    const websiteClassification = classifyWebsite(scenario.url);

    const rating = Number((3.6 + ((i * 3) % 15) / 10).toFixed(1));
    const reviewCount = (i + 1) * 7 + (i % 3) * 12;

    leads.push({
      place_id: placeId,
      name,
      address,
      postcode,
      phone_raw: phoneData.phone_raw,
      phone_e164: phoneData.phone_e164,
      phone_type: phoneData.phone_type,
      whatsapp_likely: phoneData.whatsapp_likely,
      website: websiteClassification.normalized_url,
      has_website: websiteClassification.has_website,
      website_type: websiteClassification.website_type,
      rating,
      review_count: reviewCount,
      categories: [niche.toLowerCase(), 'point_of_interest', 'establishment'],
      opening_hours: {
        weekdayDescriptions: [
          'Monday: 9:00 AM – 5:30 PM',
          'Tuesday: 9:00 AM – 5:30 PM',
          'Wednesday: 9:00 AM – 5:30 PM',
          'Thursday: 9:00 AM – 5:30 PM',
          'Friday: 9:00 AM – 5:30 PM',
          'Saturday: 10:00 AM – 4:00 PM',
          'Sunday: Closed',
        ],
      },
      google_maps_url: `https://maps.google.com/?q=${encodeURIComponent(name + ' ' + address)}`,
      business_status: 'OPERATIONAL',
      status: 'discovered',
      is_suppressed: false,
    });
  }

  return {
    leads,
    requestsMade: 1,
    isMockData: true,
  };
}

