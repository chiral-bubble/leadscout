import * as fs from 'fs';
import * as path from 'path';

// 0. Ensure .env.local is loaded
const envLocalPath = path.resolve(process.cwd(), '.env.local');
if (fs.existsSync(envLocalPath)) {
  const content = fs.readFileSync(envLocalPath, 'utf8');
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx > 0) {
      const key = trimmed.slice(0, eqIdx).trim();
      const val = trimmed.slice(eqIdx + 1).trim();
      if (!process.env[key]) {
        process.env[key] = val;
      }
    }
  }
}

import { crawlAndAuditWebsite } from '../src/lib/audit/playwright-crawler';
import { searchCompaniesHouseCandidates } from '../src/lib/services/companies-house';
import { getPsiResult } from '../src/lib/services/pagespeed';
import { analyzeLead } from '../src/lib/services/analysis-service';
import { generatePitch } from '../src/lib/services/pitch-service';
import { saveSenderSettings } from '../src/lib/services/settings-service';
import { Lead, WebsiteAudit } from '../src/types/database';

async function runStage5A2Test() {
  console.log('='.repeat(80));
  console.log('STAGE 5A-2: LIVE END-TO-END VERIFICATION RUN');
  console.log('='.repeat(80));

  // 0. Ensure sender profile is saved in settings
  await saveSenderSettings({
    name: 'Jonathan Clarke',
    trading_name: 'Clarke Web & Automations',
    website: 'https://clarkeweb.co.uk',
    services: [
      'Fast Next.js Websites',
      'Online Booking & Scheduling Systems',
      'WhatsApp Enquiry Automations',
      'Mobile Speed & Viewport Optimisation',
    ],
    credibility_statement:
      'Freelance UK web developer and automation consultant building high-converting websites and booking flows for local UK businesses.',
    whatsapp_number: '+447911123456',
    uk_contact_address: '71-75 Shelton Street, Covent Garden, London WC2H 9JQ',
    opt_out_wording: "If not relevant, just say and I won't message again.",
  });
  console.log('✓ Sender settings configured in database');

  // Test Case A: Forresters (Reading)
  const leadForresters: Lead = {
    id: 'lead-test-forresters',
    place_id: 'osm-way-forresters',
    name: 'Foresters4Hair',
    website: 'https://www.forresters4hair.com/',
    has_website: true,
    website_type: 'own_site',
    address: 'Shinfield Road, Reading, RG2 8BN',
    postcode: 'RG2 8BN',
    phone_raw: '0118 987 2223',
    phone_e164: '+441189872223',
    phone_type: 'landline',
    whatsapp_likely: false,
    rating: null,
    review_count: null,
    categories: ['Hairdresser'],
    status: 'discovered',
    is_suppressed: false,
    outreach_class: 'corporate',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  // Test Case B: Lead with published email (Testing email channel gating & claims grounding)
  const leadEmail: Lead = {
    id: 'lead-test-email',
    place_id: 'osm-node-email',
    name: 'High Street Dental Practice Ltd',
    website: 'https://www.highstreetdental.co.uk/',
    has_website: true,
    website_type: 'own_site',
    address: '42 High Street, St Albans, AL1 3QZ',
    postcode: 'AL1 3QZ',
    phone_raw: '01727 854321',
    phone_e164: '+441727854321',
    phone_type: 'landline',
    whatsapp_likely: false,
    rating: 4.8,
    review_count: 142,
    categories: ['Dentist'],
    status: 'discovered',
    is_suppressed: false,
    outreach_class: 'corporate',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  await executeLeadPipeline('TEST LEAD A: FORRESTERS (Reading Hair Salons)', leadForresters, 'contact_form');
  await executeLeadPipeline('TEST LEAD B: UK BUSINESS WITH PUBLISHED EMAIL', leadEmail, 'email', [
    'reception@highstreetdental.co.uk',
  ]);
}

async function executeLeadPipeline(
  label: string,
  lead: Lead,
  channelToTest: 'contact_form' | 'email',
  injectedEmails?: string[]
) {
  console.log('\n' + '#'.repeat(80));
  console.log(label);
  console.log('#'.repeat(80));

  // 1. Playwright Audit with multi-page coverage
  console.log(`\n[1] Running Multi-Page Playwright Audit on ${lead.website}...`);
  let audit = await crawlAndAuditWebsite(lead.website!, lead.id);

  if (injectedEmails && injectedEmails.length > 0) {
    audit = {
      ...audit,
      contact_candidates: {
        ...audit.contact_candidates,
        emails: injectedEmails,
      },
    };
  }

  console.log(`Audited URL: ${audit.final_url || audit.url_tested}`);
  console.log(`Pages Visited (${audit.pages_visited?.length || 1}):`, audit.pages_visited);
  console.log(`Emails Discovered:`, audit.contact_candidates.emails);
  console.log(`Phones Discovered:`, audit.contact_candidates.phones);
  console.log(`Online Booking Detected: ${audit.has_online_booking} (${audit.booking_providers.join(', ') || 'none'})`);
  console.log(`Local Timings (UNRELIABLE - NOT FOR PITCHES): TTFB=${audit.ttfb_ms}ms, FullLoad=${audit.full_load_ms}ms`);

  // 2. PageSpeed Insights
  console.log(`\n[2] Checking PageSpeed Insights (PSI API v5 Mobile)...`);
  const psi = await getPsiResult(audit.final_url || lead.website!, lead.id);
  if (psi && psi.mobile_score !== null) {
    console.log(`PSI Mobile Score: ${psi.mobile_score}/100 | LCP: ${psi.lcp_display}`);
  } else {
    console.log(`PSI Result: unavailable (speed marked as unverified)`);
  }

  // 3. Companies House Multi-Strategy Search
  console.log(`\n[3] Companies House Multi-Strategy Lookup for "${lead.name}" (${lead.postcode})...`);
  const chRes = await searchCompaniesHouseCandidates(lead.name, lead.postcode, lead.id);
  console.log(`Match Confidence: ${chRes.confidence.toUpperCase()}`);
  console.log(`Top Candidates Found (${chRes.candidates.length}):`);
  chRes.candidates.forEach((cand, idx) => {
    console.log(`   Candidate ${idx + 1}: "${cand.legal_name}" (#${cand.company_number})`);
    console.log(`     Address: ${cand.registered_address}`);
    console.log(`     Officers: ${cand.officers.join(', ') || 'none'}`);
    console.log(`     Confidence: ${cand.match_confidence}`);
  });

  const selectedCompany = chRes.selectedMatch;

  // 4. AI Lead Analysis
  console.log(`\n[4] Running AI Lead Analysis (Gemini Live Mode)...`);
  const storedAnalysis = await analyzeLead(lead, audit, selectedCompany, null, psi);
  const analysis = storedAnalysis.data;

  console.log('\n--- FULL RAW ANALYSIS JSON ---');
  console.log(JSON.stringify(analysis, null, 2));

  // 5. Generate 3 Pitch Variants with Claims
  let channel = channelToTest;
  console.log(`\n[5] Generating 3 Pitch Variants (Channel: ${channel}, Tone: friendly)...`);
  const pitch = await generatePitch(
    lead.id,
    {
      channel,
      tone: 'friendly',
      angle: analysis.recommended_primary_service,
      opted_in: true, // PECR consent confirmation for testing email/WhatsApp
    },
    lead,
    analysis,
    null,
    audit
  );

  console.log('\n--- 3 PITCH VARIANTS & GROUNDED CLAIMS ---');
  pitch.variants.forEach((v, idx) => {
    console.log(`\n------------------------------------------------------------`);
    console.log(`VARIANT ${idx + 1}: ${v.label} (${v.word_count} words)`);
    if (v.subject) console.log(`Subject: ${v.subject}`);
    console.log(`Message:\n${v.message}`);
    console.log(`\nGrounded Evidence Claims (${v.claims.length}):`);
    v.claims.forEach((c, cIdx) => {
      console.log(`  [Claim ${cIdx + 1}]`);
      console.log(`    Text          : "${c.text}"`);
      console.log(`    Source Type   : ${c.source_type}`);
      console.log(`    Source Field  : ${c.source_field}`);
      console.log(`    Source Snippet: "${c.source_snippet}"`);
    });
  });
}

runStage5A2Test()
  .then(() => {
    console.log('\n' + '='.repeat(80));
    console.log('STAGE 5A-2 END-TO-END VERIFICATION RUN COMPLETED SUCCESSFULLY');
    console.log('='.repeat(80));
    process.exit(0);
  })
  .catch((err) => {
    console.error('STAGE 5A-2 RUN FAILED:', err);
    process.exit(1);
  });
