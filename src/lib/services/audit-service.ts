import { getSupabaseServerClient } from '@/lib/supabase/server';
import { WebsiteAudit, AuditStatus, Lead } from '@/types/database';
import { crawlAndAuditWebsite } from '@/lib/audit/playwright-crawler';
import { getLocalSqliteDb } from '@/lib/db/sqlite';

// In-memory audit storage & status tracker
const fallbackAudits: Map<string, WebsiteAudit> = new Map(); // keyed by lead_id
const auditStatuses: Map<string, AuditStatus> = new Map(); // keyed by lead_id

export function getAuditStatus(leadId: string): AuditStatus {
  return auditStatuses.get(leadId) || 'pending';
}

export function setAuditStatus(leadId: string, status: AuditStatus) {
  auditStatuses.set(leadId, status);
}

export async function getAuditForLead(leadId: string): Promise<WebsiteAudit | null> {
  const supabase = getSupabaseServerClient();
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('website_audits')
        .select('*')
        .eq('lead_id', leadId)
        .order('created_at', { ascending: false })
        .maybeSingle();

      if (data && !error) return data as WebsiteAudit;
    } catch {
      // fallback
    }
  }

  if (fallbackAudits.has(leadId)) {
    return fallbackAudits.get(leadId)!;
  }

  // SQLite persistent store
  try {
    const db = getLocalSqliteDb();
    const row = db.prepare('SELECT data FROM audits WHERE lead_id = ? ORDER BY created_at DESC LIMIT 1').get(leadId) as any;
    if (row && row.data) {
      const parsed = JSON.parse(row.data) as WebsiteAudit;
      fallbackAudits.set(leadId, parsed);
      return parsed;
    }
  } catch (err) {
    // ignore
  }

  return null;
}

export async function getAllAuditsForSearch(leadIds: string[]): Promise<Record<string, WebsiteAudit>> {
  const result: Record<string, WebsiteAudit> = {};
  for (const id of leadIds) {
    const audit = await getAuditForLead(id);
    if (audit) {
      result[id] = audit;
    }
  }
  return result;
}

/**
 * Runs a single lead audit and stores the result.
 */
export async function runSingleLeadAudit(lead: Lead): Promise<WebsiteAudit> {
  if (!lead.website || lead.website_type === 'none' || lead.website_type === 'social_only') {
    setAuditStatus(lead.id, 'skipped');
    throw new Error('Lead does not have a testable website (must be own_site or builder)');
  }

  setAuditStatus(lead.id, 'auditing');

  try {
    const audit = await crawlAndAuditWebsite(lead.website, lead.id);

    // Save in-memory
    fallbackAudits.set(lead.id, audit);
    setAuditStatus(lead.id, audit.audit_error ? 'failed' : 'audited');

    // Save to Supabase if configured
    const supabase = getSupabaseServerClient();
    if (supabase) {
      try {
        await supabase.from('website_audits').insert({
          id: audit.id,
          lead_id: audit.lead_id,
          url_tested: audit.url_tested,
          final_url: audit.final_url,
          http_status: audit.http_status,
          uses_https: audit.uses_https,
          ssl_valid: audit.ssl_valid,
          load_time_ms: audit.load_time_ms,
          mobile_responsive: audit.mobile_friendly,
          has_contact_form: audit.has_contact_form,
          has_online_booking: audit.has_online_booking,
          detected_technologies: [audit.detected_platform, ...(audit.booking_providers || [])],
          raw_seo_metrics: {
            title: audit.page_title,
            meta_description: audit.meta_description,
            h1: audit.h1_text,
            copyright_year: audit.copyright_year,
            lcp_ms: audit.largest_contentful_paint_ms,
          },
          broken_links_found: audit.broken_links_count,
          error_log: audit.audit_error,
        });

        // Update lead status
        await supabase
          .from('leads')
          .update({
            status: audit.audit_error ? 'discovered' : 'audited',
          })
          .eq('id', lead.id);
      } catch (dbErr) {
        console.warn('Could not persist audit to Supabase, stored in memory:', dbErr);
      }
    }

    // Persist to local SQLite
    try {
      const db = getLocalSqliteDb();
      db.prepare(`
        INSERT OR REPLACE INTO audits (id, lead_id, data, created_at)
        VALUES (?, ?, ?, ?)
      `).run(audit.id, audit.lead_id, JSON.stringify(audit), audit.created_at);
    } catch (sqlErr) {
      console.warn('Could not persist audit to SQLite:', sqlErr);
    }

    return audit;
  } catch (err: any) {
    setAuditStatus(lead.id, 'failed');
    throw err;
  }
}

/**
 * Runs batch audits sequentially without crashing on failures.
 */
export async function runBatchAudits(
  leads: Lead[],
  onProgress?: (leadId: string, audit: WebsiteAudit | null) => void
): Promise<{ auditedCount: number; failedCount: number; skippedCount: number }> {
  let auditedCount = 0;
  let failedCount = 0;
  let skippedCount = 0;

  for (const lead of leads) {
    if (!lead.website || (lead.website_type !== 'own_site' && lead.website_type !== 'builder')) {
      skippedCount++;
      setAuditStatus(lead.id, 'skipped');
      if (onProgress) onProgress(lead.id, null);
      continue;
    }

    try {
      const audit = await runSingleLeadAudit(lead);
      if (audit.audit_error) {
        failedCount++;
      } else {
        auditedCount++;
      }
      if (onProgress) onProgress(lead.id, audit);
    } catch (err) {
      failedCount++;
      setAuditStatus(lead.id, 'failed');
      if (onProgress) onProgress(lead.id, null);
    }

    // Small delay between domain visits
    await new Promise((res) => setTimeout(res, 500));
  }

  return { auditedCount, failedCount, skippedCount };
}
