import { getLlmProvider } from '@/lib/llm';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { Lead, WebsiteAudit, CompanyRecord, OutreachClass } from '@/types/database';
import { LeadAnalysis, LeadAnalysisSchema, StoredAnalysis } from '@/types/analysis';
import { ANALYZE_SYSTEM_PROMPT } from '@/prompts/analyze';
import { getAuditForLead } from '@/lib/services/audit-service';
import { matchCompaniesHouse, searchCompaniesHouseCandidates } from '@/lib/services/companies-house';
import { computeOutreachClass, isLeadSuppressed } from '@/lib/services/suppression-service';
import { enrichLeadSocials, getSocialEnrichmentForLead } from '@/lib/services/social-enrichment';
import { SocialEnrichmentResult } from '@/types/social';
import { getPsiResult, PsiResult } from '@/lib/services/pagespeed';
import { getLocalSqliteDb } from '@/lib/db/sqlite';

// In-memory cache of analyses
const fallbackAnalyses: Map<string, StoredAnalysis> = new Map(); // keyed by lead_id

export async function getAnalysisForLead(leadId: string): Promise<StoredAnalysis | null> {
  const supabase = getSupabaseServerClient();
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('analyses')
        .select('*')
        .eq('lead_id', leadId)
        .order('created_at', { ascending: false })
        .maybeSingle();

      if (data && !error) {
        return {
          id: data.id,
          lead_id: data.lead_id,
          model_used: data.model_used,
          lead_score: data.opportunity_score,
          data: data.key_problems?._raw_analysis || (data as any),
          created_at: data.created_at,
        };
      }
    } catch {
      // fallback
    }
  }

  if (fallbackAnalyses.has(leadId)) {
    return fallbackAnalyses.get(leadId)!;
  }

  // SQLite persistent store
  try {
    const db = getLocalSqliteDb();
    const row = db.prepare('SELECT * FROM analyses WHERE lead_id = ? ORDER BY created_at DESC LIMIT 1').get(leadId) as any;
    if (row && row.data) {
      const parsed: StoredAnalysis = {
        id: row.id,
        lead_id: row.lead_id,
        model_used: row.model_used,
        lead_score: row.lead_score,
        data: JSON.parse(row.data),
        created_at: row.created_at,
      };
      fallbackAnalyses.set(leadId, parsed);
      return parsed;
    }
  } catch (err) {
    // ignore
  }

  return null;
}

export async function getAllAnalysesForLeads(leadIds: string[]): Promise<Record<string, StoredAnalysis>> {
  const map: Record<string, StoredAnalysis> = {};
  for (const id of leadIds) {
    const analysis = await getAnalysisForLead(id);
    if (analysis) {
      map[id] = analysis;
    }
  }
  return map;
}

/**
 * Gathers all multi-source intelligence for a lead and runs AI analysis.
 */
