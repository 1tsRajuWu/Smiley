#!/usr/bin/env node
/**
 * Apply install schema SQL via Supabase Management API.
 * Requires SUPABASE_ACCESS_TOKEN (Dashboard → Account → Access Tokens).
 * Optional: SUPABASE_PROJECT_REF (default smxpcmakejgxknpzrspg).
 *
 * Usage:
 *   node scripts/apply-install-schema-management-api.js
 *   node scripts/apply-install-schema-management-api.js scripts/migrate-v8-columns.sql
 *   (default runs base schema + v8 migration)
 */
const fs = require('fs');
const path = require('path');
const https = require('https');

const token = process.env.SUPABASE_ACCESS_TOKEN;
const projectRef = process.env.SUPABASE_PROJECT_REF || 'smxpcmakejgxknpzrspg';

if (!token) {
  console.error('Set SUPABASE_ACCESS_TOKEN (personal access token from supabase.com/dashboard/account/tokens).');
  process.exit(1);
}

const defaultFiles = [
  path.join(__dirname, 'install-database-schema.sql'),
  path.join(__dirname, 'migrate-v8-columns.sql'),
  path.join(__dirname, 'migrate-fix-digest-trigger.sql'),
];
const files = process.argv.length > 2
  ? process.argv.slice(2).map((p) => path.resolve(p))
  : defaultFiles;

function postQuery(queryText) {
  const body = JSON.stringify({ query: queryText });
  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: 'api.supabase.com',
        path: `/v1/projects/${projectRef}/database/query`,
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body),
        },
      },
      (res) => {
        let data = '';
        res.on('data', (c) => { data += c; });
        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(data ? JSON.parse(data) : {});
          } else {
            reject(new Error(`HTTP ${res.statusCode}: ${data.slice(0, 500)}`));
          }
        });
      },
    );
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

(async () => {
  for (const sqlPath of files) {
    if (!fs.existsSync(sqlPath)) {
      throw new Error(`SQL file not found: ${sqlPath}`);
    }
    const query = fs.readFileSync(sqlPath, 'utf8');
    await postQuery(query);
    console.log(`Applied ${path.relative(process.cwd(), sqlPath)} via Management API.`);
  }
})().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
