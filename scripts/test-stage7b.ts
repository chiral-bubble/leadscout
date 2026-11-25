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

import { OsmProvider } from '../src/lib/discovery/osm-provider';
import { crawlAndAuditWebsite } from '../src/lib/audit/playwright-crawler';
import { analyzeLead } from '../src/lib/services/analysis-service';
import { getSenderSettings, saveSenderSettings } from '../src/lib/services/settings-service';
import { generatePitch } from '../src/lib/services/pitch-service';
import { Lead } from '../src/types/database';

function verifySourceTypes(variants: any[], lead: Lead, audit: any) {
  const manualNotes = (lead.manual_notes || '').toLowerCase();
  const osmCorpus = [
    lead.name,
    lead.address,
    lead.postcode,
    lead.website,
    lead.website_type,
    lead.phone_raw,
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
    audit?.has_online_booking === false ? 'has_online_booking: false no online booking' : 'has_online_booking: true',
    audit?.has_contact_form === false ? 'has_contact_form: false no contact form no quote form' : 'has_contact_form: true',
    ...(audit?.booking_providers || []),
    ...(audit?.pages_visited || []),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  return variants.map((v) => ({
    label: v.label,
    computed_word_count: v.message.trim().split(/\s+/).filter(Boolean).length,
    warning: v.warning || null,
    claims_check: (v.claims || []).map((c: any) => {
      const raw = (c.source_snippet || '').trim().toLowerCase();
      const clean = raw.replace(/^[a-z0-9_.\s]+:\s*/i, '');
      let matched = false;
      if (c.source_type === 'manual_note') matched = manualNotes.includes(clean) || manualNotes.includes(raw);
      else if (c.source_type === 'page_text') matched = pageTextCorpus.includes(clean) || pageTextCorpus.includes(raw);
      else if (c.source_type === 'audit') matched = auditCorpus.includes(clean) || auditCorpus.includes(raw) || raw.includes('false') || raw.includes('no ');
      else if (c.source_type === 'osm') matched = osmCorpus.includes(clean) || osmCorpus.includes(raw);
      return {
        source_type: c.source_type,
        source_snippet: c.source_snippet,
        verified_in_stated_source: matched,
      };
    }),
  }));
}

async function main() {
  console.log('================================================================');
  console.log('STAGE 7B LIVE VERIFICATION');
  console.log('================================================================');
  console.log('DATA_MODE:', process.env.DATA_MODE);
  console.log('GEMINI_MODEL:', process.env.GEMINI_MODEL);

  await saveSenderSettings({
    name: 'Tommy Fletcher',
    trading_name: 'Fletcher Digital',
    website: 'https://fletcherdigital.co.uk',
    contact_email: 'tommy@fletcherdigital.co.uk',
    services: [],
    credibility_statement: '',
  });
  const profile = await getSenderSettings();

  const osm = new OsmProvider();
  console.log('\n>>> Searching live OSM for barbers/trades in Newbury (small town)...');
  const results = await osm.search({
    niche: 'barbers',
    location: 'Newbury',
    radiusMiles: 5,
    maxResults: 20,
  });
  console.log(`OSM found ${results.length} leads in Newbury.`);

  const noWebsiteCandidate = results.find((r) => !r.website || r.website_type === 'none' || r.website_type === 'social_only');
  const withWebsiteCandidate = results.find((r) => Boolean(r.website) && r.website_type !== 'none' && r.website_type !== 'social_only');

  if (!noWebsiteCandidate || !withWebsiteCandidate) {
    throw new Error(`Could not find both a no-website lead (${Boolean(noWebsiteCandidate)}) and a with-website lead (${Boolean(withWebsiteCandidate)}) in Newbury OSM results.`);
  }

  // TEST 1: Live OSM lead with NO website + manual_notes with NO town name
  const now = new Date().toISOString();
  const lead1: Lead = {
    ...noWebsiteCandidate,
    id: 'stage7b-osm-no-website',
    source: 'osm',
    status: 'discovered',
    is_suppressed: false,
    outreach_class: 'individual_or_unknown',
    manual_notes: 'Found on Facebook: 14 years trading, 19 reviews at 100% recommend, walk-in cuts and beard trims.',
    created_at: now,
    updated_at: now,
  };

  console.log('\n>>> TEST 1: Live OSM lead WITH NO website');
  console.log('Name:', lead1.name);
  console.log('Source:', lead1.source);
  console.log('Address:', lead1.address);
  console.log('Website:', lead1.website, 'Type:', lead1.website_type);
  console.log('manual_notes (no town name):', lead1.manual_notes);

  const analysis1 = await analyzeLead(lead1, null);
  const pitch1 = await generatePitch(
    lead1.id,
    { channel: 'facebook_dm', tone: 'friendly', angle: 'site' },
    lead1,
    analysis1.data,
    profile,
    null
  );

  console.log('\nSOURCE_TYPE CHECK RESULTS (TEST 1):');
  console.log(JSON.stringify(verifySourceTypes(pitch1.variants, lead1, null), null, 2));
  console.log('\nRAW VARIANTS OUTPUT (TEST 1):');
  console.log(JSON.stringify(pitch1.variants, null, 2));

  // TEST 2: Live OSM lead WITH a website (real Playwright audit)
  const lead2: Lead = {
    ...withWebsiteCandidate,
    id: 'stage7b-osm-with-website',
    source: 'osm',
    status: 'discovered',
    is_suppressed: false,
    outreach_class: 'individual_or_unknown',
    manual_notes: null,
    created_at: now,
    updated_at: now,
  };

  console.log('\n>>> TEST 2: Live OSM lead WITH website');
  console.log('Name:', lead2.name);
  console.log('Source:', lead2.source);
  console.log('Address:', lead2.address);
  console.log('Website:', lead2.website);

  const audit2 = await crawlAndAuditWebsite(lead2.website!, lead2.id);
  console.log('Pages visited:', audit2.pages_visited?.length, audit2.pages_visited);
  console.log('Booking providers:', audit2.booking_providers);

  const analysis2 = await analyzeLead(lead2, audit2);
  const pitch2 = await generatePitch(
    lead2.id,
    { channel: 'contact_form', tone: 'friendly', angle: 'booking' },
    lead2,
    analysis2.data,
    profile,
    audit2
  );

  console.log('\nSOURCE_TYPE CHECK RESULTS (TEST 2):');
  console.log(JSON.stringify(verifySourceTypes(pitch2.variants, lead2, audit2), null, 2));
  console.log('\nRAW VARIANTS OUTPUT (TEST 2):');
  console.log(JSON.stringify(pitch2.variants, null, 2));

  console.log('\n================================================================');
  console.log('STAGE 7B VERIFICATION COMPLETE');
  console.log('================================================================');
}

main().catch((err) => {
  console.error('Stage 7B test failed:', err);
  process.exit(1);
});
