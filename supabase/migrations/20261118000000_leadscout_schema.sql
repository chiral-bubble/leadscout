-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. SEARCHES
CREATE TABLE IF NOT EXISTS searches (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  niche TEXT NOT NULL,
  location TEXT NOT NULL,
  radius_miles NUMERIC(5, 2) NOT NULL DEFAULT 10,
  max_results INTEGER NOT NULL DEFAULT 20,
  results_count INTEGER NOT NULL DEFAULT 0,
  estimated_api_cost_gbp NUMERIC(6, 4) DEFAULT 0.0000,
  status TEXT NOT NULL DEFAULT 'completed', -- 'pending' | 'running' | 'completed' | 'failed'
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('Europe/London', now())
);

-- 2. LEADS
CREATE TABLE IF NOT EXISTS leads (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  search_id UUID REFERENCES searches(id) ON DELETE SET NULL,
  place_id TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  address TEXT,
  postcode TEXT,
  phone_raw TEXT,
  phone_e164 TEXT,
  phone_type TEXT NOT NULL DEFAULT 'unknown', -- 'mobile' | 'landline' | 'unknown'
  whatsapp_likely BOOLEAN NOT NULL DEFAULT FALSE,
  website TEXT,
  has_website BOOLEAN NOT NULL DEFAULT FALSE,
  website_type TEXT NOT NULL DEFAULT 'none',  -- 'none' | 'social_only' | 'builder' | 'own_site'
  rating NUMERIC(2, 1),
  review_count INTEGER DEFAULT 0,
  categories JSONB DEFAULT '[]'::jsonb,
  opening_hours JSONB DEFAULT '{}'::jsonb,
  google_maps_url TEXT,
  business_status TEXT,
  status TEXT NOT NULL DEFAULT 'discovered', -- 'discovered' | 'audited' | 'analysed' | 'ready_for_outreach' | 'contacted'
  is_suppressed BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('Europe/London', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('Europe/London', now())
);

CREATE INDEX IF NOT EXISTS idx_leads_place_id ON leads(place_id);
CREATE INDEX IF NOT EXISTS idx_leads_search_id ON leads(search_id);
CREATE INDEX IF NOT EXISTS idx_leads_postcode ON leads(postcode);
CREATE INDEX IF NOT EXISTS idx_leads_website_type ON leads(website_type);
CREATE INDEX IF NOT EXISTS idx_leads_phone_type ON leads(phone_type);
CREATE INDEX IF NOT EXISTS idx_leads_is_suppressed ON leads(is_suppressed);

-- 3. WEBSITE_AUDITS (Playwright checks)
CREATE TABLE IF NOT EXISTS website_audits (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  url_tested TEXT NOT NULL,
  http_status INTEGER,
  is_https BOOLEAN DEFAULT FALSE,
  mobile_responsive BOOLEAN DEFAULT FALSE,
  load_time_ms INTEGER,
  has_contact_form BOOLEAN DEFAULT FALSE,
  has_online_booking BOOLEAN DEFAULT FALSE,
  detected_technologies JSONB DEFAULT '[]'::jsonb,
  screenshot_storage_path TEXT,
  broken_links_found INTEGER DEFAULT 0,
  raw_seo_metrics JSONB DEFAULT '{}'::jsonb,
  error_log TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('Europe/London', now())
);

-- 4. COMPANY_RECORDS (Companies House)
CREATE TABLE IF NOT EXISTS company_records (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  company_number TEXT NOT NULL UNIQUE,
  company_name TEXT NOT NULL,
  company_status TEXT NOT NULL,
  company_type TEXT,
  incorporation_date DATE,
  sic_codes JSONB DEFAULT '[]'::jsonb,
  registered_office_address JSONB DEFAULT '{}'::jsonb,
  officers JSONB DEFAULT '[]'::jsonb,
  last_accounts_date DATE,
  has_charges BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('Europe/London', now())
);

-- 5. ANALYSES (Anthropic Claude Evaluation)
CREATE TABLE IF NOT EXISTS analyses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  model_used TEXT NOT NULL,
  opportunity_score INTEGER NOT NULL CHECK (opportunity_score BETWEEN 1 AND 100),
  key_problems JSONB NOT NULL DEFAULT '[]'::jsonb,
  recommended_solutions JSONB NOT NULL DEFAULT '[]'::jsonb,
  estimated_project_value_gbp NUMERIC(10, 2),
  estimated_roi_angle TEXT,
  decision_maker_guess TEXT,
  summary TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('Europe/London', now())
);

-- 6. PITCHES
CREATE TABLE IF NOT EXISTS pitches (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  analysis_id UUID REFERENCES analyses(id) ON DELETE SET NULL,
  model_used TEXT NOT NULL,
  subject_line TEXT NOT NULL,
  email_body_text TEXT NOT NULL,
  whatsapp_text TEXT,
  linkedin_note_text TEXT,
  click_to_chat_links JSONB DEFAULT '{}'::jsonb,
  is_customised_by_user BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('Europe/London', now())
);

-- 7. OUTREACH_LOG
CREATE TABLE IF NOT EXISTS outreach_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  pitch_id UUID REFERENCES pitches(id) ON DELETE SET NULL,
  channel TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft_opened',
  notes TEXT,
  contacted_at TIMESTAMPTZ NOT NULL DEFAULT timezone('Europe/London', now()),
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('Europe/London', now())
);

-- 8. SUPPRESSION_LIST
CREATE TABLE IF NOT EXISTS suppression_list (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  domain TEXT,
  email TEXT,
  phone_e164 TEXT,
  company_number TEXT,
  lead_id UUID REFERENCES leads(id) ON DELETE SET NULL,
  reason TEXT NOT NULL DEFAULT 'user_requested',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('Europe/London', now())
);

CREATE INDEX IF NOT EXISTS idx_suppression_domain ON suppression_list(domain);
CREATE INDEX IF NOT EXISTS idx_suppression_email ON suppression_list(email);
CREATE INDEX IF NOT EXISTS idx_suppression_phone ON suppression_list(phone_e164);

