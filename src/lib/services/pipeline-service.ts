import Anthropic from '@anthropic-ai/sdk';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { Lead } from '@/types/database';
import {
  PipelineStatus,
  FollowUpReminder,
  LeadNote,
  DashboardMetrics,
} from '@/types/pipeline';
import { getLeadById, fallbackLeads } from '@/lib/services/leads-service';
import { getAnalysisForLead } from '@/lib/services/analysis-service';
import { addLeadToSuppression } from '@/lib/services/suppression-service';
import { getOutreachLogsForLead } from '@/lib/services/pitch-service';

// In-memory fallback caches
const fallbackReminders: Map<string, FollowUpReminder[]> = new Map(); // leadId -> reminders
const fallbackNotes: Map<string, LeadNote[]> = new Map(); // leadId -> notes

export function mapLeadToPipelineStatus(lead: Lead): PipelineStatus {
  if (lead.pipeline_status) {
    return lead.pipeline_status as PipelineStatus;
  }
  if (lead.is_suppressed || lead.outreach_class === 'blocked' || lead.status === 'suppressed') {
    return 'do_not_contact';
  }
  if (lead.status === 'converted') return 'won';
  if (lead.status === 'abandoned') return 'lost';
  if (lead.status === 'in_conversation') return 'replied';
  if (lead.status === 'contacted') return 'contacted';
  if (lead.status === 'analysed' || lead.status === 'audited') return 'researched';
  return 'new';
}

/**
 * Updates a lead's pipeline status, handles follow-up triggers and suppression.
 */
export async function updateLeadPipelineStatus(
  leadId: string,
  newStatus: PipelineStatus
): Promise<Lead> {
  let lead = await getLeadById(leadId);
  if (!lead) {
    // Check fallback
    lead = fallbackLeads.get(leadId) || null;
  }

  if (!lead) {
    throw new Error(`Lead ${leadId} not found`);
  }

  const now = new Date();
  const nowIso = now.toISOString();

  // 1. If moved to Contacted: create Day 3 and Day 7 follow-up reminders
  if (newStatus === 'contacted') {
    const day3Date = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000).toISOString();
    const day7Date = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();

    const existingReminders = fallbackReminders.get(leadId) || [];
    if (existingReminders.length === 0) {
      const r3: FollowUpReminder = {
        id: crypto.randomUUID(),
        lead_id: leadId,
        stage: 'day_3',
        scheduled_for: day3Date,
        status: 'pending',
        created_at: nowIso,
      };

      const r7: FollowUpReminder = {
        id: crypto.randomUUID(),
        lead_id: leadId,
        stage: 'day_7',
        scheduled_for: day7Date,
        status: 'pending',
        created_at: nowIso,
      };

      fallbackReminders.set(leadId, [r3, r7]);
      lead.next_follow_up_date = day3Date;
    }
  }

  // 2. If moved to Do Not Contact: add to suppression permanently
  if (newStatus === 'do_not_contact') {
    await addLeadToSuppression(lead, 'User marked Do Not Contact from pipeline');
    lead.is_suppressed = true;
    lead.outreach_class = 'blocked';
    lead.status = 'suppressed';
  }

  lead.pipeline_status = newStatus;
  lead.last_activity_at = nowIso;
  lead.updated_at = nowIso;

  // Persist to fallback cache
  fallbackLeads.set(lead.place_id, lead);

  // Persist to Supabase if configured
  const supabase = getSupabaseServerClient();
  if (supabase) {
    try {
      await supabase
        .from('leads')
        .update({
          status: newStatus === 'do_not_contact' ? 'suppressed' : newStatus === 'won' ? 'converted' : 'analysed',
          updated_at: nowIso,
        })
        .eq('id', leadId);
    } catch (err) {
      console.warn('Could not update status in Supabase:', err);
    }
  }

  return lead;
}

/**
 * Generates an automated Day 3 or Day 7 follow-up message using Anthropic or deterministic UK copywriting.
 * Enforces a strict cap of 2 follow-ups per lead, moving to "Cold" tag after that.
 */
