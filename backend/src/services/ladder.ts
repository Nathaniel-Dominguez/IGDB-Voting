import { getDb } from '../db';
import { GameVoteCount } from '../models/Vote';
import igdbService from './igdb';

export type LadderPhase = 'nominations' | 'bracket' | 'complete';

/** Stored on ladders.constraints (JSON). All fields optional; empty = no restrictions. */
export interface LadderConstraints {
  genreIds?: number[];
  releaseYear?: number;
  releaseYearMin?: number;
  releaseYearMax?: number;
  gameModeIds?: number[];
  platformIds?: number[];
}

/** Input when starting a ladder: names resolved to IDs. */
export interface StartLadderConstraintsInput {
  genreNames?: string[];
  releaseYear?: number;
  releaseYearMin?: number;
  releaseYearMax?: number;
  gameModeNames?: string[];
  platformNames?: string[];
}

export interface LadderState {
  guildId: string;
  phase: LadderPhase;
  bracketSize: number;
  ladderId: number;
  constraints?: LadderConstraints | null;
  constraintsDisplay?: string | null;
  topGames?: GameVoteCount[];
  currentRound?: number;
  matchups?: Array<{
    id: number;
    round: number;
    gameAId: number;
    gameBId: number | null;
    gameAName: string;
    gameBName: string | null;
    winnerGameId: number | null;
    votesA: number;
    votesB: number;
  }>;
  champion?: { gameId: number; gameName: string };
}

function ensureGuild(guildId: string): void {
  const db = getDb();
  const stmt = db.prepare(
    `INSERT OR IGNORE INTO guilds (guild_id, bracket_size) VALUES (?, 16)`
  );
  stmt.run(guildId);
}

function getOrCreateLadderRow(guildId: string): { id: number; phase: string; bracket_size: number; constraints: string | null; constraints_display: string | null } {
  ensureGuild(guildId);
  const db = getDb();
  let row = db.prepare(
    `SELECT id, phase, bracket_size, constraints, constraints_display FROM ladders WHERE guild_id = ? AND phase != 'complete' ORDER BY id DESC LIMIT 1`
  ).get(guildId) as { id: number; phase: string; bracket_size: number; constraints: string | null; constraints_display: string | null } | undefined;
  if (!row) {
    db.prepare(
      `INSERT INTO ladders (guild_id, phase, bracket_size) VALUES (?, 'nominations', 16)`
    ).run(guildId);
    row = db.prepare(
      `SELECT id, phase, bracket_size, constraints, constraints_display FROM ladders WHERE guild_id = ? ORDER BY id DESC LIMIT 1`
    ).get(guildId) as { id: number; phase: string; bracket_size: number; constraints: string | null; constraints_display: string | null };
  }
  return row!;
}

function parseConstraints(json: string | null): LadderConstraints | null {
  if (!json || json.trim() === '') return null;
  try {
    const o = JSON.parse(json) as LadderConstraints;
    const hasAny = o.genreIds?.length || o.gameModeIds?.length || o.platformIds?.length ||
      o.releaseYear != null || o.releaseYearMin != null || o.releaseYearMax != null;
    return hasAny ? o : null;
  } catch {
    return null;
  }
}

/** Returns true if game data satisfies all non-empty ladder constraints. */
export function gameMatchesLadderConstraints(gameData: any, constraints: LadderConstraints | null): boolean {
  if (!constraints) return true;
  const genres = gameData?.genres;
  if (constraints.genreIds?.length) {
    const gameGenreIds = Array.isArray(genres) ? genres.map((g: any) => g?.id ?? g).filter(Boolean) : [];
    if (gameGenreIds.length === 0) return false;
    if (!constraints.genreIds.some(id => gameGenreIds.includes(id))) return false;
  }
  if (constraints.releaseYear != null || constraints.releaseYearMin != null || constraints.releaseYearMax != null) {
    const ts = gameData?.first_release_date;
    if (ts == null) return false;
    const year = new Date(ts * 1000).getUTCFullYear();
    if (constraints.releaseYear != null && year !== constraints.releaseYear) return false;
    if (constraints.releaseYearMin != null && year < constraints.releaseYearMin) return false;
    if (constraints.releaseYearMax != null && year > constraints.releaseYearMax) return false;
  }
  const gameModes = gameData?.game_modes;
  if (constraints.gameModeIds?.length) {
    const gameModeIds = Array.isArray(gameModes) ? gameModes.map((m: any) => m?.id ?? m).filter(Boolean) : [];
    if (gameModeIds.length === 0) return false;
    if (!constraints.gameModeIds.some(id => gameModeIds.includes(id))) return false;
  }
  const platforms = gameData?.platforms;
  if (constraints.platformIds?.length) {
    const gamePlatformIds = Array.isArray(platforms) ? platforms.map((p: any) => p?.id ?? p).filter(Boolean) : [];
    if (gamePlatformIds.length === 0) return false;
    if (!constraints.platformIds.some(id => gamePlatformIds.includes(id))) return false;
  }
  return true;
}

