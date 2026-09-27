import { config } from './config.js';
import { db } from './db.js';

// Standing "watch" requests: a privileged operator asks to be notified when a
// visual event happens. Evaluated inside the existing scene-description call
// (no extra API cost), and delivered on the requester's own channel.
db.exec(`
  CREATE TABLE IF NOT EXISTS watches (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    created_by       TEXT    NOT NULL,   -- phone (wa) or chat id (tg)
    channel          TEXT    NOT NULL,   -- 'wa' | 'tg'
    condition        TEXT    NOT NULL,   -- normalized visible event to watch for
    raw_text         TEXT,               -- original request
    expires_at       INTEGER,            -- epoch ms; NULL = until canceled
    recurring        INTEGER NOT NULL DEFAULT 1,
    active           INTEGER NOT NULL DEFAULT 1,
    created_at       INTEGER NOT NULL,
    last_notified_at INTEGER NOT NULL DEFAULT 0
  );
  CREATE INDEX IF NOT EXISTS watches_active ON watches (active);
`);

const insertStmt = db.prepare(
  `INSERT INTO watches (created_by, channel, condition, raw_text, expires_at, recurring, active, created_at, last_notified_at)
   VALUES (?, ?, ?, ?, ?, ?, 1, ?, 0)`,
);
const activeByUserStmt = db.prepare(
  'SELECT * FROM watches WHERE active = 1 AND created_by = ? ORDER BY created_at ASC',
);
const countActiveStmt = db.prepare('SELECT COUNT(*) AS n FROM watches WHERE active = 1 AND created_by = ?');
const deactivateStmt = db.prepare('UPDATE watches SET active = 0 WHERE id = ?');
const deactivateOwnStmt = db.prepare('UPDATE watches SET active = 0 WHERE id = ? AND created_by = ? AND active = 1');
const deactivateAllOwnStmt = db.prepare('UPDATE watches SET active = 0 WHERE created_by = ? AND active = 1');
const markStmt = db.prepare('UPDATE watches SET last_notified_at = ? WHERE id = ?');

/** Create a watch. expiresAt is epoch ms or null. Returns the row. */
export function createWatch({ createdBy, channel, condition, rawText, expiresAt, recurring = true }) {
  const createdAt = Date.now();
  const { lastInsertRowid } = insertStmt.run(
    createdBy, channel, condition, rawText || null, expiresAt ?? null, recurring ? 1 : 0, createdAt,
  );
  return { id: Number(lastInsertRowid), createdBy, channel, condition, expiresAt: expiresAt ?? null, recurring };
}

/** Active, non-expired watches across all users (for the watcher to evaluate). */
export function activeWatches() {
  const now = Date.now();
  return db
    .prepare('SELECT * FROM watches WHERE active = 1 AND (expires_at IS NULL OR expires_at > ?) ORDER BY id ASC')
    .all(now);
}

/** A user's active watches, oldest first (for list/cancel by position). */
export function watchesByUser(createdBy) {
  return activeByUserStmt.all(createdBy);
}

export function activeCount(createdBy) {
  return countActiveStmt.get(createdBy).n;
}

export function markNotified(id, at = Date.now()) {
  markStmt.run(at, id);
}

/** Deactivate one watch; when createdBy is given, only if it belongs to them. */
export function deactivateWatch(id, createdBy) {
  const res = createdBy ? deactivateOwnStmt.run(id, createdBy) : deactivateStmt.run(id);
  return res.changes > 0;
}

/** Deactivate all of a user's active watches; returns how many. */
export function deactivateAll(createdBy) {
  return deactivateAllOwnStmt.run(createdBy).changes;
}

/** Sweep expired watches to inactive (housekeeping, keeps listings clean). */
export function expireDue() {
  db.prepare('UPDATE watches SET active = 0 WHERE active = 1 AND expires_at IS NOT NULL AND expires_at <= ?').run(Date.now());
}

/** Epoch ms of the next local midnight (end of today) in the configured timezone. */
export function endOfTodayMs() {
  const now = new Date();
  const local = new Date(now.toLocaleString('en-US', { timeZone: config.timezone }));
  const nextMidnight = new Date(local);
  nextMidnight.setHours(24, 0, 0, 0);
  return now.getTime() + (nextMidnight.getTime() - local.getTime());
}

// Housekeeping sweep so expired watches drop out of listings on their own.
setInterval(expireDue, 5 * 60 * 1000).unref();
