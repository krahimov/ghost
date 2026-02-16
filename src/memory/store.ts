import Database from "better-sqlite3";
import { getDbPath } from "../utils/paths.js";
import { logger } from "../utils/logger.js";

let db: Database.Database | null = null;

export function getDatabase(): Database.Database {
  if (db) return db;

  const dbPath = getDbPath();
  db = new Database(dbPath);

  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

  db.exec(`
    CREATE TABLE IF NOT EXISTS hauntings (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      status TEXT DEFAULT 'active',
      created_at TEXT NOT NULL,
      last_cycle_at TEXT,
      total_cycles INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS sources (
      id TEXT PRIMARY KEY,
      haunting_id TEXT NOT NULL,
      url TEXT NOT NULL,
      title TEXT,
      source_type TEXT,
      fetched_at TEXT NOT NULL,
      relevance REAL,
      summary TEXT,
      raw_excerpt TEXT,
      FOREIGN KEY (haunting_id) REFERENCES hauntings(id)
    );

    CREATE TABLE IF NOT EXISTS observations (
      id TEXT PRIMARY KEY,
      haunting_id TEXT NOT NULL,
      timestamp TEXT NOT NULL,
      priority TEXT NOT NULL,
      title TEXT NOT NULL,
      content TEXT,
      source_ids TEXT,
      reflected INTEGER DEFAULT 0,
      FOREIGN KEY (haunting_id) REFERENCES hauntings(id)
    );

    CREATE TABLE IF NOT EXISTS cycle_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      haunting_id TEXT NOT NULL,
      started_at TEXT NOT NULL,
      completed_at TEXT,
      observations_added INTEGER DEFAULT 0,
      sources_fetched INTEGER DEFAULT 0,
      reflected INTEGER DEFAULT 0,
      plan_items_added INTEGER DEFAULT 0,
      notifications_sent INTEGER DEFAULT 0,
      error TEXT,
      FOREIGN KEY (haunting_id) REFERENCES hauntings(id)
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      haunting_id TEXT NOT NULL,
      timestamp TEXT NOT NULL,
      channel TEXT NOT NULL,
      content TEXT NOT NULL,
      observation_ids TEXT,
      FOREIGN KEY (haunting_id) REFERENCES hauntings(id)
    );
  `);

  logger.debug("Database initialized");
  return db;
}

export function registerHaunting(
  id: string,
  name: string,
  description: string,
): void {
  const database = getDatabase();
  database
    .prepare(
      `INSERT OR REPLACE INTO hauntings (id, name, description, created_at)
       VALUES (?, ?, ?, ?)`,
    )
    .run(id, name, description, new Date().toISOString());
}

export function logCycleStart(hauntingId: string): number {
  const database = getDatabase();
  const result = database
    .prepare(
      `INSERT INTO cycle_log (haunting_id, started_at) VALUES (?, ?)`,
    )
    .run(hauntingId, new Date().toISOString());
  return Number(result.lastInsertRowid);
}

export function logCycleEnd(
  cycleId: number,
  stats: {
    observationsAdded: number;
    sourcesFetched: number;
    reflected: boolean;
    planItemsAdded: number;
    notificationsSent: number;
    error?: string;
  },
): void {
  const database = getDatabase();
  database
    .prepare(
      `UPDATE cycle_log SET
        completed_at = ?,
        observations_added = ?,
        sources_fetched = ?,
        reflected = ?,
        plan_items_added = ?,
        notifications_sent = ?,
        error = ?
       WHERE id = ?`,
    )
    .run(
      new Date().toISOString(),
      stats.observationsAdded,
      stats.sourcesFetched,
      stats.reflected ? 1 : 0,
      stats.planItemsAdded,
      stats.notificationsSent,
      stats.error ?? null,
      cycleId,
    );
}

export function updateHauntingCycleCount(hauntingId: string): void {
  const database = getDatabase();
  database
    .prepare(
      `UPDATE hauntings SET
        total_cycles = total_cycles + 1,
        last_cycle_at = ?
       WHERE id = ?`,
    )
    .run(new Date().toISOString(), hauntingId);
}

export function getHauntingStats(hauntingId: string): {
  totalCycles: number;
  lastCycleAt: string | null;
} | null {
  const database = getDatabase();
  const row = database
    .prepare(`SELECT total_cycles, last_cycle_at FROM hauntings WHERE id = ?`)
    .get(hauntingId) as
    | { total_cycles: number; last_cycle_at: string | null }
    | undefined;

  if (!row) return null;

  return {
    totalCycles: row.total_cycles,
    lastCycleAt: row.last_cycle_at,
  };
}

export function closeDatabase(): void {
  if (db) {
    db.close();
    db = null;
  }
}
