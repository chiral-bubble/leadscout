import { CompanyRecord, MatchConfidence } from '@/types/database';
import { extractUKPostcode, getOutwardCode } from '@/lib/uk/postcode';
import { getLocalSqliteDb } from '@/lib/db/sqlite';

export interface CHCompanySearchItem {
  company_number: string;
  title: string;
  company_type?: string;
  company_status?: string;
  date_of_creation?: string;
  address_snippet?: string;
  address?: {
    postal_code?: string;
    premises?: string;
    address_line_1?: string;
    locality?: string;
  };
  sic_codes?: string[];
}

export interface CHOfficerItem {
  name: string;
  officer_role: string;
  resigned_on?: string;
  appointed_on?: string;
}

export interface CompaniesHouseSearchResult {
  selectedMatch: CompanyRecord | null;
  candidates: CompanyRecord[];
  confidence: MatchConfidence;
  configured: boolean;
}

// In-memory confirmed matches cache: leadId -> CompanyRecord
const confirmedCompanies: Map<string, CompanyRecord> = new Map();

export function setConfirmedCompany(leadId: string, record: CompanyRecord): void {
  const confirmedRecord = { ...record, is_confirmed: true };
  confirmedCompanies.set(leadId, confirmedRecord);

  // Persist to local SQLite
  try {
    const db = getLocalSqliteDb();
    db.prepare(`
      INSERT OR REPLACE INTO confirmed_companies (lead_id, company_record, confirmed_at)
      VALUES (?, ?, ?)
    `).run(leadId, JSON.stringify(confirmedRecord), new Date().toISOString());
  } catch (err) {
    console.warn('Failed to persist confirmed company to SQLite:', err);
  }
}

export function getConfirmedCompany(leadId: string): CompanyRecord | null {
  if (confirmedCompanies.has(leadId)) {
    return confirmedCompanies.get(leadId)!;
  }

  // Check SQLite
  try {
    const db = getLocalSqliteDb();
    const row = db.prepare('SELECT company_record FROM confirmed_companies WHERE lead_id = ?').get(leadId) as any;
    if (row && row.company_record) {
      const parsed = JSON.parse(row.company_record) as CompanyRecord;
      confirmedCompanies.set(leadId, parsed);
      return parsed;
    }
  } catch (err) {
    // ignore
  }

  return null;
}

export async function matchCompaniesHouse(
  businessName: string,
  postcode?: string | null,
  leadId = 'lead-mock-id'
): Promise<CompanyRecord | null> {
  const result = await searchCompaniesHouseCandidates(businessName, postcode, leadId);
  return result.selectedMatch;
}

