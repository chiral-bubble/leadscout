-- Stage 5A-2 through Stage 7B schema additions for Supabase
ALTER TABLE IF EXISTS leads ADD COLUMN IF NOT EXISTS source TEXT;
ALTER TABLE IF EXISTS leads ADD COLUMN IF NOT EXISTS selected_name TEXT;
ALTER TABLE IF EXISTS leads ADD COLUMN IF NOT EXISTS website_name TEXT;
ALTER TABLE IF EXISTS leads ADD COLUMN IF NOT EXISTS manual_notes TEXT;
ALTER TABLE IF EXISTS leads ADD COLUMN IF NOT EXISTS has_contact_route BOOLEAN DEFAULT TRUE;

CREATE TABLE IF NOT EXISTS sender_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT,
  trading_name TEXT,
  website TEXT,
  contact_email TEXT,
  services JSONB DEFAULT '[]'::jsonb,
  credibility_statement TEXT,
  whatsapp_number TEXT,
  uk_contact_address TEXT,
  opt_out_wording TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE IF EXISTS sender_settings ADD COLUMN IF NOT EXISTS contact_email TEXT;

CREATE TABLE IF NOT EXISTS psi_results (
  url TEXT PRIMARY KEY,
  lead_id TEXT,
  mobile_score INTEGER,
  lcp_display TEXT,
  fetched_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS confirmed_companies (
  lead_id TEXT PRIMARY KEY,
  company_record JSONB NOT NULL,
  confirmed_at TIMESTAMPTZ DEFAULT NOW()
);
