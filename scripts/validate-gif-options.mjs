import { ACTIVITY_TENOR_FALLBACKS } from '../src/discord-images.js';

const errors = [];
const urlToActivities = new Map();

for (const [activityId, url] of Object.entries(ACTIVITY_TENOR_FALLBACKS)) {
  if (!url || typeof url !== 'string') {
    errors.push(`${activityId}: missing fallback URL`);
    continue;
  }
  if (!urlToActivities.has(url)) urlToActivities.set(url, []);
  urlToActivities.get(url).push(activityId);
  if (url.length > 512) errors.push(`${activityId}: URL too long (${url.length})`);
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
console.log(`OK — ${Object.keys(ACTIVITY_TENOR_FALLBACKS).length} activities, one curated GIF each.`);
