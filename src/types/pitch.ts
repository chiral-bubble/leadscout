import { z } from 'zod';

export const PitchClaimSchema = z.object({
  text: z.string().describe('The specific factual statement or observation made in the pitch'),
  source_type: z
    .enum(['audit', 'page_text', 'osm', 'companies_house', 'psi', 'manual_note', 'manual_notes', 'lead_data'])
    .describe('Raw source provider'),
  source_field: z.string().optional().describe('Optional raw field in the source data'),
  source_snippet: z.string().describe('Verbatim quote or value from the raw data supporting this claim'),
});

export type PitchClaim = z.infer<typeof PitchClaimSchema>;

export const PitchVariantSchema = z.object({
  label: z.string(),
  subject: z.string().nullable().optional(),
  message: z.string(),
  word_count: z.number(),
  personalisation_used: z.array(z.string()).default([]),
  claims: z.array(PitchClaimSchema).min(1),
  warning: z.string().nullable().optional(),
});

export const PitchResultSchema = z.object({
  variants: z.array(PitchVariantSchema).min(3),
});

export type PitchVariant = z.infer<typeof PitchVariantSchema>;
export type PitchResult = z.infer<typeof PitchResultSchema>;

export type PitchTone = 'friendly' | 'professional' | 'casual';
export type PitchChannel = 'facebook_dm' | 'whatsapp' | 'email' | 'contact_form' | 'call_script';

export interface PitchOptions {
  tone: PitchTone;
  channel: PitchChannel;
  angle?: string;
  opted_in?: boolean;
}

export interface SenderProfile {
  name: string;
  trading_name: string;
  website: string;
  contact_email?: string;
  services?: string[];
  credibility_statement?: string;
}

export interface StoredPitch {
  id: string;
  lead_id: string;
  analysis_id?: string | null;
  channel: PitchChannel;
  tone: PitchTone;
  angle: string;
  variants: PitchVariant[];
  created_at: string;
}

export type OutreachStatus =
  | 'draft_opened'
  | 'sent'
  | 'replied'
  | 'declined'
  | 'bounced'
  | 'converted';

export interface OutreachLogEntry {
  id: string;
  lead_id: string;
  pitch_id?: string | null;
  channel: string;
  status: OutreachStatus;
  notes?: string | null;
  contacted_at: string;
  created_at: string;
}
