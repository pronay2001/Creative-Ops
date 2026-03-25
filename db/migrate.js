const { Pool } = require('pg');

const schema = `
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  keka_id TEXT UNIQUE,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
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

const alterations = `
ALTER TABLE requests ADD COLUMN IF NOT EXISTS vertical TEXT;
ALTER TABLE requests ADD COLUMN IF NOT EXISTS is_expedited BOOLEAN DEFAULT false;

ALTER TABLE knowledge_entries ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}';
ALTER TABLE knowledge_entries ADD COLUMN IF NOT EXISTS reference TEXT;

ALTER TABLE content_schedule ADD COLUMN IF NOT EXISTS linked_request_id TEXT;
ALTER TABLE content_schedule ADD COLUMN IF NOT EXISTS platforms TEXT[] DEFAULT '{}';
ALTER TABLE content_schedule ADD COLUMN IF NOT EXISTS created_by TEXT;
`;

async function migrate() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    await pool.query(schema);
    await pool.query(alterations);
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
