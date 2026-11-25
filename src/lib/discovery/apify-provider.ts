import { PlacesProvider, PlacesSearchParams } from '@/types/places';
import { Lead } from '@/types/database';
import { normalizeUKPhone } from '@/lib/uk/phone';
import { classifyWebsite } from '@/lib/utils/website-classifier';

export class ApifyPlacesProvider implements PlacesProvider {
  name = 'ApifyProvider';

  async search(params: PlacesSearchParams): Promise<Omit<Lead, 'id' | 'created_at' | 'updated_at'>[]> {
    const dataMode = process.env.DATA_MODE || 'live';
    const token = process.env.APIFY_TOKEN || process.env.APIFY_API_TOKEN;

    if (!token || token.trim() === '' || token === 'your-apify-token') {
      if (dataMode === 'live') {
        throw new Error(
          'ApifyPlacesProvider error: APIFY_API_TOKEN is missing in live mode. Please set APIFY_API_TOKEN or choose PLACES_PROVIDER=osm.'
        );
      }
    }

    const query = `${params.niche} in ${params.location}, UK`;
    const endpoint = `https://api.apify.com/v2/acts/compass~crawler-google-places/run-sync-get-dataset-items?token=${token}`;

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        searchStringsArray: [query],
        maxCrawledPlacesPerSearch: params.maxResults,
        language: 'en',
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`ApifyPlacesProvider API HTTP ${response.status}: ${err}`);
    }

    const items = await response.json();
    if (!Array.isArray(items)) return [];

    const leads: Omit<Lead, 'id' | 'created_at' | 'updated_at'>[] = [];

    for (const item of items) {
      const rawPhone = item.phone || item.phoneUnformatted || null;
      const phoneInfo = normalizeUKPhone(rawPhone);
      const websiteUrl = item.website || null;
      const classification = classifyWebsite(websiteUrl);
      const hasWebsite = classification.has_website;

      if (params.onlyNoWebsite && hasWebsite) continue;

      leads.push({
        place_id: item.placeId || `apify-${item.cid || crypto.randomUUID()}`,
        name: item.title || item.name || 'Local Business',
        address: item.address || `${params.location}, UK`,
        postcode: item.postalCode || null,
        phone_raw: rawPhone,
        phone_e164: phoneInfo.phone_e164,
        phone_type: phoneInfo.phone_type,
        whatsapp_likely: phoneInfo.whatsapp_likely,
        website: websiteUrl,
        has_website: hasWebsite,
        website_type: classification.website_type,
        rating: typeof item.totalScore === 'number' ? item.totalScore : null,
        review_count: typeof item.reviewsCount === 'number' ? item.reviewsCount : 0,
        categories: item.categories || [params.niche],
        opening_hours: item.openingHours ? { raw: item.openingHours } : null,
        google_maps_url: item.url || null,
        business_status: 'OPERATIONAL',
        status: 'discovered',
        is_suppressed: false,
        outreach_class: 'individual_or_unknown',
      });
    }

    return leads;
  }
}
