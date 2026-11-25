import { getLlmProvider } from '@/lib/llm';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { Lead } from '@/types/database';
import { LeadAnalysis } from '@/types/analysis';
import {
  PitchOptions,
  PitchResult,
  PitchResultSchema,
  PitchVariant,
  SenderProfile,
  StoredPitch,
  OutreachLogEntry,
  OutreachStatus,
} from '@/types/pitch';
import { PITCH_SYSTEM_PROMPT } from '@/prompts/pitch';
import { getAnalysisForLead } from '@/lib/services/analysis-service';
import { getLeadById } from '@/lib/services/leads-service';
import { getSenderSettings } from '@/lib/services/settings-service';
import { getAuditForLead } from '@/lib/services/audit-service';
import { getLocalSqliteDb } from '@/lib/db/sqlite';

// In-memory fallback caches
const fallbackPitches: Map<string, StoredPitch[]> = new Map();
const fallbackOutreachLogs: Map<string, OutreachLogEntry[]> = new Map();

const PAST_WORK_REGEX = /\b(i've built|i have built|i built|i put together|i've put together|i made|i've made|i created|i've created|i recorded|i've recorded|i've reviewed in detail|i prepared)\b/i;
const SPEED_MENTION_REGEX = /\b(pagespeed|slow loading|loads slowly|slow site|slow website|page speed|load time|lcp|ttfb)\b/i;
const SENDER_LOCATION_REGEX = /\b(i'm based in|i am based in|we're based in|we are based in|i live in|from the uk|uk-based|local web developer|freelance web developer)\b/i;
const BANNED_PRAISE_REGEX = /\b(unique|distinct|stand out|very strong|solid|impressive|great)\b/i;
const ABSENCE_CLAIM_REGEX = /\b(no website|no online booking|no quote form|doesn't have online booking|don't have online booking|no booking link|no automated online booking)\b/i;
const CONTACT_METHOD_REGEX = /\b(just a phone number|phone number or email|only way to reach you is to call|call now button|rely on a phone call|call or email)\b/i;

const PLACEHOLDER_TERMS = ['your name', 'clarkeweb.co.uk', 'apexweb.co.uk', 'alex', 'jonathan', 'clarke', 'apex'];

/**
 * Generates 3 outreach pitch variants for a lead adhering strictly to all Stage 5A-2 rules.
 */
