import path from 'path';

const DB_PATH = process.env.DATABASE_PATH || path.join(process.cwd(), 'data', 'voting.db');
const USE_MOCK_DB = process.env.USE_MOCK_DB === '1' || process.env.USE_MOCK_DB === 'true';

/** Minimal DB interface used by services (compatible with better-sqlite3). */
export interface DbLike {
  prepare(sql: string): {
    run: (...args: unknown[]) => void;
    get: (...args: unknown[]) => unknown;
    all: (...args: unknown[]) => unknown[];
  };
  exec(sql: string): void;
  pragma(sql: string): void;
  close(): void;
}

let db: DbLike | null = null;
let mockMode = false;

function createMockDb(): DbLike {
  mockMode = true;
  if (process.env.NODE_ENV !== 'test') {
    console.warn('[db] Using mock DB (no persistence). Set USE_MOCK_DB=0 and fix better-sqlite3 bindings for real SQLite.');
  }
  return {
    prepare(sql: string) {
      const normalized = sql.replace(/\s+/g, ' ').trim();
      return {
        run: () => {},
        get: () => {
          if (normalized.includes('ladders') && normalized.includes('phase') && normalized.includes('constraints_display')) {
            return { id: 1, phase: 'nominations', bracket_size: 16, constraints: null, constraints_display: null };
          }
          if (normalized.includes('COUNT(*)') && normalized.includes('AS c')) return { c: 0 };
          if (normalized.includes('PRAGMA') && normalized.includes('table_info(ladders)')) {
            return undefined; // .all() is used for this; see below
          }
          if (normalized.includes('game_data') && normalized.includes('game_cache')) return undefined;
          if (normalized.includes('bracket_matchups') && (normalized.includes('winner_game_id') || normalized.includes('game_a_id'))) return undefined;
          if (normalized.includes('SELECT id FROM ladders WHERE guild_id')) return undefined;
          return undefined;
        },
        all: (..._args: unknown[]) => {
          if (normalized.includes('PRAGMA') && normalized.includes('table_info(ladders)')) {
            return [{ name: 'constraints' }, { name: 'constraints_display' }] as unknown[];
          }
          return [];
        },
      };
    },
    exec: () => {},
    pragma: () => {},
    close: () => {},
  };
}

function initRealDb(): DbLike {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const Database = require('better-sqlite3') as typeof import('better-sqlite3');
  const dir = path.dirname(DB_PATH);
  const fs = require('fs');
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  const database = new Database(DB_PATH) as DbLike;
  database.pragma('journal_mode = WAL');
  runMigrations(database);
  return database;
}

function runMigrations(database: DbLike): void {
  database.exec(`
    CREATE TABLE IF NOT EXISTS guilds (
      guild_id TEXT PRIMARY KEY,
      guild_name TEXT,
      bracket_size INTEGER NOT NULL DEFAULT 16,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS ladders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      guild_id TEXT NOT NULL,
      phase TEXT NOT NULL CHECK(phase IN ('nominations', 'bracket', 'complete')),
      bracket_size INTEGER NOT NULL DEFAULT 16,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      nominations_closed_at TEXT,
      FOREIGN KEY (guild_id) REFERENCES guilds(guild_id)
    );
    CREATE INDEX IF NOT EXISTS idx_ladders_guild ON ladders(guild_id);

    CREATE TABLE IF NOT EXISTS nomination_votes (
      guild_id TEXT NOT NULL,
      game_id INTEGER NOT NULL,
      game_name TEXT NOT NULL,
      user_id TEXT NOT NULL,
      platform TEXT NOT NULL CHECK(platform IN ('web', 'discord')),
      category TEXT,
      timestamp TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (guild_id, game_id, user_id, platform),
      FOREIGN KEY (guild_id) REFERENCES guilds(guild_id)
    );
    CREATE INDEX IF NOT EXISTS idx_nomination_votes_guild ON nomination_votes(guild_id);

    CREATE TABLE IF NOT EXISTS game_cache (
      guild_id TEXT NOT NULL,
      game_id INTEGER NOT NULL,
      game_data TEXT,
      PRIMARY KEY (guild_id, game_id)
    );

    CREATE TABLE IF NOT EXISTS bracket_matchups (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      guild_id TEXT NOT NULL,
      ladder_id INTEGER NOT NULL,
      round INTEGER NOT NULL,
      game_a_id INTEGER NOT NULL,
      game_b_id INTEGER,
      game_a_name TEXT NOT NULL,
      game_b_name TEXT,
      winner_game_id INTEGER,
      FOREIGN KEY (guild_id) REFERENCES guilds(guild_id),
      FOREIGN KEY (ladder_id) REFERENCES ladders(id)
    );
    CREATE INDEX IF NOT EXISTS idx_matchups_guild_ladder ON bracket_matchups(guild_id, ladder_id);

    CREATE TABLE IF NOT EXISTS matchup_votes (
      guild_id TEXT NOT NULL,
      matchup_id INTEGER NOT NULL,
      user_id TEXT NOT NULL,
      platform TEXT NOT NULL CHECK(platform IN ('web', 'discord')),
      voted_game_id INTEGER NOT NULL,
      timestamp TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (guild_id, matchup_id, user_id, platform),
      FOREIGN KEY (guild_id) REFERENCES guilds(guild_id),
      FOREIGN KEY (matchup_id) REFERENCES bracket_matchups(id)
    );
  `);
  const tableInfo = database.prepare('PRAGMA table_info(ladders)').all() as Array<{ name: string }>;
  if (!tableInfo.some((c: { name: string }) => c.name === 'constraints')) {
    database.exec('ALTER TABLE ladders ADD COLUMN constraints TEXT');
  }
  if (!tableInfo.some((c: { name: string }) => c.name === 'constraints_display')) {
    database.exec('ALTER TABLE ladders ADD COLUMN constraints_display TEXT');
  }
}

export function getDb(): DbLike {
  if (!db) {
    if (USE_MOCK_DB) {
      db = createMockDb();
      return db;
    }
    try {
      db = initRealDb();
    } catch (err) {
      console.warn('[db] better-sqlite3 failed to load (missing native bindings?). Using mock DB.', err);
      db = createMockDb();
    }
  }
  return db;
}

/** True when the app is using the in-memory mock DB (no persistence). */
export function isMockDb(): boolean {
  return mockMode;
}

export function closeDb(): void {
  if (db) {
    db.close();
    db = null;
  }
  mockMode = false;
}
