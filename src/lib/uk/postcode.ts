/**
 * Helper utilities for UK postcodes.
 * UK Postcode formats: EC1A 1BB, W1A 0AX, M1 1AE, B33 8TH, CR2 6XH, DN55 1PT
 */
const UK_POSTCODE_REGEX = /\b([A-Z]{1,2}[0-9][A-Z0-9]?\s?[0-9][A-Z]{2})\b/i;

export function extractUKPostcode(text?: string | null): string | null {
  if (!text) return null;
  const match = text.toUpperCase().match(UK_POSTCODE_REGEX);
  if (!match) return null;

  const rawCode = match[1].replace(/\s+/g, '');
  // Format with space before last 3 characters (inward code)
  if (rawCode.length >= 5) {
    const outward = rawCode.slice(0, rawCode.length - 3);
    const inward = rawCode.slice(rawCode.length - 3);
    return `${outward} ${inward}`;
  }
  return rawCode;
}

export function getOutwardCode(postcode?: string | null): string | null {
  const formatted = extractUKPostcode(postcode);
  if (!formatted) return null;
  return formatted.split(' ')[0] || null;
}

