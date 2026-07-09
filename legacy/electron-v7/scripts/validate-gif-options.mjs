import { ACTIVITY_TENOR_FALLBACKS } from '../src/discord-images.js';

const errors = [];
const urlToActivities = new Map();

for (const [activityId, url] of Object.entries(ACTIVITY_TENOR_FALLBACKS)) {
  if (!url || typeof url !== 'string') {
    errors.push(`${activityId}: missing Tenor fallback URL`);
    continue;
  }
  if (!/^https:\/\//i.test(url)) errors.push(`${activityId}: URL must be HTTPS`);
  if (url.length > 512) errors.push(`${activityId}: URL too long (${url.length})`);
  if (!urlToActivities.has(url)) urlToActivities.set(url, []);
  urlToActivities.get(url).push(activityId);
}

const crossDupes = [...urlToActivities.entries()].filter(([, acts]) => acts.length > 1);
if (crossDupes.length) {
  for (const [url, acts] of crossDupes) {
    errors.push(`Cross-activity duplicate: ${acts.join(', ')} -> ${url}`);
  }
}

if (Object.keys(ACTIVITY_TENOR_FALLBACKS).length !== 31) {
  errors.push(`Expected 31 activities, got ${Object.keys(ACTIVITY_TENOR_FALLBACKS).length}`);
}

if (errors.length) {
  console.error('VALIDATION FAILED:\n' + errors.join('\n'));
  process.exit(1);
}
console.log(`OK — 31 activities, ${Object.keys(ACTIVITY_TENOR_FALLBACKS).length} curated Tenor URLs.`);
