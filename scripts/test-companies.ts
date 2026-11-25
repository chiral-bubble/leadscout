import { matchCompaniesHouse } from '../src/lib/services/companies-house';
import {
  computeOutreachClass,
  addLeadToSuppression,
  isLeadSuppressed,
  bulkImportSuppression,
  getSuppressionList,
} from '../src/lib/services/suppression-service';
import { Lead } from '../src/types/database';

async function main() {
  console.log('--- LeadScout UK Stage 3: Companies House & Outreach Eligibility Tests ---\n');

  // Test Lead 1: Registered Company Candidate
  console.log('1. Testing Companies House Lookup for Registered Business...');
  const lead1: Lead = {
    id: 'lead-test-1',
    place_id: 'test_place_1',
    name: 'Apex Plumbers Ltd',
    postcode: 'BS1 5HH',
    phone_e164: '+447911123456',
    phone_type: 'mobile',
    whatsapp_likely: true,
    website: 'https://apexplumbing.co.uk',
    has_website: true,
    website_type: 'own_site',
    categories: ['plumber'],
    status: 'discovered',
    is_suppressed: false,
    review_count: 24,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const company1 = await matchCompaniesHouse(lead1.name, lead1.postcode, lead1.id);
  console.log('Company Record Result:', {
    company_number: company1?.company_number,
    legal_name: company1?.legal_name,
    company_type: company1?.company_type,
    status: company1?.status,
    match_confidence: company1?.match_confidence,
    officers: company1?.officers,
  });

  const outreachClass1 = computeOutreachClass(lead1, company1, false);
  console.log('Outreach Class:', outreachClass1);
  if (outreachClass1 !== 'corporate') {
    throw new Error(`Expected corporate outreach class, got ${outreachClass1}`);
  }

  // Test Lead 2: Sole Trader / Unregistered
  console.log('\n2. Testing Unregistered Business (Sole Trader)...');
  const lead2: Lead = {
    id: 'lead-test-2',
    place_id: 'test_place_2',
    name: 'Dave Dave Plumbing Local Handyman',
    postcode: 'M1 4BT',
    phone_e164: '+447911999888',
    phone_type: 'mobile',
    whatsapp_likely: true,
    has_website: false,
    website_type: 'none',
    categories: ['plumber'],
    status: 'discovered',
    is_suppressed: false,
    review_count: 5,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const outreachClass2 = computeOutreachClass(lead2, null, false);
  console.log('Sole Trader Outreach Class:', outreachClass2);
  if (outreachClass2 !== 'individual_or_unknown') {
    throw new Error(`Expected individual_or_unknown, got ${outreachClass2}`);
  }

  // Test 3: Suppression List & Blocking
  console.log('\n3. Testing Suppression List & "Do Not Contact" Block...');
  await addLeadToSuppression(lead1, 'user_requested', 'Blocked during test');

  const isSupp = await isLeadSuppressed(lead1);
  console.log('Is lead 1 suppressed?:', isSupp);
  if (!isSupp) throw new Error('Lead 1 should be suppressed');

  const outreachClassBlocked = computeOutreachClass(lead1, company1, isSupp);
  console.log('Outreach Class when suppressed:', outreachClassBlocked);
  if (outreachClassBlocked !== 'blocked') {
    throw new Error(`Expected blocked outreach class, got ${outreachClassBlocked}`);
  }

  // Test 4: Bulk Import Numbers/Emails
  console.log('\n4. Testing Bulk Import of Numbers & Emails...');
  const importResult = await bulkImportSuppression(
    '07911000111\ncompetitor@bristolplumbing.co.uk\n01614960999\nbadlead.co.uk',
    'competitor_list'
  );
  console.log('Bulk import added count:', importResult.addedCount);
  if (importResult.addedCount < 4) {
    throw new Error(`Expected 4 imported entries, got ${importResult.addedCount}`);
  }

  const list = await getSuppressionList();
  console.log('Current total suppression entries:', list.length);

  console.log('\n>>> STAGE 3 COMPANIES HOUSE & OUTREACH ELIGIBILITY CHECKS PASSED! <<<');
  process.exit(0);
}

main().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
