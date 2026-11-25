import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getPlacesProvider } from '@/lib/discovery';
import { saveSearchAndLeads, getSearchHistory } from '@/lib/services/leads-service';

const SearchRequestSchema = z.object({
  niche: z.string().min(1, 'Niche is required').trim(),
  location: z.string().min(1, 'UK location is required').trim(),
  radiusMiles: z.coerce.number().min(1).max(20).default(10),
  maxResults: z
    .union([z.literal(20), z.literal(50), z.literal(100), z.enum(['20', '50', '100'])])
    .transform((v) => (typeof v === 'string' ? parseInt(v, 10) : v) as 20 | 50 | 100),
  onlyNoWebsite: z.boolean().optional().default(false),
  provider: z.enum(['osm', 'companies_house']).optional(),
});

export async function POST(request: Request) {
  try {
    const json = await request.json();
    const parsed = SearchRequestSchema.safeParse(json);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid search parameters', details: parsed.error.format() },
        { status: 400 }
      );
    }

    const { niche, location, radiusMiles, maxResults, onlyNoWebsite, provider: reqProvider } = parsed.data;
    const provider = getPlacesProvider(reqProvider);

    // 1. Discover places via configured PlacesProvider (OSM default, Google, or Apify)
    const discoveredLeads = await provider.search({
      niche,
      location,
      radiusMiles,
      maxResults,
      onlyNoWebsite,
    });

    const isDemo = process.env.DATA_MODE === 'demo';

    // 2. De-duplicate and persist in database
    const saved = await saveSearchAndLeads(
      { niche, location, radiusMiles, maxResults },
      discoveredLeads
    );

    return NextResponse.json({
      success: true,
      provider: provider.name,
      search: saved.search,
      leads: saved.leads,
      newLeadsCount: saved.newLeadsCount,
      duplicateLeadsCount: saved.duplicateLeadsCount,
      isMockData: isDemo,
    });
  } catch (err: any) {
    console.error('Error in /api/searches POST:', err);
    return NextResponse.json(
      { error: err.message || 'Internal server error processing search' },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const history = await getSearchHistory();
    return NextResponse.json({ searches: history });
  } catch (err: any) {
    console.error('Error in /api/searches GET:', err);
    return NextResponse.json(
      { error: err.message || 'Failed to fetch search history' },
      { status: 500 }
    );
  }
}
