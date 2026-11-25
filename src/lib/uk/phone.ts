import { parsePhoneNumberFromString, CountryCode } from 'libphonenumber-js';
import { PhoneType } from '@/types/database';

export interface NormalizedPhoneResult {
  phone_raw: string | null;
  phone_e164: string | null;
  phone_type: PhoneType;
  whatsapp_likely: boolean;
}

/**
 * Normalises a UK phone number to E.164 (+44) and classifies phone type.
 * - Mobile: starts with 07 or +447 -> whatsapp_likely = true
 * - Landline: starts with 01, 02, 03 or +441, +442, +443
 * - Unknown: other or unparseable
 */
export function normalizeUKPhone(inputRaw?: string | null): NormalizedPhoneResult {
  if (!inputRaw || typeof inputRaw !== 'string') {
    return {
      phone_raw: null,
      phone_e164: null,
      phone_type: 'unknown',
      whatsapp_likely: false,
    };
  }

  const rawTrimmed = inputRaw.trim();
  const digitsOnly = rawTrimmed.replace(/\D/g, '');

  let e164: string | null = null;
  let phoneType: PhoneType = 'unknown';

  // Attempt standard parsing via libphonenumber-js with 'GB' default country
  try {
    const parsed = parsePhoneNumberFromString(rawTrimmed, 'GB' as CountryCode);
    if (parsed && parsed.isValid()) {
      e164 = parsed.format('E.164');
    }
  } catch {
    // fallback to regex below
  }

  // Fallback regex standardisation if libphonenumber didn't produce E.164
  if (!e164) {
    if (rawTrimmed.startsWith('+44')) {
      e164 = `+${digitsOnly}`;
    } else if (rawTrimmed.startsWith('0044')) {
      e164 = `+${digitsOnly.slice(2)}`;
    } else if (digitsOnly.startsWith('0') && digitsOnly.length >= 10 && digitsOnly.length <= 11) {
      e164 = `+44${digitsOnly.slice(1)}`;
    }
  }

  // Determine phone type according to UK numbering scheme
  if (e164) {
    if (e164.startsWith('+447')) {
      phoneType = 'mobile';
    } else if (
      e164.startsWith('+441') ||
      e164.startsWith('+442') ||
      e164.startsWith('+443')
    ) {
      phoneType = 'landline';
    } else {
      phoneType = 'unknown';
    }
  } else {
    // Check raw digit pattern as fallback
    if (digitsOnly.startsWith('07') || digitsOnly.startsWith('447')) {
      phoneType = 'mobile';
    } else if (
      digitsOnly.startsWith('01') ||
      digitsOnly.startsWith('02') ||
      digitsOnly.startsWith('03') ||
      digitsOnly.startsWith('441') ||
      digitsOnly.startsWith('442') ||
      digitsOnly.startsWith('443')
    ) {
      phoneType = 'landline';
    }
  }

  return {
    phone_raw: rawTrimmed,
    phone_e164: e164,
    phone_type: phoneType,
    whatsapp_likely: phoneType === 'mobile',
  };
}

