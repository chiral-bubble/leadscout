import { NextRequest, NextResponse } from 'next/server';
import {
  updateLeadPipelineStatus,
  mapLeadToPipelineStatus,
  getDashboardMetrics,
} from '@/lib/services/pipeline-service';
import { fallbackLeads } from '@/lib/services/leads-service';
import { PipelineStatus } from '@/types/pipeline';

export async function GET() {
  try {
    const allLeads = Array.from(fallbackLeads.values()).map((lead) => ({
      ...lead,
      pipeline_status: mapLeadToPipelineStatus(lead),
    }));

    const metrics = await getDashboardMetrics();

    return NextResponse.json({ success: true, leads: allLeads, metrics });
  } catch (err: any) {
    console.error('Error fetching pipeline:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { leadId, status } = body;

    if (!leadId || !status) {
      return NextResponse.json({ error: 'leadId and status are required' }, { status: 400 });
    }

    const updatedLead = await updateLeadPipelineStatus(leadId, status as PipelineStatus);
    const metrics = await getDashboardMetrics();

    return NextResponse.json({ success: true, lead: updatedLead, metrics });
  } catch (err: any) {
    console.error('Error updating pipeline status:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
