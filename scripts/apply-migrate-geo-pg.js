#!/usr/bin/env node
/** Apply geo migration via direct Postgres. Requires SUPABASE_DB_URL secret. */
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

const dbUrl = process.env.SUPABASE_DB_URL;
if (!dbUrl) {
  console.error('Set SUPABASE_DB_URL (Supabase → Settings → Database → Connection string URI).');
  process.exit(1);
}

const sqlPath = path.join(__dirname, 'migrate-geo-columns.sql');
const sql = fs.readFileSync(sqlPath, 'utf8');

(async () => {
  const client = new Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });
  await client.connect();
  await client.query(sql);
  await client.end();
  console.log('Geo migration applied.');
})().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
