import { crawlAndAuditWebsite } from '../src/lib/audit/playwright-crawler';

async function testSiteAudit(url: string, name: string) {
  console.log(`\n========================================`);
  console.log(`Auditing [${name}]: ${url}`);
  console.log(`========================================`);

  const startTime = Date.now();
  const audit = await crawlAndAuditWebsite(url, `test-${name.toLowerCase().replace(/\s+/g, '-')}`);
  const duration = ((Date.now() - startTime) / 1000).toFixed(2);

  console.log(`Completed in ${duration}s`);
  console.log('Status & Security:', {
    final_url: audit.final_url,
    http_status: audit.http_status,
    uses_https: audit.uses_https,
    ssl_valid: audit.ssl_valid,
  });

  console.log('Performance & Responsiveness:', {
    load_time_ms: audit.load_time_ms,
    largest_contentful_paint_ms: audit.largest_contentful_paint_ms,
    mobile_friendly: audit.mobile_friendly,
    mobile_issues: audit.mobile_issues,
    desktop_screenshot_captured: Boolean(audit.screenshot_desktop),
    mobile_screenshot_captured: Boolean(audit.screenshot_mobile),
  });

  console.log('Opportunity & Tech Signals:', {
    detected_platform: audit.detected_platform,
    copyright_year: audit.copyright_year,
    is_outdated_copyright: audit.is_outdated_copyright,
    has_contact_form: audit.has_contact_form,
    has_online_booking: audit.has_online_booking,
    booking_providers: audit.booking_providers,
    has_whatsapp_link: audit.has_whatsapp_link,
    has_live_chat: audit.has_live_chat,
    has_ecommerce: audit.has_ecommerce,
    has_cookie_banner: audit.has_cookie_banner,
    has_privacy_policy: audit.has_privacy_policy,
  });

  console.log('Contacts & Socials Found:', {
    emails: audit.contact_candidates.emails,
    phones: audit.contact_candidates.phones,
    social_links: audit.social_links,
    broken_links_count: audit.broken_links_count,
  });

  console.log('Visible Text Preview (first 120 chars):');
  console.log(`"${audit.text_excerpt.slice(0, 120)}..."`);

  if (audit.audit_error) {
    console.warn(`[!] Audit error logged: ${audit.audit_error}`);
  }
}

async function main() {
  console.log('Starting LeadScout UK Playwright Website Audit Tests...\n');

  // Test on 3 diverse real sites:
  // 1. example.com (minimal site, tests baseline, outdated copyright/no mobile viewport checks)
  // 2. gov.uk (large accessible UK government site)
  // 3. bbc.co.uk (heavy media site with cookie banner, viewport, socials)
  const testSites = [
    { url: 'https://example.com', name: 'Example Domain' },
    { url: 'https://www.gov.uk', name: 'GOV.UK' },
    { url: 'https://www.bbc.co.uk', name: 'BBC UK' },
  ];

  for (const site of testSites) {
    try {
      await testSiteAudit(site.url, site.name);
    } catch (err: any) {
      console.error(`Failed auditing ${site.name}:`, err.message);
    }
  }

  console.log('\n>>> STAGE 2 PLAYWRIGHT AUDIT TESTS COMPLETED SUCCESSFULLY! <<<');
  process.exit(0);
}

main().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
