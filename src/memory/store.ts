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
      key_claims TEXT,
      entities TEXT,
      strategic_relevance TEXT,
      cycle_id INTEGER,
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

  // Migration: add columns that might not exist in older databases
  const migrations = [
    "ALTER TABLE sources ADD COLUMN key_claims TEXT",
    "ALTER TABLE sources ADD COLUMN entities TEXT",
    "ALTER TABLE sources ADD COLUMN strategic_relevance TEXT",
    "ALTER TABLE sources ADD COLUMN cycle_id INTEGER",
  ];
  for (const migration of migrations) {
    try {
      db.exec(migration);
    } catch {
      // Column already exists — skip
    }
  }

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

// --- Source persistence ---

export interface SourceRecord {
  url: string;
  title: string;
  source_type?: string;
  fetched_at: string;
  relevance?: number;
  summary?: string;
  raw_excerpt?: string;
  key_claims?: string[];
  entities?: string[];
  strategic_relevance?: string;
}

export function insertSource(
  hauntingId: string,
  source: SourceRecord,
  cycleId?: number,
): void {
  const database = getDatabase();
  const id = `${hauntingId}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  database
    .prepare(
      `INSERT OR REPLACE INTO sources
       (id, haunting_id, url, title, source_type, fetched_at, relevance, summary, raw_excerpt, key_claims, entities, strategic_relevance, cycle_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      id,
      hauntingId,
      source.url,
      source.title,
      source.source_type ?? null,
      source.fetched_at,
      source.relevance ?? null,
      source.summary ?? null,
      source.raw_excerpt ?? null,
      source.key_claims ? JSON.stringify(source.key_claims) : null,
      source.entities ? JSON.stringify(source.entities) : null,
      source.strategic_relevance ?? null,
      cycleId ?? null,
    );
}

export function getSourcesForHaunting(
  hauntingId: string,
  limit = 100,
): SourceRecord[] {
  const database = getDatabase();
  const rows = database
    .prepare(
      `SELECT url, title, source_type, fetched_at, relevance, summary, raw_excerpt, key_claims, entities, strategic_relevance
       FROM sources WHERE haunting_id = ?
       ORDER BY fetched_at DESC LIMIT ?`,
    )
    .all(hauntingId, limit) as any[];

  return rows.map((row) => ({
    url: row.url,
    title: row.title,
    source_type: row.source_type,
    fetched_at: row.fetched_at,
    relevance: row.relevance,
    summary: row.summary,
    raw_excerpt: row.raw_excerpt,
    key_claims: row.key_claims ? JSON.parse(row.key_claims) : undefined,
    entities: row.entities ? JSON.parse(row.entities) : undefined,
    strategic_relevance: row.strategic_relevance,
  }));
}

export function searchSources(
  hauntingId: string,
  searchTerm: string,
  limit = 20,
): SourceRecord[] {
  const database = getDatabase();
  const pattern = `%${searchTerm}%`;
  const rows = database
    .prepare(
      `SELECT url, title, source_type, fetched_at, relevance, summary, raw_excerpt, key_claims, entities, strategic_relevance
       FROM sources WHERE haunting_id = ?
       AND (title LIKE ? OR summary LIKE ? OR raw_excerpt LIKE ? OR key_claims LIKE ?)
       ORDER BY relevance DESC LIMIT ?`,
    )
    .all(hauntingId, pattern, pattern, pattern, pattern, limit) as any[];

  return rows.map((row) => ({
    url: row.url,
    title: row.title,
    source_type: row.source_type,
    fetched_at: row.fetched_at,
    relevance: row.relevance,
    summary: row.summary,
    raw_excerpt: row.raw_excerpt,
    key_claims: row.key_claims ? JSON.parse(row.key_claims) : undefined,
    entities: row.entities ? JSON.parse(row.entities) : undefined,
    strategic_relevance: row.strategic_relevance,
  }));
}

export function getSourceCount(hauntingId: string): number {
  const database = getDatabase();
  const row = database
    .prepare(`SELECT COUNT(*) as count FROM sources WHERE haunting_id = ?`)
    .get(hauntingId) as { count: number };
  return row.count;
}

// --- Cycle logging ---

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
