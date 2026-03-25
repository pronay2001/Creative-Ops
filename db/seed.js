const { Pool } = require('pg');

async function seed() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool.connect();

  try {
    const existing = await client.query('SELECT COUNT(*) FROM users');
    if (parseInt(existing.rows[0].count) > 0) {
      console.log('[seed] Database already has data, skipping seed');
      return;
    }

    console.log('[seed] Seeding database...');
    await client.query('BEGIN');

    console.log('[seed] Done — database seeded (no user/request data to seed, only schema)');
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[seed] Error:', err.message);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

if (require.main === module) {
  require('dotenv').config();
  seed().then(() => process.exit(0)).catch(() => process.exit(1));
}

module.exports = { seed };
