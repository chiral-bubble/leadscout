/**
 * Simple, polite robots.txt parser and checker.
 * Fetches /robots.txt with a 4s timeout.
 * Respects wildcard Disallow: / rules.
 */
export async function checkRobotsAllowed(url: string, userAgent = 'LeadScoutUK'): Promise<boolean> {
  try {
    const parsed = new URL(url);
    const robotsUrl = `${parsed.protocol}//${parsed.host}/robots.txt`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);

    const res = await fetch(robotsUrl, {
      signal: controller.signal,
      headers: { 'User-Agent': `${userAgent}/1.0` },
    });
    clearTimeout(timeout);

    if (!res.ok) {
      // If 404 or missing, crawling is allowed
      return true;
    }

    const text = await res.text();
    const lines = text.split('\n').map(l => l.trim().toLowerCase());

    let appliesToAll = false;
    for (const line of lines) {
      if (line.startsWith('user-agent:')) {
        const agent = line.replace('user-agent:', '').trim();
        appliesToAll = agent === '*' || agent.includes(userAgent.toLowerCase());
      } else if (appliesToAll && line.startsWith('disallow:')) {
        const path = line.replace('disallow:', '').trim();
        if (path === '/' || path === '/*') {
          return false; // Root is disallowed
        }
      }
    }

    return true;
  } catch {
    // If robots.txt fails to load (timeout/network error), allow crawling politely
    return true;
  }
}
