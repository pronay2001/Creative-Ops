const { Pool } = require('pg');

const schema = `
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  keka_id TEXT UNIQUE,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT,
  role TEXT NOT NULL DEFAULT 'requester',
  skills TEXT[] DEFAULT '{}',
  capacity INTEGER DEFAULT 0,
  avatar_url TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS campaigns (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  show TEXT,
  status TEXT DEFAULT 'active',
  description TEXT,
  created_date TIMESTAMPTZ DEFAULT NOW(),
  created_by TEXT REFERENCES users(id),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS requests (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  campaign_id TEXT REFERENCES campaigns(id),
  asset_type_id TEXT NOT NULL,
  department TEXT,
  platforms TEXT[] DEFAULT '{}',
  assigned_to TEXT REFERENCES users(id),
  status TEXT DEFAULT 'intake',
  priority TEXT DEFAULT 'medium',
  go_live_date DATE,
  internal_deadline DATE,
  brief JSONB DEFAULT '{}',
  created_date TIMESTAMPTZ DEFAULT NOW(),
  created_by TEXT REFERENCES users(id),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS deliverables (
  id TEXT PRIMARY KEY,
  request_id TEXT REFERENCES requests(id) ON DELETE CASCADE,
  asset_type_id TEXT NOT NULL,
  platforms TEXT[] DEFAULT '{}',
  assigned_to TEXT REFERENCES users(id),
  status TEXT DEFAULT 'intake',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS comments (
  id SERIAL PRIMARY KEY,
  request_id TEXT REFERENCES requests(id) ON DELETE CASCADE,
  user_id TEXT REFERENCES users(id),
  text TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS activity_log (
  id SERIAL PRIMARY KEY,
  request_id TEXT REFERENCES requests(id) ON DELETE CASCADE,
  user_id TEXT REFERENCES users(id),
  action TEXT NOT NULL,
  details JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS timesheet_entries (
  id SERIAL PRIMARY KEY,
  user_id TEXT REFERENCES users(id),
  request_id TEXT REFERENCES requests(id),
  date DATE NOT NULL,
  hours NUMERIC(4,2) DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS knowledge_entries (
  id SERIAL PRIMARY KEY,
  campaign_id TEXT REFERENCES campaigns(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  type TEXT,
  content TEXT,
  created_by TEXT REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS content_schedule (
  id SERIAL PRIMARY KEY,
  campaign_id TEXT REFERENCES campaigns(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  platform TEXT,
  scheduled_date DATE,
  status TEXT DEFAULT 'planned',
  assigned_to TEXT REFERENCES users(id),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
`;

const seedUsers = `
INSERT INTO users (id, name, email, password_hash, role, skills, capacity) VALUES
  ('usr_pronay',   'Pronay Roy',       'pronay.roy@hoichoi.tv', '$2b$10$rMCdJwdCNKdx9nGqPhfH1eAsZchE8a5QAMuF/gjwjzXD8CV10kydK', 'creative_lead', ARRAY['video','motion','design'], 40),
  ('usr_sneha',    'Sneha Roy',        'sneha@hoichoi.tv',      '$2b$10$b0fGvXQNPf968PYmSYtUV.ufShQFb/wm827d7eIKjQqDbDVTis92.', 'designer',      ARRAY['video','motion'], 35),
  ('usr_arjun',    'Arjun Das',        'arjun@hoichoi.tv',      '$2b$10$y8PQ26oUTRfIFf.rzTkqyORPT1cw6lBNgMfGwgLLG10fLZ.OcxHRm', 'designer',      ARRAY['static','social'], 35),
  ('usr_riya',     'Riya Sen',         'riya@hoichoi.tv',       '$2b$10$fbCUNyI0kzBG6i6/WykRkeNuQaAERaF4zXIweHKOyA/S6g9yaTfz6', 'designer',      ARRAY['static','banner','social'], 35),
  ('usr_anirban',  'Anirban Ghosh',    'anirban@hoichoi.tv',    '$2b$10$qUh57UgCP4r.SbmJPfAIlOQA1XaK7hfhC1Kwbfr/81.eKGDnEgfVm', 'approver',      ARRAY['review'], 0),
  ('usr_mitali',   'Mitali Chakraborty','mitali@hoichoi.tv',    '$2b$10$3phXz7qlmopTDifxMW3pReNtMP271JdCcr9lhGvYjZbSRd9zwgf7q', 'requester',     ARRAY['content'], 0),
  ('usr_sourav',   'Sourav Banerjee',  'sourav@svf.in',         '$2b$10$PYrlV.kBKTstY9reWENqRurHCqTQbV4kOX.lUlpeGqXSVoSZkG8eK', 'requester',     ARRAY['marketing'], 0),
  ('usr_priyanka', 'Priyanka Sarkar',  'priyanka@svf.in',       '$2b$10$eo11VnewFOJSxrdhhbpaLO30kFAmlzLtnXIurskhm8F1OYhToffzy', 'approver',      ARRAY['review'], 0)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  email = EXCLUDED.email,
  password_hash = EXCLUDED.password_hash;
`;

