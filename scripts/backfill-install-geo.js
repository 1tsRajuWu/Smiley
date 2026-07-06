#!/usr/bin/env node
/**
 * Backfill geo fields from ipwho.is (works with partial schema).
 * SUPABASE_SERVICE_KEY=sb_secret_… node scripts/backfill-install-geo.js
 */
const https = require('https');

const SUPABASE_URL = (process.env.SUPABASE_URL || 'https://smxpcmakejgxknpzrspg.supabase.co').replace(/\/$/, '');
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || process.argv[2];

if (!SERVICE_KEY) {
  console.error('Set SUPABASE_SERVICE_KEY or pass secret key as first argument.');
  process.exit(1);
}

function request(url, { method = 'GET', body = null } = {}) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const payload = body ? JSON.stringify(body) : null;
    const headers = { apikey: SERVICE_KEY, 'Content-Type': 'application/json', Prefer: 'return=minimal' };
    if (SERVICE_KEY.startsWith('eyJ')) headers.Authorization = `Bearer ${SERVICE_KEY}`;
    if (payload) headers['Content-Length'] = Buffer.byteLength(payload);

    const req = https.request(
      { hostname: parsed.hostname, path: parsed.pathname + parsed.search, method, headers },
      (res) => {
        let data = '';
        res.on('data', (c) => { data += c; });
        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            try { resolve(data ? JSON.parse(data) : {}); } catch { resolve(data || {}); }
          } else {
            reject(new Error(`HTTP ${res.statusCode}: ${data.slice(0, 400)}`));
          }
        });
      },
    );
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

function mapGeo(geo, columns) {
  if (!geo?.success) return null;
  const patch = {};
  if (columns.has('country_code') && geo.country_code) {
    patch.country_code = String(geo.country_code).slice(0, 8).toUpperCase();
  }
  if (columns.has('region')) {
    const r = columns.has('region_name') ? geo.region : (geo.region || geo.region_code);
    if (r) patch.region = String(r).slice(0, 64);
  }
  if (columns.has('country_name') && geo.country) patch.country_name = String(geo.country).slice(0, 64);
  if (columns.has('region_name') && geo.region) patch.region_name = String(geo.region).slice(0, 64);
  if (columns.has('city') && geo.city) patch.city = String(geo.city).slice(0, 64);
  if (columns.has('isp') && geo.connection?.isp) patch.isp = String(geo.connection.isp).slice(0, 128);
  if (columns.has('geo_timezone') && geo.timezone?.id) patch.geo_timezone = String(geo.timezone.id).slice(0, 64);
  return Object.keys(patch).length ? patch : null;
}

function fetchGeo(ip) {
  const path = ip && !ip.startsWith('127.') ? `https://ipwho.is/${encodeURIComponent(ip)}` : 'https://ipwho.is/';
  return request(path);
}

async function detectColumns() {
  const sample = await request(`${SUPABASE_URL}/rest/v1/installs?select=*&limit=1`);
  const row = Array.isArray(sample) && sample[0] ? sample[0] : {};
  return new Set(Object.keys(row));
}

async function main() {
  const columns = await detectColumns();
  console.log('Columns:', [...columns].join(', '));

  const selectCols = ['install_id', 'ip_address', 'country_code', 'region'];
  if (columns.has('country_name')) selectCols.push('country_name');
  if (columns.has('city')) selectCols.push('city');

  const rows = await request(
    `${SUPABASE_URL}/rest/v1/installs?select=${selectCols.join(',')}&order=last_seen_at.desc`,
  );
  if (!Array.isArray(rows)) throw new Error('Expected array of installs');

  let updated = 0;
  for (const row of rows) {
    try {
      const geo = await fetchGeo(row.ip_address);
      const patch = mapGeo(geo, columns);
      if (!patch) continue;
      if (row.country_code && patch.country_code === row.country_code
          && row.region && row.region.length > 2 && patch.region === row.region) {
        console.log(`Skip ${row.install_id.slice(0, 8)}…`);
        continue;
      }
      await request(
        `${SUPABASE_URL}/rest/v1/installs?install_id=eq.${encodeURIComponent(row.install_id)}`,
        { method: 'PATCH', body: patch },
      );
      updated += 1;
      const label = patch.country_name || patch.country_code || '?';
      console.log(`Updated ${row.install_id.slice(0, 8)}… → ${label}, ${patch.city || patch.region || '—'}`);
      await new Promise((r) => setTimeout(r, 350));
    } catch (err) {
      console.warn(`${row.install_id.slice(0, 8)}…: ${err.message}`);
    }
  }
  console.log(`Done. Updated ${updated}/${rows.length} row(s).`);
}

main().catch((e) => { console.error(e.message); process.exit(1); });