export async function generateFollowUp(
  leadId: string,
  stage: 'day_3' | 'day_7'
): Promise<{ message: string; isCold: boolean; followUpCount: number }> {
  const lead = (await getLeadById(leadId)) || fallbackLeads.get(leadId);
  if (!lead) throw new Error(`Lead ${leadId} not found`);

  const currentCount = lead.follow_up_count || 0;

  // Strict cap: 2 follow-ups per lead. Stays in current column with 'Cold' tag only (no move to lost)
  if (currentCount >= 2) {
    if (!lead.tags) lead.tags = [];
    if (!lead.tags.includes('Cold')) lead.tags.push('Cold');
    // Cold leads stay in their column with a Cold tag only (no move to Lost)
    fallbackLeads.set(lead.place_id, lead);

    return {
      message: 'Maximum 2 follow-ups already reached. Lead has been tagged as "Cold".',
      isCold: true,
      followUpCount: currentCount,
    };
  }

  const storedAnalysis = await getAnalysisForLead(leadId);
  const firstName = extractFirstName(storedAnalysis?.data.decision_maker_guess);
  const greeting = firstName !== 'there' ? `Hi ${firstName}` : 'Hi there';

  const newCount = currentCount + 1;
  lead.follow_up_count = newCount;

  let message = '';

  if (stage === 'day_3') {
    // Day 3: Short polite nudge adding ONE new useful tip
    const tipOptions = [
      'spotted that adding a direct WhatsApp click-to-chat button usually increases mobile enquiries by 20-30% for local UK services',
      'compressing your large header images will noticeably improve your mobile Google PageSpeed score',
      'setting up a direct Google Review short-link in your customer receipts makes collecting 5-star reviews effortless',
    ];
    const tip = tipOptions[Math.floor(Math.random() * tipOptions.length)];

    message = `${greeting}, hope your week is going well. Just following up briefly on my earlier note regarding ${lead.name}. While reviewing your setup, another quick tip I noticed: ${tip}. No pressure at all — would you still be open to that quick 5-minute chat? If not relevant, just say and I won't message again.`;
  } else {
    // Day 7: Final "closing the loop" message with clear opt-out
    message = `${greeting}, following up one last time to close the loop on my previous messages. I assume website and booking updates aren't a priority right now, which is completely fine! I'll close our file and won't trouble you again. If your priorities change in future, feel free to keep my details. Wishing ${lead.name} continued success.`;

    // After Day 7 follow-up, mark as Cold
    if (!lead.tags) lead.tags = [];
    if (!lead.tags.includes('Cold')) lead.tags.push('Cold');
  }

  lead.last_activity_at = new Date().toISOString();
  fallbackLeads.set(lead.place_id, lead);

  // Update reminder status
  const reminders = fallbackReminders.get(leadId) || [];
  const targetReminder = reminders.find((r) => r.stage === stage);
  if (targetReminder) {
    targetReminder.status = 'sent';
    targetReminder.generated_message = message;
  }

  return {
    message,
    isCold: (lead.tags || []).includes('Cold'),
    followUpCount: newCount,
  };
}

function extractFirstName(rawName?: string | null): string {
  if (!rawName || rawName === 'unknown' || rawName.trim() === '') return 'there';
  const cleaned = rawName.replace(/\(.*?\)/g, '').trim();
  if (cleaned.includes(',')) {
    const parts = cleaned.split(',');
    if (parts[1]) {
      const token = parts[1].trim().split(/\s+/)[0];
      if (token) return token.charAt(0).toUpperCase() + token.slice(1).toLowerCase();
    }
  }
  const token = cleaned.replace(/^(dr|mr|mrs|ms)\.?\s+/i, '').split(/\s+/)[0];
  return token ? token.charAt(0).toUpperCase() + token.slice(1).toLowerCase() : 'there';
}

/**
 * Retrieves follow-up reminders for a lead.
 */
