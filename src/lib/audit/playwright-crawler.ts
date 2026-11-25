import { chromium, Browser } from 'playwright';
import { WebsiteAudit, ContactCandidates, SocialLinks } from '@/types/database';
import { checkRobotsAllowed } from './robots';
import { domainRateLimiter } from './rate-limiter';

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36 (compatible; LeadScoutUK/1.0; +https://leadscout.co.uk/bot)';

const KNOWN_BOOKING_PATTERNS = [
  { name: 'Calendly', pattern: /calendly\.com/i },
  { name: 'Fresha', pattern: /fresha\.com/i },
  { name: 'Treatwell', pattern: /treatwell\.co\.uk|treatwell\.com/i },
  { name: 'Mindbody', pattern: /mindbodyonline\.com|mindbody\.io/i },
  { name: 'OpenTable', pattern: /opentable\.co\.uk|opentable\.com/i },
  { name: 'ResDiary', pattern: /resdiary\.com/i },
  { name: 'Setmore', pattern: /setmore\.com/i },
  { name: 'Acuity Scheduling', pattern: /acuityscheduling\.com|squarespacescheduling\.com/i },
  { name: 'Phorest', pattern: /phorest\.com/i },
  { name: 'Timely', pattern: /gettimely\.com/i },
  { name: 'Booksy', pattern: /booksy\.com/i },
  { name: 'Jane App', pattern: /janeapp\.com/i },
];

const LIVE_CHAT_PATTERNS = [
  /crisp\.chat/i,
  /intercom\.io|intercomcdn\.com/i,
  /tidio\.co/i,
  /zendesk\.com|zopim\.com/i,
  /livechatinc\.com/i,
  /drift\.com/i,
  /tawk\.to/i,
  /hubspot\.com.*conversations/i,
];

let globalBrowser: Browser | null = null;

async function getBrowser(): Promise<Browser> {
  if (!globalBrowser || !globalBrowser.isConnected()) {
    globalBrowser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    });
  }
  return globalBrowser;
}

