import {
  SocialEnrichmentProvider,
  SocialProfileData,
  SocialEnrichmentResult,
} from '@/types/social';
import { getSupabaseServerClient } from '@/lib/supabase/server';

// In-memory cache for social enrichment results
const fallbackSocialEnrichments: Map<string, SocialEnrichmentResult> = new Map();

/**
 * Checks whether text or bio indicates the business takes orders/bookings manually through DMs.
 */
export function checkIsRunningThroughDms(bio: string | null, hasBookingLink: boolean): boolean {
  if (!bio || hasBookingLink) return false;

  const dmRegex = /\b(dm|message|inbox)\s+(to|for)\s+(book|booking|appointments?|enquir|prices?|order|info)\b/i;
  const dmUsRegex = /\b(dm|message)\s+(us|me)\s+(to|for)\s+(book|appointments?|enquiries?)\b/i;
  const simpleDmRegex = /\b(dm|message)\s+(to\s+book|for\s+booking)\b/i;

  return dmRegex.test(bio) || dmUsRegex.test(bio) || simpleDmRegex.test(bio);
}

/**
 * Checks whether bio or external links contain an active booking or link-in-bio tool.
 */
export function checkHasBookingOrLinkInBio(bio: string | null, linkUrl: string | null): boolean {
  const combined = `${bio || ''} ${linkUrl || ''}`.toLowerCase();

  const bookingDomains = [
    'linktr.ee',
    'linktree',
    'beacons.ai',
    'bio.link',
    'fresha.com',
    'treatwell.co.uk',
    'calendly.com',
    'acuityscheduling.com',
    'booksy.com',
    'setmore.com',
    'mindbodyonline.com',
    'timely.com',
    'phorest.com',
    'ovatu.com',
    'vagaro.com',
    'opentable.co.uk',
    'resdiary.com',
  ];

  return bookingDomains.some((d) => combined.includes(d));
}

/**
 * Checks whether a business is considered inactive on social media (no post in 60+ days).
 */
export function checkIsInactive(lastPostDate: string | null, postsLast60Days: number): boolean {
  if (postsLast60Days === 0) return true;
  if (!lastPostDate) return true;

  const lastPost = new Date(lastPostDate).getTime();
  const sixtyDaysAgo = Date.now() - 60 * 24 * 60 * 60 * 1000;

  return lastPost < sixtyDaysAgo;
}

/**
 * Apify Implementation of SocialEnrichmentProvider.
 * Fetches only public business information (no follower or commenter personal data).
 * Easily toggled with env flag ENABLE_SOCIAL_ENRICHMENT=true/false.
 */
export class ApifySocialEnrichmentProvider implements SocialEnrichmentProvider {
  name = 'ApifySocialEnrichment';

  isEnabled(): boolean {
    const flag = process.env.ENABLE_SOCIAL_ENRICHMENT;
    if (flag === 'false' || flag === '0') return false;
    return true;
  }

  async enrichUrl(url: string): Promise<SocialProfileData | null> {
    if (!this.isEnabled()) return null;

    const lower = url.toLowerCase();
    const isInstagram = lower.includes('instagram.com');
    const isFacebook = lower.includes('facebook.com');

    const platform: 'instagram' | 'facebook' | 'unknown' = isInstagram
      ? 'instagram'
      : isFacebook
      ? 'facebook'
      : 'unknown';

    const handle = this.extractHandle(url, platform);
    const token = process.env.APIFY_TOKEN || process.env.APIFY_API_TOKEN;

    // If Apify token is provided and valid, attempt Apify Actor execution
    if (token && token.trim() !== '' && token !== 'your-apify-token') {
      try {
        const apifyResult = await this.callApifyActor(handle, platform, token);
        if (apifyResult) return apifyResult;
      } catch (err) {
        console.warn('Apify actor call failed, falling back to heuristic parsing:', err);
      }
    }

    const dataMode = process.env.DATA_MODE || 'live';
    if (dataMode === 'live') {
      // In live mode, do NOT generate synthetic heuristic profile data
      return null;
    }

    // Heuristic public profile analysis for testing & zero-cost operations only in demo mode
    return this.generateHeuristicProfile(url, platform, handle);
  }

  async enrichLead(
    leadId: string,
    socialUrls: string[]
  ): Promise<SocialEnrichmentResult | null> {
    if (!this.isEnabled() || !socialUrls || socialUrls.length === 0) {
      return null;
    }

    const profiles: SocialProfileData[] = [];

    for (const url of socialUrls) {
      try {
        const data = await this.enrichUrl(url);
        if (data) profiles.push(data);
      } catch (err) {
        console.warn(`Failed to enrich social URL ${url}:`, err);
      }
    }

    if (profiles.length === 0) return null;

    const instagram = profiles.find((p) => p.platform === 'instagram') || null;
    const facebook = profiles.find((p) => p.platform === 'facebook') || null;

    const isInactive = profiles.some((p) => p.is_inactive);
    const isRunningThroughDms = profiles.some((p) => p.is_running_through_dms);

    const summaryParts: string[] = [];
    if (instagram) {
      summaryParts.push(
        `Instagram (@${instagram.handle || 'profile'}): ${instagram.follower_count || 'unknown'} followers, ${instagram.posts_last_60_days} posts in last 60 days.`
      );
    }
    if (facebook) {
      summaryParts.push(
        `Facebook: ${facebook.follower_count || 'unknown'} followers, ${facebook.posts_last_60_days} posts in last 60 days.`
      );
    }
    if (isRunningThroughDms) {
      summaryParts.push('⚠️ Bio instructs clients to "DM to book" with no automated booking link.');
    }
    if (isInactive) {
      summaryParts.push('⚠️ Inactive socials: No posts published in the last 60+ days.');
    }

    const result: SocialEnrichmentResult = {
      lead_id: leadId,
      profiles,
      instagram,
      facebook,
      is_inactive: isInactive,
      is_running_through_dms: isRunningThroughDms,
      summary: summaryParts.join(' '),
    };

    // Cache result
    fallbackSocialEnrichments.set(leadId, result);

    return result;
  }

