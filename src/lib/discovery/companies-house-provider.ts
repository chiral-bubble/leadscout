import { PlacesProvider, PlacesSearchParams } from '@/types/places';
import { Lead } from '@/types/database';

/**
 * Discovers newly incorporated UK companies (last 90 days) in the target town/location
 * using the official UK Companies House Advanced Search API.
 * Newly incorporated Ltd/LLP businesses rarely have websites yet and are B2B corporate leads.
 */
export class CompaniesHouseProvider implements PlacesProvider {
  name = 'CompaniesHouseProvider';

  async search(params: PlacesSearchParams): Promise<Omit<Lead, 'id' | 'created_at' | 'updated_at'>[]> {
    const apiKey = process.env.COMPANIES_HOUSE_API_KEY;
    if (!apiKey || apiKey.trim() === '') {
      throw new Error(
        'CompaniesHouseProvider error: COMPANIES_HOUSE_API_KEY is missing. Please add it to your environment variables.'
      );
    }

    const toDate = new Date();
    const fromDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    const fmt = (d: Date) => d.toISOString().slice(0, 10);

    const url = new URL('https://api.company-information.service.gov.uk/advanced-search/companies');
    url.searchParams.set('incorporated_from', fmt(fromDate));
    url.searchParams.set('incorporated_to', fmt(toDate));
    url.searchParams.set('location', params.location);
    url.searchParams.set('company_status', 'active');
    url.searchParams.set('size', String(Math.min(params.maxResults * 2, 100)));

    const authHeader = 'Basic ' + Buffer.from(`${apiKey}:`).toString('base64');
    const res = await fetch(url.toString(), {
      headers: {
        Authorization: authHeader,
        Accept: 'application/json',
      },
      signal: AbortSignal.timeout(15000),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      if (res.status === 401) {
        throw new Error(
          'Companies House API key was rejected (HTTP 401 Invalid Authorization). Please generate a live REST API key at developer.company-information.service.gov.uk (leave Restricted IPs blank for Vercel) and update COMPANIES_HOUSE_API_KEY.'
        );
      }
      throw new Error(`Companies House Advanced Search returned HTTP ${res.status}: ${errText.slice(0, 150)}`);
    }

    const data = await res.json();
    const items: any[] = data.items || [];
    const nicheLower = params.niche.toLowerCase().trim();
    const nicheWord = nicheLower.replace(/s$/, '');

    // Prioritise companies whose name matches the searched niche, followed by other new companies in that town
    const sortedItems = [...items].sort((a, b) => {
      const aMatch = (a.company_name || '').toLowerCase().includes(nicheWord) ? 1 : 0;
      const bMatch = (b.company_name || '').toLowerCase().includes(nicheWord) ? 1 : 0;
      if (aMatch !== bMatch) return bMatch - aMatch;
      return (b.date_of_creation || '').localeCompare(a.date_of_creation || '');
    });

    const leads: Omit<Lead, 'id' | 'created_at' | 'updated_at'>[] = sortedItems
      .slice(0, params.maxResults)
      .map((item) => {
        const addrObj = item.registered_office_address || {};
        const addressParts = [
          addrObj.address_line_1,
          addrObj.address_line_2,
          addrObj.locality,
          addrObj.postal_code,
        ].filter(Boolean);

        const sicCodes: string[] = Array.isArray(item.sic_codes) ? item.sic_codes : [];
        const created = item.date_of_creation ? `incorporated ${item.date_of_creation}` : 'newly incorporated';

        return {
          place_id: `ch-${item.company_number}`,
          source: 'companies_house',
          name: item.company_name,
          address: addressParts.join(', ') || `${params.location}, UK`,
          postcode: addrObj.postal_code || null,
          phone_raw: null,
          phone_e164: null,
          phone_type: 'unknown',
          whatsapp_likely: false,
          email: null,
          website: null,
          has_website: false,
          website_type: 'none',
          rating: null,
          review_count: null,
          has_contact_route: true,
          categories: [nicheLower, created, ...(sicCodes.length > 0 ? [`SIC ${sicCodes[0]}`] : [])],
          opening_hours: null,
          google_maps_url: `https://find-and-update.company-information.service.gov.uk/company/${item.company_number}`,
          business_status: 'OPERATIONAL',
          status: 'discovered',
          is_suppressed: false,
          outreach_class: 'corporate',
          manual_notes: `Companies House #${item.company_number} (${item.company_type || 'ltd'}), ${created}.`,
        };
      });

    return leads;
  }
}
