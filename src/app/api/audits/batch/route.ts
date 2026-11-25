import { NextResponse } from 'next/server';
import { runBatchAudits } from '@/lib/services/audit-service';
import { Lead } from '@/types/database';

export async function POST(request: Request) {
  try {
    const { leads } = await request.json();

    if (!Array.isArray(leads) || leads.length === 0) {
      return NextResponse.json({ error: 'Leads array is required' }, { status: 400 });
    }

    // Run batch audits sequentially so failures don't crash the batch
    const results = await runBatchAudits(leads as Lead[]);

    return NextResponse.json({
      success: true,
      ...results,
    });
  } catch (err: any) {
    console.error('Error in /api/audits/batch POST:', err);
    return NextResponse.json(
      { error: err.message || 'Batch audit failed' },
      { status: 500 }
    );
  }
}