export async function addNominationVote(guildId: string, data: {
  gameId: number;
  gameName: string;
  category: string;
  userId: string;
  platform: 'web' | 'discord';
}): Promise<void> {
  const ladder = getOrCreateLadderRow(guildId);
  if (ladder.phase !== 'nominations') {
    throw new Error('Ladder is not in nominations phase');
  }
  const constraints = parseConstraints(ladder.constraints);
  if (constraints) {
    let gameData = getGameCache(guildId, data.gameId) as any;
    if (!gameData) {
      try {
        gameData = await igdbService.getGameById(data.gameId);
        if (gameData) setGameCache(guildId, data.gameId, gameData);
      } catch (e) {
        console.warn('IGDB fetch in addNominationVote:', e);
      }
    }
    if (!gameData || !gameMatchesLadderConstraints(gameData, constraints)) {
      throw new Error(
        'This round has restrictions (genre, year, game mode, or platform). This game does not match. Check the ladder details.'
      );
    }
  }
  ensureGuild(guildId);
  const db = getDb();
  db.prepare(`
    INSERT INTO nomination_votes (guild_id, game_id, game_name, user_id, platform, category)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(guild_id, game_id, user_id, platform) DO UPDATE SET
      category = excluded.category,
      timestamp = datetime('now')
  `).run(guildId, data.gameId, data.gameName, data.userId, data.platform, data.category);
}

export function getTopNominations(guildId: string, limit: number): GameVoteCount[] {
  const db = getDb();
  const rows = db.prepare(`
    SELECT game_id AS gameId, game_name AS gameName, COUNT(*) AS votes
    FROM nomination_votes
    WHERE guild_id = ?
    GROUP BY guild_id, game_id
    ORDER BY votes DESC
    LIMIT ?
  `).all(guildId, limit) as Array<{ gameId: number; gameName: string; votes: number }>;
  return rows.map(r => ({ gameId: r.gameId, gameName: r.gameName, votes: r.votes }));
}

export function getNominationVoteCount(guildId: string): number {
  const db = getDb();
  const row = db.prepare(
    `SELECT COUNT(*) AS c FROM nomination_votes WHERE guild_id = ?`
  ).get(guildId) as { c: number };
  return row?.c ?? 0;
}

export function getNominationGameCount(guildId: string): number {
  const db = getDb();
  const row = db.prepare(
    `SELECT COUNT(DISTINCT game_id) AS c FROM nomination_votes WHERE guild_id = ?`
  ).get(guildId) as { c: number };
  return row?.c ?? 0;
}

export function getVotesForGame(guildId: string, gameId: number): Array<{ userId: string; platform: string; timestamp: string }> {
  const db = getDb();
  return db.prepare(`
    SELECT user_id AS userId, platform, timestamp FROM nomination_votes
    WHERE guild_id = ? AND game_id = ?
  `).all(guildId, gameId) as Array<{ userId: string; platform: string; timestamp: string }>;
}

export function setGameCache(guildId: string, gameId: number, gameData: unknown): void {
  ensureGuild(guildId);
  const db = getDb();
  db.prepare(`
    INSERT INTO game_cache (guild_id, game_id, game_data) VALUES (?, ?, ?)
    ON CONFLICT(guild_id, game_id) DO UPDATE SET game_data = excluded.game_data
  `).run(guildId, gameId, JSON.stringify(gameData));
}

