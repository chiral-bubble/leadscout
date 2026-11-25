import { analyzeLead } from '../src/lib/services/analysis-service';
import { Lead, WebsiteAudit, CompanyRecord } from '../src/types/database';
import { LeadAnalysisSchema } from '../src/types/analysis';

async function main() {
  console.log('--- LeadScout UK Stage 4: AI Lead Analysis Test ---\n');

  // Realistic UK lead: High Street Dental Practice in St Albans
  const testLead: Lead = {
    id: 'lead-test-dentist-01',
    place_id: 'ChIJN1t_tDeuEmsRUsoyG83frY4',
    name: 'High Street Dental Practice Ltd',
    address: '42 High Street, St Albans, Hertfordshire, AL1 3QZ',
    postcode: 'AL1 3QZ',
    phone_raw: '01727 854321',
    phone_e164: '+441727854321',
    phone_type: 'landline',
    whatsapp_likely: false,
    website: 'https://highstreetdental-stalbans.co.uk',
    has_website: true,
    website_type: 'own_site',
    rating: 4.8,
    review_count: 142,
    categories: ['Dentist', 'Cosmetic Dentist', 'Dental Clinic'],
    business_status: 'OPERATIONAL',
    google_maps_url: 'https://maps.google.com/?cid=1234567890',
    status: 'audited',
    is_suppressed: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  // Playwright audit result with real indicators (outdated copyright, no booking, mobile issues)
  const testAudit: WebsiteAudit = {
    id: 'audit-test-01',
    lead_id: testLead.id,
    url_tested: 'https://highstreetdental-stalbans.co.uk',
    final_url: 'https://highstreetdental-stalbans.co.uk/',
    http_status: 200,
    uses_https: true,
    ssl_valid: true,
    load_time_ms: 3240,
    largest_contentful_paint_ms: 4100,
    mobile_friendly: false,
    mobile_issues: ['Horizontal overflow detected at 390px', 'Missing viewport meta tag', 'Small tap targets for menu navigation'],
    screenshot_desktop: 'data:image/png;base64,sampleDesktop...',
    screenshot_mobile: 'data:image/png;base64,sampleMobile...',
    page_title: 'High Street Dental Practice | St Albans Cosmetic Dentistry',
    meta_description: 'Welcome to High Street Dental Practice. Established in 2012 in St Albans.',
    h1_text: 'Gentle, Affordable Family Dentistry',
    detected_platform: 'WordPress',
    copyright_year: 2019,
    is_outdated_copyright: true,
    has_contact_form: true,
    has_online_booking: false,
    booking_providers: [],
    has_ecommerce: false,
    has_live_chat: false,
    has_whatsapp_link: false,
    has_cookie_banner: false,
    has_privacy_policy: true,
    contact_candidates: {
      emails: ['info@highstreetdental-stalbans.co.uk'],
      phones: ['+441727854321'],
    },
    social_links: {
      facebook: 'https://facebook.com/highstreetdentalstalbans',
      instagram: 'https://instagram.com/highstreetdental_uk',
    },
    broken_links_count: 2,
    text_excerpt:
      'High Street Dental Practice provides comprehensive dental care including Invisalign, teeth whitening, hygiene appointments and dental implants in St Albans. Dr. Jonathan Clarke BDS and Dr. Sarah Jenkins provide exceptional gentle dental care. Call our reception desk on 01727 854321 to book your initial consultation. Opening hours: Monday to Friday 9:00am - 5:30pm.',
    broken_links: [],
    created_at: new Date().toISOString(),
  };

  // Companies House record
  const testCompany: CompanyRecord = {
    id: 'company-test-01',
    lead_id: testLead.id,
    company_number: '08342190',
    legal_name: 'HIGH STREET DENTAL PRACTICE LIMITED',
    company_type: 'ltd',
    status: 'active',
    incorporation_date: '2013-01-15',
    sic_codes: ['86230 - Dental practice activities'],
    registered_address: '42 High Street, St Albans, Hertfordshire, AL1 3QZ',
    officers: ['CLARKE, Jonathan Michael (Director)', 'JENKINS, Sarah Elizabeth (Director)'],
    match_confidence: 'high',
    created_at: new Date().toISOString(),
  };

  console.log(`Running analyzeLead() for "${testLead.name}"...\n`);
  const storedAnalysis = await analyzeLead(testLead, testAudit, testCompany);

  // Validate with Zod
  const validationResult = LeadAnalysisSchema.safeParse(storedAnalysis.data);
  if (!validationResult.success) {
    console.error('Validation FAILED:', validationResult.error.format());
    process.exit(1);
  }

  console.log('✅ Zod Schema Validation PASSED!\n');
  console.log('--- OUTPUT JSON RESULT ---');
  console.log(JSON.stringify(storedAnalysis.data, null, 2));
  console.log('\n--- METRICS SUMMARY ---');
  console.log(`Lead Score: ${storedAnalysis.data.lead_score}/10`);
  console.log(`Score Reasoning: ${storedAnalysis.data.score_reasoning}`);
  console.log(`Recommended Primary Service: ${storedAnalysis.data.recommended_primary_service}`);
  console.log(`Best Contact Channel: ${storedAnalysis.data.best_contact_channel}`);
  console.log(`Decision Maker: ${storedAnalysis.data.decision_maker_guess}`);
  console.log(`Identified Weaknesses: ${storedAnalysis.data.weaknesses.length}`);
  console.log(`Identified Opportunities: ${storedAnalysis.data.opportunities.length}`);
}

main().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
