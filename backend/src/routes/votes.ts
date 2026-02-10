import { Router, Request, Response } from 'express';
import { Vote } from '../models/Vote';
import * as votingService from '../services/voting';
import igdbService from '../services/igdb';
import { getDb } from '../db';

const router = Router();
const ADMIN_SECRET = process.env.ADMIN_SECRET || '';

function getGuildId(req: Request): string | null {
  return req.body?.guildId ?? (req.query.guildId as string) ?? null;
}

function isAdmin(req: Request): boolean {
  if (!ADMIN_SECRET) return true;
  const header = req.headers['x-admin-secret'] || req.body?.adminSecret;
  return header === ADMIN_SECRET;
}

// Submit a nomination vote (Phase 1 only)
router.post('/', async (req: Request, res: Response) => {
  try {
    const guildId = getGuildId(req);
    if (!guildId) {
      return res.status(400).json({ error: 'Missing required field: guildId (query or body)' });
    }
    const { gameId, gameName, category, userId, platform } = req.body;

    if (!gameId || !gameName || !category || !userId || !platform) {
      return res.status(400).json({
        error: 'Missing required fields: gameId, gameName, category, userId, platform',
      });
    }

    if (platform !== 'web' && platform !== 'discord') {
      return res.status(400).json({ error: 'Platform must be "web" or "discord"' });
    }

    const state = votingService.getLadderState(guildId);
    if (state?.phase !== 'nominations') {
      return res.status(400).json({
        error: 'Ladder is not in nominations phase. Use matchup vote for bracket.',
      });
    }

    if (!votingService.getGameData(guildId, gameId)) {
      try {
        const gameData = await igdbService.getGameById(gameId);
        if (gameData) {
          votingService.setGameData(guildId, gameId, gameData);
        }
      } catch (error) {
        console.warn(`Could not fetch game data for ${gameId}:`, error);
      }
    }

    const vote: Vote = {
      guildId,
      gameId,
      gameName,
      category,
      userId,
      platform: platform as 'web' | 'discord',
      timestamp: new Date(),
    };

    await votingService.addVote(vote);

    res.json({
      success: true,
      message: 'Vote recorded',
      totalVotes: votingService.getVoteCount(guildId),
      totalGames: votingService.getTotalGames(guildId),
    });
  } catch (error: any) {
    console.error('Error submitting vote:', error);
    const status = error.message?.includes('restrictions') ? 400 : 500;
    res.status(status).json({ error: error.message || 'Failed to submit vote' });
  }
});

// Get top games (requires guildId query)
router.get('/top', (req: Request, res: Response) => {
  try {
    const guildId = getGuildId(req);
    if (!guildId) {
      return res.status(400).json({ error: 'Missing required query: guildId' });
    }
    const limit = parseInt(req.query.limit as string) || 100;
    const topGames = votingService.getTopGames(guildId, limit);

    res.json({
      games: topGames,
      total: topGames.length,
      totalVotes: votingService.getVoteCount(guildId),
      totalGames: votingService.getTotalGames(guildId),
    });
  } catch (error: any) {
    console.error('Error getting top games:', error);
    res.status(500).json({ error: error.message || 'Failed to get top games' });
  }
});

// Get votes for a specific game (requires guildId query)
router.get('/game/:gameId', (req: Request, res: Response) => {
  try {
    const guildId = getGuildId(req);
    if (!guildId) {
      return res.status(400).json({ error: 'Missing required query: guildId' });
    }
    const gameId = parseInt(req.params.gameId);
    const voteDetails = votingService.getVotesForGame(guildId, gameId);
    const gameData = votingService.getGameData(guildId, gameId);

    res.json({
      gameId,
      gameData,
      votes: voteDetails.length,
      voteDetails,
    });
  } catch (error: any) {
    console.error('Error getting game votes:', error);
    res.status(500).json({ error: error.message || 'Failed to get game votes' });
  }
});

// Get voting statistics (requires guildId query)
router.get('/stats', (req: Request, res: Response) => {
  try {
    const guildId = getGuildId(req);
    if (!guildId) {
      return res.status(400).json({ error: 'Missing required query: guildId' });
    }
    res.json({
      totalVotes: votingService.getVoteCount(guildId),
      totalGames: votingService.getTotalGames(guildId),
      topGames: votingService.getTopGames(guildId, 10),
    });
  } catch (error: any) {
    console.error('Error getting stats:', error);
    res.status(500).json({ error: error.message || 'Failed to get stats' });
  }
});

// Clear all votes for a guild (admin only)
router.delete('/clear', (req: Request, res: Response) => {
  try {
    if (!isAdmin(req)) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    const guildId = getGuildId(req);
    if (!guildId) {
      return res.status(400).json({ error: 'Missing required query or body: guildId' });
    }
    const database = getDb();
    database.prepare('DELETE FROM nomination_votes WHERE guild_id = ?').run(guildId);
    res.json({ success: true, message: 'Votes cleared for guild' });
  } catch (error: any) {
    console.error('Error clearing votes:', error);
    res.status(500).json({ error: error.message || 'Failed to clear votes' });
  }
});

export default router;
