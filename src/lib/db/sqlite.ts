/**
 * Local SQLite storage fallback for LeadScout UK when Supabase is not configured.
 * Uses Node.js 22/24 built-in `node:sqlite` (DatabaseSync).
 * Persists all entities to `leadscout.db` in project root across server restarts.
 */

import { DatabaseSync } from 'node:sqlite';
import * as path from 'path';

let dbInstance: DatabaseSync | null = null;

export function getLocalSqliteDb(): DatabaseSync {
  if (!dbInstance) {
    const dbPath = path.resolve(process.cwd(), 'leadscout.db');
    dbInstance = new DatabaseSync(dbPath);
    initSqliteSchema(dbInstance);
  }
  return dbInstance;
}

export function closeLocalSqliteDb(): void {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
  }
}

function initSqliteSchema(db: DatabaseSync): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS leads (
      id TEXT PRIMARY KEY,
      place_id TEXT,
      source TEXT,
      name TEXT NOT NULL,
      selected_name TEXT,
      website_name TEXT,
      address TEXT,
      postcode TEXT,
      phone_raw TEXT,
      phone_e164 TEXT,
      phone_type TEXT,
      whatsapp_likely INTEGER,
      website TEXT,
      has_website INTEGER,
      website_type TEXT,
      rating REAL,
      review_count INTEGER,
      categories TEXT,
      opening_hours TEXT,
      google_maps_url TEXT,
      business_status TEXT,
      status TEXT,
      is_suppressed INTEGER,
      audit_status TEXT,
      lead_score REAL,
      outreach_class TEXT,
      pipeline_status TEXT,
      notes TEXT,
      manual_notes TEXT,
      tags TEXT,
      next_follow_up_date TEXT,
      follow_up_count INTEGER,
      last_activity_at TEXT,
      has_contact_route INTEGER,
      created_at TEXT,
      updated_at TEXT
    );

    CREATE TABLE IF NOT EXISTS analyses (
      id TEXT PRIMARY KEY,
      lead_id TEXT NOT NULL,
      model_used TEXT,
      lead_score REAL,
      data TEXT NOT NULL,
      created_at TEXT
    );

    CREATE TABLE IF NOT EXISTS pitches (
      id TEXT PRIMARY KEY,
      lead_id TEXT NOT NULL,
      analysis_id TEXT,
      channel TEXT,
      tone TEXT,
      angle TEXT,
      variants TEXT NOT NULL,
      created_at TEXT
    );

    CREATE TABLE IF NOT EXISTS audits (
      id TEXT PRIMARY KEY,
      lead_id TEXT NOT NULL,
      data TEXT NOT NULL,
      created_at TEXT
    );

    CREATE TABLE IF NOT EXISTS psi_results (
      url TEXT PRIMARY KEY,
      lead_id TEXT,
      mobile_score INTEGER,
      lcp_display TEXT,
      fetched_at TEXT
    );

    CREATE TABLE IF NOT EXISTS sender_settings (
      id TEXT PRIMARY KEY,
      name TEXT,
      trading_name TEXT,
      website TEXT,
      contact_email TEXT,
      services TEXT,
      credibility_statement TEXT,
      whatsapp_number TEXT,
      uk_contact_address TEXT,
      opt_out_wording TEXT,
      created_at TEXT,
      updated_at TEXT
    );

    CREATE TABLE IF NOT EXISTS outreach_log (
      id TEXT PRIMARY KEY,
      lead_id TEXT NOT NULL,
      pitch_id TEXT,
      channel TEXT,
      status TEXT,
      notes TEXT,
      contacted_at TEXT,
      created_at TEXT
    );

    CREATE TABLE IF NOT EXISTS confirmed_companies (
      lead_id TEXT PRIMARY KEY,
      company_record TEXT NOT NULL,
      confirmed_at TEXT
    );
  `);

  // Safe migrations for existing leadscout.db files
  try {
    db.exec('ALTER TABLE leads ADD COLUMN manual_notes TEXT');
  } catch {
    // Column already exists
  }
  try {
    db.exec('ALTER TABLE sender_settings ADD COLUMN contact_email TEXT');
  } catch {
    // Column already exists
  }
  try {
    db.exec('ALTER TABLE leads ADD COLUMN source TEXT');
  } catch {
    // Column already exists
  }
}
