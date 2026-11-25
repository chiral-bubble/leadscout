import { NextResponse } from 'next/server';
import { analyzeLead } from '@/lib/services/analysis-service';
import { Lead } from '@/types/database';

export async function POST(request: Request) {
  try {
    const { leads, limit = 5 } = await request.json();

    if (!Array.isArray(leads) || leads.length === 0) {
      return NextResponse.json({ error: 'Leads array is required' }, { status: 400 });
    }

    // Sort by review_count desc to prioritize high intent active businesses
    const targetLeads = [...leads]
      .sort((a, b) => (b.review_count || 0) - (a.review_count || 0))
      .slice(0, limit);

    const analyses: Record<string, any> = {};

    for (const lead of targetLeads as Lead[]) {
      try {
        const stored = await analyzeLead(lead);
        analyses[lead.id] = stored;
      } catch (err) {
        console.warn(`Failed to analyze lead ${lead.id}:`, err);
      }
    }

    return NextResponse.json({ success: true, analyses, count: Object.keys(analyses).length });
  } catch (err: any) {
    console.error('Error in /api/analyses/batch POST:', err);
    return NextResponse.json({ error: err.message || 'Batch analysis failed' }, { status: 500 });
  }
}