  private extractHandle(url: string, platform: string): string {
    try {
      const parsed = new URL(url.startsWith('http') ? url : `https://${url}`);
      const parts = parsed.pathname.split('/').filter(Boolean);
      return parts[0] || 'business';
    } catch {
      return 'business';
    }
  }

  private async callApifyActor(
    handle: string,
    platform: string,
    token: string
  ): Promise<SocialProfileData | null> {
    if (platform !== 'instagram') return null;

    // Call Apify Instagram Scraper actor run-sync endpoint
    const endpoint = `https://api.apify.com/v2/acts/apify~instagram-profile-scraper/run-sync-get-dataset-items?token=${token}`;
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        usernames: [handle],
        resultsLimit: 5,
      }),
    });

    if (!response.ok) {
      throw new Error(`Apify returned status ${response.status}`);
    }

    const items = await response.json();
    if (!Array.isArray(items) || items.length === 0) return null;

    const item = items[0];
    const bio: string = item.biography || '';
    const externalUrl: string = item.externalUrl || '';
    const hasBooking = checkHasBookingOrLinkInBio(bio, externalUrl);
    const isDms = checkIsRunningThroughDms(bio, hasBooking);

    const latestPosts = item.latestPosts || [];
    const captions: string[] = latestPosts
      .slice(0, 5)
      .map((p: any) => p.caption || '')
      .filter(Boolean);

    const sixtyDaysAgo = Date.now() - 60 * 24 * 60 * 60 * 1000;
    const postsLast60Days = latestPosts.filter((p: any) => {
      const d = p.timestamp ? new Date(p.timestamp).getTime() : 0;
      return d >= sixtyDaysAgo;
    }).length;

    const lastPostDate = latestPosts[0]?.timestamp || null;
    const isInactive = checkIsInactive(lastPostDate, postsLast60Days);

    return {
      platform: 'instagram',
      url: `https://instagram.com/${handle}`,
      handle,
      follower_count: item.followersCount || null,
      posts_last_60_days: postsLast60Days,
      last_post_date: lastPostDate,
      bio,
      has_booking_or_link_in_bio: hasBooking,
      link_in_bio_url: externalUrl || null,
      recent_captions: captions,
      is_inactive: isInactive,
      is_running_through_dms: isDms,
      enriched_at: new Date().toISOString(),
    };
  }

  private generateHeuristicProfile(
    url: string,
    platform: 'instagram' | 'facebook' | 'unknown',
    handle: string
  ): SocialProfileData {
    const isTestDm = handle.includes('dm') || handle.includes('barber') || handle.includes('clinic');
    const isTestInactive = handle.includes('old') || handle.includes('inactive');

    const bio = isTestDm
      ? `Award-winning local clinic. ✨ Appointments available weekly. 📩 DM to book your slot! No walk-ins.`
      : `Official page for ${handle.replace(/_/g, ' ')}. Providing high quality services in the UK.`;

    const linkUrl = isTestDm ? null : `https://${handle}.co.uk`;
    const hasBooking = checkHasBookingOrLinkInBio(bio, linkUrl);
    const isDms = checkIsRunningThroughDms(bio, hasBooking);

    const now = Date.now();
    const lastPostDate = isTestInactive
      ? new Date(now - 75 * 24 * 60 * 60 * 1000).toISOString() // 75 days ago (inactive)
      : new Date(now - 4 * 24 * 60 * 60 * 1000).toISOString(); // 4 days ago (active)

    const postsLast60Days = isTestInactive ? 0 : 8;
    const isInactive = checkIsInactive(lastPostDate, postsLast60Days);

    return {
      platform,
      url,
      handle,
      follower_count: 1450,
      posts_last_60_days: postsLast60Days,
      last_post_date: lastPostDate,
      bio,
      has_booking_or_link_in_bio: hasBooking,
      link_in_bio_url: linkUrl,
      recent_captions: [
        'Fresh results from our morning appointments! 🦷✨',
        'Weekend clinic hours are now open for emergency consultations.',
        'Friendly reminder to review your dental hygiene routine this month.',
      ],
      is_inactive: isInactive,
      is_running_through_dms: isDms,
      enriched_at: new Date().toISOString(),
    };
  }
}

// Default exportable instance
export const defaultSocialProvider = new ApifySocialEnrichmentProvider();

export async function enrichLeadSocials(
  leadId: string,
  socialLinks: Record<string, string>,
  provider: SocialEnrichmentProvider = defaultSocialProvider
): Promise<SocialEnrichmentResult | null> {
  const urls = Object.values(socialLinks).filter(Boolean);
  return provider.enrichLead(leadId, urls);
}

export function getSocialEnrichmentForLead(leadId: string): SocialEnrichmentResult | null {
  return fallbackSocialEnrichments.get(leadId) || null;
}
