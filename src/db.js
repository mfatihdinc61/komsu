import { mkdirSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';

mkdirSync('data', { recursive: true });
export const db = new DatabaseSync('data/events.db');

db.exec(`
  CREATE TABLE IF NOT EXISTS events (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    ts          INTEGER NOT NULL,
    kind        TEXT    NOT NULL,   -- 'motion' | 'heartbeat'
    motion      REAL    NOT NULL DEFAULT 0,
    description TEXT    NOT NULL
  );
  CREATE INDEX IF NOT EXISTS events_ts ON events (ts);
`);

const insertStmt = db.prepare('INSERT INTO events (ts, kind, motion, description) VALUES (?, ?, ?, ?)');
const recentStmt = db.prepare('SELECT * FROM events ORDER BY ts DESC LIMIT ?');
const betweenStmt = db.prepare('SELECT * FROM events WHERE ts >= ? AND ts <= ? ORDER BY ts DESC LIMIT ?');

export function addEvent({ ts, kind, motion, description }) {
  const { lastInsertRowid } = insertStmt.run(ts, kind, motion, description);
  return { id: Number(lastInsertRowid), ts, kind, motion, description };
}

/** Newest first. */
export function recentEvents(limit = 50) {
  return recentStmt.all(limit);
}

/** Events with ts in [start, end], newest first (for historical questions). */
export function eventsBetween(start, end, limit = 200) {
  return betweenStmt.all(start, end, limit);
}

/** Map of id -> ts for the given event ids (used by frame pruning). */
export function eventTsMap(ids) {
  if (!ids.length) return {};
  const rows = db.prepare(`SELECT id, ts FROM events WHERE id IN (${ids.map(() => '?').join(',')})`).all(...ids);
  const map = {};
  for (const r of rows) map[r.id] = r.ts;
  return map;
}
