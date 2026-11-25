import { getLocalSqliteDb, closeLocalSqliteDb } from '../src/lib/db/sqlite';
import { saveSearchAndLeads, getLeadById, fallbackLeads } from '../src/lib/services/leads-service';
import { generatePitch, getStoredPitchesForLead } from '../src/lib/services/pitch-service';
import { saveSenderSettings, getSenderSettings } from '../src/lib/services/settings-service';
import { Lead } from '../src/types/database';

async function main() {
  console.log('--- Testing SQLite Persistence ---');
  
  // 1. Save valid sender profile
  await saveSenderSettings({
    name: 'Sarah Jenkins',
    trading_name: 'Jenkins Web Solutions',
    website: 'https://jenkinswebsolutions.co.uk',
    services: ['Website Redesign', 'Online Booking Automation'],
    credibility_statement: 'Helping independent Berkshire businesses modernize mobile bookings and web presence',
    whatsapp_number: '+447700900123',
    uk_contact_address: '100 King Street, Reading, RG1 2HF',
    opt_out_wording: 'Reply STOP to opt out anytime.',
  });
  console.log('Saved sender profile to SQLite.');

  // 2. Insert test lead
  const testLeadPlaceId = `test_place_${Date.now()}`;
  const testLeadRaw = {
    place_id: testLeadPlaceId,
    name: 'Berkshire Aesthetics Clinic',
    selected_name: 'Berkshire Aesthetics Clinic',
    website: 'https://berkshireaesthetics.example.co.uk',
    phone_e164: '+447911123456',
    phone_type: 'mobile' as const,
    whatsapp_likely: true,
    has_website: true,
    website_type: 'own_site' as const,
    rating: null,
    review_count: null,
    categories: ['Beauty salon', 'Skin care clinic'],
    status: 'discovered' as const,
    is_suppressed: false,
    outreach_class: 'corporate' as const,
  };

  const { leads } = await saveSearchAndLeads(
    { niche: 'clinics', location: 'Reading', radiusMiles: 5, maxResults: 1 },
    [testLeadRaw]
  );
  const leadId = leads[0].id;
  console.log(`Saved Lead ID: ${leadId}`);

  // 3. Close SQLite database (simulating server shutdown)
  console.log('Closing SQLite database connection (simulating server restart)...');
  closeLocalSqliteDb();
  fallbackLeads.clear();

  // 4. Reload SQLite database in fresh instance and assert records
  console.log('Re-opening SQLite database and querying lead and sender profile...');
  const reloadedProfile = await getSenderSettings();
  console.log('Reloaded profile:', reloadedProfile?.trading_name);
  if (!reloadedProfile || reloadedProfile.name !== 'Sarah Jenkins') {
    throw new Error('Persistence test failed: Sender profile not recovered from SQLite');
  }

  const reloadedLead = await getLeadById(leadId);
  console.log('Reloaded lead:', reloadedLead?.name);
  if (!reloadedLead || reloadedLead.name !== 'Berkshire Aesthetics Clinic') {
    throw new Error('Persistence test failed: Lead not recovered from SQLite');
  }

  console.log('PROVEN: SQLite persistence survived database close and re-opened cleanly.');
}

main().catch((err) => {
  console.error('Persistence test failed:', err);
  process.exit(1);
});
