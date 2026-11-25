import { NextRequest, NextResponse } from 'next/server';
import { generatePitch } from '@/lib/services/pitch-service';
import { PitchOptions } from '@/types/pitch';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { leadId, options, lead, analysis } = body;

    if (!leadId) {
      return NextResponse.json({ error: 'leadId is required' }, { status: 400 });
    }

    const pitchOptions: PitchOptions = {
      tone: options?.tone || 'friendly',
      channel: options?.channel || 'whatsapp',
      angle: options?.angle,
      opted_in: Boolean(options?.opted_in),
    };

    const storedPitch = await generatePitch(leadId, pitchOptions, lead, analysis);

    return NextResponse.json({ success: true, pitch: storedPitch });
  } catch (err: any) {
    console.error('Error in /api/pitches/generate:', err);
    return NextResponse.json(
      { error: err.message || 'Failed to generate pitch' },
      { status: 500 }
    );
  }
}
