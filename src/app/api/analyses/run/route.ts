import { NextResponse } from 'next/server';
import { analyzeLead } from '@/lib/services/analysis-service';
import { Lead } from '@/types/database';

export async function POST(request: Request) {
  try {
    const { lead, audit, company, social } = await request.json();

    if (!lead || !lead.id) {
      return NextResponse.json({ error: 'Valid lead is required' }, { status: 400 });
    }

    const analysis = await analyzeLead(lead as Lead, audit, company, social);
    return NextResponse.json({ success: true, analysis });
  } catch (err: any) {
    console.error('Error in /api/analyses/run POST:', err);
    return NextResponse.json({ error: err.message || 'Analysis failed' }, { status: 500 });
  }
}