export async function analyzeLead(
  lead: Lead,
  customAudit?: WebsiteAudit | null,
  customCompany?: CompanyRecord | null,
  customSocial?: SocialEnrichmentResult | null,
  customPsi?: PsiResult | null
): Promise<StoredAnalysis> {
  // 1. Gather all data sources
  const audit = customAudit || (await getAuditForLead(lead.id));
  const company = customCompany || (await matchCompaniesHouse(lead.name, lead.postcode, lead.id));
  const isSupp = await isLeadSuppressed(lead);
  const outreachClass: OutreachClass = computeOutreachClass(lead, company, isSupp);

  // Social enrichment
  const socialEnrichment =
    customSocial ||
    getSocialEnrichmentForLead(lead.id) ||
    (audit?.social_links ? await enrichLeadSocials(lead.id, audit.social_links as any) : null);

  // PageSpeed Insights (PSI)
  const psi = customPsi !== undefined ? customPsi : (audit?.final_url || lead.website ? await getPsiResult(audit?.final_url || lead.website!, lead.id) : null);

  // Greeting name selection: strictly active director from Companies House if confirmed by user
  let greetingName: string | null = null;
  let greetingSource: 'companies_house_officer' | 'page_current_staff' | 'unknown' = 'unknown';
  if (company?.is_confirmed && company.officers && company.officers.length > 0 && company.officers[0] !== 'unknown') {
    greetingName = company.officers[0];
    greetingSource = 'companies_house_officer';
  }

  const pagesCount = audit?.pages_visited?.length || (audit ? 1 : 0);

  const inputPayload = {
    google_business_data: {
      name: lead.name,
      rating: lead.rating,
      review_count: lead.review_count,
      categories: lead.categories,
      address: lead.address,
      postcode: lead.postcode,
      business_status: lead.business_status || 'OPERATIONAL',
      google_maps_url: lead.google_maps_url,
    },
    website_audit: audit
      ? {
          url_tested: audit.url_tested,
          final_url: audit.final_url,
          http_status: audit.http_status,
          uses_https: audit.uses_https,
          ttfb_ms: audit.ttfb_ms,
          load_time_ms: audit.ttfb_ms,
          full_load_ms: audit.full_load_ms,
          local_timing_disclaimer: "measured from audit machine, unreliable - NEVER use in pitches or to claim slow",
          mobile_friendly: audit.mobile_friendly,
          mobile_issues: audit.mobile_issues,
          detected_platform: audit.detected_platform,
          copyright_year: audit.copyright_year,
          is_outdated_copyright: audit.is_outdated_copyright,
          has_contact_form: audit.has_contact_form,
          has_online_booking: audit.has_online_booking,
          booking_providers: audit.booking_providers,
          has_whatsapp_link: audit.has_whatsapp_link,
          has_live_chat: audit.has_live_chat,
          has_ecommerce: audit.has_ecommerce,
          has_cookie_banner: audit.has_cookie_banner,
          broken_links_count: audit.broken_links_count,
          homepage_visible_text_excerpt: audit.text_excerpt.slice(0, 3000),
          pages_visited: audit.pages_visited || [audit.url_tested],
          pages_visited_count: pagesCount,
        }
      : null,
    psi_result: psi
      ? {
          mobile_score: psi.mobile_score,
          lcp_display: psi.lcp_display,
          verified: true,
          citation: `Google PageSpeed gives your mobile site ${psi.mobile_score}/100`,
        }
      : {
          mobile_score: null,
          lcp_display: null,
          verified: false,
          citation: "unverified",
        },
    companies_house_data: company
      ? {
          company_number: company.company_number,
          legal_name: company.legal_name,
          company_type: company.company_type,
          status: company.status,
          incorporation_date: company.incorporation_date,
          sic_codes: company.sic_codes,
          officers: company.officers,
          match_confidence: company.match_confidence,
        }
      : null,
    greeting_info: {
      suggested_greeting_name: greetingName,
      source: greetingSource,
    },
    social_links: audit?.social_links || {},
    social: socialEnrichment,
    outreach_class: outreachClass,
  };

  const llmProvider = getLlmProvider();
  const dataMode = process.env.DATA_MODE || 'live';
  let validatedAnalysis: LeadAnalysis;

  try {
    validatedAnalysis = await llmProvider.generateJson(
      ANALYZE_SYSTEM_PROMPT,
      inputPayload,
      LeadAnalysisSchema
    );
  } catch (err: any) {
    if (dataMode === 'live') {
      throw new Error(`AI Analysis failed (${llmProvider.name}): ${err.message}`);
    }
    validatedAnalysis = generateDeterministicUKAnalysis(inputPayload, outreachClass, lead);
  }

  // Filter out any cookie banner pitchable weakness and enforce absence rule
  validatedAnalysis.weaknesses = validatedAnalysis.weaknesses.filter(
    (w) => !w.issue.toLowerCase().includes('cookie') && !w.evidence.toLowerCase().includes('cookie')
  );

  // If pages visited < 3, mark absence claims as 'not_verified'
  if (pagesCount < 3) {
    validatedAnalysis.weaknesses = validatedAnalysis.weaknesses.map((w) => {
      const lower = (w.issue + ' ' + w.evidence).toLowerCase();
      if (lower.includes('no booking') || lower.includes('no contact form') || lower.includes('no social')) {
        return {
          ...w,
          severity: 'not_verified' as const,
          evidence: `${w.evidence} (only ${pagesCount} page visited; not verified)`,
          verified_on_pages: pagesCount,
        };
      }
      return { ...w, verified_on_pages: pagesCount };
    });
  }

  // Ensure greeting fields
  if (!validatedAnalysis.greeting_name) {
    validatedAnalysis.greeting_name = greetingName;
    validatedAnalysis.greeting_name_source = greetingSource;
  }

  const stored: StoredAnalysis = {
    id: crypto.randomUUID(),
    lead_id: lead.id,
    model_used: llmProvider.name,
    lead_score: validatedAnalysis.lead_score,
    data: validatedAnalysis,
    created_at: new Date().toISOString(),
  };

  // Cache in-memory
  fallbackAnalyses.set(lead.id, stored);

  // Store in Supabase if configured
  const supabase = getSupabaseServerClient();
  if (supabase) {
    try {
      await supabase.from('analyses').insert({
        id: stored.id,
        lead_id: lead.id,
        model_used: llmProvider.name,
        opportunity_score: validatedAnalysis.lead_score * 10,
        key_problems: { _raw_analysis: validatedAnalysis },
        recommended_solutions: validatedAnalysis.opportunities.map((o) => o.service),
        estimated_project_value_gbp: parseEstimatedValue(validatedAnalysis.opportunities[0]?.estimated_value_gbp_range),
        estimated_roi_angle: validatedAnalysis.opportunities[0]?.why || '',
        decision_maker_guess: validatedAnalysis.decision_maker_guess,
        summary: validatedAnalysis.business_summary,
      });

      await supabase
        .from('leads')
        .update({ status: 'analysed' })
        .eq('id', lead.id);
    } catch (err) {
      console.warn('Could not persist analysis to Supabase:', err);
    }
  }

  // Store in SQLite
  try {
    const db = getLocalSqliteDb();
    db.prepare(`
      INSERT OR REPLACE INTO analyses (id, lead_id, model_used, lead_score, data, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(stored.id, stored.lead_id, stored.model_used, stored.lead_score, JSON.stringify(stored.data), stored.created_at);
  } catch (sqlErr) {
    console.warn('Could not persist analysis to SQLite:', sqlErr);
  }

  return stored;
}

function parseEstimatedValue(rangeStr?: string): number | null {
  if (!rangeStr) return null;
  const match = rangeStr.match(/£([0-9,]+)/);
  if (match) {
    return parseInt(match[1].replace(/,/g, ''), 10);
  }
  return null;
}

/**
 * Deterministic fallback
 */
export function generateDeterministicUKAnalysis(
  payload: any,
  outreachClass: OutreachClass,
  lead: any
): LeadAnalysis {
  const audit = payload.website_audit;
  const company = payload.companies_house_data;
  const google = payload.google_business_data || lead;
  const psi = payload.psi_result;

  const weaknesses: Array<{ issue: string; evidence: string; severity: 'low' | 'medium' | 'high' | 'not_verified'; verified_on_pages: number }> = [];
  const opportunities: Array<{ service: string; why: string; estimated_value_gbp_range: string; confidence: 'low' | 'medium' | 'high' }> = [];
  const personalisationHooks: Array<{ hook: string; source: string; snippet: string }> = [];

  const pagesCount = audit?.pages_visited_count || 1;

  if (google.rating !== null && google.rating !== undefined && google.review_count > 0) {
    personalisationHooks.push({
      hook: `Rated ${google.rating.toFixed(1)} stars across ${google.review_count} reviews`,
      source: 'google_business.rating',
      snippet: `${google.rating} (${google.review_count} reviews)`,
    });
  }
  if (google.address) {
    personalisationHooks.push({
      hook: `Based at ${google.address}`,
      source: 'google_business.address',
      snippet: google.address,
    });
  }

  let websiteQuality: 'none' | 'poor' | 'average' | 'good' = 'none';
  const digitalEvidence: string[] = [];

  if (!audit) {
    websiteQuality = 'none';
    weaknesses.push({
      issue: 'Missing dedicated website',
      evidence: 'No website URL published on Google Business Profile',
      severity: 'high',
      verified_on_pages: 0,
    });
    opportunities.push({
      service: 'new_website',
      why: 'Establish dedicated web presence to capture local UK search queries.',
      estimated_value_gbp_range: '£800-£1,800',
      confidence: 'high',
    });
    digitalEvidence.push('No website URL present');
  } else {
    if (audit.detected_platform === 'WordPress') {
      websiteQuality = 'average';
      digitalEvidence.push('WordPress installation detected');
      personalisationHooks.push({
        hook: 'WordPress website detected',
        source: 'audit.detected_platform',
        snippet: 'WordPress',
      });
    } else {
      websiteQuality = audit.mobile_friendly && audit.uses_https ? 'good' : 'poor';
      digitalEvidence.push('Custom website domain');
    }

    if (audit.is_outdated_copyright && audit.copyright_year) {
      weaknesses.push({
        issue: 'Outdated website copyright',
        evidence: `Footer displays copyright ${audit.copyright_year}`,
        severity: 'medium',
        verified_on_pages: pagesCount,
      });
    }

    if (!audit.mobile_friendly) {
      weaknesses.push({
        issue: 'Mobile viewport bottlenecks',
        evidence: audit.mobile_issues.join(', '),
        severity: 'high',
        verified_on_pages: pagesCount,
      });
    }

    // Absence check: only allowed if pagesCount >= 3
    if (!audit.has_online_booking) {
      weaknesses.push({
        issue: 'No online booking integration',
        evidence: pagesCount >= 3 ? 'No scheduling widgets detected across inspected pages' : 'Not verified on single page',
        severity: pagesCount >= 3 ? 'medium' : 'not_verified',
        verified_on_pages: pagesCount,
      });
      opportunities.push({
        service: 'online_booking_system',
        why: 'Enable customers to book appointments directly 24/7.',
        estimated_value_gbp_range: '£600-£1,400',
        confidence: 'high',
      });
    }
  }

  // PSI speed evidence
  if (psi?.verified && psi.mobile_score !== null) {
    if (psi.mobile_score < 50) {
      weaknesses.push({
        issue: 'Low mobile page performance score',
        evidence: `Google PageSpeed gives your mobile site ${psi.mobile_score}/100`,
        severity: 'high',
        verified_on_pages: 1,
      });
    }
  }

  const directorName = company?.officers?.[0] || 'unknown';
  if (directorName !== 'unknown') {
    personalisationHooks.push({
      hook: `Director: ${directorName}`,
      source: 'companies_house.officers',
      snippet: directorName,
    });
  }

  const primaryService = opportunities[0]?.service || 'website_redesign';

  return {
    business_summary: `${google.name} is a local UK business based in ${google.address || 'the UK'}. Customer rating is ${
      google.rating ? `${google.rating} (${google.review_count} reviews)` : 'unknown'
    }.`,
    business_type_guess: company?.company_type ? `${company.company_type.toUpperCase()} Company` : 'Independent Business',
    digital_presence: {
      website_quality: websiteQuality,
      social_presence: 'none',
      booking_or_ordering_online: Boolean(audit?.has_online_booking),
      evidence: digitalEvidence,
    },
    weaknesses,
    opportunities,
    recommended_primary_service: primaryService,
    recommended_secondary_services: opportunities.slice(1, 3).map((o) => o.service),
    lead_score: 7,
    score_reasoning: 'Verified local business with modernisation opportunities.',
    best_contact_channel: audit?.contact_candidates?.emails?.length > 0 ? 'email' : 'contact_form',
    channel_reasoning: 'Appropriate for diagnostic website review.',
    personalisation_hooks: personalisationHooks.slice(0, 4),
    decision_maker_guess: directorName,
    greeting_name: directorName !== 'unknown' ? directorName : null,
    greeting_name_source: directorName !== 'unknown' ? 'companies_house_officer' : 'unknown',
    risks_or_red_flags: [],
    outreach_class: outreachClass,
    data_gaps: [],
  };
}
