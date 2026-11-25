import * as fs from 'fs';
import * as path from 'path';

// Load .env.local manually
try {
  const envPath = path.resolve(process.cwd(), '.env.local');
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, 'utf8').split('\n');
    for (const line of lines) {
      const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
      if (match) {
        const key = match[1];
        let val = (match[2] || '').trim();
        if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
        if (val.startsWith("'") && val.endsWith("'")) val = val.slice(1, -1);
        process.env[key] = val;
      }
    }
  }
} catch (e) {}

import { crawlAndAuditWebsite } from '../src/lib/audit/playwright-crawler';
import { analyzeLead } from '../src/lib/services/analysis-service';
import { generatePitch } from '../src/lib/services/pitch-service';
import { saveSenderSettings } from '../src/lib/services/settings-service';
import { OsmProvider } from '../src/lib/discovery/osm-provider';
import { Lead } from '../src/types/database';

async function main() {
  console.log('================================================================');
  console.log('STAGE 5A-3 LIVE VERIFICATION');
  console.log('================================================================');
  console.log('DATA_MODE:', process.env.DATA_MODE);
  console.log('GEMINI_MODEL:', process.env.GEMINI_MODEL);
  console.log('COMPANIES_HOUSE_API_KEY loaded:', Boolean(process.env.COMPANIES_HOUSE_API_KEY && process.env.COMPANIES_HOUSE_API_KEY.trim() !== ''));

  // Ensure real valid settings
  await saveSenderSettings({
    name: 'Sarah Jenkins',
    trading_name: 'Jenkins Web Solutions',
    website: 'https://jenkinswebsolutions.co.uk',
    services: ['Website Redesign', 'Online Booking Automation'],
    credibility_statement: 'Helping independent Berkshire businesses modernize mobile bookings and web presence',
    whatsapp_number: '+447700900123',
    uk_contact_address: '100 King Street, Reading, RG1 2HF',
    opt_out_wording: 'If not relevant, just say and I won\'t message again.',
  });

  // TEST 1: Forresters multi-page audit with social extraction
  console.log('\n>>> TEST 1: Forresters multi-page audit (5 pages) & social link check...');
  const forrestersLead: Lead = {
    id: 'forresters-lead-live',
    place_id: 'osm-node-forresters',
    name: 'Forresters',
    selected_name: 'Forresters',
    website: 'https://www.forresters4hair.com/',
    phone_raw: '0118 957 2004',
    phone_e164: '+441189572004',
    phone_type: 'landline',
    whatsapp_likely: false,
    has_website: true,
    website_type: 'own_site',
    rating: null,
    review_count: null,
    categories: ['Hairdresser'],
    status: 'discovered',
    is_suppressed: false,
    outreach_class: 'corporate',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const audit = await crawlAndAuditWebsite(forrestersLead.website!, forrestersLead.id);
  console.log('Pages Visited count:', audit.pages_visited?.length);
  console.log('Pages Visited URLs:', audit.pages_visited);
  console.log('Discovered Social Links:', audit.social_links);
  console.log('Contact Candidates:', audit.contact_candidates);

  console.log('\nRunning Gemini live analysis for Forresters...');
  const analysis = await analyzeLead(forrestersLead, audit);
  console.log('Analysis Summary:', analysis.data.business_summary);
  console.log('Greeting Name:', analysis.data.greeting_name, 'Source:', analysis.data.greeting_name_source);
  console.log('Best Contact Channel:', analysis.data.best_contact_channel);

  console.log('\nGenerating pitch variants for Forresters (channel: contact_form)...');
  const pitch = await generatePitch(forrestersLead.id, {
    channel: 'contact_form',
    tone: 'professional',
  }, forrestersLead, analysis.data, null, audit);

  console.log('\nPITCH VARIANTS GENERATED:');
  pitch.variants.forEach((v, idx) => {
    console.log(`\n--- Variant ${idx + 1}: ${v.label} (${v.word_count} words) ---`);
    console.log(v.message);
    console.log('Claims backing factual sentences:');
    v.claims.forEach((c) => {
      console.log(`  - [${c.source_type}] "${c.text}" -> snippet: "${c.source_snippet}" (${c.source_field})`);
    });
  });

  // TEST 2: Live OSM Search for a business with a published email
  console.log('\n>>> TEST 2: Live OSM Search in Reading/London for a business with a published email...');
  const osm = new OsmProvider();
  const searchResults = await osm.search({
    niche: 'barbers',
    location: 'Reading',
    radiusMiles: 5,
    maxResults: 15,
  });

  console.log(`OSM discovered ${searchResults.length} candidates in Reading.`);
  let liveLeadWithEmail: Lead | null = null;
  let liveLeadAudit: any = null;

  for (const candidate of searchResults) {
    if (candidate.website) {
      console.log(`Auditing candidate with website: ${candidate.name} (${candidate.website})...`);
      try {
        const testAudit = await crawlAndAuditWebsite(candidate.website, 'candidate-test');
        if (testAudit.contact_candidates?.emails && testAudit.contact_candidates.emails.length > 0) {
          console.log(`FOUND business with published email! ${candidate.name} -> ${testAudit.contact_candidates.emails.join(', ')}`);
          liveLeadWithEmail = {
            ...candidate,
            id: 'live-candidate-email-test',
            status: 'discovered',
            is_suppressed: false,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          } as Lead;
          liveLeadAudit = testAudit;
          break;
        }
      } catch (err: any) {
        console.log(`Audit failed for ${candidate.website}: ${err.message}`);
      }
    }
  }

  if (liveLeadWithEmail && liveLeadAudit) {
    console.log('\nRunning live analysis & email pitch on discovered business with email...');
    const liveAnalysis = await analyzeLead(liveLeadWithEmail, liveLeadAudit);
    console.log('Analysis summary:', liveAnalysis.data.business_summary);
    const emailPitch = await generatePitch(liveLeadWithEmail.id, {
      channel: 'email',
      tone: 'professional',
      opted_in: true, // Simulating user checking 'opted in' for verified sole trader outreach under PECR
    }, liveLeadWithEmail, liveAnalysis.data, null, liveLeadAudit);
    console.log('\nGenerated Email Pitch:');
    emailPitch.variants.forEach((v, idx) => {
      console.log(`\n--- Email Variant ${idx + 1}: ${v.label} (${v.subject}) ---`);
      console.log(v.message);
      console.log('Claims backing factual sentences:');
      v.claims.forEach((c) => {
        console.log(`  - [${c.source_type}] "${c.text}" -> snippet: "${c.source_snippet}" (${c.source_field})`);
      });
    });
  } else {
    console.log('Notice: No business among the queried OSM candidates in Reading published a public email on their audited website pages.');
  }

  console.log('\n================================================================');
  console.log('STAGE 5A-3 VERIFICATION COMPLETE');
  console.log('================================================================');
}

main().catch((err) => {
  console.error('Test run failed:', err);
  process.exit(1);
});