export async function searchCompaniesHouseCandidates(
  businessName: string,
  postcode?: string | null,
  leadId = 'lead-mock-id'
): Promise<CompaniesHouseSearchResult> {
  const confirmed = getConfirmedCompany(leadId);
  if (confirmed) {
    return {
      selectedMatch: confirmed,
      candidates: [confirmed],
      confidence: 'high',
      configured: true,
    };
  }

  const apiKey = process.env.COMPANIES_HOUSE_API_KEY;
  const isKeyLoaded = Boolean(apiKey && apiKey.trim() !== '' && apiKey !== 'your-companies-house-api-key');
  console.log(`COMPANIES_HOUSE_API_KEY loaded: ${isKeyLoaded}`);

  const envType = process.env.COMPANIES_HOUSE_ENV || 'live';
  const dataMode = process.env.DATA_MODE || 'live';

  if (!isKeyLoaded) {
    if (dataMode === 'live') {
      // In live mode with no key configured, real calls only -> return null/empty with configured: false
      return {
        selectedMatch: null,
        candidates: [],
        confidence: 'none',
        configured: false,
      };
    }
    const mock = generateMockCompanyRecord(businessName, postcode, leadId);
    return {
      selectedMatch: mock,
      candidates: [mock],
      confidence: 'high',
      configured: false,
    };
  }

  const baseUrl =
    envType === 'sandbox'
      ? 'https://api-sandbox.company-information.service.gov.uk'
      : 'https://api.company-information.service.gov.uk';

  const authHeader = `Basic ${Buffer.from(apiKey! + ':').toString('base64')}`;

  // Multi-strategy queries
  const clean1 = businessName
    .replace(/\b(hair salons|for hair|hair salon|hair studio|salons|barbershop|barbers|barber)\b/gi, '')
    .replace(/\b(ltd|limited|llp|plc|and co|& co|services|studio|uk)\b/gi, '')
    .trim();

  const clean2 = businessName
    .replace(/\b(ltd|limited|llp|plc|and co|& co)\b/gi, '')
    .trim();

  const queries = Array.from(new Set([clean1, clean2, businessName])).filter((q) => q.length >= 2);

  let allItems: CHCompanySearchItem[] = [];

  for (const q of queries) {
    try {
      const searchUrl = `${baseUrl}/search/companies?q=${encodeURIComponent(q)}&items_per_page=6`;
      const res = await fetch(searchUrl, {
        headers: { Authorization: authHeader },
        signal: AbortSignal.timeout(8000), // 8000ms timeout
      });

      if (res.ok) {
        const data = await res.json();
        const items: CHCompanySearchItem[] = data.items || [];
        if (items.length > 0) {
          allItems = items;
          break; // Found matches
        }
      }
    } catch (err) {
      console.warn(`CH search attempt for "${q}" failed:`, err);
    }
  }

  // If still empty and postcode is provided, try postcode search
  if (allItems.length === 0 && postcode) {
    const cleanPostcode = extractUKPostcode(postcode);
    if (cleanPostcode) {
      try {
        const pcUrl = `${baseUrl}/search/companies?q=${encodeURIComponent(cleanPostcode)}&items_per_page=6`;
        const pcRes = await fetch(pcUrl, {
          headers: { Authorization: authHeader },
          signal: AbortSignal.timeout(8000),
        });
        if (pcRes.ok) {
          const pcData = await pcRes.json();
          allItems = pcData.items || [];
        }
      } catch {
        // ignore
      }
    }
  }

  if (allItems.length === 0) {
    if (dataMode === 'live') {
      return {
        selectedMatch: null,
        candidates: [],
        confidence: 'none',
        configured: true,
      };
    }
    const candidates = generateCandidateOptions(businessName, postcode, leadId);
    return {
      selectedMatch: candidates[0] || null,
      candidates,
      confidence: 'medium',
      configured: true,
    };
  }

  return processAllCandidates(allItems, businessName, postcode, leadId, authHeader, baseUrl);
}

async function processAllCandidates(
  items: CHCompanySearchItem[],
  businessName: string,
  postcode: string | null | undefined,
  leadId: string,
  authHeader: string,
  baseUrl: string
): Promise<CompaniesHouseSearchResult> {
  const normName = normalizeCompanyName(businessName);
  const targetPostcode = extractUKPostcode(postcode);
  const targetOutward = getOutwardCode(targetPostcode);

  const evaluated: Array<{ item: CHCompanySearchItem; confidence: MatchConfidence; score: number }> = [];

  for (const item of items) {
    const candidateName = normalizeCompanyName(item.title);
    const candidatePostcode = extractUKPostcode(item.address?.postal_code || item.address_snippet);
    const candidateOutward = getOutwardCode(candidatePostcode);

    const isExactName = normName === candidateName || normName.includes(candidateName) || candidateName.includes(normName);
    const isPostcodeMatch = targetPostcode && candidatePostcode && targetPostcode === candidatePostcode;
    const isOutwardMatch = targetOutward && candidateOutward && targetOutward === candidateOutward;

    let conf: MatchConfidence = 'low';
    let score = 1;

    if (isExactName && isPostcodeMatch) {
      conf = 'high';
      score = 100;
    } else if (isExactName && isOutwardMatch) {
      conf = 'high';
      score = 80;
    } else if (isExactName) {
      conf = 'medium';
      score = 50;
    } else if (isPostcodeMatch) {
      conf = 'medium';
      score = 40;
    } else if (isOutwardMatch) {
      conf = 'low';
      score = 20;
    }

    evaluated.push({ item, confidence: conf, score });
  }

  evaluated.sort((a, b) => b.score - a.score);

  // Take top 3 candidates and populate officer details for each
  const topCandidates = evaluated.slice(0, 3);
  const candidateRecords: CompanyRecord[] = [];

  for (const c of topCandidates) {
    let directors: string[] = [];
    try {
      const officersUrl = `${baseUrl}/company/${c.item.company_number}/officers`;
      const offRes = await fetch(officersUrl, {
        headers: { Authorization: authHeader },
        signal: AbortSignal.timeout(6000),
      });
      if (offRes.ok) {
        const offData = await offRes.json();
        const rawOfficers: CHOfficerItem[] = offData.items || [];
        directors = rawOfficers
          .filter(
            (o) =>
              !o.resigned_on &&
              (o.officer_role.toLowerCase().includes('director') ||
                o.officer_role.toLowerCase().includes('llp-designated-member') ||
                o.officer_role.toLowerCase().includes('member'))
          )
          .map((o) => formatOfficerName(o.name))
          .slice(0, 3);
      }
    } catch {
      directors = [];
    }

    candidateRecords.push({
      id: crypto.randomUUID(),
      lead_id: leadId,
      company_number: c.item.company_number,
      legal_name: c.item.title,
      company_type: c.item.company_type || 'ltd',
      status: c.item.company_status || 'active',
      incorporation_date: c.item.date_of_creation || null,
      sic_codes: c.item.sic_codes || [],
      registered_address: c.item.address_snippet || (postcode ? `${postcode}, UK` : 'United Kingdom'),
      officers: directors,
      match_confidence: c.confidence,
      created_at: new Date().toISOString(),
    });
  }

  const best = candidateRecords[0] || null;
  const highestConf = topCandidates[0]?.confidence || 'none';

  return {
    selectedMatch: best,
    candidates: candidateRecords,
    confidence: highestConf,
    configured: true,
  };
}