export function getGameCache(guildId: string, gameId: number): unknown {
  const db = getDb();
  const row = db.prepare(
    `SELECT game_data FROM game_cache WHERE guild_id = ? AND game_id = ?`
  ).get(guildId, gameId) as { game_data: string } | undefined;
  return row ? JSON.parse(row.game_data) : null;
}

export function getLadderState(guildId: string): LadderState | null {
  ensureGuild(guildId);
  const ladder = getOrCreateLadderRow(guildId);
  const state: LadderState = {
    guildId,
    phase: ladder.phase as LadderPhase,
    bracketSize: ladder.bracket_size,
    ladderId: ladder.id,
    constraints: parseConstraints(ladder.constraints),
    constraintsDisplay: ladder.constraints_display || null,
  };

  if (ladder.phase === 'nominations') {
    state.topGames = getTopNominations(guildId, ladder.bracket_size * 2);
    return state;
  }

  if (ladder.phase === 'bracket') {
    const db = getDb();
    const matchups = db.prepare(`
      SELECT m.id, m.round, m.game_a_id AS gameAId, m.game_b_id AS gameBId,
             m.game_a_name AS gameAName, m.game_b_name AS gameBName, m.winner_game_id AS winnerGameId
      FROM bracket_matchups m
      WHERE m.guild_id = ? AND m.ladder_id = ?
      ORDER BY m.round, m.id
    `).all(guildId, ladder.id) as Array<{
      id: number;
      round: number;
      gameAId: number;
      gameBId: number | null;
      gameAName: string;
      gameBName: string | null;
      winnerGameId: number | null;
    }>;

    const currentRound = matchups.length ? Math.max(...matchups.map(m => m.round)) : 0;
    const unresolved = matchups.filter(m => m.winnerGameId === null);
    const activeRound = unresolved.length ? Math.min(...unresolved.map(m => m.round)) : null;

    const withVotes = matchups.map(m => {
      const votes = db.prepare(`
        SELECT voted_game_id, COUNT(*) AS c FROM matchup_votes
        WHERE matchup_id = ? AND guild_id = ?
        GROUP BY voted_game_id
      `).all(m.id, guildId) as Array<{ voted_game_id: number; c: number }>;
      const votesA = votes.find(v => v.voted_game_id === m.gameAId)?.c ?? 0;
      const votesB = m.gameBId != null ? (votes.find(v => v.voted_game_id === m.gameBId)?.c ?? 0) : 0;
      return { ...m, votesA, votesB };
    });

    state.currentRound = currentRound;
    state.matchups = withVotes;
    const singleFinal = matchups.length === 1 && matchups[0].winnerGameId != null;
    if (singleFinal) {
      state.phase = 'complete';
      const m = matchups[0];
      state.champion = {
        gameId: m.winnerGameId!,
        gameName: m.winnerGameId === m.gameAId ? m.gameAName : (m.gameBName ?? ''),
      };
    }
    return state;
  }

  if (ladder.phase === 'complete') {
    const db = getDb();
    const final = db.prepare(`
      SELECT winner_game_id AS gameId, game_a_id, game_b_id, game_a_name, game_b_name
      FROM bracket_matchups
      WHERE guild_id = ? AND ladder_id = ? AND round = (SELECT MAX(round) FROM bracket_matchups WHERE guild_id = ? AND ladder_id = ?)
      LIMIT 1
    `).get(guildId, ladder.id, guildId, ladder.id) as { gameId: number; game_a_id: number; game_b_id: number; game_a_name: string; game_b_name: string } | undefined;
    if (final) {
      state.champion = {
        gameId: final.gameId,
        gameName: final.gameId === final.game_a_id ? final.game_a_name : final.game_b_name,
      };
    }
    return state;
  }

  return state;
}

