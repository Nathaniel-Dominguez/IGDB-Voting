import Database from 'better-sqlite3';
import path from 'path';

const DB_PATH = process.env.DATABASE_PATH || path.join(process.cwd(), 'data', 'voting.db');

let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!db) {
    const dir = path.dirname(DB_PATH);
    const fs = require('fs');
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    runMigrations();
  }
  return db;
}

function runMigrations(): void {
  const database = db!;
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
  // Add constraints column to ladders if missing (round-start filters)
  const tableInfo = database.prepare('PRAGMA table_info(ladders)').all() as Array<{ name: string }>;
  if (!tableInfo.some((c: { name: string }) => c.name === 'constraints')) {
    database.exec('ALTER TABLE ladders ADD COLUMN constraints TEXT');
  }
  if (!tableInfo.some((c: { name: string }) => c.name === 'constraints_display')) {
    database.exec('ALTER TABLE ladders ADD COLUMN constraints_display TEXT');
  }
}

export function closeDb(): void {
  if (db) {
    db.close();
    db = null;
  }
}
