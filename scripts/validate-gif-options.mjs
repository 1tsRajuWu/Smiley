import { ACTIVITY_GIF_OPTIONS, ACTIVITY_TENOR_FALLBACKS } from '../src/discord-images.js';

const errors = [];
const urlToActivities = new Map();

for (const [activityId, options] of Object.entries(ACTIVITY_GIF_OPTIONS)) {
  const girls = options.filter((o) => o.gender === 'girl');
  const boys = options.filter((o) => o.gender === 'boy');
  if (options.length !== 4) errors.push(`${activityId}: expected 4 options, got ${options.length}`);
  if (girls.length !== 2) errors.push(`${activityId}: expected 2 girl options, got ${girls.length}`);
  if (boys.length !== 2) errors.push(`${activityId}: expected 2 boy options, got ${boys.length}`);
  const fallback = ACTIVITY_TENOR_FALLBACKS[activityId];
  if (fallback !== girls[0]?.url) {
    errors.push(`${activityId}: fallback must match first girl URL`);
  }
  const seen = new Set();
  for (const o of options) {
    if (seen.has(o.url)) errors.push(`${activityId}: duplicate URL within activity (${o.id})`);
    seen.add(o.url);
    if (!urlToActivities.has(o.url)) urlToActivities.set(o.url, []);
    urlToActivities.get(o.url).push(activityId);
    if (o.url.length > 512) errors.push(`${activityId}: URL too long (${o.url.length})`);
  }
}

const crossDupes = [...urlToActivities.entries()].filter(([, acts]) => acts.length > 1);
if (crossDupes.length) {
  for (const [url, acts] of crossDupes) {
    errors.push(`Cross-activity duplicate: ${acts.join(', ')} -> ${url}`);
  }
}

if (Object.keys(ACTIVITY_GIF_OPTIONS).length !== 31) {
  errors.push(`Expected 31 activities, got ${Object.keys(ACTIVITY_GIF_OPTIONS).length}`);
}

if (errors.length) {
  console.error('VALIDATION FAILED:\n' + errors.join('\n'));
  process.exit(1);
}
console.log('OK — 31 activities, 124 unique URLs, all fallbacks match first girl option.');