export function closeNominations(guildId: string, bracketSize?: number): LadderState {
  const ladder = getOrCreateLadderRow(guildId);
  if (ladder.phase !== 'nominations') {
    throw new Error('Ladder is not in nominations phase');
  }
  const size = bracketSize ?? ladder.bracket_size;
  const top = getTopNominations(guildId, size);
  if (top.length < 2) {
    throw new Error(`Need at least 2 games to start bracket (have ${top.length}). Nominate more!`);
  }
  const db = getDb();
  const n = top.length;
  db.prepare(`UPDATE ladders SET phase = 'bracket', nominations_closed_at = datetime('now') WHERE id = ?`).run(ladder.id);
  for (let i = 0; i < Math.floor(n / 2); i++) {
    const a = top[i];
    const b = top[n - 1 - i];
    db.prepare(`
      INSERT INTO bracket_matchups (guild_id, ladder_id, round, game_a_id, game_b_id, game_a_name, game_b_name)
      VALUES (?, ?, 1, ?, ?, ?, ?)
    `).run(guildId, ladder.id, a.gameId, b.gameId, a.gameName, b.gameName);
  }
  return getLadderState(guildId)!;
}

export function addMatchupVote(guildId: string, data: {
  matchupId: number;
  votedGameId: number;
  userId: string;
  platform: 'web' | 'discord';
}): void {
  const db = getDb();
  const matchup = db.prepare(`
    SELECT id, game_a_id, game_b_id, winner_game_id FROM bracket_matchups
    WHERE id = ? AND guild_id = ?
  `).get(data.matchupId, guildId) as { id: number; game_a_id: number; game_b_id: number | null; winner_game_id: number | null } | undefined;
  if (!matchup) throw new Error('Matchup not found');
  if (matchup.winner_game_id != null) throw new Error('Matchup already closed');
  if (data.votedGameId !== matchup.game_a_id && data.votedGameId !== matchup.game_b_id) {
    throw new Error('Invalid game choice for this matchup');
  }
  db.prepare(`
    INSERT INTO matchup_votes (guild_id, matchup_id, user_id, platform, voted_game_id)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(guild_id, matchup_id, user_id, platform) DO UPDATE SET voted_game_id = excluded.voted_game_id, timestamp = datetime('now')
  `).run(guildId, data.matchupId, data.userId, data.platform, data.votedGameId);
}