function normalizeCompanyName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, '')
    .replace(/\b(limited|ltd|plc|llp|and co|services|company|group)\b/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function formatOfficerName(raw: string): string {
  if (raw.includes(',')) {
    const [last, first] = raw.split(',').map((s) => s.trim());
    return `${toTitleCase(first)} ${toTitleCase(last)}`;
  }
  return toTitleCase(raw);
}

function toTitleCase(str: string): string {
  return str
    .toLowerCase()
    .split(' ')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

function generateRealisticDirectorName(businessName: string): string {
  const firstNames = ['James', 'David', 'Sarah', 'Emma', 'Oliver', 'Charlotte', 'Thomas', 'Sophie', 'Jack', 'Lucy'];
  const lastNames = ['Smith', 'Taylor', 'Davies', 'Brown', 'Wilson', 'Evans', 'Thomas', 'Johnson', 'Roberts', 'Walker'];

  const hash = businessName.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const first = firstNames[hash % firstNames.length];
  const last = lastNames[(hash * 3) % lastNames.length];
  return `${first} ${last}`;
}

function generateCandidateOptions(
  businessName: string,
  postcode: string | null | undefined,
  leadId: string
): CompanyRecord[] {
  const clean = businessName.replace(/\b(ltd|limited|llp|plc|and co|& co|services|studio|uk)\b/gi, '').trim().toUpperCase();
  const variants = [
    `${clean} LTD`,
    `${clean} (HAIR) LIMITED`,
    `${clean} HAIR SALONS LTD`,
  ];

  return variants.map((legalName, idx) => {
    const hash = Math.abs((businessName + idx).split('').reduce((acc, char) => acc + char.charCodeAt(0), 0));
    const companyNum = String(10000000 + (hash % 89999999));
    const director = generateRealisticDirectorName(businessName + idx);

    return {
      id: crypto.randomUUID(),
      lead_id: leadId,
      company_number: companyNum,
      legal_name: legalName,
      company_type: 'ltd',
      status: 'active',
      incorporation_date: '2016-05-18',
      sic_codes: ['96020', '47750'],
      registered_address: postcode ? `Unit ${idx + 1}, High Street, ${postcode}` : 'Reading, Berkshire, UK',
      officers: [director],
      match_confidence: idx === 0 ? ('medium' as const) : ('low' as const),
      created_at: new Date().toISOString(),
    };
  });
}

function generateMockCompanyRecord(
  businessName: string,
  postcode: string | null | undefined,
  leadId: string
): CompanyRecord {
  return generateCandidateOptions(businessName, postcode, leadId)[0];
}
