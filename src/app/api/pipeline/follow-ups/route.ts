import { NextRequest, NextResponse } from 'next/server';
import { generateFollowUp, getRemindersForLead } from '@/lib/services/pipeline-service';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { leadId, stage } = body;

    if (!leadId || !stage) {
      return NextResponse.json({ error: 'leadId and stage are required' }, { status: 400 });
    }

    const result = await generateFollowUp(leadId, stage);
    return NextResponse.json({ success: true, ...result });
  } catch (err: any) {
    console.error('Error generating follow-up:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const leadId = searchParams.get('leadId');

    if (!leadId) {
      return NextResponse.json({ error: 'leadId is required' }, { status: 400 });
    }

    const reminders = await getRemindersForLead(leadId);
    return NextResponse.json({ success: true, reminders });
  } catch (err: any) {
    console.error('Error fetching reminders:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
