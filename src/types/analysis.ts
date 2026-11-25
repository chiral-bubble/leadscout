import { z } from 'zod';

export const PersonalisationHookSchema = z.object({
  hook: z.string().describe('The verified factual observation or detail to mention in outreach'),
  source: z.string().describe('e.g. audit.text_excerpt, osm.tags.opening_hours, companies_house.officers'),
  snippet: z.string().describe('Verbatim quote or number from source proving this observation'),
});

export type PersonalisationHook = z.infer<typeof PersonalisationHookSchema>;

export const LeadAnalysisSchema = z.object({
  business_summary: z.string().describe('2 sentences on what they do and who they serve'),
  business_type_guess: z.string(),
  digital_presence: z.object({
    website_quality: z.enum(['none', 'poor', 'average', 'good']),
    social_presence: z.enum(['none', 'weak', 'active']),
    booking_or_ordering_online: z.boolean(),
    evidence: z.array(z.string()),
  }),
  weaknesses: z.array(
    z.object({
      issue: z.string(),
      evidence: z.string(),
      severity: z.enum(['low', 'medium', 'high', 'not_verified']),
      verified_on_pages: z.number().optional(),
    })
  ),
  opportunities: z.array(
    z.object({
      service: z.string().describe('one of the allowed services'),
      why: z.string(),
      estimated_value_gbp_range: z
        .string()
        .transform((v) => (v.startsWith('£') ? v : `£${v}`))
        .describe('e.g. £600-£1,500 (must start with £)'),
      confidence: z.enum(['low', 'medium', 'high']),
    })
  ),
  recommended_primary_service: z.string(),
  recommended_secondary_services: z.array(z.string()),
  lead_score: z.number().min(1).max(10),
  score_reasoning: z.string(),
  best_contact_channel: z.enum(['whatsapp', 'email', 'phone_call', 'contact_form', 'none']),
  channel_reasoning: z.string(),
  personalisation_hooks: z.array(PersonalisationHookSchema).describe('2-4 specific, true details with verbatim source snippets'),
  decision_maker_guess: z.string().describe('name/title or unknown'),
  greeting_name: z.string().nullable().optional(),
  greeting_name_source: z.enum(['companies_house_officer', 'page_current_staff', 'unknown']).nullable().optional(),
  risks_or_red_flags: z.array(z.string()),
  outreach_class: z.enum(['corporate', 'individual_or_unknown', 'blocked']),
  data_gaps: z.array(z.string()),
});

export type LeadAnalysis = z.infer<typeof LeadAnalysisSchema>;

export interface StoredAnalysis {
  id: string;
  lead_id: string;
  model_used: string;
  lead_score: number;
  data: LeadAnalysis;
  created_at: string;
}