const alterations = `
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash TEXT;
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_keka_id_key;
DROP INDEX IF EXISTS users_keka_id_unique;
ALTER TABLE users ADD COLUMN IF NOT EXISTS department TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS designation TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS reports_to_name TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS reports_to_email TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS location TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS joined_at DATE;
ALTER TABLE requests ADD COLUMN IF NOT EXISTS vertical TEXT;
ALTER TABLE requests ADD COLUMN IF NOT EXISTS is_expedited BOOLEAN DEFAULT false;

ALTER TABLE knowledge_entries ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}';
ALTER TABLE knowledge_entries ADD COLUMN IF NOT EXISTS reference TEXT;

ALTER TABLE content_schedule ADD COLUMN IF NOT EXISTS linked_request_id TEXT;
ALTER TABLE content_schedule ADD COLUMN IF NOT EXISTS platforms TEXT[] DEFAULT '{}';
ALTER TABLE content_schedule ADD COLUMN IF NOT EXISTS created_by TEXT;

CREATE TABLE IF NOT EXISTS timesheet_clock (
  id SERIAL PRIMARY KEY,
  user_id TEXT REFERENCES users(id) NOT NULL,
  request_id TEXT REFERENCES requests(id),
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  duration_minutes NUMERIC(6,2),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
`;

const assetTypeMigration = `
UPDATE requests SET asset_type_id = 'scene_cutdown' WHERE asset_type_id = 'repurpose_reel';
UPDATE requests SET asset_type_id = 'teaser_first_look' WHERE asset_type_id = 'teaser_trailer';
UPDATE requests SET asset_type_id = 'hoichoi_brand_promo' WHERE asset_type_id = 'brand_promo';
UPDATE requests SET asset_type_id = 'branded_content_episode' WHERE asset_type_id = 'brand_episode_promo';
UPDATE requests SET asset_type_id = 'prebuzz_phase_ads' WHERE asset_type_id = 'prebuzz';
UPDATE requests SET asset_type_id = 'promo_phase_ads' WHERE asset_type_id = 'promo_video';
UPDATE requests SET asset_type_id = 'sustenance_phase_ads' WHERE asset_type_id = 'combined_ads';
UPDATE requests SET asset_type_id = 'library_content_ads' WHERE asset_type_id = 'scene_based_ads';
UPDATE requests SET asset_type_id = 'teaser_trailer_repackage' WHERE asset_type_id = 'trailer_repackages';
UPDATE requests SET asset_type_id = 'whatsapp_crm_video' WHERE asset_type_id = 'crm_promos';
UPDATE requests SET asset_type_id = 'teaser_first_look_thumb' WHERE asset_type_id = 'teaser_trailer_thumb';
UPDATE requests SET asset_type_id = 'ancillary_content_thumb' WHERE asset_type_id = 'promo_thumbnail';
UPDATE requests SET asset_type_id = 'super_cards_ext_influencers' WHERE asset_type_id = 'thumb_ext_influencers';
UPDATE requests SET asset_type_id = 'whatsapp_crm_static' WHERE asset_type_id = 'crm_static';
UPDATE requests SET asset_type_id = 'cms_thumbnail_refresh' WHERE asset_type_id = 'cms_thumbnail';
UPDATE requests SET asset_type_id = 'sm_episode_thumbnail' WHERE asset_type_id = 'episode_thumbnail';
UPDATE requests SET asset_type_id = 'cms_thumbnail_refresh' WHERE asset_type_id = 'cms_maintenance';

UPDATE deliverables SET asset_type_id = 'scene_cutdown' WHERE asset_type_id = 'repurpose_reel';
UPDATE deliverables SET asset_type_id = 'teaser_first_look' WHERE asset_type_id = 'teaser_trailer';
UPDATE deliverables SET asset_type_id = 'hoichoi_brand_promo' WHERE asset_type_id = 'brand_promo';
UPDATE deliverables SET asset_type_id = 'branded_content_episode' WHERE asset_type_id = 'brand_episode_promo';
UPDATE deliverables SET asset_type_id = 'prebuzz_phase_ads' WHERE asset_type_id = 'prebuzz';
UPDATE deliverables SET asset_type_id = 'promo_phase_ads' WHERE asset_type_id = 'promo_video';
UPDATE deliverables SET asset_type_id = 'sustenance_phase_ads' WHERE asset_type_id = 'combined_ads';
UPDATE deliverables SET asset_type_id = 'library_content_ads' WHERE asset_type_id = 'scene_based_ads';
UPDATE deliverables SET asset_type_id = 'teaser_trailer_repackage' WHERE asset_type_id = 'trailer_repackages';
UPDATE deliverables SET asset_type_id = 'whatsapp_crm_video' WHERE asset_type_id = 'crm_promos';
UPDATE deliverables SET asset_type_id = 'teaser_first_look_thumb' WHERE asset_type_id = 'teaser_trailer_thumb';
UPDATE deliverables SET asset_type_id = 'ancillary_content_thumb' WHERE asset_type_id = 'promo_thumbnail';
UPDATE deliverables SET asset_type_id = 'super_cards_ext_influencers' WHERE asset_type_id = 'thumb_ext_influencers';
UPDATE deliverables SET asset_type_id = 'whatsapp_crm_static' WHERE asset_type_id = 'crm_static';
UPDATE deliverables SET asset_type_id = 'cms_thumbnail_refresh' WHERE asset_type_id = 'cms_thumbnail';
UPDATE deliverables SET asset_type_id = 'sm_episode_thumbnail' WHERE asset_type_id = 'episode_thumbnail';
UPDATE deliverables SET asset_type_id = 'cms_thumbnail_refresh' WHERE asset_type_id = 'cms_maintenance';
`;

async function migrate() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    await pool.query(schema);
    await pool.query(alterations);
    await pool.query(assetTypeMigration);
    await pool.query(seedUsers);
    console.log('[migrate] Schema created successfully');
  } catch (err) {
    console.error('[migrate] Error:', err.message);
    throw err;
  } finally {
    await pool.end();
  }
}

if (require.main === module) {
  require('dotenv').config();
  migrate().then(() => process.exit(0)).catch(() => process.exit(1));
}

module.exports = { migrate };
