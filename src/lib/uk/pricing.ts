/**
 * Google Places API (New) Text Search cost estimator in GBP (£).
 * Official Pricing:
 * - Text Search (New) Pro / Enterprise fields = $32.00 per 1,000 requests ($0.032 / request).
 * - Approx GBP conversion: 1 USD ≈ 0.80 GBP -> £0.0256 per page/request.
 * - Each request fetches up to 20 places.
 */
export const GOOGLE_TEXT_SEARCH_COST_PER_PAGE_GBP = 0.0256;

export function estimateSearchCostGBP(maxResults: number): number {
  const pagesNeeded = Math.ceil(maxResults / 20);
  const cost = pagesNeeded * GOOGLE_TEXT_SEARCH_COST_PER_PAGE_GBP;
  return Number(cost.toFixed(4));
}

export function formatGBP(amount: number): string {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    minimumFractionDigits: 2,
    maximumFractionDigits: 3,
  }).format(amount);
}

