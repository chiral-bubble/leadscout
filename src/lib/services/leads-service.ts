import { getSupabaseServerClient } from '@/lib/supabase/server';
import { Lead, SearchRecord } from '@/types/database';
import { estimateSearchCostGBP } from '@/lib/uk/pricing';
import { getLocalSqliteDb } from '@/lib/db/sqlite';

// In-memory fallback stores for local testing when Supabase is not connected
export const fallbackSearches: SearchRecord[] = [];
export const fallbackLeads: Map<string, Lead> = new Map(); // keyed by place_id

function inferLeadSource(lead: Partial<Lead>): string {
  if (lead.source) return lead.source;
  if (lead.place_id?.startsWith('osm:')) return 'osm';
  if (lead.google_maps_url) return 'google_maps';
  if (lead.website_type === 'social_only') return 'facebook';
  return 'website';
}

function persistLeadToSqlite(lead: Lead): void {
  try {
    const db = getLocalSqliteDb();
    db.prepare(`
      INSERT OR REPLACE INTO leads (
        id, place_id, source, name, selected_name, website_name, address, postcode,
        phone_raw, phone_e164, phone_type, whatsapp_likely, website, has_website,
        website_type, rating, review_count, categories, opening_hours, google_maps_url,
        business_status, status, is_suppressed, audit_status, lead_score, outreach_class,
        pipeline_status, notes, manual_notes, tags, next_follow_up_date, follow_up_count, last_activity_at,
        has_contact_route, created_at, updated_at
      ) VALUES (
        ?, ?, ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?, ?,
        ?, ?, ?
      )
    `).run(
      lead.id,
      lead.place_id,
      inferLeadSource(lead),
      lead.name,
      lead.selected_name || null,
      lead.website_name || null,
      lead.address || null,
      lead.postcode || null,
      lead.phone_raw || null,
      lead.phone_e164 || null,
      lead.phone_type || null,
      lead.whatsapp_likely ? 1 : 0,
      lead.website || null,
      lead.has_website ? 1 : 0,
      lead.website_type || null,
      lead.rating ?? null,
      lead.review_count ?? null,
      JSON.stringify(lead.categories || []),
      lead.opening_hours ? JSON.stringify(lead.opening_hours) : null,
      lead.google_maps_url || null,
      lead.business_status || null,
      lead.status || 'discovered',
      lead.is_suppressed ? 1 : 0,
      lead.audit_status || null,
      lead.lead_score ?? null,
      lead.outreach_class || null,
      lead.pipeline_status || null,
      lead.notes || null,
      lead.manual_notes || null,
      lead.tags ? JSON.stringify(lead.tags) : null,
      lead.next_follow_up_date || null,
      lead.follow_up_count || 0,
      lead.last_activity_at || null,
      lead.has_contact_route ? 1 : 0,
      lead.created_at || new Date().toISOString(),
      lead.updated_at || new Date().toISOString()
    );
  } catch (err) {
    console.warn('Failed to persist lead to SQLite:', err);
  }
}

export interface SaveSearchResults {
  search: SearchRecord;
  leads: Lead[];
  newLeadsCount: number;
  duplicateLeadsCount: number;
}

