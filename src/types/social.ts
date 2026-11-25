export interface SocialProfileData {
  platform: 'instagram' | 'facebook' | 'unknown';
  url: string;
  handle?: string | null;
  follower_count: number | null;
  posts_last_60_days: number;
  last_post_date: string | null; // ISO string
  bio: string | null;
  has_booking_or_link_in_bio: boolean;
  link_in_bio_url?: string | null;
  recent_captions: string[]; // max 5 public post captions (no user comments/followers stored)
  is_inactive: boolean; // no post in 60+ days
  is_running_through_dms: boolean; // bio indicates "DM to book" and has no booking link
  enriched_at: string;
}

export interface SocialEnrichmentResult {
  lead_id: string;
  profiles: SocialProfileData[];
  instagram?: SocialProfileData | null;
  facebook?: SocialProfileData | null;
  is_inactive: boolean;
  is_running_through_dms: boolean;
  summary: string;
}

export interface SocialEnrichmentProvider {
  name: string;
  isEnabled(): boolean;
  enrichUrl(url: string): Promise<SocialProfileData | null>;
  enrichLead(leadId: string, socialUrls: string[]): Promise<SocialEnrichmentResult | null>;
}