export async function crawlAndAuditWebsite(
  rawUrl: string,
  leadId: string
): Promise<WebsiteAudit> {
  let targetUrl = rawUrl.trim();
  if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
    targetUrl = `https://${targetUrl}`;
  }

  const releaseLock = await domainRateLimiter.acquire(targetUrl);

  const now = new Date().toISOString();
  const currentYear = new Date().getFullYear();

  try {
    const isAllowed = await checkRobotsAllowed(targetUrl);
    if (!isAllowed) {
      return createErrorAudit(leadId, targetUrl, 'Auditing blocked by website robots.txt');
    }

    const browser = await getBrowser();

    const desktopContext = await browser.newContext({
      viewport: { width: 1280, height: 800 },
      userAgent: USER_AGENT,
      ignoreHTTPSErrors: true,
    });

    const page = await desktopContext.newPage();
    page.setDefaultTimeout(20000);

    const startTime = Date.now();
    let httpStatus: number | null = null;
    let finalUrl: string = targetUrl;
    let sslValid = false;
    let usesHttps = false;

    let response: any = null;
    let ttfbMs: number | null = null;
    try {
      response = await page.goto(targetUrl, {
        waitUntil: 'commit',
        timeout: 20000,
      });
      ttfbMs = Date.now() - startTime;

      if (response) {
        httpStatus = response.status();
        finalUrl = response.url();
        usesHttps = finalUrl.startsWith('https://');
        sslValid = usesHttps;
      }

      await page.waitForLoadState('domcontentloaded', { timeout: 8000 }).catch(() => {});
    } catch (navError: any) {
      await desktopContext.close();
      return createErrorAudit(leadId, targetUrl, `Navigation failed: ${navError.message}`);
    }

    let fullLoadMs: number | null = null;
    try {
      const remainingTime = Math.max(1000, 20000 - (Date.now() - startTime));
      await page.waitForLoadState('load', { timeout: remainingTime });
      fullLoadMs = Math.min(Date.now() - startTime, 20000);
    } catch {
      fullLoadMs = Math.min(Date.now() - startTime, 20000);
    }

    const loadTimeMs = ttfbMs;

    let lcpMs: number | null = null;
    try {
      lcpMs = await page.evaluate(() => {
        return new Promise<number | null>((resolve) => {
          let lastLcp: number | null = null;
          const observer = new PerformanceObserver((entryList) => {
            const entries = entryList.getEntries();
            const lastEntry = entries[entries.length - 1];
            if (lastEntry) lastLcp = Math.round(lastEntry.startTime);
          });
          observer.observe({ type: 'largest-contentful-paint', buffered: true });
          setTimeout(() => {
            observer.disconnect();
            resolve(lastLcp);
          }, 300);
        });
      });
    } catch {
      lcpMs = null;
    }

    let screenshotDesktop: string | null = null;
    try {
      const buffer = await page.screenshot({ type: 'jpeg', quality: 70 });
      screenshotDesktop = `data:image/jpeg;base64,${buffer.toString('base64')}`;
    } catch {
      screenshotDesktop = null;
    }

    // 3. Extract DOM metrics, metadata, booking, contacts, links (NO nested named functions to avoid esbuild __name issues)
    const auditData = await page.evaluate((currYear) => {
      const html = document.documentElement.outerHTML;

      const title = document.title || '';
      const metaDesc =
        document.querySelector('meta[name="description"]')?.getAttribute('content') ||
        document.querySelector('meta[property="og:description"]')?.getAttribute('content') ||
        '';
      const h1 = document.querySelector('h1')?.innerText?.trim() || '';

      const metaGenerator =
        document.querySelector('meta[name="generator"]')?.getAttribute('content')?.toLowerCase() || '';
      let platform: 'WordPress' | 'Wix' | 'Squarespace' | 'Shopify' | 'Webflow' | 'Custom' = 'Custom';

      if (metaGenerator.includes('wordpress') || html.includes('wp-content') || html.includes('wp-includes')) {
        platform = 'WordPress';
      } else if (metaGenerator.includes('wix') || html.includes('wix.com') || html.includes('X-Wix-')) {
        platform = 'Wix';
      } else if (metaGenerator.includes('squarespace') || html.includes('squarespace.com')) {
        platform = 'Squarespace';
      } else if (metaGenerator.includes('shopify') || html.includes('cdn.shopify.com')) {
        platform = 'Shopify';
      } else if (metaGenerator.includes('webflow') || html.includes('uploads-ssl.webflow.com')) {
        platform = 'Webflow';
      }

      let foundYear: number | null = null;
      const footerText =
        (document.querySelector('footer')?.innerText || document.body.innerText || '').slice(-2500);
      const copyrightMatch = footerText.match(/(?:©|copyright|&copy;)\s*(?:20\d{2}\s*[-–]\s*)?(20\d{2})/i);
      if (copyrightMatch && copyrightMatch[1]) {
        foundYear = parseInt(copyrightMatch[1], 10);
      }

      const forms = Array.from(document.querySelectorAll('form'));
      const hasContactForm = forms.some((f) => {
        const text = (f.innerText || '').toLowerCase();
        const inputs = Array.from(f.querySelectorAll('input, textarea, button'));
        const actionStr = typeof f.action === 'string' ? f.action.toLowerCase() : (f.getAttribute('action') || '').toLowerCase();
        const idStr = typeof f.id === 'string' ? f.id.toLowerCase() : (f.getAttribute('id') || '').toLowerCase();
        return (
          inputs.length >= 2 &&
          (text.includes('send') ||
            text.includes('message') ||
            text.includes('contact') ||
            text.includes('submit') ||
            actionStr.includes('contact') ||
            idStr.includes('contact'))
        );
      });

      const hasEcommerce =
        html.includes('woocommerce') ||
        html.includes('cart') ||
        html.includes('checkout') ||
        Boolean(document.querySelector('.cart, #cart, a[href*="cart"], a[href*="checkout"]'));

      const hasCookieBanner = Boolean(
        document.querySelector('#onetrust-banner-sdk, #cookie-notice, .cookie-consent, #CybotCookiebotDialog') ||
          html.includes('cookie-banner') ||
          html.includes('cookie-notice') ||
          html.includes('cookiebot')
      );

      const hasPrivacyPolicy = Array.from(document.querySelectorAll('a')).some((a) => {
        const href = (a.href || '').toLowerCase();
        const text = (a.innerText || '').toLowerCase();
        return href.includes('privacy') || text.includes('privacy policy') || text.includes('gdpr');
      });

      const hasWhatsappLink = Array.from(document.querySelectorAll('a')).some((a) => {
        const href = (a.href || '').toLowerCase();
        return href.includes('wa.me') || href.includes('api.whatsapp.com') || href.startsWith('whatsapp:');
      });

      const clone = document.body.cloneNode(true) as HTMLElement;
      clone.querySelectorAll('script, style, noscript, svg, nav, footer').forEach((el) => el.remove());
      const visibleText = (clone.innerText || '')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 3000);

      // Extract Internal Links - direct loops without nested function declarations
      const origin = window.location.origin;
      const navLinks: { url: string; text: string }[] = [];
      const seenUrls = new Set<string>();

      const selectors = ['nav a[href], header a[href], footer a[href]', 'a[href]'];
      for (let s = 0; s < selectors.length; s++) {
        const els = document.querySelectorAll(selectors[s]);
        for (let i = 0; i < els.length; i++) {
          const a = els[i] as HTMLAnchorElement;
          const href = a.href;
          const text = (a.innerText || a.getAttribute('aria-label') || '').trim();
          if (
            href &&
            href.startsWith(origin) &&
            !href.includes('#') &&
            !href.match(/\.(jpg|jpeg|png|gif|svg|pdf|webp|css|js)$/i) &&
            !seenUrls.has(href)
          ) {
            seenUrls.add(href);
            navLinks.push({ url: href, text });
          }
        }
      }

      // Social Links extraction: anchor hrefs, meta tags, and JSON-LD sameAs
      const socials: Record<string, string> = {};
      const allAnchors = document.querySelectorAll('a[href]');
      for (let i = 0; i < allAnchors.length; i++) {
        const a = allAnchors[i] as HTMLAnchorElement;
        const href = a.href || '';
        const aria = a.getAttribute('aria-label') || '';
        const title = a.getAttribute('title') || '';
        const combined = `${href} ${aria} ${title}`.toLowerCase();

        if (combined.includes('instagram.com/') && !socials.instagram) socials.instagram = href;
        if ((combined.includes('facebook.com/') || combined.includes('fb.com/')) && !socials.facebook) socials.facebook = href;
        if (combined.includes('linkedin.com/') && !socials.linkedin) socials.linkedin = href;
        if (combined.includes('tiktok.com/') && !socials.tiktok) socials.tiktok = href;
        if ((combined.includes('twitter.com/') || combined.includes('x.com/')) && !socials.x) socials.x = href;
      }

      // Check meta tags for social links (e.g. meta article:publisher or og:see_also)
      const metaTags = document.querySelectorAll('meta[property], meta[name]');
      for (let i = 0; i < metaTags.length; i++) {
        const content = metaTags[i].getAttribute('content') || '';
        if (content.includes('facebook.com/') && !socials.facebook) socials.facebook = content;
        if (content.includes('instagram.com/') && !socials.instagram) socials.instagram = content;
        if (content.includes('twitter.com/') || content.includes('x.com/')) {
          if (!socials.x) socials.x = content.startsWith('http') ? content : `https://x.com/${content.replace('@', '')}`;
        }
      }

      // Check JSON-LD scripts for sameAs
      const jsonLdScripts = document.querySelectorAll('script[type="application/ld+json"]');
      for (let i = 0; i < jsonLdScripts.length; i++) {
        try {
          const parsed = JSON.parse(jsonLdScripts[i].innerHTML || '{}');
          const candidateList: any[] = [];
          if (Array.isArray(parsed)) candidateList.push(...parsed);
          else if (parsed['@graph'] && Array.isArray(parsed['@graph'])) candidateList.push(...parsed['@graph']);
          else candidateList.push(parsed);

          for (let j = 0; j < candidateList.length; j++) {
            const item = candidateList[j];
            const sameAs = Array.isArray(item.sameAs) ? item.sameAs : [item.sameAs].filter(Boolean);
            for (let k = 0; k < sameAs.length; k++) {
              const sUrl = String(sameAs[k]);
              if (sUrl.includes('facebook.com/') && !socials.facebook) socials.facebook = sUrl;
              if (sUrl.includes('instagram.com/') && !socials.instagram) socials.instagram = sUrl;
              if (sUrl.includes('linkedin.com/') && !socials.linkedin) socials.linkedin = sUrl;
              if (sUrl.includes('tiktok.com/') && !socials.tiktok) socials.tiktok = sUrl;
              if ((sUrl.includes('twitter.com/') || sUrl.includes('x.com/')) && !socials.x) socials.x = sUrl;
            }
          }
        } catch {}
      }

      // Emails & Phones
      const emailsFound: string[] = [];
      const phonesFound: string[] = [];

      for (let i = 0; i < allAnchors.length; i++) {
        const a = allAnchors[i] as HTMLAnchorElement;
        const href = a.href;
        if (href.startsWith('mailto:')) {
          const mail = href.replace(/^mailto:/i, '').split('?')[0].trim();
          if (mail && !emailsFound.includes(mail)) emailsFound.push(mail);
        }
        if (href.startsWith('tel:')) {
          const tel = href.replace(/^tel:/i, '').trim();
          if (tel && !phonesFound.includes(tel)) phonesFound.push(tel);
        }
      }

      const emailMatches = document.body.innerText.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g) || [];
      for (let i = 0; i < emailMatches.length; i++) {
        const m = emailMatches[i];
        if (!emailsFound.includes(m) && !m.endsWith('.png') && !m.endsWith('.jpg') && emailsFound.length < 10) {
          emailsFound.push(m);
        }
      }

      return {
        title,
        metaDesc,
        h1,
        platform,
        foundYear,
        hasContactForm,
        hasEcommerce,
        hasCookieBanner,
        hasPrivacyPolicy,
        hasWhatsappLink,
        visibleText,
        navLinks,
        socials,
        emails: emailsFound,
        phones: phonesFound,
        fullHtml: html,
      };
    }, currentYear);

    await desktopContext.close();

    // 4. Mobile Responsiveness & Screenshot
    const mobileContext = await browser.newContext({
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
      userAgent: USER_AGENT,
      ignoreHTTPSErrors: true,
    });

    const mobilePage = await mobileContext.newPage();
    let mobileFriendly = true;
    const mobileIssues: string[] = [];
    let screenshotMobile: string | null = null;

    try {
      await mobilePage.goto(finalUrl, { waitUntil: 'commit', timeout: 15000 });
      await mobilePage.waitForLoadState('domcontentloaded', { timeout: 8000 }).catch(() => {});
      await mobilePage.waitForTimeout(800).catch(() => {});

      const mobileChecks = await mobilePage.evaluate(() => {
        const viewportMeta = document.querySelector('meta[name="viewport"]')?.getAttribute('content') || '';
        const hasViewport = viewportMeta.includes('width=device-width');

        const docWidth = document.documentElement.scrollWidth;
        const windowWidth = window.innerWidth;
        const hasHorizontalOverflow = docWidth > windowWidth + 5;

        let hasSmallText = false;
        const paragraphs = Array.from(document.querySelectorAll('p, span, a, li')).slice(0, 50);
        for (let i = 0; i < paragraphs.length; i++) {
          const fontSize = parseFloat(window.getComputedStyle(paragraphs[i]).fontSize);
          if (fontSize > 0 && fontSize < 11) {
            hasSmallText = true;
            break;
          }
        }

        return {
          hasViewport,
          hasHorizontalOverflow,
          hasSmallText,
        };
      });

      if (!mobileChecks.hasViewport) {
        mobileFriendly = false;
        mobileIssues.push('Missing viewport meta tag (width=device-width)');
      }
      if (mobileChecks.hasHorizontalOverflow) {
        mobileFriendly = false;
        mobileIssues.push('Horizontal overflow detected (content exceeds mobile screen width)');
      }
      if (mobileChecks.hasSmallText) {
        mobileIssues.push('Illegible small text font sizes on mobile (<11px)');
      }

      const mobileBuf = await mobilePage.screenshot({ type: 'jpeg', quality: 70 });
      screenshotMobile = `data:image/jpeg;base64,${mobileBuf.toString('base64')}`;
    } catch (mobileErr: any) {
      mobileFriendly = false;
      mobileIssues.push(`Mobile render failed: ${mobileErr.message}`);
    } finally {
      await mobileContext.close();
    }

    // 5. Booking Providers & Live Chat Detection
    const detectedBookingProviders: string[] = [];
    for (const b of KNOWN_BOOKING_PATTERNS) {
      if (b.pattern.test(auditData.fullHtml)) {
        detectedBookingProviders.push(b.name);
      }
    }
    let hasOnlineBooking = detectedBookingProviders.length > 0;

    let hasLiveChat = false;
    for (const chatPattern of LIVE_CHAT_PATTERNS) {
      if (chatPattern.test(auditData.fullHtml)) {
        hasLiveChat = true;
        break;
      }
    }

    // 6. Check Broken Internal Links
    const brokenLinks: string[] = [];
    const sampleLinks = auditData.navLinks.slice(0, 10).map((l) => l.url);
    for (const link of sampleLinks) {
      try {
        const linkRes = await fetch(link, {
          method: 'HEAD',
          headers: { 'User-Agent': USER_AGENT },
          signal: AbortSignal.timeout(3000),
        });
        if (linkRes.status >= 400 && linkRes.status < 600) {
          brokenLinks.push(`${link} (HTTP ${linkRes.status})`);
        }
      } catch {
        // ignore
      }
    }

    // 7. Multi-page Coverage: Visit up to 4 relevant subpages
    const pagesVisited: string[] = [finalUrl];
    let mergedHasContactForm = auditData.hasContactForm;
    let mergedHasWhatsapp = auditData.hasWhatsappLink;
    const mergedEmails = new Set<string>(auditData.emails);
    const mergedPhones = new Set<string>(auditData.phones);
    const mergedSocials: Record<string, string> = { ...auditData.socials };
    let visitedPageTexts: string[] = [auditData.visibleText];

    const targetPattern = /(contact|book|booking|appointment|enquir|salon|team|about)/i;
    const subpageCandidates = auditData.navLinks
      .filter((l) => targetPattern.test(l.url) || targetPattern.test(l.text))
      .filter((l) => l.url !== finalUrl && !pagesVisited.includes(l.url))
      .slice(0, 4);

    const subContext = await browser.newContext({
      viewport: { width: 1280, height: 800 },
      userAgent: USER_AGENT,
      ignoreHTTPSErrors: true,
    });

    for (const item of subpageCandidates) {
      if (pagesVisited.includes(item.url)) continue;
      try {
        const subPage = await subContext.newPage();
        subPage.setDefaultTimeout(8000);
        const subRes = await subPage.goto(item.url, { waitUntil: 'commit', timeout: 8000 });
        if (subRes && subRes.ok()) {
          pagesVisited.push(item.url);
          await subPage.waitForLoadState('domcontentloaded', { timeout: 4000 }).catch(() => {});

          const subData = await subPage.evaluate(() => {
            const html = document.documentElement.outerHTML;
            const text = (document.body.innerText || '').slice(0, 2000);

            const forms = Array.from(document.querySelectorAll('form'));
            const hasForm = forms.some((f) => {
              const t = (f.innerText || '').toLowerCase();
              const actionStr = typeof f.action === 'string' ? f.action.toLowerCase() : (f.getAttribute('action') || '').toLowerCase();
              return t.includes('contact') || t.includes('message') || t.includes('submit') || t.includes('send') || actionStr.includes('contact');
            });

            const emails: string[] = [];
            const anchors = document.querySelectorAll('a[href]');
            for (let i = 0; i < anchors.length; i++) {
              const h = (anchors[i] as HTMLAnchorElement).href;
              if (h.startsWith('mailto:')) {
                const m = h.replace(/^mailto:/i, '').split('?')[0].trim();
                if (m) emails.push(m);
              }
            }

            const matches = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g) || [];
            for (let i = 0; i < matches.length; i++) {
              const m = matches[i];
              if (!emails.includes(m) && !m.endsWith('.png') && !m.endsWith('.jpg')) emails.push(m);
            }

            const phones: string[] = [];
            for (let i = 0; i < anchors.length; i++) {
              const h = (anchors[i] as HTMLAnchorElement).href;
              if (h.startsWith('tel:')) {
                const p = h.replace(/^tel:/i, '').trim();
                if (p) phones.push(p);
              }
            }

            let hasWa = false;
            for (let i = 0; i < anchors.length; i++) {
              const h = ((anchors[i] as HTMLAnchorElement).href || '').toLowerCase();
              if (h.includes('wa.me') || h.includes('api.whatsapp.com') || h.startsWith('whatsapp:')) {
                hasWa = true;
                break;
              }
            }

            const s: Record<string, string> = {};
            for (let i = 0; i < anchors.length; i++) {
              const a = anchors[i] as HTMLAnchorElement;
              const h = a.href || '';
              const aria = a.getAttribute('aria-label') || '';
              const title = a.getAttribute('title') || '';
              const combined = `${h} ${aria} ${title}`.toLowerCase();

              if (combined.includes('instagram.com/')) s.instagram = h;
              if (combined.includes('facebook.com/') || combined.includes('fb.com/')) s.facebook = h;
              if (combined.includes('linkedin.com/')) s.linkedin = h;
              if (combined.includes('tiktok.com/')) s.tiktok = h;
              if (combined.includes('twitter.com/') || combined.includes('x.com/')) s.x = h;
            }

            const mTags = document.querySelectorAll('meta[property], meta[name]');
            for (let i = 0; i < mTags.length; i++) {
              const content = mTags[i].getAttribute('content') || '';
              if (content.includes('facebook.com/') && !s.facebook) s.facebook = content;
              if (content.includes('instagram.com/') && !s.instagram) s.instagram = content;
            }

            return { html, text, hasForm, emails, phones, hasWa, socials: s };
          });

          if (subData.hasForm) mergedHasContactForm = true;
          if (subData.hasWa) mergedHasWhatsapp = true;
          subData.emails.forEach((e) => mergedEmails.add(e));
          subData.phones.forEach((p) => mergedPhones.add(p));
          Object.assign(mergedSocials, subData.socials);
          visitedPageTexts.push(subData.text);

          for (const b of KNOWN_BOOKING_PATTERNS) {
            if (b.pattern.test(subData.html) && !detectedBookingProviders.includes(b.name)) {
              detectedBookingProviders.push(b.name);
              hasOnlineBooking = true;
            }
          }
        }
        await subPage.close().catch(() => {});
      } catch {
        // continue
      }
    }

    await subContext.close().catch(() => {});

    const isOutdatedCopyright =
      Boolean(auditData.foundYear) && (auditData.foundYear! <= currentYear - 2);

    console.log(`[Crawler] Discovered social links for ${targetUrl}:`, mergedSocials);

    return {
      id: crypto.randomUUID(),
      lead_id: leadId,
      url_tested: targetUrl,
      final_url: finalUrl,
      http_status: httpStatus,
      uses_https: usesHttps,
      ssl_valid: sslValid,
      ttfb_ms: ttfbMs,
      load_time_ms: loadTimeMs,
      full_load_ms: fullLoadMs,
      largest_contentful_paint_ms: lcpMs,
      mobile_friendly: mobileFriendly,
      mobile_issues: mobileIssues,
      screenshot_desktop: screenshotDesktop,
      screenshot_mobile: screenshotMobile,
      page_title: auditData.title,
      meta_description: auditData.metaDesc,
      h1_text: auditData.h1,
      detected_platform: auditData.platform,
      copyright_year: auditData.foundYear,
      is_outdated_copyright: isOutdatedCopyright,
      has_contact_form: mergedHasContactForm,
      has_online_booking: hasOnlineBooking,
      booking_providers: detectedBookingProviders,
      has_ecommerce: auditData.hasEcommerce,
      has_live_chat: hasLiveChat,
      has_whatsapp_link: mergedHasWhatsapp,
      has_cookie_banner: auditData.hasCookieBanner,
      has_privacy_policy: auditData.hasPrivacyPolicy,
      contact_candidates: {
        emails: Array.from(mergedEmails),
        phones: Array.from(mergedPhones),
      },
      social_links: mergedSocials,
      broken_links_count: brokenLinks.length,
      broken_links: brokenLinks,
      text_excerpt: visitedPageTexts.join('\n\n--- SUBPAGE ---\n\n'),
      pages_visited: pagesVisited,
      created_at: now,
    };
  } catch (error: any) {
    // Fallback for serverless environments (e.g., Vercel) where Chromium binary is unavailable
    const msg = error?.message || '';
    if (
      msg.includes('Executable doesn') ||
      msg.includes('browserType.launch') ||
      msg.includes('spawn') ||
      process.env.VERCEL === '1'
    ) {
      try {
        return await fetchFallbackAudit(leadId, targetUrl);
      } catch (fetchErr: any) {
        return createErrorAudit(leadId, targetUrl, fetchErr.message || msg);
      }
    }
    return createErrorAudit(leadId, targetUrl, msg || 'Unexpected audit error');
  } finally {
    releaseLock();
  }
}

