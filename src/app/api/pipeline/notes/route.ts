import { NextRequest, NextResponse } from 'next/server';
import { saveLeadNotes, getLeadNotes } from '@/lib/services/pipeline-service';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const leadId = searchParams.get('leadId');

    if (!leadId) {
      return NextResponse.json({ error: 'leadId is required' }, { status: 400 });
    }

    const notes = await getLeadNotes(leadId);
    return NextResponse.json({ success: true, notes });
  } catch (err: any) {
    console.error('Error fetching notes:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { leadId, text } = body;

    if (!leadId) {
      return NextResponse.json({ error: 'leadId is required' }, { status: 400 });
    }

    const note = await saveLeadNotes(leadId, text || '');
    return NextResponse.json({ success: true, note });
  } catch (err: any) {
    console.error('Error saving note:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
