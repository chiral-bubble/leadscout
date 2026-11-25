import { NextResponse } from 'next/server';
import { getAuditForLead, getAllAuditsForSearch, runSingleLeadAudit, getAuditStatus } from '@/lib/services/audit-service';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const leadId = searchParams.get('leadId');
    const leadIds = searchParams.get('leadIds');

    if (leadId) {
      const audit = await getAuditForLead(leadId);
      const status = getAuditStatus(leadId);
      return NextResponse.json({ audit, status });
    }

    if (leadIds) {
      const ids = leadIds.split(',').filter(Boolean);
      const audits = await getAllAuditsForSearch(ids);
      const statuses: Record<string, string> = {};
      ids.forEach((id) => {
        statuses[id] = getAuditStatus(id);
      });
      return NextResponse.json({ audits, statuses });
    }

    return NextResponse.json({ error: 'leadId or leadIds parameter is required' }, { status: 400 });
  } catch (err: any) {
    console.error('Error in /api/audits GET:', err);
    return NextResponse.json({ error: err.message || 'Failed to fetch audit' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { lead } = await request.json();

    if (!lead || !lead.id || !lead.website) {
      return NextResponse.json({ error: 'Valid lead with website is required' }, { status: 400 });
    }

    const audit = await runSingleLeadAudit(lead);
    return NextResponse.json({
      success: true,
      audit,
      status: audit.audit_error ? 'failed' : 'audited',
    });
  } catch (err: any) {
    console.error('Error in /api/audits POST:', err);
    return NextResponse.json(
      { error: err.message || 'Audit execution failed' },
      { status: 500 }
    );
  }
}