async function fetchFallbackAudit(leadId: string, targetUrl: string): Promise<WebsiteAudit> {
  const now = new Date().toISOString();
  const res = await fetch(targetUrl, {
    headers: { 'User-Agent': USER_AGENT },
    signal: AbortSignal.timeout(12000),
  });
  const html = await res.text();
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const h1Match = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  const stripHtml = (s: string) => s.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  const textExcerpt = stripHtml(html).slice(0, 3500);

  const emails = Array.from(new Set((html.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g) || []).filter((e) => !/\.(png|jpg|jpeg|svg|webp)$/i.test(e))));
  const phones = Array.from(new Set(html.match(/(?:tel:)?((?:\+44|0)[\d\s()-]{8,14}\d)/g) || [])).map((p) => p.replace(/^tel:/i, '').trim());
  const bookingProviders = KNOWN_BOOKING_PATTERNS.filter((b) => b.pattern.test(html)).map((b) => b.name);
  const socials: SocialLinks = {};
  const fbMatch = html.match(/https?:\/\/(?:www\.)?facebook\.com\/[a-zA-Z0-9_.-]+/i);
  const igMatch = html.match(/https?:\/\/(?:www\.)?instagram\.com\/[a-zA-Z0-9_.-]+/i);
  if (fbMatch) socials.facebook = fbMatch[0];
  if (igMatch) socials.instagram = igMatch[0];

  return {
    id: crypto.randomUUID(),
    lead_id: leadId,
    url_tested: targetUrl,
    final_url: res.url || targetUrl,
    http_status: res.status,
    uses_https: (res.url || targetUrl).startsWith('https://'),
    ssl_valid: (res.url || targetUrl).startsWith('https://'),
    ttfb_ms: null,
    load_time_ms: null,
    full_load_ms: null,
    largest_contentful_paint_ms: null,
    mobile_friendly: /name=["']viewport["']/i.test(html),
    mobile_issues: [],
    screenshot_desktop: null,
    screenshot_mobile: null,
    page_title: titleMatch ? stripHtml(titleMatch[1]) : null,
    meta_description: null,
    h1_text: h1Match ? stripHtml(h1Match[1]) : null,
    detected_platform: /squarespace/i.test(html) ? 'Squarespace' : /wix\.com/i.test(html) ? 'Wix' : /wp-content/i.test(html) ? 'WordPress' : 'Custom',
    copyright_year: null,
    is_outdated_copyright: false,
    has_contact_form: /<form\b/i.test(html),
    has_online_booking: bookingProviders.length > 0,
    booking_providers: bookingProviders,
    has_ecommerce: false,
    has_live_chat: LIVE_CHAT_PATTERNS.some((p) => p.test(html)),
    has_whatsapp_link: /wa\.me|api\.whatsapp\.com/i.test(html),
    has_cookie_banner: false,
    has_privacy_policy: /privacy/i.test(html),
    contact_candidates: { emails: emails.slice(0, 5), phones: phones.slice(0, 5) },
    social_links: socials,
    broken_links_count: 0,
    broken_links: [],
    text_excerpt: textExcerpt,
    pages_visited: [res.url || targetUrl],
    created_at: now,
  };
}

function createErrorAudit(leadId: string, urlTested: string, errorMessage: string): WebsiteAudit {
  return {
    id: crypto.randomUUID(),
    lead_id: leadId,
    url_tested: urlTested,
    final_url: null,
    http_status: null,
    uses_https: false,
    ssl_valid: false,
    ttfb_ms: null,
    load_time_ms: null,
    full_load_ms: null,
    largest_contentful_paint_ms: null,
    mobile_friendly: false,
    mobile_issues: [errorMessage],
    screenshot_desktop: null,
    screenshot_mobile: null,
    page_title: null,
    meta_description: null,
    h1_text: null,
    detected_platform: 'Custom',
    copyright_year: null,
    is_outdated_copyright: false,
    has_contact_form: false,
    has_online_booking: false,
    booking_providers: [],
    has_ecommerce: false,
    has_live_chat: false,
    has_whatsapp_link: false,
    has_cookie_banner: false,
    has_privacy_policy: false,
    contact_candidates: { emails: [], phones: [] },
    social_links: {},
    broken_links_count: 0,
    broken_links: [],
    text_excerpt: '',
    pages_visited: [urlTested],
    audit_error: errorMessage,
    created_at: new Date().toISOString(),
  };
}
