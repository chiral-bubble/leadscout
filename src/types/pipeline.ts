export type PipelineStatus =
  | 'new'
  | 'researched'
  | 'contacted'
  | 'replied'
  | 'call_booked'
  | 'proposal_sent'
  | 'won'
  | 'lost'
  | 'do_not_contact';

export const PIPELINE_COLUMNS: { id: PipelineStatus; label: string; color: string }[] = [
  { id: 'new', label: 'New', color: 'border-slate-300 bg-slate-50' },
  { id: 'researched', label: 'Researched', color: 'border-blue-300 bg-blue-50/50' },
  { id: 'contacted', label: 'Contacted', color: 'border-amber-300 bg-amber-50/50' },
  { id: 'replied', label: 'Replied', color: 'border-indigo-300 bg-indigo-50/50' },
  { id: 'call_booked', label: 'Call Booked', color: 'border-purple-300 bg-purple-50/50' },
  { id: 'proposal_sent', label: 'Proposal Sent', color: 'border-pink-300 bg-pink-50/50' },
  { id: 'won', label: 'Won', color: 'border-emerald-300 bg-emerald-50/50' },
  { id: 'lost', label: 'Lost', color: 'border-slate-200 bg-slate-100/50' },
  { id: 'do_not_contact', label: 'Do Not Contact', color: 'border-rose-300 bg-rose-50/50' },
];

export interface FollowUpReminder {
  id: string;
  lead_id: string;
  stage: 'day_3' | 'day_7';
  scheduled_for: string; // ISO string date
  status: 'pending' | 'sent' | 'dismissed';
  generated_message?: string | null;
  created_at: string;
}

export interface LeadNote {
  id: string;
  lead_id: string;
  text: string;
  created_at: string;
  updated_at: string;
}

export interface DashboardMetrics {
  leads_found: number;
  contacted: number;
  replies: number;
  reply_rate_pct: number;
  calls_booked: number;
  won: number;
  revenue_won_gbp: number;
  pipeline_potential_gbp: number;
}
