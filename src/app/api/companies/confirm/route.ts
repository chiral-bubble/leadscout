import { NextRequest, NextResponse } from 'next/server';
import { setConfirmedCompany } from '@/lib/services/companies-house';
import { CompanyRecord } from '@/types/database';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { leadId, companyRecord } = body;
    if (!leadId || !companyRecord) {
      return NextResponse.json({ error: 'leadId and companyRecord are required' }, { status: 400 });
    }

    setConfirmedCompany(leadId, companyRecord as CompanyRecord);
    return NextResponse.json({ success: true, confirmed: companyRecord });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
