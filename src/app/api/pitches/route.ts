import { NextRequest, NextResponse } from 'next/server';
import { getStoredPitchesForLead } from '@/lib/services/pitch-service';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const leadId = searchParams.get('leadId');

    if (!leadId) {
      return NextResponse.json({ error: 'leadId is required' }, { status: 400 });
    }

    const pitches = await getStoredPitchesForLead(leadId);
    return NextResponse.json({ success: true, pitches });
  } catch (err: any) {
    console.error('Error in /api/pitches:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
