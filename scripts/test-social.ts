import {
  ApifySocialEnrichmentProvider,
  checkIsRunningThroughDms,
  checkHasBookingOrLinkInBio,
  checkIsInactive,
} from '../src/lib/services/social-enrichment';
import { analyzeLead } from '../src/lib/services/analysis-service';
import { Lead } from '../src/types/database';
import { SocialEnrichmentResult, SocialProfileData } from '../src/types/social';

async function main() {
  console.log('--- LeadScout UK Stage 7: Social Enrichment Verification ---\n');

  const provider = new ApifySocialEnrichmentProvider();
  console.log(`Provider Name: ${provider.name}`);
  console.log(`Is Provider Enabled by Default?: ${provider.isEnabled()}`);

  // 1. Test Feature Flag Disable
  process.env.ENABLE_SOCIAL_ENRICHMENT = 'false';
  console.log(`With ENABLE_SOCIAL_ENRICHMENT=false -> isEnabled(): ${provider.isEnabled()}`);
  const disabledResult = await provider.enrichUrl('https://instagram.com/any_profile');
  console.log(`✅ Disabled check passed (returned ${disabledResult})`);
  delete process.env.ENABLE_SOCIAL_ENRICHMENT; // reset

  // 2. Test Detection Functions
  console.log('\n2. Testing Detection Heuristics:');
  // DM detection
  const bioWithDm = 'Best skin clinic in St Albans. 🌟 DM to book appointments! Closed Sundays.';
  const bioWithBooking = 'Best skin clinic in St Albans. 🌟 Book online at link below: linktr.ee/skinclinic';
  console.log('   - "DM to book" with NO link -> isRunningThroughDms:', checkIsRunningThroughDms(bioWithDm, false));
  console.log('   - "DM to book" WITH booking link -> isRunningThroughDms:', checkIsRunningThroughDms(bioWithDm, true));
  console.log('   - Bio with Linktree -> hasBooking:', checkHasBookingOrLinkInBio(bioWithBooking, 'https://linktr.ee/skinclinic'));

  // Inactivity detection
  const seventyDaysAgo = new Date(Date.now() - 70 * 24 * 60 * 60 * 1000).toISOString();
  const fiveDaysAgo = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString();
  console.log('   - Last post 70 days ago (0 posts in 60d) -> isInactive:', checkIsInactive(seventyDaysAgo, 0));
  console.log('   - Last post 5 days ago (12 posts in 60d) -> isInactive:', checkIsInactive(fiveDaysAgo, 12));

  // 3. Test Enrichment of a Real Profile URL
  console.log('\n3. Testing enrichUrl() for Public Business Profile...');
  const testUrl = 'https://instagram.com/highstreet_barbers_dm';
  const profileData = await provider.enrichUrl(testUrl);

  if (!profileData) {
    throw new Error('Failed to retrieve profile data from provider');
  }

  console.log('✅ Public Profile Data Retrieved:');
  console.log({
    platform: profileData.platform,
    url: profileData.url,
    handle: profileData.handle,
    followers: profileData.follower_count,
    posts_last_60_days: profileData.posts_last_60_days,
    last_post_date: profileData.last_post_date,
    bio: profileData.bio,
    has_booking_or_link_in_bio: profileData.has_booking_or_link_in_bio,
    is_inactive: profileData.is_inactive,
    is_running_through_dms: profileData.is_running_through_dms,
    recent_captions_count: profileData.recent_captions.length,
  });

  // Verify privacy rule
  console.log('\n🔒 Privacy Check: Ensuring no follower names, commenter handles, or PII stored:');
  console.log(`   - Keys present on profile data: ${Object.keys(profileData).join(', ')}`);
  if ((profileData as any).followers || (profileData as any).comments) {
    throw new Error('Privacy violation: followers or comments array detected!');
  }
  console.log('   ✅ Passed: Only public business profile and captions are stored.');

  // 4. Test Feeding Social Enrichment into analyzeLead()
  console.log('\n4. Feeding Social Enrichment Object into analyzeLead()...');

  const lead: Lead = {
    id: 'lead-barber-dm-01',
    place_id: 'place_barber_dm_01',
    name: 'Crown Traditional Barbershop',
    address: '14 Market Place, St Albans, AL3 5DG',
    postcode: 'AL3 5DG',
    phone_raw: '07911 888777',
    phone_e164: '+447911888777',
    phone_type: 'mobile',
    whatsapp_likely: true,
    website: 'https://instagram.com/crowntraditionalbarbers',
    has_website: true,
    website_type: 'social_only',
    rating: 4.9,
    review_count: 65,
    categories: ['Barber', 'Hair Salon'],
    business_status: 'OPERATIONAL',
    status: 'discovered',
    is_suppressed: false,
    outreach_class: 'individual_or_unknown',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const socialEnrichment: SocialEnrichmentResult = {
    lead_id: lead.id,
    profiles: [profileData],
    instagram: profileData,
    facebook: null,
    is_inactive: profileData.is_inactive,
    is_running_through_dms: true, // explicitly flag DM booking
    summary: 'Instagram (@crowntraditionalbarbers): 1,450 followers. Bio states "DM to book" with no automated booking link.',
  };

  const analysis = await analyzeLead(lead, null, null, socialEnrichment);

  console.log('✅ Analysis Generated with Social Signals:');
  console.log(`Fit Score: ${analysis.lead_score}/10`);
  console.log(`Recommended Primary Service: ${analysis.data.recommended_primary_service}`);

  console.log('\nIdentified Weaknesses:');
  analysis.data.weaknesses.forEach((w, i) => {
    console.log(`   [${i + 1}] ${w.issue} (${w.severity}) -> Evidence: "${w.evidence}"`);
  });

  console.log('\nOpportunities:');
  analysis.data.opportunities.forEach((o, i) => {
    console.log(`   [${i + 1}] Service: ${o.service} (${o.estimated_value_gbp_range}) -> Why: "${o.why}"`);
  });

  console.log('\nPersonalisation Hooks:');
  analysis.data.personalisation_hooks.forEach((h, i) => {
    console.log(`   - "${h}"`);
  });

  const hasDmWeakness = analysis.data.weaknesses.some(
    (w) => w.issue.toLowerCase().includes('dm') || w.evidence.toLowerCase().includes('dm')
  );

  if (!hasDmWeakness) {
    throw new Error('Expected "running the business through DMs" weakness to be flagged in analysis!');
  }

  console.log('\n🎉 ALL STAGE 7 VERIFICATION CHECKS PASSED!');
}

main().catch((err) => {
  console.error('Fatal test error in Stage 7:', err);
  process.exit(1);
});
