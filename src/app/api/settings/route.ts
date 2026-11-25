import { NextRequest, NextResponse } from 'next/server';
import { getSenderSettings, saveSenderSettings } from '@/lib/services/settings-service';

export async function GET() {
  try {
    const settings = await getSenderSettings();
    return NextResponse.json({ settings });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const saved = await saveSenderSettings(body);
    return NextResponse.json({ settings: saved });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
