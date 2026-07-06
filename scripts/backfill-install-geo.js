#!/usr/bin/env node
/**
 * Backfill country/city/ISP from ipwho.is for all installs (maintainer script).
 * Requires service role / secret key via SUPABASE_SERVICE_KEY or first arg.
 *
 * Usage:
 *   SUPABASE_SERVICE_KEY=sb_secret_… node scripts/backfill-install-geo.js
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
    const headers = { apikey: SERVICE_KEY, 'Content-Type': 'application/json' };
    if (SERVICE_KEY.startsWith('eyJ')) headers.Authorization = `Bearer ${SERVICE_KEY}`;
    if (payload) headers['Content-Length'] = Buffer.byteLength(payload);

    const req = https.request(
      { hostname: parsed.hostname, path: parsed.pathname + parsed.search, method, headers },
      (res) => {
        let data = '';
        res.on('data', (c) => { data += c; });
        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            try { resolve(data ? JSON.parse(data) : {}); } catch { resolve(data); }
          } else {
            reject(new Error(`HTTP ${res.statusCode}: ${data.slice(0, 300)}`));
          }
        });
      },
    );
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

function mapGeo(geo) {
  if (!geo?.success) return null;
  return {
    country_code: geo.country_code ? String(geo.country_code).slice(0, 8).toUpperCase() : null,
    country_name: geo.country ? String(geo.country).slice(0, 64) : null,
    region: geo.region_code ? String(geo.region_code).slice(0, 16) : null,
    region_name: geo.region ? String(geo.region).slice(0, 64) : null,
    city: geo.city ? String(geo.city).slice(0, 64) : null,
    isp: geo.connection?.isp ? String(geo.connection.isp).slice(0, 128) : null,
    geo_timezone: geo.timezone?.id ? String(geo.timezone.id).slice(0, 64) : null,
  };
}

function fetchGeoForIp(ip) {
  if (!ip || ip.startsWith('127.') || ip === '::1') {
    return request('https://ipwho.is/');
  }
  return request(`https://ipwho.is/${encodeURIComponent(ip)}`);
}

async function main() {
  const rows = await request(
    `${SUPABASE_URL}/rest/v1/installs?select=install_id,ip_address,country_name,city&order=last_seen_at.desc`,
  );
  if (!Array.isArray(rows)) {
    console.error('Unexpected response:', rows);
    process.exit(1);
  }
  console.log(`Found ${rows.length} install(s).`);

  let updated = 0;
  for (const row of rows) {
    if (row.country_name && row.city) {
      console.log(`Skip ${row.install_id.slice(0, 8)}… (already has geo)`);
      continue;
    }
    try {
      const geo = await fetchGeoForIp(row.ip_address);
      const patch = mapGeo(geo);
      if (!patch) {
        console.warn(`No geo for ${row.install_id.slice(0, 8)}…`);
        continue;
      }
      await request(
        `${SUPABASE_URL}/rest/v1/installs?install_id=eq.${encodeURIComponent(row.install_id)}`,
        { method: 'PATCH', body: patch },
      );
      updated += 1;
      console.log(`Updated ${row.install_id.slice(0, 8)}… → ${patch.country_name || patch.country_code}, ${patch.city || '—'}`);
      await new Promise((r) => setTimeout(r, 400));
    } catch (err) {
      console.warn(`Failed ${row.install_id.slice(0, 8)}…:`, err.message);
    }
  }
  console.log(`Done. Updated ${updated} row(s).`);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
