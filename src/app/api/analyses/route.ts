import { NextResponse } from 'next/server';
import { getAnalysisForLead, getAllAnalysesForLeads } from '@/lib/services/analysis-service';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const leadId = searchParams.get('leadId');
    const leadIds = searchParams.get('leadIds');

    if (leadId) {
      const analysis = await getAnalysisForLead(leadId);
      return NextResponse.json({ analysis });
    }

    if (leadIds) {
      const ids = leadIds.split(',').filter(Boolean);
      const analyses = await getAllAnalysesForLeads(ids);
      return NextResponse.json({ analyses });
    }

    return NextResponse.json({ error: 'leadId or leadIds parameter is required' }, { status: 400 });
  } catch (err: any) {
    console.error('Error in /api/analyses GET:', err);
    return NextResponse.json({ error: err.message || 'Failed to fetch analysis' }, { status: 500 });
  }
}
