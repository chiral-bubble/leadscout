import { NextRequest, NextResponse } from 'next/server';
import { enrichLeadSocials, getSocialEnrichmentForLead } from '@/lib/services/social-enrichment';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const leadId = searchParams.get('leadId');

    if (!leadId) {
      return NextResponse.json({ error: 'leadId is required' }, { status: 400 });
    }

    const enrichment = getSocialEnrichmentForLead(leadId);
    return NextResponse.json({ success: true, enrichment });
  } catch (err: any) {
    console.error('Error fetching social enrichment:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { leadId, socialLinks } = body;

    if (!leadId || !socialLinks) {
      return NextResponse.json({ error: 'leadId and socialLinks are required' }, { status: 400 });
    }

    const result = await enrichLeadSocials(leadId, socialLinks);
    return NextResponse.json({ success: true, enrichment: result });
  } catch (err: any) {
    console.error('Error enriching socials:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
