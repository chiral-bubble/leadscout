import { generatePitch, logOutreach, getOutreachLogsForLead } from '../src/lib/services/pitch-service';
import { Lead } from '../src/types/database';
import { LeadAnalysis } from '../src/types/analysis';

async function main() {
  console.log('--- LeadScout UK Stage 5: Pitch Generator Verification ---\n');

  // Realistic UK Lead: High Street Dental Practice Ltd in St Albans
  const lead: Lead = {
    id: 'lead-test-dentist-01',
    place_id: 'ChIJN1t_tDeuEmsRUsoyG83frY4',
    name: 'High Street Dental Practice Ltd',
    address: '42 High Street, St Albans, Hertfordshire, AL1 3QZ',
    postcode: 'AL1 3QZ',
    phone_raw: '07911 123456',
    phone_e164: '+447911123456',
    phone_type: 'mobile',
    whatsapp_likely: true,
    website: 'https://highstreetdental-stalbans.co.uk',
    has_website: true,
    website_type: 'own_site',
    rating: 4.8,
    review_count: 142,
    categories: ['Dentist', 'Cosmetic Dentist'],
    business_status: 'OPERATIONAL',
    status: 'analysed',
    is_suppressed: false,
    outreach_class: 'corporate',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  // Stored analysis from Stage 4
  const analysis: LeadAnalysis = {
    business_summary:
      'High Street Dental Practice Ltd is a reputable UK Dentist business based in St Albans. They actively serve local patients with an established customer rating of 4.8.',
    business_type_guess: 'LTD Company',
    digital_presence: {
      website_quality: 'average',
      social_presence: 'active',
      booking_or_ordering_online: false,
      evidence: ['WordPress installation detected', 'No online booking integration'],
    },
    weaknesses: [
      {
        issue: 'Mobile viewport and responsiveness bottlenecks',
        evidence: 'Horizontal overflow detected at 390px, Missing viewport meta tag',
        severity: 'high',
        verified_on_pages: 3,
      },
      {
        issue: 'No online booking or instant scheduling integration',
        evidence: 'No scheduling widgets (Calendly, Fresha, etc.) detected on site',
        severity: 'medium',
        verified_on_pages: 3,
      },
      {
        issue: 'Outdated website copyright',
        evidence: 'Footer displays copyright 2019',
        severity: 'medium',
        verified_on_pages: 3,
      },
    ],
    opportunities: [
      {
        service: 'website_redesign',
        why: 'Modernise design and mobile layout to convert more search traffic into confirmed consultations.',
        estimated_value_gbp_range: '£750-£1,500',
        confidence: 'high',
      },
      {
        service: 'online_booking_system',
        why: 'Enable patients to book appointments directly 24/7 without manual telephone coordination.',
        estimated_value_gbp_range: '£600-£1,400',
        confidence: 'high',
      },
      {
        service: 'mobile_fix_and_speed',
        why: 'Fix viewport overflow so mobile users can browse and enquire smoothly.',
        estimated_value_gbp_range: '£500-£1,200',
        confidence: 'high',
      },
    ],
    recommended_primary_service: 'website_redesign',
    recommended_secondary_services: ['online_booking_system', 'mobile_fix_and_speed'],
    lead_score: 9,
    score_reasoning: 'High-priority opportunity with 3 digital gaps and proven customer demand (142 reviews).',
    best_contact_channel: 'whatsapp',
    channel_reasoning: 'Verified UK mobile number; WhatsApp provides direct personal communication.',
    personalisation_hooks: [
      {
        hook: 'Rated 4.8 stars across 142 Google reviews',
        source: 'google_business.rating',
        snippet: '4.8 stars across 142 Google reviews',
      },
      {
        hook: 'Based locally at 42 High Street, St Albans, Hertfordshire, AL1 3QZ',
        source: 'google_business.address',
        snippet: '42 High Street, St Albans, Hertfordshire, AL1 3QZ',
      },
      {
        hook: 'Attn: CLARKE, Jonathan Michael (Director) (Director on Companies House record)',
        source: 'companies_house.officers',
        snippet: 'CLARKE, Jonathan Michael',
      },
    ],
    decision_maker_guess: 'CLARKE, Jonathan Michael (Director)',
    risks_or_red_flags: [],
    outreach_class: 'corporate',
    data_gaps: [],
  };

  console.log(`Generating 3 WhatsApp variants for: ${lead.name}`);
  console.log(`Decision Maker: ${analysis.decision_maker_guess} -> First Name resolved to greeting`);
  console.log(`Personalisation Hook: "${analysis.personalisation_hooks[0]}"\n`);

  // 1. Test WhatsApp Pitch Generation
  const pitchResult = await generatePitch(
    lead.id,
    {
      channel: 'whatsapp',
      tone: 'friendly',
      angle: 'website_redesign',
    },
    lead,
    analysis
  );

  console.log('✅ Generated 3 WhatsApp Pitch Variants Successfully!\n');

  pitchResult.variants.forEach((v, index) => {
    console.log(`-------------------------------------------------------------------`);
    console.log(`[${v.label}]`);
    console.log(`Word Count: ${v.word_count} words (Requirement: 50-80 words)`);
    console.log(`Personalisation Used: ${v.personalisation_used.join(', ')}`);
    if (v.warning) console.log(`Warning: ${v.warning}`);
    console.log(`\nMessage:\n"${v.message}"\n`);

    // Verify WhatsApp URL
    const cleanNumber = lead.phone_e164!.replace(/[^0-9]/g, '');
    const waUrl = `https://wa.me/${cleanNumber}?text=${encodeURIComponent(v.message)}`;
    console.log(`Click-to-Chat Link:\n${waUrl}\n`);
  });

  // 2. Test Outreach Logging
  console.log('Testing Outreach Logging...');
  const logEntry = await logOutreach(
    lead.id,
    pitchResult.id,
    'whatsapp',
    'draft_opened',
    'User clicked Open in WhatsApp button'
  );
  console.log('✅ Logged outreach event:', logEntry);

  const logs = await getOutreachLogsForLead(lead.id);
  console.log(`✅ Retrieved ${logs.length} outreach log entries for lead.`);
}

main().catch((err) => {
  console.error('Test error:', err);
  process.exit(1);
});
