import { chromium } from 'playwright';

async function testPw() {
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--ignore-certificate-errors'],
  });
  const page = await browser.newPage();
  try {
    console.log('Navigating to forresters4hair.com...');
    const t0 = Date.now();
    const res = await page.goto('https://www.forresters4hair.com/', {
      waitUntil: 'commit',
      timeout: 15000,
    });
    console.log('Commit reached in', Date.now() - t0, 'ms. Status:', res?.status());
    await page.waitForLoadState('domcontentloaded', { timeout: 10000 }).catch(() => console.log('domcontentloaded timed out'));
    const title = await page.title();
    console.log('Page Title:', title);
  } catch (err: any) {
    console.error('Playwright failed:', err.message);
  } finally {
    await browser.close();
  }
}

testPw();
