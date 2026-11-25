import { PlacesProvider, PlacesSearchParams } from '@/types/places';
import { Lead } from '@/types/database';
import { normalizeUKPhone } from '@/lib/uk/phone';

/**
 * UK Food Standards Agency (FHRS) Open API v2 Provider.
 * 100% free, keyless official UK government API covering every registered
 * restaurant, takeaway, cafe, bakery, pub, and mobile caterer in the UK.
 */
export class FhrsProvider implements PlacesProvider {
  name = 'FhrsProvider';

  async search(params: PlacesSearchParams): Promise<Omit<Lead, 'id' | 'created_at' | 'updated_at'>[]> {
    const { niche, location, maxResults } = params;

    const locations = location
      .split(',')
      .map((l) => l.trim())
      .filter(Boolean)
      .slice(0, 5);

    const businessTypeId = this.mapNicheToBusinessTypeId(niche);
    const seenIds = new Set<string>();
    const leads: Omit<Lead, 'id' | 'created_at' | 'updated_at'>[] = [];

    for (const singleLocation of locations) {
      const url = new URL('https://api.ratings.food.gov.uk/Establishments');
      url.searchParams.set('address', singleLocation);
      url.searchParams.set('pageSize', String(Math.min(maxResults, 250)));
      url.searchParams.set('pageNumber', '1');
      if (businessTypeId) {
        url.searchParams.set('businessTypeId', String(businessTypeId));
      }

      const res = await fetch(url.toString(), {
        headers: {
          'x-api-version': '2',
          Accept: 'application/json',
          'User-Agent': 'LeadScoutUK/1.0',
        },
        signal: AbortSignal.timeout(15000),
      });

      if (!res.ok) {
        throw new Error(`UK Food Standards Agency API returned HTTP ${res.status}`);
      }

      const data = await res.json();
      const establishments: any[] = data.establishments || [];

      for (const est of establishments) {
        const fhrsId = String(est.FHRSID || '');
        if (!fhrsId || seenIds.has(fhrsId) || !est.BusinessName) continue;
        seenIds.add(fhrsId);

        const addressParts = [
          est.AddressLine1,
          est.AddressLine2,
          est.AddressLine3,
          est.AddressLine4,
          est.PostCode,
        ].filter(Boolean);

        const rawPhone = est.Phone || null;
        const phoneInfo = normalizeUKPhone(rawPhone);
        const ratingNum = /^\d+$/.test(String(est.RatingValue || ''))
          ? parseInt(String(est.RatingValue), 10)
          : null;

        leads.push({
          place_id: `fhrs-${fhrsId}`,
          source: 'fhrs',
          name: est.BusinessName.trim(),
          address: addressParts.join(', ') || `${singleLocation}, UK`,
          postcode: est.PostCode || null,
          phone_raw: rawPhone,
          phone_e164: phoneInfo.phone_e164,
          phone_type: phoneInfo.phone_type,
          whatsapp_likely: phoneInfo.whatsapp_likely,
          email: null,
          website: null,
          has_website: false,
          website_type: 'none',
          rating: ratingNum,
          review_count: null,
          has_contact_route: Boolean(rawPhone || phoneInfo.phone_e164),
          categories: [
            (est.BusinessType || niche || 'food').toLowerCase(),
            ...(ratingNum !== null ? [`FHRS ${ratingNum}/5`] : []),
          ],
          opening_hours: null,
          google_maps_url: `https://ratings.food.gov.uk/business/${fhrsId}`,
          business_status: 'OPERATIONAL',
          status: 'discovered',
          is_suppressed: false,
          outreach_class: 'individual_or_unknown',
          manual_notes: est.RatingValue
            ? `UK Food Hygiene Rating: ${est.RatingValue}/5 (${est.BusinessType || 'Food Business'}).`
            : null,
        });

        if (leads.length >= maxResults) break;
      }

      if (leads.length >= maxResults) break;
    }

    return leads.slice(0, maxResults);
  }

  private mapNicheToBusinessTypeId(niche: string): number | null {
    const n = niche.toLowerCase().trim();
    if (n.includes('takeaway') || n.includes('sandwich') || n.includes('pizza') || n.includes('kebab') || n.includes('fish')) {
      return 7844; // Takeaway/sandwich shop
    }
    if (n.includes('restaurant') || n.includes('cafe') || n.includes('coffee') || n.includes('bistro')) {
      return 1; // Restaurant/Cafe/Canteen
    }
    if (n.includes('pub') || n.includes('bar')) {
      return 7843; // Pub/bar/nightclub
    }
    if (n.includes('cater') || n.includes('mobile') || n.includes('van')) {
      return 7842; // Mobile caterer
    }
    return null; // All food & hospitality types
  }
}
