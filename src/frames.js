import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { config } from './config.js';
import { eventTsMap } from './db.js';

const DIR = 'data/frames';
mkdirSync(DIR, { recursive: true });

const pathFor = (id, i) => `${DIR}/${id}_${i}.jpg`;

/** Save a few frames around an event so detail questions can re-analyze them. */
export function saveFrames(id, jpegs) {
  if (!config.ai.frameStore || !jpegs?.length) return;
  try {
    jpegs.forEach((jpeg, i) => writeFileSync(pathFor(id, i), jpeg));
    prune();
  } catch (err) {
    console.warn('[frames] could not save frames:', err.message);
  }
}

/** All saved frames for an event, chronological. */
export function loadFrames(id) {
  try {
    return readdirSync(DIR)
      .filter((f) => f.startsWith(`${id}_`) && f.endsWith('.jpg'))
      .sort((a, b) => idx(a) - idx(b))
      .map((f) => readFileSync(`${DIR}/${f}`));
  } catch {
    return [];
  }
}

/** One representative frame for an event (the last/closest to the description). */
export function loadPrimaryFrame(id) {
  const frames = loadFrames(id);
  return frames.length ? frames[frames.length - 1] : null;
}

const eventId = (f) => Number(f.split('_')[0]);
const idx = (f) => Number(f.split('_')[1]?.replace('.jpg', '')) || 0;

/**
 * Delete frames older than frameKeepDays (by their event's timestamp), plus
 * a hard count cap (frameKeep) as disk protection. Orphaned frames (event no
 * longer in the DB) are removed too.
 */
function prune() {
  try {
    const files = readdirSync(DIR).filter((f) => f.endsWith('.jpg'));
    const ids = [...new Set(files.map(eventId))].filter((n) => !Number.isNaN(n));
    const tsMap = eventTsMap(ids);
    const cutoff = Date.now() - config.ai.frameKeepDays * 86400000;

    const drop = new Set();
    // Age-based: keep only events within the retention window.
    for (const id of ids) {
      const ts = tsMap[id];
      if (ts === undefined || ts < cutoff) drop.add(id);
    }
    // Count cap: if still too many events, drop the oldest by id.
    const keep = ids.filter((id) => !drop.has(id)).sort((a, b) => b - a);
    for (const id of keep.slice(config.ai.frameKeep)) drop.add(id);

    if (!drop.size) return;
    for (const f of files) if (drop.has(eventId(f))) rmSync(`${DIR}/${f}`, { force: true });
  } catch {
    // best effort
  }
}
