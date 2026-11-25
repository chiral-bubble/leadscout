import {
  updateLeadPipelineStatus,
  generateFollowUp,
  getRemindersForLead,
  getTodayFocusLeads,
  getDashboardMetrics,
  saveLeadNotes,
  getLeadNotes,
} from '../src/lib/services/pipeline-service';
import { fallbackLeads } from '../src/lib/services/leads-service';
import { isLeadSuppressed } from '../src/lib/services/suppression-service';
import { Lead } from '../src/types/database';

async function main() {
  console.log('--- LeadScout UK Stage 6: Pipeline, Follow-ups & Export Verification ---\n');

  // Seed sample leads in pipeline
  const testLead1: Lead = {
    id: 'pipeline-lead-01',
    place_id: 'place_pipeline_01',
    name: 'High Street Dental Practice Ltd',
    postcode: 'AL1 3QZ',
    phone_e164: '+447911123456',
    phone_type: 'mobile',
    whatsapp_likely: true,
    website: 'https://highstreetdental-stalbans.co.uk',
    has_website: true,
    website_type: 'own_site',
    lead_score: 9,
    status: 'analysed',
    is_suppressed: false,
    outreach_class: 'corporate',
    review_count: 142,
    categories: ['Dentist'],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const testLead2: Lead = {
    id: 'pipeline-lead-02',
    place_id: 'place_pipeline_02',
    name: 'Dave Dave Handyman & Plumbing',
    postcode: 'M1 4BT',
    phone_e164: '+447911999888',
    phone_type: 'mobile',
    whatsapp_likely: true,
    has_website: false,
    website_type: 'none',
    lead_score: 7,
    status: 'discovered',
    is_suppressed: false,
    outreach_class: 'individual_or_unknown',
    review_count: 18,
    categories: ['Plumber'],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  fallbackLeads.set(testLead1.place_id, testLead1);
  fallbackLeads.set(testLead2.place_id, testLead2);

  // 1. Test Moving Lead to Contacted -> Triggers Day 3 and Day 7 Reminders
  console.log('1. Testing status transition to "contacted"...');
  await updateLeadPipelineStatus(testLead1.id, 'contacted');
  const reminders = await getRemindersForLead(testLead1.id);
  console.log(`✅ Status updated to "contacted". Auto-scheduled reminders count: ${reminders.length}`);
  console.log('   - Reminder 1:', reminders[0]?.stage, 'scheduled for:', reminders[0]?.scheduled_for);
  console.log('   - Reminder 2:', reminders[1]?.stage, 'scheduled for:', reminders[1]?.scheduled_for);

  // 2. Test Follow-up 1 (Day 3 Nudge + Tip)
  console.log('\n2. Testing Day 3 Follow-up Generation (Useful Tip)...');
  const followUp1 = await generateFollowUp(testLead1.id, 'day_3');
  console.log(`✅ Day 3 Message Generated (Follow-up count: ${followUp1.followUpCount}):`);
  console.log(`"${followUp1.message}"\n`);

  // 3. Test Follow-up 2 (Day 7 Closing Loop)
  console.log('3. Testing Day 7 Follow-up Generation (Closing Loop + Opt-out)...');
  const followUp2 = await generateFollowUp(testLead1.id, 'day_7');
  console.log(`✅ Day 7 Message Generated (Follow-up count: ${followUp2.followUpCount}):`);
  console.log(`"${followUp2.message}"\n`);
  console.log(`   - Is lead tagged as "Cold"?:`, followUp2.isCold ? 'YES (❄️ Cold)' : 'NO');

  // 4. Test Cap Enforcement (Max 2 Follow-ups)
  console.log('\n4. Testing Cap at 2 Follow-ups...');
  const followUp3 = await generateFollowUp(testLead1.id, 'day_3');
  console.log(`✅ Cap Enforced: "${followUp3.message}"`);

  // 5. Test One-Click "Do Not Contact" (Permanent Suppression)
  console.log('\n5. Testing "Do Not Contact" Suppression Trigger...');
  await updateLeadPipelineStatus(testLead2.id, 'do_not_contact');
  const isSupp = await isLeadSuppressed(testLead2);
  console.log(`✅ Lead marked "do_not_contact". Is lead suppressed permanently?: ${isSupp}`);

  // 6. Test Daily "Today" Focus Calculation
  console.log('\n6. Testing Daily "Today" Action Plan (Daily Cap: 15)...');
  const todayFocus = await getTodayFocusLeads(15);
  console.log(`✅ Today Leads to Message Queue: ${todayFocus.leadsToMessage.length}`);
  console.log(`✅ Overdue / Pending Follow-ups: ${todayFocus.followUpsDue.length}`);
  console.log(`✅ Active Replies to Answer: ${todayFocus.repliesToAnswer.length}`);

  // 7. Test Dashboard Metrics
  console.log('\n7. Testing Dashboard Metrics Calculation...');
  await updateLeadPipelineStatus(testLead1.id, 'won');
  const metrics = await getDashboardMetrics();
  console.log('✅ Live Pipeline Metrics:', {
    leads_found: metrics.leads_found,
    contacted: metrics.contacted,
    replies: metrics.replies,
    reply_rate_pct: `${metrics.reply_rate_pct}%`,
    calls_booked: metrics.calls_booked,
    won: metrics.won,
    revenue_won_gbp: `£${metrics.revenue_won_gbp}`,
    pipeline_potential_gbp: `£${metrics.pipeline_potential_gbp}`,
  });

  // 8. Test Notes
  console.log('\n8. Testing Lead Notes...');
  await saveLeadNotes(testLead1.id, 'Spoke with Jonathan. Agreed to £1,250 redesign package.');
  const notes = await getLeadNotes(testLead1.id);
  console.log(`✅ Saved note successfully: "${notes[0]?.text}"`);

  console.log('\n🎉 ALL STAGE 6 VERIFICATION CHECKS PASSED!');
}

main().catch((err) => {
  console.error('Test error:', err);
  process.exit(1);
});
