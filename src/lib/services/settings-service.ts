import { getSupabaseServerClient } from '@/lib/supabase/server';
import { getLocalSqliteDb } from '@/lib/db/sqlite';
import { SenderProfile } from '@/types/pitch';

export interface DbSenderSettings {
  id: string;
  name: string;
  trading_name: string;
  website: string;
  contact_email?: string | null;
  services?: string[];
  credibility_statement?: string;
  whatsapp_number?: string | null;
  uk_contact_address?: string | null;
  opt_out_wording?: string | null;
  created_at?: string;
  updated_at?: string;
}

export async function getSenderSettings(): Promise<SenderProfile | null> {
  const supabase = getSupabaseServerClient();
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('sender_settings')
        .select('*')
        .limit(1)
        .maybeSingle();

      if (data && !error) {
        return {
          name: data.name,
          trading_name: data.trading_name,
          website: data.website,
          contact_email: data.contact_email || '',
          services: Array.isArray(data.services) ? data.services : JSON.parse(data.services || '[]'),
          credibility_statement: data.credibility_statement || '',
        };
      }
    } catch {
      // fallback
    }
  }

  // SQLite persistent store
  try {
    const db = getLocalSqliteDb();
    const row = db.prepare('SELECT * FROM sender_settings ORDER BY updated_at DESC LIMIT 1').get() as any;
    if (row) {
      return {
        name: row.name,
        trading_name: row.trading_name,
        website: row.website,
        contact_email: row.contact_email || '',
        services: JSON.parse(row.services || '[]'),
        credibility_statement: row.credibility_statement || '',
      };
    }
  } catch (err) {
    console.warn('SQLite sender_settings read failed:', err);
  }

  // Fallback to env variables if explicitly set
  if (process.env.SENDER_NAME && process.env.SENDER_TRADING_NAME) {
    return {
      name: process.env.SENDER_NAME,
      trading_name: process.env.SENDER_TRADING_NAME,
      website: process.env.SENDER_WEBSITE || '',
      contact_email: process.env.SENDER_EMAIL || '',
      services: (process.env.SENDER_SERVICES || '').split(',').map((s) => s.trim()).filter(Boolean),
      credibility_statement: process.env.SENDER_CREDIBILITY || '',
    };
  }

  return null;
}

export async function saveSenderSettings(settings: Omit<DbSenderSettings, 'id'>): Promise<DbSenderSettings> {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const full: DbSenderSettings = {
    ...settings,
    id,
    created_at: now,
    updated_at: now,
  };

  const supabase = getSupabaseServerClient();
  if (supabase) {
    try {
      await supabase.from('sender_settings').upsert({
        id,
        name: settings.name,
        trading_name: settings.trading_name,
        website: settings.website,
        contact_email: settings.contact_email || null,
        services: settings.services || [],
        credibility_statement: settings.credibility_statement || '',
        whatsapp_number: settings.whatsapp_number,
        uk_contact_address: settings.uk_contact_address,
        opt_out_wording: settings.opt_out_wording,
        updated_at: full.updated_at,
      });
    } catch (err) {
      console.warn('Could not persist sender_settings to Supabase:', err);
    }
  }

  // Persist to local SQLite
  try {
    const db = getLocalSqliteDb();
    db.prepare(`
      INSERT OR REPLACE INTO sender_settings (
        id, name, trading_name, website, contact_email, services, credibility_statement,
        whatsapp_number, uk_contact_address, opt_out_wording, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      full.id,
      full.name,
      full.trading_name,
      full.website,
      full.contact_email || null,
      JSON.stringify(full.services || []),
      full.credibility_statement || '',
      full.whatsapp_number || null,
      full.uk_contact_address || null,
      full.opt_out_wording || null,
      full.created_at || now,
      full.updated_at || now
    );
  } catch (err) {
    console.warn('SQLite sender_settings write failed:', err);
  }

  return full;
}
