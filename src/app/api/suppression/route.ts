import { NextResponse } from 'next/server';
import {
  getSuppressionList,
  addLeadToSuppression,
  bulkImportSuppression,
  removeSuppression,
} from '@/lib/services/suppression-service';

export async function GET() {
  try {
    const list = await getSuppressionList();
    return NextResponse.json({ suppressionList: list });
  } catch (err: any) {
    console.error('Error in /api/suppression GET:', err);
    return NextResponse.json({ error: err.message || 'Failed to fetch suppression list' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    // 1. Single lead suppression
    if (body.lead) {
      const record = await addLeadToSuppression(body.lead, body.reason, body.notes);
      return NextResponse.json({ success: true, record });
    }

    // 2. Bulk import of emails/phones
    if (body.rawInput) {
      const { addedCount } = await bulkImportSuppression(body.rawInput, body.reason, body.notes);
      return NextResponse.json({ success: true, addedCount });
    }

    return NextResponse.json({ error: 'lead or rawInput parameter is required' }, { status: 400 });
  } catch (err: any) {
    console.error('Error in /api/suppression POST:', err);
    return NextResponse.json({ error: err.message || 'Failed to suppress entry' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'id parameter is required' }, { status: 400 });
    }

    await removeSuppression(id);
    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('Error in /api/suppression DELETE:', err);
    return NextResponse.json({ error: err.message || 'Failed to remove suppression entry' }, { status: 500 });
  }
}