export function closeRound(guildId: string): LadderState {
  const ladder = getOrCreateLadderRow(guildId);
  if (ladder.phase !== 'bracket') {
    throw new Error('Ladder is not in bracket phase');
  }
  const db = getDb();
  const openMatchups = db.prepare(`
    SELECT id, game_a_id, game_b_id FROM bracket_matchups
    WHERE guild_id = ? AND ladder_id = ? AND winner_game_id IS NULL
  `).all(guildId, ladder.id) as Array<{ id: number; game_a_id: number; game_b_id: number | null }>;
  if (openMatchups.length === 0) {
    throw new Error('No open matchups to close');
  }
  for (const m of openMatchups) {
    const votes = db.prepare(`
      SELECT voted_game_id, COUNT(*) AS c FROM matchup_votes WHERE matchup_id = ? AND guild_id = ? GROUP BY voted_game_id
    `).all(m.id, guildId) as Array<{ voted_game_id: number; c: number }>;
    const votesA = votes.find(v => v.voted_game_id === m.game_a_id)?.c ?? 0;
    const votesB = m.game_b_id != null ? (votes.find(v => v.voted_game_id === m.game_b_id)?.c ?? 0) : 0;
    const winner = votesA >= votesB ? m.game_a_id : m.game_b_id!;
    db.prepare(`UPDATE bracket_matchups SET winner_game_id = ? WHERE id = ?`).run(winner, m.id);
  }
  const currentRound = db.prepare(
    `SELECT MAX(round) AS r FROM bracket_matchups WHERE guild_id = ? AND ladder_id = ?`
  ).get(guildId, ladder.id) as { r: number };
  const roundMatchups = db.prepare(`
    SELECT winner_game_id, game_a_id, game_b_id, game_a_name, game_b_name FROM bracket_matchups
    WHERE guild_id = ? AND ladder_id = ? AND round = ?
  `).all(guildId, ladder.id, currentRound.r) as Array<{ winner_game_id: number; game_a_id: number; game_b_id: number | null; game_a_name: string; game_b_name: string | null }>;
  const getGameName = (gameId: number) => {
    const row = roundMatchups.find(r => r.game_a_id === gameId || r.game_b_id === gameId);
    if (!row) return `Game ${gameId}`;
    return gameId === row.game_a_id ? row.game_a_name : (row.game_b_name ?? '');
  };
  if (roundMatchups.length === 1) {
    db.prepare(`UPDATE ladders SET phase = 'complete' WHERE id = ?`).run(ladder.id);
    return getLadderState(guildId)!;
  }
  const nextRound = currentRound.r + 1;
  for (let i = 0; i < roundMatchups.length; i += 2) {
    const wa = roundMatchups[i].winner_game_id;
    const wb = roundMatchups[i + 1].winner_game_id;
    const nameA = getGameName(wa);
    const nameB = getGameName(wb);
    db.prepare(`
      INSERT INTO bracket_matchups (guild_id, ladder_id, round, game_a_id, game_b_id, game_a_name, game_b_name)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(guildId, ladder.id, nextRound, wa, wb, nameA, nameB);
  }
  return getLadderState(guildId)!;
}

export async function startLadder(
  guildId: string,
  bracketSize: number = 16,
  constraintsInput?: StartLadderConstraintsInput
): Promise<LadderState> {
  ensureGuild(guildId);
  const db = getDb();
  const existing = db.prepare(
    `SELECT id FROM ladders WHERE guild_id = ? AND phase != 'complete'`
  ).get(guildId);
  if (existing) {
    return getLadderState(guildId)!;
  }
  if (bracketSize !== 8 && bracketSize !== 16 && bracketSize !== 32) {
    throw new Error('bracketSize must be 8, 16, or 32');
  }
  let constraintsJson: string | null = null;
  let constraintsDisplay: string | null = null;
  if (constraintsInput && (
    (constraintsInput.genreNames?.length) ||
    (constraintsInput.gameModeNames?.length) ||
    (constraintsInput.platformNames?.length) ||
    constraintsInput.releaseYear != null ||
    constraintsInput.releaseYearMin != null ||
    constraintsInput.releaseYearMax != null
  )) {
    const stored: LadderConstraints = {};
    if (constraintsInput.genreNames?.length) {
      stored.genreIds = await igdbService.resolveGenreNamesToIds(constraintsInput.genreNames);
    }
    if (constraintsInput.gameModeNames?.length) {
      stored.gameModeIds = await igdbService.resolveGameModeNamesToIds(constraintsInput.gameModeNames);
    }
    if (constraintsInput.platformNames?.length) {
      stored.platformIds = await igdbService.resolvePlatformNamesToIds(constraintsInput.platformNames);
    }
    if (constraintsInput.releaseYear != null) stored.releaseYear = constraintsInput.releaseYear;
    if (constraintsInput.releaseYearMin != null) stored.releaseYearMin = constraintsInput.releaseYearMin;
    if (constraintsInput.releaseYearMax != null) stored.releaseYearMax = constraintsInput.releaseYearMax;
    constraintsJson = JSON.stringify(stored);
    const parts: string[] = [];
    if (constraintsInput.genreNames?.length) parts.push(`Genre: ${constraintsInput.genreNames.join(', ')}`);
    if (constraintsInput.releaseYear != null) parts.push(`Year: ${constraintsInput.releaseYear}`);
    else if (constraintsInput.releaseYearMin != null || constraintsInput.releaseYearMax != null) {
      const min = constraintsInput.releaseYearMin ?? '?';
      const max = constraintsInput.releaseYearMax ?? '?';
      parts.push(`Year: ${min}–${max}`);
    }
    if (constraintsInput.gameModeNames?.length) parts.push(`Mode: ${constraintsInput.gameModeNames.join(', ')}`);
    if (constraintsInput.platformNames?.length) parts.push(`Platform: ${constraintsInput.platformNames.join(', ')}`);
    constraintsDisplay = parts.join(' · ');
  }
  db.prepare(`UPDATE guilds SET bracket_size = ? WHERE guild_id = ?`).run(bracketSize, guildId);
  db.prepare(
    `INSERT INTO ladders (guild_id, phase, bracket_size, constraints, constraints_display) VALUES (?, 'nominations', ?, ?, ?)`
  ).run(guildId, bracketSize, constraintsJson, constraintsDisplay);
  return getLadderState(guildId)!;
}
