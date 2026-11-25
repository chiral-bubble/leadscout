# LeadScout UK 🇬🇧

Lead research and outreach assistant for UK freelance web developers and agencies selling websites, redesigns, booking systems, and automations to UK small businesses.

---

## Stage 1: Discovery Features Built

1. **Search Form**:
   - **Business Niche**: Free-text with clickable suggestions (*dentists*, *barbers*, *plumbers*, *restaurants*, *estate agents*, *gyms*, *accountants*, *wedding photographers*).
   - **UK Location**: City, town, or postcode (e.g., *Bristol*, *Leeds*, *BS1 5HH*).
   - **Radius Slider**: 1 to 20 miles.
   - **Max Results**: 20, 50, or 100 results.
   - **Live Estimated Google API Cost**: Computed dynamically in GBP (£) based on query pagination.

2. **Backend Services & Google Places API (New)**:
   - Queries `https://places.googleapis.com/v1/places:searchText` with `"{niche} in {location}, UK"`.
   - Paginates via `nextPageToken` up to `maxResults`.
   - Includes graceful fallback mode for rapid local testing without requiring an immediate Google Cloud billing setup.
   - De-duplicates leads across searches by `place_id`.
   - Stores: `place_id`, `name`, `address`, `postcode`, `phone_raw`, `phone_e164`, `phone_type`, `whatsapp_likely`, `website`, `has_website`, `website_type`, `rating`, `review_count`, `categories`, `opening_hours`, `google_maps_url`, `business_status`, and `search_id`.

3. **UK Normalisation & Opportunity Classification**:
   - **Phone Normalisation**: E.164 (`+44...`).
     - `phone_type = "mobile"` for `07...` / `+447...` -> `whatsapp_likely = true`.
     - `phone_type = "landline"` for `01...`, `02...`, `03...`.
     - `phone_type = "unknown"` for others.
   - **Website Classification**:
     - `none`: No website found (primary hot lead for web build).
     - `social_only`: Facebook, Instagram, TikTok, Linktree, etc. (prime redesign target).
     - `builder`: Wix, Squarespace, GoDaddy, WordPress.com, Carrd, etc. (migration lead).
     - `own_site`: Custom domain.
   - **UK Postcode Extraction**: Formats outward & inward codes (e.g., `BS1 5HH`).

4. **UI & Results Table**:
   - Sortable by: *Business Name*, *Google Rating*, *Review Count*.
   - Filterable by: *Website Type* (All, No Website, Social Only, Site Builder, Own Site), *Phone Channel* (All, Mobile / WhatsApp, Landline), and live text search.
   - High-contrast visual badges for opportunity channels.
   - Quick Inspect modal for business hours, address, and Google Maps deep link.
   - CSV Export for offline workflow.
   - "Save Search" history list displaying past scans with results count, cost in GBP, and London timestamp.
   - Skeleton loaders and error/warning notification banners.

---

## How to Run & Test

### 1. Environment Configuration
Copy `.env.example` to `.env.local`:
```bash
cd leadscout-uk
cp .env.example .env.local
```
Add your `GOOGLE_PLACES_API_KEY` (if you have one). If omitted, LeadScout UK will automatically run in realistic preview mode with authentic UK addresses, postcodes, and phone numbers.

### 2. Run Verification Tests
```bash
npm run test:discovery
```

### 3. Start Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

