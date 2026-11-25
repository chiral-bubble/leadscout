import { NextResponse } from 'next/server';
import { matchCompaniesHouse, searchCompaniesHouseCandidates } from '@/lib/services/companies-house';
import { computeOutreachClass, isLeadSuppressed } from '@/lib/services/suppression-service';
import { Lead } from '@/types/database';

export async function POST(request: Request) {
  try {
    const { lead, leads, withCandidates } = await request.json();

    // 1. Single lead lookup
    if (lead) {
      if (withCandidates) {
        const searchRes = await searchCompaniesHouseCandidates(lead.name, lead.postcode, lead.id);
        const suppressed = await isLeadSuppressed(lead);
        const outreachClass = computeOutreachClass(lead, searchRes.selectedMatch, suppressed);
        const decisionMaker = searchRes.selectedMatch?.officers?.[0] || null;

        return NextResponse.json({
          success: true,
          company: searchRes.selectedMatch,
          candidates: searchRes.candidates,
          confidence: searchRes.confidence,
          outreachClass,
          decisionMaker,
          isSuppressed: suppressed,
        });
      }

      const company = await matchCompaniesHouse(lead.name, lead.postcode, lead.id);
      const suppressed = await isLeadSuppressed(lead);
      const outreachClass = computeOutreachClass(lead, company, suppressed);
      const decisionMaker = company?.officers?.[0] || null;

      return NextResponse.json({
        success: true,
        company,
        outreachClass,
        decisionMaker,
        isSuppressed: suppressed,
      });
    }

    // 2. Batch leads lookup
    if (Array.isArray(leads)) {
      const results: Record<
        string,
        {
          company: any;
          outreachClass: string;
          decisionMaker: string | null;
          isSuppressed: boolean;
        }
      > = {};

      for (const item of leads as Lead[]) {
        const company = await matchCompaniesHouse(item.name, item.postcode, item.id);
        const suppressed = await isLeadSuppressed(item);
        const outreachClass = computeOutreachClass(item, company, suppressed);
        const decisionMaker = company?.officers?.[0] || null;

        results[item.id] = {
          company,
          outreachClass,
          decisionMaker,
          isSuppressed: suppressed,
        };
      }

      return NextResponse.json({ success: true, results });
    }

    return NextResponse.json({ error: 'lead or leads array is required' }, { status: 400 });
  } catch (err: any) {
    console.error('Error in /api/companies POST:', err);
    return NextResponse.json({ error: err.message || 'Company lookup failed' }, { status: 500 });
  }
}
