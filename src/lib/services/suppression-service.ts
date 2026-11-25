import { getSupabaseServerClient } from '@/lib/supabase/server';
import { SuppressionRecord, Lead, CompanyRecord, OutreachClass } from '@/types/database';
import { normalizeUKPhone } from '@/lib/uk/phone';

// In-memory fallback suppression list
const fallbackSuppression: Map<string, SuppressionRecord> = new Map();

export async function getSuppressionList(): Promise<SuppressionRecord[]> {
  const supabase = getSupabaseServerClient();
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('suppression_list')
        .select('*')
        .order('created_at', { ascending: false });

      if (data && !error) return data as SuppressionRecord[];
    } catch {
      // fallback
    }
  }
  return Array.from(fallbackSuppression.values());
}

/**
 * Checks whether a given lead is on the suppression list.
 */
export async function isLeadSuppressed(lead: Lead): Promise<boolean> {
  const list = await getSuppressionList();

  const leadDomain = extractDomain(lead.website);
  const leadPhone = lead.phone_e164;
  const leadId = lead.id;

  for (const entry of list) {
    if (entry.lead_id && entry.lead_id === leadId) return true;
    if (entry.phone_e164 && leadPhone && entry.phone_e164 === leadPhone) return true;
    if (entry.domain && leadDomain && entry.domain.toLowerCase() === leadDomain.toLowerCase()) return true;
    if (entry.company_number && lead.company_record?.company_number === entry.company_number) return true;
  }

  return false;
}

/**
 * Adds a lead to the suppression list and marks them as blocked.
 */
export async function addLeadToSuppression(
  lead: Lead,
  reason = 'user_requested',
  notes = 'Manual do-not-contact flag from UI'
): Promise<SuppressionRecord> {
  const domain = extractDomain(lead.website);
  const now = new Date().toISOString();

  const record: SuppressionRecord = {
    id: crypto.randomUUID(),
    lead_id: lead.id,
    business_name: lead.name,
    domain: domain || null,
    phone_e164: lead.phone_e164 || null,
    company_number: lead.company_record?.company_number || null,
    reason,
    notes,
    created_at: now,
  };

  fallbackSuppression.set(record.id, record);

  const supabase = getSupabaseServerClient();
  if (supabase) {
    try {
      await supabase.from('suppression_list').insert({
        id: record.id,
        domain: record.domain,
        phone_e164: record.phone_e164,
        company_number: record.company_number,
        lead_id: record.lead_id,
        reason: record.reason,
        notes: record.notes,
      });

      // Update lead flag in DB
      await supabase
        .from('leads')
        .update({ is_suppressed: true })
        .eq('id', lead.id);
    } catch (err) {
      console.warn('Failed to insert into Supabase suppression_list:', err);
    }
  }

  return record;
}

/**
 * Bulk import numbers or emails into suppression list.
 */
export async function bulkImportSuppression(
  rawInput: string,
  reason = 'bulk_imported',
  notes = 'Imported from blocklist'
): Promise<{ addedCount: number }> {
  const lines = rawInput.split(/[\n,;]+/).map((s) => s.trim()).filter(Boolean);
  let addedCount = 0;

  for (const item of lines) {
    let email: string | null = null;
    let phone: string | null = null;
    let domain: string | null = null;

    if (item.includes('@')) {
      email = item.toLowerCase();
    } else if (/\d/.test(item)) {
      const norm = normalizeUKPhone(item);
      phone = norm.phone_e164 || item;
    } else if (item.includes('.')) {
      domain = item.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0].toLowerCase();
    }

    if (email || phone || domain) {
      const record: SuppressionRecord = {
        id: crypto.randomUUID(),
        email,
        phone_e164: phone,
        domain,
        reason,
        notes,
        created_at: new Date().toISOString(),
      };
      fallbackSuppression.set(record.id, record);
      addedCount++;
    }
  }

  return { addedCount };
}

/**
 * Removes an entry from the suppression list.
 */
export async function removeSuppression(id: string): Promise<boolean> {
  fallbackSuppression.delete(id);
  const supabase = getSupabaseServerClient();
  if (supabase) {
    try {
      await supabase.from('suppression_list').delete().eq('id', id);
    } catch {
      // ignore
    }
  }
  return true;
}

/**
 * Computes outreach_class per PECR / UK rules:
 * - 'corporate': active Ltd, LLP, or PLC with high match confidence
 * - 'individual_or_unknown': sole trader, partnership, or unverified (PECR consent warning)
 * - 'blocked': on suppression list
 */
export function computeOutreachClass(
  lead: Lead,
  companyRecord?: CompanyRecord | null,
  isSuppressed = false
): OutreachClass {
  if (isSuppressed || lead.is_suppressed) {
    return 'blocked';
  }

  if (
    companyRecord &&
    companyRecord.match_confidence === 'high' &&
    companyRecord.status.toLowerCase() === 'active' &&
    (companyRecord.company_type.toLowerCase().includes('ltd') ||
      companyRecord.company_type.toLowerCase().includes('llp') ||
      companyRecord.company_type.toLowerCase().includes('plc'))
  ) {
    return 'corporate';
  }

  return 'individual_or_unknown';
}

function extractDomain(url?: string | null): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url.startsWith('http') ? url : `https://${url}`);
    return parsed.hostname.toLowerCase().replace(/^www\./, '');
  } catch {
    return null;
  }
}