export async function saveSearchAndLeads(
  params: {
    niche: string;
    location: string;
    radiusMiles: number;
    maxResults: number;
  },
  discoveredLeads: Omit<Lead, 'id' | 'created_at' | 'updated_at'>[]
): Promise<SaveSearchResults> {
  const supabase = getSupabaseServerClient();
  const searchId = crypto.randomUUID();
  const now = new Date().toISOString();
  const estimatedCost = estimateSearchCostGBP(params.maxResults);

  const searchRecord: SearchRecord = {
    id: searchId,
    niche: params.niche,
    location: params.location,
    radius_miles: params.radiusMiles,
    max_results: params.maxResults,
    results_count: discoveredLeads.length,
    estimated_api_cost_gbp: estimatedCost,
    status: 'completed',
    created_at: now,
  };

  if (!supabase) {
    // In-memory persistence
    fallbackSearches.unshift(searchRecord);

    let newCount = 0;
    let duplicateCount = 0;
    const savedLeads: Lead[] = [];

    for (const item of discoveredLeads) {
      const existing = fallbackLeads.get(item.place_id);
      if (existing) {
        // De-duplicate: link to latest search while preserving existing data
        duplicateCount++;
        const updated: Lead = {
          ...existing,
          ...item,
          id: existing.id,
          search_id: searchId,
          updated_at: now,
        };
        fallbackLeads.set(item.place_id, updated);
        persistLeadToSqlite(updated);
        savedLeads.push(updated);
      } else {
        newCount++;
        const newLead: Lead = {
          ...item,
          id: crypto.randomUUID(),
          search_id: searchId,
          created_at: now,
          updated_at: now,
        };
        fallbackLeads.set(item.place_id, newLead);
        persistLeadToSqlite(newLead);
        savedLeads.push(newLead);
      }
    }

    return {
      search: searchRecord,
      leads: savedLeads,
      newLeadsCount: newCount,
      duplicateLeadsCount: duplicateCount,
    };
  }

  // Supabase Persistence
  try {
    // 1. Insert search record
    await supabase.from('searches').insert({
      id: searchId,
      niche: params.niche,
      location: params.location,
      radius_miles: params.radiusMiles,
      max_results: params.maxResults,
      results_count: discoveredLeads.length,
      estimated_api_cost_gbp: estimatedCost,
      status: 'completed',
    });

    // 2. Query suppression list to check for any suppressed entries
    const { data: suppressionRows } = await supabase.from('suppression_list').select('domain, email, phone_e164');
    const suppressedPhones = new Set((suppressionRows || []).map(r => r.phone_e164).filter(Boolean));

    let newCount = 0;
    let duplicateCount = 0;
    const finalLeads: Lead[] = [];

    // 3. Upsert leads de-duplicating by place_id
    for (const leadData of discoveredLeads) {
      const isSuppressed = leadData.phone_e164 ? suppressedPhones.has(leadData.phone_e164) : false;

      const { data: existingLead } = await supabase
        .from('leads')
        .select('id, status, is_suppressed')
        .eq('place_id', leadData.place_id)
        .maybeSingle();

      if (existingLead) {
        duplicateCount++;
        const { data: updated } = await supabase
          .from('leads')
          .update({
            search_id: searchId,
            name: leadData.name,
            address: leadData.address,
            postcode: leadData.postcode,
            phone_raw: leadData.phone_raw,
            phone_e164: leadData.phone_e164,
            phone_type: leadData.phone_type,
            whatsapp_likely: leadData.whatsapp_likely,
            website: leadData.website,
            has_website: leadData.has_website,
            website_type: leadData.website_type,
            rating: leadData.rating,
            review_count: leadData.review_count,
            categories: leadData.categories,
            opening_hours: leadData.opening_hours,
            google_maps_url: leadData.google_maps_url,
            business_status: leadData.business_status,
            is_suppressed: existingLead.is_suppressed || isSuppressed,
            updated_at: now,
          })
          .eq('place_id', leadData.place_id)
          .select()
          .single();

        if (updated) finalLeads.push(updated as Lead);
      } else {
        newCount++;
        const { data: created } = await supabase
          .from('leads')
          .insert({
            search_id: searchId,
            place_id: leadData.place_id,
            name: leadData.name,
            address: leadData.address,
            postcode: leadData.postcode,
            phone_raw: leadData.phone_raw,
            phone_e164: leadData.phone_e164,
            phone_type: leadData.phone_type,
            whatsapp_likely: leadData.whatsapp_likely,
            website: leadData.website,
            has_website: leadData.has_website,
            website_type: leadData.website_type,
            rating: leadData.rating,
            review_count: leadData.review_count,
            categories: leadData.categories,
            opening_hours: leadData.opening_hours,
            google_maps_url: leadData.google_maps_url,
            business_status: leadData.business_status,
            status: 'discovered',
            is_suppressed: isSuppressed,
          })
          .select()
          .single();

        if (created) finalLeads.push(created as Lead);
      }
    }

    return {
      search: searchRecord,
      leads: finalLeads,
      newLeadsCount: newCount,
      duplicateLeadsCount: duplicateCount,
    };
  } catch (error: any) {
    console.error('Supabase save error:', error);
    // Return in-memory fallback on database error
    return {
      search: searchRecord,
      leads: discoveredLeads.map((l, i) => ({
        ...l,
        id: `mock-id-${i}`,
        search_id: searchId,
        created_at: now,
        updated_at: now,
      })),
      newLeadsCount: discoveredLeads.length,
      duplicateLeadsCount: 0,
    };
  }
}

