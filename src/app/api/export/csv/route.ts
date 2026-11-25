import { NextRequest, NextResponse } from 'next/server';
import { fallbackLeads } from '@/lib/services/leads-service';
import { mapLeadToPipelineStatus } from '@/lib/services/pipeline-service';
import { Lead } from '@/types/database';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const filterStatus = searchParams.get('status');

    let leads = Array.from(fallbackLeads.values());

    if (filterStatus && filterStatus !== 'all') {
      leads = leads.filter((l) => mapLeadToPipelineStatus(l) === filterStatus);
    }

    const headers = [
      'ID',
      'Business Name',
      'Rating',
      'Review Count',
      'Lead Score (1-10)',
      'Pipeline Status',
      'Website',
      'Website Type',
      'Phone (E.164)',
      'Phone Type',
      'WhatsApp Likely',
      'Postcode',
      'Address',
      'Decision Maker',
      'Outreach Class',
      'Follow-Up Count',
      'Tags',
      'Notes',
      'Last Activity',
    ];

    const rows = leads.map((l) => [
      escapeCsv(l.id),
      escapeCsv(l.name),
      l.rating || '',
      l.review_count || 0,
      l.lead_score || '',
      escapeCsv(mapLeadToPipelineStatus(l)),
      escapeCsv(l.website || ''),
      escapeCsv(l.website_type),
      escapeCsv(l.phone_e164 || ''),
      escapeCsv(l.phone_type),
      l.whatsapp_likely ? 'YES' : 'NO',
      escapeCsv(l.postcode || ''),
      escapeCsv(l.address || ''),
      escapeCsv(l.likely_decision_maker || ''),
      escapeCsv(l.outreach_class || 'individual_or_unknown'),
      l.follow_up_count || 0,
      escapeCsv((l.tags || []).join(', ')),
      escapeCsv(l.notes || ''),
      escapeCsv(l.last_activity_at || l.created_at || ''),
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');

    const filename = `leadscout-uk-export-${new Date().toISOString().slice(0, 10)}.csv`;

    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (err: any) {
    console.error('Error in CSV export:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

function escapeCsv(val: any): string {
  if (val === null || val === undefined) return '""';
  const str = String(val).replace(/"/g, '""');
  return `"${str}"`;
}
