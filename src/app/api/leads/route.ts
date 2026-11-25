import { NextResponse } from 'next/server';
import { getLeadsBySearchId, getLeadById, updateLeadManualNotes } from '@/lib/services/leads-service';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const leadId = searchParams.get('leadId');
    if (leadId) {
      const lead = await getLeadById(leadId);
      return NextResponse.json({ lead });
    }

    const searchId = searchParams.get('searchId');
    if (!searchId) {
      return NextResponse.json({ error: 'leadId or searchId parameter is required' }, { status: 400 });
    }

    const leads = await getLeadsBySearchId(searchId);
    return NextResponse.json({ leads });
  } catch (err: any) {
    console.error('Error in /api/leads GET:', err);
    return NextResponse.json(
      { error: err.message || 'Failed to fetch leads' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const { leadId, manual_notes } = body;
    if (!leadId) {
      return NextResponse.json({ error: 'leadId is required' }, { status: 400 });
    }
    const updated = await updateLeadManualNotes(leadId, manual_notes ?? '');
    return NextResponse.json({ success: true, lead: updated });
  } catch (err: any) {
    console.error('Error in /api/leads PATCH:', err);
    return NextResponse.json(
      { error: err.message || 'Failed to update lead manual_notes' },
      { status: 500 }
    );
  }
}