export async function getSearchHistory(): Promise<SearchRecord[]> {
  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return fallbackSearches;
  }

  try {
    const { data, error } = await supabase
      .from('searches')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(30);

    if (error || !data) return fallbackSearches;
    return data as SearchRecord[];
  } catch {
    return fallbackSearches;
  }
}

export async function getLeadById(leadId: string): Promise<Lead | null> {
  const supabase = getSupabaseServerClient();
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('leads')
        .select('*')
        .eq('id', leadId)
        .maybeSingle();

      if (data && !error) {
        return data as Lead;
      }
    } catch {
      // fallback
    }
  }

  const inMem = Array.from(fallbackLeads.values()).find((l) => l.id === leadId);
  if (inMem) return inMem;

  // SQLite persistent store
  try {
    const db = getLocalSqliteDb();
    const row = db.prepare('SELECT * FROM leads WHERE id = ?').get(leadId) as any;
    if (row) {
      const lead: Lead = {
        id: row.id,
        place_id: row.place_id,
        source: row.source || (row.place_id?.startsWith('osm:') ? 'osm' : row.google_maps_url ? 'google_maps' : 'website'),
        name: row.name,
        selected_name: row.selected_name,
        website_name: row.website_name,
        address: row.address,
        postcode: row.postcode,
        phone_raw: row.phone_raw,
        phone_e164: row.phone_e164,
        phone_type: row.phone_type,
        whatsapp_likely: Boolean(row.whatsapp_likely),
        website: row.website,
        has_website: Boolean(row.has_website),
        website_type: row.website_type,
        rating: row.rating,
        review_count: row.review_count,
        categories: JSON.parse(row.categories || '[]'),
        opening_hours: row.opening_hours ? JSON.parse(row.opening_hours) : null,
        google_maps_url: row.google_maps_url,
        business_status: row.business_status,
        status: row.status,
        is_suppressed: Boolean(row.is_suppressed),
        audit_status: row.audit_status,
        lead_score: row.lead_score,
        outreach_class: row.outreach_class,
        pipeline_status: row.pipeline_status,
        notes: row.notes,
        manual_notes: row.manual_notes || null,
        tags: row.tags ? JSON.parse(row.tags) : [],
        next_follow_up_date: row.next_follow_up_date,
        follow_up_count: row.follow_up_count,
        last_activity_at: row.last_activity_at,
        has_contact_route: Boolean(row.has_contact_route),
        created_at: row.created_at,
        updated_at: row.updated_at,
      };
      fallbackLeads.set(lead.place_id, lead);
      return lead;
    }
  } catch (err) {
    // ignore
  }

  return null;
}

export async function updateLeadManualNotes(leadId: string, manualNotes: string): Promise<Lead | null> {
  const now = new Date().toISOString();
  const supabase = getSupabaseServerClient();
  if (supabase) {
    try {
      await supabase
        .from('leads')
        .update({ manual_notes: manualNotes, updated_at: now })
        .eq('id', leadId);
    } catch (err) {
      console.warn('Supabase manual_notes update failed:', err);
    }
  }

  // Update SQLite
  try {
    const db = getLocalSqliteDb();
    db.prepare('UPDATE leads SET manual_notes = ?, updated_at = ? WHERE id = ?').run(manualNotes, now, leadId);
  } catch (err) {
    console.warn('SQLite manual_notes update failed:', err);
  }

  // Update in-memory map if present
  for (const [k, l] of fallbackLeads.entries()) {
    if (l.id === leadId) {
      const updated = { ...l, manual_notes: manualNotes, updated_at: now };
      fallbackLeads.set(k, updated);
      return updated;
    }
  }

  return getLeadById(leadId);
}

export async function getLeadsBySearchId(searchId: string): Promise<Lead[]> {
  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return Array.from(fallbackLeads.values()).filter(l => l.search_id === searchId);
  }

  try {
    const { data, error } = await supabase
      .from('leads')
      .select('*')
      .eq('search_id', searchId)
      .order('rating', { ascending: false, nullsFirst: false });

    if (error || !data) {
      return Array.from(fallbackLeads.values()).filter(l => l.search_id === searchId);
    }
    return data as Lead[];
  } catch {
    return Array.from(fallbackLeads.values()).filter(l => l.search_id === searchId);
  }
}