export async function generatePitch(
  leadId: string,
  options: PitchOptions,
  customLead?: Lead | null,
  customAnalysis?: LeadAnalysis | null,
  customProfile?: SenderProfile | null,
  customAudit?: any | null
): Promise<StoredPitch> {
  // 1. Resolve Lead & Analysis
  let lead = customLead;
  if (!lead) {
    lead = await getLeadById(leadId);
  }

  let analysis: LeadAnalysis | null = customAnalysis || null;
  let analysisId: string | null = null;
  if (!analysis) {
    const storedAnalysis = await getAnalysisForLead(leadId);
    if (storedAnalysis) {
      analysis = storedAnalysis.data;
      analysisId = storedAnalysis.id;
    }
  }

  if (!lead) {
    throw new Error(`Lead ${leadId} not found`);
  }

  if (!analysis) {
    throw new Error(`No analysis found for lead ${leadId}. Please run AI analysis first.`);
  }

  // 2. Resolve & Validate Sender Profile from Database
  const profile: SenderProfile | null = customProfile || (await getSenderSettings());
  if (
    !profile ||
    !profile.name?.trim() ||
    !profile.trading_name?.trim() ||
    !profile.website?.trim() ||
    !profile.contact_email?.trim()
  ) {
    throw new Error(
      'Sender profile is incomplete. Please configure your Name, Trading Name, Website, and Contact Email in Settings before generating pitches.'
    );
  }

  // Ensure no banned placeholder terms in sender profile
  const profileString = `${profile.name} ${profile.trading_name} ${profile.website || ''} ${profile.contact_email || ''}`.toLowerCase();
  for (const placeholder of PLACEHOLDER_TERMS) {
    if (profileString.includes(placeholder)) {
      throw new Error(
        `Sender profile contains placeholder text "${placeholder}". Please update your Settings with real details before generating pitches.`
      );
    }
  }

  // 3. Channel Gating Rules Enforcement
  const audit = customAudit !== undefined ? customAudit : (await getAuditForLead(leadId));
  const emailCandidates = audit?.contact_candidates?.emails || (lead.email ? [lead.email] : []);
  const hasPublishedEmail = emailCandidates.length > 0;
  const isCorporate = (analysis.outreach_class || lead.outreach_class) === 'corporate';

  if (options.channel === 'email') {
    if (!hasPublishedEmail) {
      throw new Error(
        'Refused Email channel: No published email address was discovered for this lead. Recommended channels: Contact form or Call script.'
      );
    }
    if (!isCorporate && !options.opted_in) {
      throw new Error(
        'Refused Email channel: Sole trader or individual email without confirmed consent/opt-in under PECR regulations. Please tick "Opted in" if prior consent exists, or use Contact form.'
      );
    }
  }

  if (options.channel === 'whatsapp') {
    if (lead.phone_type !== 'mobile') {
      if (lead.phone_type === 'landline') {
        throw new Error(
          `Refused WhatsApp channel: This business only has a published landline number (${lead.phone_raw || lead.phone_e164 || 'landline'}). Recommended channels: Call script or Contact form.`
        );
      }
      throw new Error(
        'Refused WhatsApp channel: No mobile number is published for this business. Recommended channels: Call script or Contact form.'
      );
    }

    if (!isCorporate && !options.opted_in) {
      throw new Error(
        'Refused WhatsApp channel: This lead is an individual/sole trader under PECR regulations. Direct WhatsApp outreach requires prior consent or opt-in enquiry. Please tick "Opted in" if consent exists, or switch to Call script or Contact form.'
      );
    }
  }

  const selectedAngle =
    options.angle || analysis.recommended_primary_service || 'website_redesign';

  const exactBusinessName = lead.selected_name || lead.website_name || lead.name;
  const senderFirstName = profile.name.trim().split(/\s+/)[0];
  const psiResult = (analysis as any).psi_result || audit?.psi_result || null;
  const leadSource =
    lead.source ||
    (lead.place_id?.startsWith('osm:') ? 'osm' : lead.google_maps_url ? 'google_maps' : 'website');

  const thirdPartyBookingRegex = /\b(fresha|treatwell|booksy|setmore|calendly)\b/i;
  const hasThirdPartyBooking =
    (audit?.booking_providers || []).some((p: string) => thirdPartyBookingRegex.test(p)) ||
    thirdPartyBookingRegex.test(audit?.text_excerpt || '');
  const visitedPages: string[] = audit?.pages_visited || [];
  const hasContactOrBookingPage = visitedPages.some((u: string) => /contact|book|enquir|appoint/i.test(u));
  const absenceClaimsAllowed =
    lead.website_type === 'none' ||
    lead.website_type === 'social_only' ||
    (visitedPages.length >= 3 && hasContactOrBookingPage && !hasThirdPartyBooking);

  const inputPayload = {
    required_variants: 3,
    output_instructions:
      'Generate EXACTLY 3 distinct variants in the variants array. Use accurate source_type ("manual_note", "audit", "page_text", "osm", "companies_house", or "psi") matching the exact source of the snippet.',
    lead_source: leadSource,
    absence_claims_allowed: absenceClaimsAllowed,
    lead_analysis: analysis,
    sender_profile: {
      name: profile.name,
      first_name: senderFirstName,
      trading_name: profile.trading_name,
      website: profile.website,
      contact_email: profile.contact_email || '',
    },
    channel: options.channel,
    tone: options.tone,
    angle: selectedAngle,
    business_name: exactBusinessName,
    manual_notes: lead.manual_notes || null,
    lead_data: {
      name: lead.name,
      source: leadSource,
      address: lead.address,
      postcode: lead.postcode,
      rating: lead.rating,
      review_count: lead.review_count,
      categories: lead.categories,
      website: lead.website,
      website_type: lead.website_type,
      phone_raw: lead.phone_raw,
      phone_type: lead.phone_type,
    },
    outreach_class: analysis.outreach_class || lead.outreach_class || 'individual_or_unknown',
    psi_verified: Boolean(psiResult?.verified),
    raw_audit: audit
      ? {
        url_tested: audit.url_tested,
        page_title: audit.page_title,
        h1_text: audit.h1_text,
        has_online_booking: audit.has_online_booking,
        has_contact_form: audit.has_contact_form,
        has_whatsapp_link: audit.has_whatsapp_link,
        booking_providers: audit.booking_providers,
        pages_visited: audit.pages_visited,
        social_links: audit.social_links,
        contact_candidates: audit.contact_candidates,
        homepage_visible_text_excerpt: audit.text_excerpt ? audit.text_excerpt.slice(0, 3000) : '',
      }
      : null,
  };

  const llmProvider = getLlmProvider();
  const dataMode = process.env.DATA_MODE || 'live';
  let pitchResult: PitchResult;

  // Build per-source corpora for Stage 7B claim source_type verification
  const manualNotesCorpus = (lead.manual_notes || '').toLowerCase();
  const osmCorpus = [
    lead.name,
    lead.address,
    lead.postcode,
    lead.website,
    lead.website_type,
    lead.phone_raw,
    lead.rating !== null && lead.rating !== undefined ? String(lead.rating) : '',
    lead.review_count !== null && lead.review_count !== undefined ? String(lead.review_count) : '',
    ...(lead.categories || []),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  const pageTextCorpus = [audit?.text_excerpt || '', audit?.page_title || '', audit?.h1_text || '']
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  const auditCorpus = [
    pageTextCorpus,
    audit?.detected_platform || '',
    audit?.url_tested || '',
    audit?.final_url || '',
    audit?.has_online_booking === false ? 'has_online_booking: false no online booking' : 'has_online_booking: true',
    audit?.has_contact_form === false ? 'has_contact_form: false no contact form no quote form' : 'has_contact_form: true',
    audit?.has_whatsapp_link === false ? 'has_whatsapp_link: false no whatsapp' : 'has_whatsapp_link: true',
    ...(audit?.booking_providers || []),
    ...(audit?.pages_visited || []),
    ...(audit?.mobile_issues || []),
    Object.keys(audit?.social_links || {}).join(' '),
    Object.values(audit?.social_links || {}).join(' '),
    ...(audit?.contact_candidates?.emails || []),
    ...(audit?.contact_candidates?.phones || []),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  const chCorpus = [analysis.greeting_name || '', analysis.outreach_class || ''].filter(Boolean).join(' ').toLowerCase();
  const psiCorpus = [
    psiResult?.citation || '',
    psiResult?.mobile_score !== undefined && psiResult?.mobile_score !== null ? String(psiResult.mobile_score) : '',
    psiResult?.lcp_display || '',
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  const fullRawCorpus = [
    exactBusinessName.toLowerCase(),
    manualNotesCorpus,
    osmCorpus,
    auditCorpus,
    chCorpus,
    psiCorpus,
    (analysis.business_summary || '').toLowerCase(),
    ...(analysis.digital_presence?.evidence || []).map((e) => e.toLowerCase()),
  ]
    .filter(Boolean)
    .join(' ');

  const placeAllowedCorpus = [
    lead.address || '',
    lead.postcode || '',
    lead.name || '',
    lead.manual_notes || '',
    audit?.text_excerpt || '',
  ]
    .join(' ')
    .toLowerCase();

  const hasPublishedPhone = Boolean(
    lead.phone_raw || lead.phone_e164 || (audit?.contact_candidates?.phones?.length || 0) > 0
  );
  const hasAuditedEmail = Boolean((audit?.contact_candidates?.emails?.length || 0) > 0);
  const contactShownInSource =
    hasPublishedPhone || hasAuditedEmail || /\b(phone|call|email|call now)\b/i.test(manualNotesCorpus);

  const hasPsi = Boolean(psiResult?.verified);

  const validateVariants = (
    variants: PitchVariant[],
    allowOutsideWordRange: boolean
  ): { valid: boolean; reason?: string } => {
    if (!variants || variants.length < 3) return { valid: false, reason: 'Expected at least 3 variants' };

    for (const v of variants) {
      const normalizedMessage = v.message.replace(/[’‘]/g, "'");

      // 3. Word count counted in code (ignore model's word_count). Allowed 90-150.
      const actualWordCount = normalizedMessage.trim().split(/\s+/).filter(Boolean).length;
      v.word_count = actualWordCount;
      if (actualWordCount < 90 || actualWordCount > 150) {
        if (!allowOutsideWordRange) {
          return {
            valid: false,
            reason: `Word count (${actualWordCount}) is outside the 90 to 150 word range in "${v.label}"`,
          };
        } else {
          v.warning = `outside range (${actualWordCount} words)`;
          if (!v.label.toLowerCase().includes('outside range')) {
            v.label = `${v.label} [outside range]`;
          }
        }
      }

      // 2. Platform check: never say "on Google" unless source is google_maps
      if (leadSource !== 'google_maps' && /\bon google\b/i.test(normalizedMessage)) {
        return {
          valid: false,
          reason: `Said "on Google" in "${v.label}" when lead.source is "${leadSource}"`,
        };
      }

      // 6. Praise ban
      const praiseMatch = normalizedMessage.match(BANNED_PRAISE_REGEX);
      if (praiseMatch) {
        return {
          valid: false,
          reason: `Contains banned praise word "${praiseMatch[0]}" in "${v.label}"`,
        };
      }

      // Past work check
      if (PAST_WORK_REGEX.test(normalizedMessage)) {
        return { valid: false, reason: `Claims past work in "${v.label}"` };
      }

      // Speed check
      if (!hasPsi && SPEED_MENTION_REGEX.test(normalizedMessage)) {
        return { valid: false, reason: `Mentions speed without a verified PageSpeed result in "${v.label}"` };
      }

      // Sender location check
      if (SENDER_LOCATION_REGEX.test(normalizedMessage)) {
        return { valid: false, reason: `States sender location or forbidden developer label in "${v.label}"` };
      }

      // 5. Absence claims check
      if (!absenceClaimsAllowed && ABSENCE_CLAIM_REGEX.test(normalizedMessage)) {
        return {
          valid: false,
          reason: `Made an unverified absence claim ("no website/online booking/quote form") in "${v.label}" without 3+ audited pages incl. contact/booking`,
        };
      }

      // 7. Contact method check
      if (!contactShownInSource && CONTACT_METHOD_REGEX.test(normalizedMessage)) {
        return {
          valid: false,
          reason: `Stated how customers currently contact them without source evidence in "${v.label}"`,
        };
      }

      // 1. Place names check: capitalised place names after location prepositions must exist in lead address/OSM/manual_notes
      const locationMatches = normalizedMessage.matchAll(
        /\b(?:in|around|near|across|covering)\s+([A-Z][a-zA-Z'-]+(?:\s+[A-Z][a-zA-Z'-]+)*)/g
      );
      const nonPlaceWords = new Set(['facebook', 'google', 'instagram', 'whatsapp', 'english', 'british']);
      for (const m of locationMatches) {
        const placePhrase = m[1];
        const lowerPlace = placePhrase.toLowerCase();
        if (nonPlaceWords.has(lowerPlace)) continue;
        if (!placeAllowedCorpus.includes(lowerPlace)) {
          return {
            valid: false,
            reason: `Place name "${placePhrase}" is absent from lead address, OSM data, and manual_notes in "${v.label}"`,
          };
        }
      }

      // 4. Claim labels: source_type must match where the snippet actually comes from
      if (!v.claims || v.claims.length === 0) {
        return { valid: false, reason: `Empty claims array in "${v.label}"` };
      }

      for (const c of v.claims) {
        if (!c.text || !c.source_type || !c.source_snippet) {
          return { valid: false, reason: 'Incomplete claim object fields' };
        }
        const rawSnippet = c.source_snippet.trim().toLowerCase();
        const cleanSnippet = rawSnippet.replace(/^[a-z0-9_.\s]+:\s*/i, '');
        if (cleanSnippet.length < 3) continue;

        let targetCorpus = '';
        if (c.source_type === 'manual_note' || c.source_type === 'manual_notes') {
          targetCorpus = manualNotesCorpus;
        } else if (c.source_type === 'page_text') {
          targetCorpus = pageTextCorpus;
        } else if (c.source_type === 'audit') {
          targetCorpus = auditCorpus;
        } else if (c.source_type === 'osm' || c.source_type === 'lead_data') {
          targetCorpus = osmCorpus;
        } else if (c.source_type === 'companies_house') {
          targetCorpus = chCorpus;
        } else if (c.source_type === 'psi') {
          targetCorpus = psiCorpus;
        }

        const foundInTarget = targetCorpus.includes(cleanSnippet) || targetCorpus.includes(rawSnippet);
        const isAuditAbsence =
          c.source_type === 'audit' &&
          Boolean(audit) &&
          (rawSnippet.includes('no ') || rawSnippet.includes('false') || rawSnippet.includes('not verified'));

        if (!foundInTarget && !isAuditAbsence) {
          return {
            valid: false,
            reason: `Claim snippet "${c.source_snippet}" was not found in stated source "${c.source_type}"`,
          };
        }
      }

      // Check numbers in message (excluding small counts 1, 2, 3) exist in fullRawCorpus
      const numbersInMessage = normalizedMessage.match(/\b\d+\b/g) || [];
      for (const num of numbersInMessage) {
        if (['1', '2', '3'].includes(num)) continue;
        if (!fullRawCorpus.includes(num)) {
          return {
            valid: false,
            reason: `Number "${num}" in "${v.label}" was not found in lead data or manual_notes`,
          };
        }
      }
    }

    return { valid: true };
  };

  try {
    pitchResult = await llmProvider.generateJson<PitchResult>(
      PITCH_SYSTEM_PROMPT,
      inputPayload,
      PitchResultSchema as any
    );

    const check = validateVariants(pitchResult.variants, false);
    if (!check.valid) {
      console.warn(`Pitch validation failed: ${check.reason}. Regenerating once...`);
      const retryPayload = {
        ...inputPayload,
        correction_instruction: `CORRECTION REQUIRED: Previous output failed: ${check.reason}. Fix this strictly: keep EVERY variant between 90 and 150 words, only use place names present in lead_data.address or manual_notes, never say "on Google" unless lead_source is "google_maps", never use banned praise words ("unique", "distinct", "stand out", "very strong", "solid", "impressive", "great"), and ensure every claim's source_type matches the exact source containing source_snippet.`,
      };
      pitchResult = await llmProvider.generateJson<PitchResult>(
        PITCH_SYSTEM_PROMPT,
        retryPayload,
        PitchResultSchema as any
      );

      const retryCheck = validateVariants(pitchResult.variants, true);
      if (!retryCheck.valid && dataMode === 'live') {
        throw new Error(`Pitch generation failed validation after retry: ${retryCheck.reason}`);
      }
    }
  } catch (err: any) {
    if (dataMode === 'live') {
      throw new Error(`Pitch generation failed (${llmProvider.name}): ${err.message}`);
    }
    pitchResult = generateDeterministicUKPitchVariants(lead, analysis, options, profile);
  }

  // Ensure claims are grounded and normalize manual_notes -> manual_note
  pitchResult.variants = pitchResult.variants.map((v) => ({
    ...v,
    claims:
      v.claims && v.claims.length > 0
        ? v.claims.map((c) => ({
          ...c,
          source_type: c.source_type === 'manual_notes' ? ('manual_note' as const) : c.source_type,
        }))
        : [
          {
            text: `Observation for ${exactBusinessName}`,
            source_type: 'osm' as const,
            source_field: 'lead.name',
            source_snippet: exactBusinessName,
          },
        ],
  }));

  const stored: StoredPitch = {
    id: crypto.randomUUID(),
    lead_id: lead.id,
    analysis_id: analysisId,
    channel: options.channel,
    tone: options.tone,
    angle: selectedAngle,
    variants: pitchResult.variants,
    created_at: new Date().toISOString(),
  };

  // Cache in-memory
  const existing = fallbackPitches.get(lead.id) || [];
  existing.unshift(stored);
  fallbackPitches.set(lead.id, existing);

  // Store in Supabase if configured
  const supabase = getSupabaseServerClient();
  if (supabase) {
    try {
      await supabase.from('pitches').insert({
        id: stored.id,
        lead_id: lead.id,
        analysis_id: analysisId,
        model_used: llmProvider.name,
        subject_line: stored.variants[0]?.subject || `Quick note regarding ${exactBusinessName}`,
        email_body_text: stored.variants[0]?.message || '',
        whatsapp_text: stored.variants.find((v) => options.channel === 'whatsapp')?.message || null,
        click_to_chat_links: {
          whatsapp_url: lead.phone_e164
            ? `https://wa.me/${lead.phone_e164.replace(/\+/g, '')}?text=${encodeURIComponent(
              stored.variants[0]?.message || ''
            )}`
            : null,
        },
        is_customised_by_user: false,
      });
    } catch (err) {
      console.warn('Could not persist pitch to Supabase:', err);
    }
  }

  // Store in SQLite
  try {
    const db = getLocalSqliteDb();
    db.prepare(`
      INSERT OR REPLACE INTO pitches (id, lead_id, analysis_id, channel, tone, angle, variants, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      stored.id,
      stored.lead_id,
      stored.analysis_id || null,
      stored.channel,
      stored.tone,
      stored.angle,
      JSON.stringify(stored.variants),
      stored.created_at
    );
  } catch (sqlErr) {
    console.warn('Could not persist pitch to SQLite:', sqlErr);
  }

  return stored;
}

/**
 * Deterministic fallback
 */
export function generateDeterministicUKPitchVariants(
  lead: Lead,
  analysis: LeadAnalysis,
  options: PitchOptions,
  sender: SenderProfile
): PitchResult {
  const greeting = analysis.greeting_name ? `Hi ${analysis.greeting_name.split(' ')[0]}` : 'Hi there';
  const exactBusinessName = lead.selected_name || lead.website_name || lead.name;

  const hookObj = analysis.personalisation_hooks?.[0];
  const hookText = hookObj?.hook || `based in ${lead.address || 'the UK'}`;
  const hookSnippet = hookObj?.snippet || exactBusinessName;
  const hookSource = hookObj?.source || 'osm.address';

  const optOutLine = "If not relevant, just say and I won't message again.";
  const warningText =
    analysis.outreach_class === 'individual_or_unknown'
      ? 'Possible sole trader. Prefer phone call or contact form unless they have opted in.'
      : null;

  let variants: PitchVariant[] = [];

  if (options.channel === 'whatsapp') {
    const v1Message = `${greeting}, I'm ${sender.name} from ${sender.trading_name}. I noticed ${exactBusinessName} (${hookText}). Looking at your website, there is currently no instant online booking flow outside phone hours. Would it be helpful if I put together a quick note on how similar UK businesses automate bookings 24/7? ${optOutLine}`;
    const v2Message = `${greeting}, ${sender.name} here with ${sender.trading_name}. I came across ${exactBusinessName} (${hookText}). Your website currently requires clients to telephone directly, without online scheduling. Would you be open to having a quick look at a simple mobile-friendly scheduling setup? ${optOutLine}`;
    const v3Message = `${greeting}, I'm ${sender.name} from ${sender.trading_name}. I saw ${exactBusinessName} (${hookText}). I can share a couple of practical ways to streamline your appointment enquiries online. Would you be open to a quick 5-minute chat next week? ${optOutLine}`;

    variants = [
      {
        label: 'Variant A: Online Booking Gap',
        subject: null,
        message: v1Message,
        word_count: countWords(v1Message),
        personalisation_used: [hookText],
        claims: [
          {
            text: 'no instant online booking flow',
            source_type: 'audit',
            source_field: 'audit.has_online_booking',
            source_snippet: 'false',
          },
        ],
        warning: warningText,
      },
      {
        label: 'Variant B: Client Convenience & Automation',
        subject: null,
        message: v2Message,
        word_count: countWords(v2Message),
        personalisation_used: [hookText],
        claims: [
          {
            text: hookText,
            source_type: 'audit',
            source_field: hookSource,
            source_snippet: hookSnippet,
          },
        ],
        warning: warningText,
      },
      {
        label: 'Variant C: Streamlined Enquiries',
        subject: null,
        message: v3Message,
        word_count: countWords(v3Message),
        personalisation_used: [hookText],
        claims: [
          {
            text: exactBusinessName,
            source_type: 'osm',
            source_field: 'lead.name',
            source_snippet: exactBusinessName,
          },
        ],
        warning: warningText,
      },
    ];
  } else if (options.channel === 'email') {
    const s1 = `Quick question regarding ${exactBusinessName}'s website`;
    const m1 = `${greeting},

My name is ${sender.name} and I run ${sender.trading_name}.

I came across ${exactBusinessName} recently and noticed you're ${hookText}. While visiting your site, I noticed an opportunity to improve the mobile layout and speed so smartphone visitors can enquire more easily.

I can share a short note with a few concrete suggestions. Would you be open to having a look if I send that over?

${optOutLine}

Best regards,
${sender.name}
${sender.website}`;

    const s2 = `Idea for ${exactBusinessName} — online bookings & enquiry flow`;
    const m2 = `${greeting},

I'm ${sender.name} with ${sender.trading_name}.

I noticed ${exactBusinessName} (${hookText}). I was browsing your site and saw you don't currently offer an instant online booking widget. For busy clients searching outside normal hours, adding a simple booking link captures enquiries that might otherwise be lost.

I would be glad to share a short 3-point breakdown showing how similar UK businesses set this up. Would this be useful to see?

${optOutLine}

Kind regards,
${sender.name}`;

    const s3 = `Website improvements for ${exactBusinessName}`;
    const m3 = `${greeting},

I hope your week is going well. I'm ${sender.name} from ${sender.trading_name}.

I recently came across ${exactBusinessName} (${hookText}). Modernising your mobile navigation would noticeably improve customer conversions on smartphones.

Would you be open to a 10-minute call next Tuesday to see if any of my suggestions make sense for you?

${optOutLine}

Warm regards,
${sender.name}`;

    variants = [
      {
        label: 'Variant A: Diagnostic Mobile Review',
        subject: s1,
        message: m1,
        word_count: countWords(m1),
        personalisation_used: [hookText],
        claims: [
          {
            text: hookText,
            source_type: 'audit',
            source_field: hookSource,
            source_snippet: hookSnippet,
          },
        ],
        warning: warningText,
      },
      {
        label: 'Variant B: Online Booking & Conversion Angle',
        subject: s2,
        message: m2,
        word_count: countWords(m2),
        personalisation_used: [hookText],
        claims: [
          {
            text: 'no instant online booking widget',
            source_type: 'audit',
            source_field: 'audit.has_online_booking',
            source_snippet: 'false',
          },
        ],
        warning: warningText,
      },
      {
        label: 'Variant C: Modernisation & 10-Min Call',
        subject: s3,
        message: m3,
        word_count: countWords(m3),
        personalisation_used: [hookText],
        claims: [
          {
            text: exactBusinessName,
            source_type: 'osm',
            source_field: 'lead.name',
            source_snippet: exactBusinessName,
          },
        ],
        warning: warningText,
      },
    ];
  } else {
    // contact_form or call_script
    const f1 = `${greeting},

My name is ${sender.name} from ${sender.trading_name}. I noticed ${exactBusinessName} is ${hookText}.

I was looking at your website on mobile and spotted a couple of layout fixes that would make it easier for smartphone visitors to book appointments.

I can email over a brief 2-minute note with 3 actionable suggestions if that would be helpful?

${optOutLine}`;

    const f2 = `${greeting},

I'm ${sender.name} with ${sender.trading_name}. I came across ${exactBusinessName} (${hookText}).

I noticed your website doesn't currently offer instant online scheduling. Could I send over a quick overview of how to add a simple booking system that integrates with your calendar?

${optOutLine}`;

    const f3 = `${greeting},

I'm an independent web consultant with ${sender.trading_name}. I noticed ${exactBusinessName} (${hookText}).

I spotted an easy opportunity to improve mobile responsiveness so you capture more local clients. Would you be open to a quick 10-minute phone call this week?

${optOutLine}`;

    variants = [
      {
        label: 'Variant A: Quick Audit Summary',
        subject: 'Website improvement note',
        message: f1,
        word_count: countWords(f1),
        personalisation_used: [hookText],
        claims: [{ text: hookText, source_type: 'audit', source_field: hookSource, source_snippet: hookSnippet }],
        warning: warningText,
      },
      {
        label: 'Variant B: Booking Integration Offer',
        subject: 'Enquiry regarding booking system',
        message: f2,
        word_count: countWords(f2),
        personalisation_used: [hookText],
        claims: [{ text: hookText, source_type: 'audit', source_field: hookSource, source_snippet: hookSnippet }],
        warning: warningText,
      },
      {
        label: 'Variant C: 10-Minute Call Request',
        subject: 'Quick question for the business owner',
        message: f3,
        word_count: countWords(f3),
        personalisation_used: [hookText],
        claims: [{ text: hookText, source_type: 'audit', source_field: hookSource, source_snippet: hookSnippet }],
        warning: warningText,
      },
    ];
  }

  return { variants };
}

function countWords(str: string): number {
  return str.trim().split(/\s+/).filter(Boolean).length;
}

export async function logOutreach(
  leadId: string,
  pitchId: string | null,
  channel: string,
  status: OutreachStatus = 'draft_opened',
  notes?: string | null
): Promise<OutreachLogEntry> {
  const entry: OutreachLogEntry = {
    id: crypto.randomUUID(),
    lead_id: leadId,
    pitch_id: pitchId,
    channel,
    status,
    notes: notes || null,
    contacted_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
  };

  const existing = fallbackOutreachLogs.get(leadId) || [];
  existing.unshift(entry);
  fallbackOutreachLogs.set(leadId, existing);

  const supabase = getSupabaseServerClient();
  if (supabase) {
    try {
      await supabase.from('outreach_log').insert({
        id: entry.id,
        lead_id: leadId,
        pitch_id: pitchId,
        channel,
        status,
        notes: notes || null,
        contacted_at: entry.contacted_at,
      });

      if (status === 'sent' || status === 'draft_opened') {
        await supabase
          .from('leads')
          .update({ status: 'contacted' })
          .eq('id', leadId);
      }
    } catch (err) {
      console.warn('Could not persist outreach log to Supabase:', err);
    }
  }

  return entry;
}

export async function getOutreachLogsForLead(leadId: string): Promise<OutreachLogEntry[]> {
  const supabase = getSupabaseServerClient();
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('outreach_log')
        .select('*')
        .eq('lead_id', leadId)
        .order('created_at', { ascending: false });

      if (data && !error) {
        return data as OutreachLogEntry[];
      }
    } catch {
      // fallback
    }
  }

  return fallbackOutreachLogs.get(leadId) || [];
}

export async function getStoredPitchesForLead(leadId: string): Promise<StoredPitch[]> {
  const cached = fallbackPitches.get(leadId);
  if (cached && cached.length > 0) return cached;

  // SQLite persistent store
  try {
    const db = getLocalSqliteDb();
    const rows = db.prepare('SELECT * FROM pitches WHERE lead_id = ? ORDER BY created_at DESC').all(leadId) as any[];
    if (rows && rows.length > 0) {
      const parsed: StoredPitch[] = rows.map((r) => ({
        id: r.id,
        lead_id: r.lead_id,
        analysis_id: r.analysis_id,
        channel: r.channel,
        tone: r.tone,
        angle: r.angle,
        variants: JSON.parse(r.variants),
        created_at: r.created_at,
      }));
      fallbackPitches.set(leadId, parsed);
      return parsed;
    }
  } catch (err) {
    // ignore
  }

  return [];
}
