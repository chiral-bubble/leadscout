export type LeadStatus =
  | 'discovered'
  | 'audited'
  | 'analysed'
  | 'ready_for_outreach'
  | 'contacted'
  | 'in_conversation'
  | 'converted'
  | 'suppressed'
  | 'abandoned';

export type PhoneType = 'mobile' | 'landline' | 'unknown';

export type WebsiteType = 'none' | 'social_only' | 'builder' | 'own_site';

export type AuditStatus = 'pending' | 'auditing' | 'audited' | 'failed' | 'skipped';

export type OutreachClass = 'corporate' | 'individual_or_unknown' | 'blocked';

export type MatchConfidence = 'high' | 'medium' | 'low' | 'none';

export interface SearchRecord {
  id: string;
  niche: string;
  location: string;
  radius_miles: number;
  max_results: number;
  results_count: number;
  estimated_api_cost_gbp: number;
  status: 'pending' | 'running' | 'completed' | 'failed';
  error_message?: string | null;
  created_at: string;
}

export interface CompanyRecord {
  id: string;
  lead_id: string;
  company_number: string;
  legal_name: string;
  company_type: string; // 'ltd', 'llp', 'plc', etc.
  status: string; // 'active', 'dissolved', etc.
  incorporation_date?: string | null;
  sic_codes: string[];
  registered_address?: string | null;
  officers: string[]; // Director names only
  match_confidence: MatchConfidence;
  is_confirmed?: boolean;
  created_at: string;
}

export interface SuppressionRecord {
  id: string;
  domain?: string | null;
  email?: string | null;
  phone_e164?: string | null;
  company_number?: string | null;
  lead_id?: string | null;
  business_name?: string | null;
  reason: string;
  notes?: string | null;
  created_at: string;
}

export interface Lead {
  id: string;
  search_id?: string | null;
  place_id: string;
  source?: 'facebook' | 'google_maps' | 'osm' | 'website' | string;
  name: string;
  address?: string | null;
  postcode?: string | null;
  phone_raw?: string | null;
  phone_e164?: string | null;
  phone_type: PhoneType;
  whatsapp_likely: boolean;
  email?: string | null;
  website?: string | null;
  has_website: boolean;
  website_type: WebsiteType;
  rating?: number | null;
  review_count?: number | null;
  categories: string[];
  opening_hours?: Record<string, any> | null;
  google_maps_url?: string | null;
  business_status?: string | null;
  status: LeadStatus;
  is_suppressed: boolean;
  audit_status?: AuditStatus;
  lead_score?: number | null;
  outreach_class?: OutreachClass;
  pipeline_status?: string;
  notes?: string | null;
  manual_notes?: string | null;
  tags?: string[];
  next_follow_up_date?: string | null;
  follow_up_count?: number;
  last_activity_at?: string;
  company_record?: CompanyRecord | null;
  likely_decision_maker?: string | null;
  website_name?: string | null;
  selected_name?: string | null;
  has_contact_route?: boolean;
  created_at: string;
  updated_at: string;
}

export interface ContactCandidates {
  emails: string[];
  phones: string[];
}

export interface SocialLinks {
  instagram?: string;
  facebook?: string;
  linkedin?: string;
  tiktok?: string;
  x?: string;
}

export interface WebsiteAudit {
  id: string;
  lead_id: string;
  url_tested: string;
  final_url?: string | null;
  http_status?: number | null;
  uses_https: boolean;
  ssl_valid: boolean;
  ttfb_ms?: number | null;
  load_time_ms?: number | null;
  full_load_ms?: number | null;
  largest_contentful_paint_ms?: number | null;
  mobile_friendly: boolean;
  mobile_issues: string[];
  screenshot_desktop?: string | null;
  screenshot_mobile?: string | null;
  page_title?: string | null;
  meta_description?: string | null;
  h1_text?: string | null;
  detected_platform: 'WordPress' | 'Wix' | 'Squarespace' | 'Shopify' | 'Webflow' | 'Custom';
  copyright_year?: number | null;
  is_outdated_copyright: boolean;
  has_contact_form: boolean;
  has_online_booking: boolean;
  booking_providers: string[];
  has_ecommerce: boolean;
  has_live_chat: boolean;
  has_whatsapp_link: boolean;
  has_cookie_banner: boolean;
  has_privacy_policy: boolean;
  contact_candidates: ContactCandidates;
  social_links: SocialLinks;
  broken_links_count: number;
  broken_links: string[];
  text_excerpt: string;
  pages_visited?: string[];
  audit_error?: string | null;
  created_at: string;
}

export interface SearchParams {
  niche: string;
  location: string;
  radius_miles: number;
  max_results: 20 | 50 | 100;
}
