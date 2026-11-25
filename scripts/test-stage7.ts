import * as fs from 'fs';
import * as path from 'path';

// Load .env.local manually
const envPath = path.resolve(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
  const lines = fs.readFileSync(envPath, 'utf-8').split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx > 0) {
      const key = trimmed.slice(0, eqIdx).trim();
      const val = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, '');
      if (!process.env[key]) {
        process.env[key] = val;
      }
    }
  }
}

import { getLocalSqliteDb, closeLocalSqliteDb } from '../src/lib/db/sqlite';
import { updateLeadManualNotes, getLeadById } from '../src/lib/services/leads-service';
import { saveSenderSettings, getSenderSettings } from '../src/lib/services/settings-service';
import { generatePitch } from '../src/lib/services/pitch-service';
import { Lead } from '../src/types/database';
import { LeadAnalysis } from '../src/types/analysis';

async function main() {
  console.log('================================================================');
  console.log('STAGE 7 VERIFICATION: VOICE REWRITE & MANUAL NOTES');
  console.log('================================================================');
  console.log('DATA_MODE:', process.env.DATA_MODE);
  console.log('GEMINI_MODEL:', process.env.GEMINI_MODEL);

  // Save sender profile with contact_email
  await saveSenderSettings({
    name: 'Tommy Fletcher',
    trading_name: 'Fletcher Digital',
    website: 'https://fletcherdigital.co.uk',
    contact_email: 'tommy@fletcherdigital.co.uk',
    services: [],
    credibility_statement: '',
  });
  const profile = await getSenderSettings();
  console.log('\nLoaded Sender Profile:', JSON.stringify(profile, null, 2));

  // Ensure Test Lead 1 (with manual_notes) exists in SQLite and persists manual_notes
  const db = getLocalSqliteDb();
  const lead1Id = 'stage7-test-lead-with-notes';
  const now = new Date().toISOString();
  const lead1: Lead = {
    id: lead1Id,
    place_id: 'osm:way:stage7-test-1',
    name: "Doe's Decorating and Handyman Services",
    address: 'Devizes, Wiltshire',
    postcode: 'SN10 1AA',
    phone_raw: '01380 720000',
    phone_e164: '+441380720000',
    phone_type: 'landline',
    whatsapp_likely: false,
    website: null,
    has_website: false,
    website_type: 'social_only',
    rating: null,
    review_count: null,
    categories: ['painter', 'decorator', 'handyman'],
    status: 'analysed',
    is_suppressed: false,
    outreach_class: 'individual_or_unknown',
    manual_notes: null,
    created_at: now,
    updated_at: now,
  };

  db.prepare(`
    INSERT OR REPLACE INTO leads (
      id, place_id, name, address, postcode, phone_raw, phone_e164, phone_type,
      whatsapp_likely, website, has_website, website_type, categories, status,
      is_suppressed, outreach_class, manual_notes, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    lead1.id, lead1.place_id, lead1.name, lead1.address ?? null, lead1.postcode ?? null,
    lead1.phone_raw ?? null, lead1.phone_e164 ?? null, lead1.phone_type, 0, lead1.website ?? null, 0,
    lead1.website_type, JSON.stringify(lead1.categories), lead1.status, 0,
    lead1.outreach_class ?? 'individual_or_unknown', null, now, now
  );

  // Update manual_notes via service and verify SQLite persistence
  const notesText = 'Owner: Robert. Found on Facebook: over 30 years in painting, decorating and handyman work, 13 reviews at 100% recommend. No website, only Facebook page.';
  await updateLeadManualNotes(lead1Id, notesText);

  closeLocalSqliteDb();
  const reloadedLead1 = await getLeadById(lead1Id);
  console.log('\n>>> TEST 1: Lead WITH manual_notes (reloaded from SQLite)');
  console.log('Persisted manual_notes:', reloadedLead1?.manual_notes);

  const analysis1: LeadAnalysis = {
    business_summary: "Doe's Decorating and Handyman Services provides painting, decorating, and handyman work in Devizes.",
    business_type_guess: 'Painter & Decorator / Handyman',
    digital_presence: {
      website_quality: 'none',
      social_presence: 'active',
      booking_or_ordering_online: false,
      evidence: ['No website, only Facebook page'],
    },
    lead_score: 8,
    score_reasoning: 'No website, only Facebook page',
    weaknesses: [{ issue: 'No standalone website', evidence: 'website_type: social_only', severity: 'high' }],
    opportunities: [{ service: 'site', why: 'Show services and quote form', estimated_value_gbp_range: '£500-£900', confidence: 'high' }],
    personalisation_hooks: [],
    recommended_primary_service: 'site',
    recommended_secondary_services: [],
    best_contact_channel: 'contact_form',
    channel_reasoning: 'No website, only Facebook page',
    decision_maker_guess: 'Robert',
    risks_or_red_flags: [],
    outreach_class: 'individual_or_unknown',
    greeting_name: null,
    greeting_name_source: 'unknown',
    data_gaps: ['No website'],
  };

  const pitch1 = await generatePitch(
    lead1Id,
    { channel: 'facebook_dm', tone: 'friendly', angle: 'site' },
    reloadedLead1,
    analysis1,
    profile,
    null
  );

  console.log('\nRAW OUTPUT (Lead WITH manual_notes):');
  console.log(JSON.stringify(pitch1.variants, null, 2));

  // TEST 2: Lead with NO manual_notes
  const lead2Id = 'stage7-test-lead-no-notes';
  const lead2: Lead = {
    id: lead2Id,
    place_id: 'osm:node:stage7-test-2',
    name: 'Bloc. Hair',
    selected_name: 'Bloc. Hair',
    address: '14 Cross Street, Reading',
    postcode: 'RG1 1SN',
    phone_raw: '0118 958 0000',
    phone_e164: '+441189580000',
    phone_type: 'landline',
    whatsapp_likely: false,
    website: 'https://www.bloc-hair.com',
    has_website: true,
    website_type: 'own_site',
    rating: null,
    review_count: null,
    categories: ['hairdresser', 'hair salon'],
    status: 'analysed',
    is_suppressed: false,
    outreach_class: 'individual_or_unknown',
    manual_notes: null,
    created_at: now,
    updated_at: now,
  };

  const analysis2: LeadAnalysis = {
    business_summary: 'Bloc. Hair is a hair salon in Reading also offering a creative studio space.',
    business_type_guess: 'Hair Salon',
    digital_presence: {
      website_quality: 'average',
      social_presence: 'active',
      booking_or_ordering_online: false,
      evidence: ['audit.has_online_booking: false'],
    },
    lead_score: 7,
    score_reasoning: 'No online booking system on website',
    weaknesses: [{ issue: 'No automated online booking system', evidence: 'audit.has_online_booking: false', severity: 'high' }],
    opportunities: [{ service: 'booking', why: 'Let clients book online', estimated_value_gbp_range: '£600-£1000', confidence: 'high' }],
    personalisation_hooks: [],
    recommended_primary_service: 'booking',
    recommended_secondary_services: [],
    best_contact_channel: 'contact_form',
    channel_reasoning: 'Website contact form',
    decision_maker_guess: 'Owner',
    risks_or_red_flags: [],
    outreach_class: 'individual_or_unknown',
    greeting_name: null,
    greeting_name_source: 'unknown',
    data_gaps: ['No PSI score'],
  };

  const audit2 = {
    url_tested: 'https://www.bloc-hair.com',
    page_title: 'Bloc. Hair',
    h1_text: 'Bloc. Hair Reading',
    has_online_booking: false,
    has_contact_form: true,
    has_whatsapp_link: false,
    booking_providers: [],
    pages_visited: ['https://www.bloc-hair.com/', 'https://www.bloc-hair.com/contact'],
    social_links: { instagram: 'https://www.instagram.com/bloc.hair/' },
    text_excerpt: 'Bloc. Hair is a creative hair salon in Reading. Bloc.Studio is our dedicated creative studio space in Reading. Contact us by phone or email to enquire.',
  };

  console.log('\n>>> TEST 2: Lead WITH NO manual_notes');
  const pitch2 = await generatePitch(
    lead2Id,
    { channel: 'contact_form', tone: 'friendly', angle: 'booking' },
    lead2,
    analysis2,
    profile,
    audit2
  );

  console.log('\nRAW OUTPUT (Lead WITH NO manual_notes):');
  console.log(JSON.stringify(pitch2.variants, null, 2));

  console.log('\n================================================================');
  console.log('STAGE 7 VERIFICATION COMPLETE');
  console.log('================================================================');
}

main().catch((err) => {
  console.error('Stage 7 test failed:', err);
  process.exit(1);
});
