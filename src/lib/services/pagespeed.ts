/**
 * PageSpeed Insights provider (PSI API v5, mobile strategy).
 * Key is optional — if absent or PSI_DISABLED=true, returns null gracefully.
 * Results are cached in-memory for 7 days (or in Supabase if configured).
 */

import { getSupabaseServerClient } from '@/lib/supabase/server';

export interface PsiResult {
  lead_id: string;
  url: string;
  mobile_score: number | null; // 0-100
  lcp_display: string | null;  // e.g. "3.2 s"
  fetched_at: string;
}

// In-memory cache: url -> PsiResult + timestamp
const psiCache = new Map<string, { result: PsiResult; fetchedAt: number }>();
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export async function getPsiResult(
  url: string,
  leadId: string
): Promise<PsiResult | null> {
  if (process.env.PSI_DISABLED === 'true') return null;

  const apiKey = process.env.PAGESPEED_API_KEY;

  // Check in-memory cache
  const cached = psiCache.get(url);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return cached.result;
  }

  // Check Supabase cache
  const supabase = getSupabaseServerClient();
  if (supabase) {
    try {
      const { data } = await supabase
        .from('psi_results')
        .select('*')
        .eq('url', url)
        .order('fetched_at', { ascending: false })
        .maybeSingle();
      if (data) {
        const ageMs = Date.now() - new Date(data.fetched_at).getTime();
        if (ageMs < CACHE_TTL_MS) {
          const result: PsiResult = {
            lead_id: data.lead_id,
            url: data.url,
            mobile_score: data.mobile_score,
            lcp_display: data.lcp_display,
            fetched_at: data.fetched_at,
          };
          psiCache.set(url, { result, fetchedAt: Date.now() - ageMs });
          return result;
        }
      }
    } catch {
      // Supabase table may not exist yet — carry on
    }
  }

  // Fetch from PSI API
  try {
    const psiUrl = new URL(
      'https://www.googleapis.com/pagespeedonline/v5/runPagespeed'
    );
    psiUrl.searchParams.set('url', url);
    psiUrl.searchParams.set('strategy', 'mobile');
    if (apiKey) psiUrl.searchParams.set('key', apiKey);

    const res = await fetch(psiUrl.toString(), {
      signal: AbortSignal.timeout(30_000),
    });

    if (!res.ok) {
      console.warn(`PSI API returned HTTP ${res.status} for ${url}`);
      return null;
    }

    const json = await res.json();
    const lhCategories = json?.lighthouseResult?.categories;
    const lhAudits = json?.lighthouseResult?.audits;

    const rawScore = lhCategories?.performance?.score;
    const mobile_score =
      typeof rawScore === 'number' ? Math.round(rawScore * 100) : null;
    const lcp_display: string | null =
      lhAudits?.['largest-contentful-paint']?.displayValue ?? null;

    const result: PsiResult = {
      lead_id: leadId,
      url,
      mobile_score,
      lcp_display,
      fetched_at: new Date().toISOString(),
    };

    // Cache in memory
    psiCache.set(url, { result, fetchedAt: Date.now() });

    // Persist to Supabase
    if (supabase) {
      try {
        await supabase.from('psi_results').upsert(
          { lead_id: leadId, url, mobile_score, lcp_display, fetched_at: result.fetched_at },
          { onConflict: 'url' }
        );
      } catch {
        // non-fatal
      }
    }

    return result;
  } catch (err: any) {
    console.warn(`PSI fetch failed for ${url}:`, err.message || err);
    return null;
  }
}
