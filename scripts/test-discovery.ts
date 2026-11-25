import { normalizeUKPhone } from '../src/lib/uk/phone';
import { extractUKPostcode } from '../src/lib/uk/postcode';
import { classifyWebsite } from '../src/lib/utils/website-classifier';
import { estimateSearchCostGBP, formatGBP } from '../src/lib/uk/pricing';

console.log('--- LeadScout UK Stage 1 Tests ---');

// 1. Phone Normalisation
const mobileTest = normalizeUKPhone('07911 123456');
console.log('Mobile Check:', {
  input: '07911 123456',
  e164: mobileTest.phone_e164,
  type: mobileTest.phone_type,
  whatsapp_likely: mobileTest.whatsapp_likely,
});
if (mobileTest.phone_type !== 'mobile' || !mobileTest.whatsapp_likely) {
  throw new Error('Mobile normalisation failed');
}

const landlineTest = normalizeUKPhone('0161 496 0123');
console.log('Landline Check:', {
  input: '0161 496 0123',
  e164: landlineTest.phone_e164,
  type: landlineTest.phone_type,
  whatsapp_likely: landlineTest.whatsapp_likely,
});
if (landlineTest.phone_type !== 'landline' || landlineTest.whatsapp_likely) {
  throw new Error('Landline normalisation failed');
}

// 2. Postcode Extraction
const postcodeTest = extractUKPostcode('10 High Street, Bristol, BS1 5HH');
console.log('Postcode extraction:', postcodeTest);
if (postcodeTest !== 'BS1 5HH') {
  throw new Error(`Expected BS1 5HH, got ${postcodeTest}`);
}

// 3. Website Classification
const wixTest = classifyWebsite('https://mybusiness.wixsite.com/home');
const instaTest = classifyWebsite('https://www.instagram.com/uk_pro_services/');
const ownTest = classifyWebsite('https://premierplumbing-bristol.co.uk');
const noneTest = classifyWebsite(null);

console.log('Website classifications:', {
  wix: wixTest.website_type,
  instagram: instaTest.website_type,
  ownSite: ownTest.website_type,
  none: noneTest.website_type,
});

if (wixTest.website_type !== 'builder') throw new Error('Wix classification failed');
if (instaTest.website_type !== 'social_only') throw new Error('Instagram classification failed');
if (ownTest.website_type !== 'own_site') throw new Error('Own site classification failed');
if (noneTest.website_type !== 'none') throw new Error('None classification failed');

// 4. Pricing
console.log('Estimated API Costs:', {
  max20: formatGBP(estimateSearchCostGBP(20)),
  max50: formatGBP(estimateSearchCostGBP(50)),
  max100: formatGBP(estimateSearchCostGBP(100)),
});

console.log('\n>>> ALL STAGE 1 LOGIC CHECKS PASSED SUCCESSFULLY! <<<');

