import { NextRequest, NextResponse } from 'next/server';
import { getTodayFocusLeads } from '@/lib/services/pipeline-service';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const dailyCap = parseInt(searchParams.get('dailyCap') || '15', 10);

    const todayData = await getTodayFocusLeads(dailyCap);
    return NextResponse.json({ success: true, ...todayData });
  } catch (err: any) {
    console.error('Error fetching today focus:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
