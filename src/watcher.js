import { AiUnavailableError, NO_CHANGE, describeScene } from './ai.js';
import { dispatchAlerts } from './alerts.js';
import { gridDiff } from './camera.js';
import { config } from './config.js';
import { addEvent, recentEvents } from './db.js';
import { saveFrames } from './frames.js';
import { activeWatches } from './watches.js';
import { dispatchWatchMatches } from './watchnotify.js';

/**
 * Turns camera motion into log entries while keeping Gemini usage bounded:
 * at most one description per cooldown, plus an optional heartbeat.
 */
export function startWatcher(camera, onEvent) {
  let lastCallAt = 0;
  let busy = false;
  let pending = null; // motion seen during cooldown, described when it ends
  let lastDescribedGrid = null; // scene grid of the last thing we actually described

  async function describe(kind, area, jpeg) {
    if (busy) return;

    // Local, free dedupe: if the scene looks the same as the last one we
    // described, skip the Gemini call entirely (saves quota on repetitive
    // motion like swaying trees, flags, or the same parked cars).
    const grid = camera.latestGrid;
    if (kind === 'motion' && lastDescribedGrid && grid) {
      const changed = gridDiff(grid, lastDescribedGrid, config.motion.pixelThreshold);
      if (changed < config.motion.minArea) {
        console.log(`[watcher] motion: scene unchanged since last description, skipping AI call`);
        return;
      }
    }

    busy = true;
    lastCallAt = Date.now();
    try {
      const [previous] = recentEvents(1);
      const watches = activeWatches();
      const { text, alerts, watchMatches } = await describeScene(jpeg, previous, watches);

      // Fire alerts even when the description itself is unchanged — a dangerous
      // situation must not be swallowed by dedupe. Cooldown lives in the dispatcher.
      if (alerts.length) dispatchAlerts(alerts, jpeg).catch((e) => console.error('[watcher] alert error:', e.message));

      // Notify operators whose standing watch conditions were met this frame.
      if (watchMatches?.length) dispatchWatchMatches(watchMatches, watches, jpeg).catch((e) => console.error('[watcher] watch error:', e.message));

      if (!text || text.includes(NO_CHANGE)) {
        lastDescribedGrid = grid; // scene is current even if nothing new to report
        console.log(`[watcher] ${kind}: no meaningful change`);
        return;
      }
      const event = addEvent({ ts: Date.now(), kind, motion: area, description: text });
      saveFrames(event.id, camera.recentFrames(config.ai.framesPerEvent)); // a few frames for re-analysis
      lastDescribedGrid = grid;
      console.log(`[watcher] ${kind}: ${text}`);
      onEvent(event);
    } catch (err) {
      const msg = err instanceof AiUnavailableError ? err.message : err?.message || err;
      console.warn(`[watcher] description skipped: ${msg}`);
    } finally {
      busy = false;
    }
  }

  const cooldownMs = config.ai.cooldownSec * 1000;

  camera.on('motion', ({ area }) => {
    if (Date.now() - lastCallAt >= cooldownMs) {
      pending = null;
      describe('motion', area, camera.latestJpeg);
    } else {
      pending = Math.max(pending ?? 0, area);
    }
  });

  setInterval(() => {
    if (!camera.online || !camera.latestJpeg) return;
    const sinceLast = Date.now() - lastCallAt;
    if (pending !== null && sinceLast >= cooldownMs) {
      const area = pending;
      pending = null;
      describe('motion', area, camera.latestJpeg);
    } else if (config.ai.heartbeatMin > 0 && sinceLast >= config.ai.heartbeatMin * 60000) {
      describe('heartbeat', 0, camera.latestJpeg);
    }
  }, 5000);
}