export async function getRemindersForLead(leadId: string): Promise<FollowUpReminder[]> {
  return fallbackReminders.get(leadId) || [];
}

/**
 * Gets leads for the daily "Today" action plan.
 */
export async function getTodayFocusLeads(dailyCap: number = 15): Promise<{
  leadsToMessage: Lead[];
  followUpsDue: { lead: Lead; reminder: FollowUpReminder }[];
  repliesToAnswer: Lead[];
}> {
  const allLeads = Array.from(fallbackLeads.values());
  const now = new Date();

  // 1. Leads to message (New / Researched, high score, not blocked, not suppressed)
  const leadsToMessage = allLeads
    .filter((l) => {
      const status = mapLeadToPipelineStatus(l);
      return (
        (status === 'new' || status === 'researched') &&
        !l.is_suppressed &&
        l.outreach_class !== 'blocked'
      );
    })
    .sort((a, b) => (b.lead_score || 0) - (a.lead_score || 0))
    .slice(0, dailyCap);

  // 2. Follow-ups due today
  const followUpsDue: { lead: Lead; reminder: FollowUpReminder }[] = [];
  for (const lead of allLeads) {
    const reminders = fallbackReminders.get(lead.id) || [];
    for (const r of reminders) {
      if (r.status === 'pending') {
        followUpsDue.push({ lead, reminder: r });
      }
    }
  }

  // 3. Replies to answer
  const repliesToAnswer = allLeads.filter((l) => {
    const status = mapLeadToPipelineStatus(l);
    return status === 'replied' || status === 'call_booked';
  });

  return {
    leadsToMessage,
    followUpsDue,
    repliesToAnswer,
  };
}

/**
 * Calculates live dashboard metrics.
 */
export async function getDashboardMetrics(): Promise<DashboardMetrics> {
  const allLeads = Array.from(fallbackLeads.values());
  const total = allLeads.length;

  let contacted = 0;
  let replies = 0;
  let callsBooked = 0;
  let won = 0;
  let revenueWon = 0;
  let pipelinePotential = 0;

  for (const l of allLeads) {
    const isCold = Array.isArray(l.tags) && l.tags.includes('Cold');
    const status = mapLeadToPipelineStatus(l);
    if (
      status === 'contacted' ||
      status === 'replied' ||
      status === 'call_booked' ||
      status === 'proposal_sent' ||
      status === 'won'
    ) {
      // Exclude cold leads from reply-rate denominators
      if (!isCold) {
        contacted++;
      }
    }
    if (status === 'replied' || status === 'call_booked' || status === 'proposal_sent' || status === 'won') {
      replies++;
    }
    if (status === 'call_booked' || status === 'proposal_sent' || status === 'won') {
      callsBooked++;
    }
    if (status === 'won') {
      won++;
      revenueWon += 1250; // average standard package
    }
    if (status !== 'lost' && status !== 'do_not_contact') {
      pipelinePotential += (l.lead_score || 5) * 150;
    }
  }

  const replyRate = contacted > 0 ? Math.round((replies / contacted) * 100) : 0;

  return {
    leads_found: total,
    contacted,
    replies,
    reply_rate_pct: replyRate,
    calls_booked: callsBooked,
    won,
    revenue_won_gbp: revenueWon,
    pipeline_potential_gbp: pipelinePotential,
  };
}

/**
 * Lead notes handlers.
 */
export async function saveLeadNotes(leadId: string, text: string): Promise<LeadNote> {
  const note: LeadNote = {
    id: crypto.randomUUID(),
    lead_id: leadId,
    text,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const existing = fallbackNotes.get(leadId) || [];
  existing.unshift(note);
  fallbackNotes.set(leadId, existing);

  // Update lead's main notes field
  const lead = await getLeadById(leadId);
  if (lead) {
    lead.notes = text;
    fallbackLeads.set(lead.place_id, lead);
  }

  return note;
}

export async function getLeadNotes(leadId: string): Promise<LeadNote[]> {
  return fallbackNotes.get(leadId) || [];
}
