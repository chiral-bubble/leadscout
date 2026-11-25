import { NextRequest, NextResponse } from 'next/server';
import { logOutreach, getOutreachLogsForLead } from '@/lib/services/pitch-service';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { leadId, pitchId, channel, status, notes } = body;

    if (!leadId || !channel) {
      return NextResponse.json({ error: 'leadId and channel are required' }, { status: 400 });
    }

    const logEntry = await logOutreach(leadId, pitchId || null, channel, status || 'draft_opened', notes);

    return NextResponse.json({ success: true, log: logEntry });
  } catch (err: any) {
    console.error('Error logging outreach:', err);
    return NextResponse.json(
      { error: err.message || 'Failed to log outreach' },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const leadId = searchParams.get('leadId');

    if (!leadId) {
      return NextResponse.json({ error: 'leadId is required' }, { status: 400 });
    }

    const logs = await getOutreachLogsForLead(leadId);
    return NextResponse.json({ success: true, logs });
  } catch (err: any) {
    console.error('Error fetching outreach logs:', err);
    return NextResponse.json(
      { error: err.message || 'Failed to fetch logs' },
      { status: 500 }
    );
  }
}
