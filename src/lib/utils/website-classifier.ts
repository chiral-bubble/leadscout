import { WebsiteType } from '@/types/database';

export interface WebsiteClassification {
  has_website: boolean;
  website_type: WebsiteType;
  normalized_url: string | null;
}

const SOCIAL_DOMAINS = [
  'facebook.com',
  'fb.com',
  'instagram.com',
  'linktr.ee',
  'tiktok.com',
  'twitter.com',
  'x.com',
  'linkedin.com',
  'youtube.com',
  'yelp.co.uk',
  'yelp.com',
  'yell.com',
  'checkatrade.com',
  'trustatrader.com',
  'bark.com',
  'tripadvisor.co.uk',
  'tripadvisor.com',
];

const BUILDER_DOMAINS = [
  'wixsite.com',
  'wix.com',
  'squarespace.com',
  'godaddysites.com',
  'wordpress.com',
  'weebly.com',
  'site123.me',
  'my-online.store',
  'carrd.co',
  'webflow.io',
  'shopify.com',
  'jimdosite.com',
  'strikingly.com',
  'canva.site',
];

export function classifyWebsite(rawUrl?: string | null): WebsiteClassification {
  if (!rawUrl || typeof rawUrl !== 'string') {
    return {
      has_website: false,
      website_type: 'none',
      normalized_url: null,
    };
  }

  const trimmed = rawUrl.trim();
  if (!trimmed || trimmed.toLowerCase() === 'n/a' || trimmed.toLowerCase() === 'none') {
    return {
      has_website: false,
      website_type: 'none',
      normalized_url: null,
    };
  }

  let parsedHostname = '';
  let fullNormalized = trimmed;

  try {
    const urlObj = new URL(trimmed.startsWith('http') ? trimmed : `https://${trimmed}`);
    parsedHostname = urlObj.hostname.toLowerCase().replace(/^www\./, '');
    fullNormalized = urlObj.href;
  } catch {
    parsedHostname = trimmed.toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0];
  }

  // 1. Social only
  const isSocial = SOCIAL_DOMAINS.some(domain => 
    parsedHostname === domain || parsedHostname.endsWith(`.${domain}`)
  );
  if (isSocial) {
    return {
      has_website: true,
      website_type: 'social_only',
      normalized_url: fullNormalized,
    };
  }

  // 2. Site builder platform subdomain
  const isBuilder = BUILDER_DOMAINS.some(domain => 
    parsedHostname === domain || parsedHostname.endsWith(`.${domain}`)
  );
  if (isBuilder) {
    return {
      has_website: true,
      website_type: 'builder',
      normalized_url: fullNormalized,
    };
  }

  // 3. Standalone custom domain
  return {
    has_website: true,
    website_type: 'own_site',
    normalized_url: fullNormalized,
  };
}

