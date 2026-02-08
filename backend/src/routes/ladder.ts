import { Router, Request, Response } from 'express';
import * as ladderService from '../services/ladder';

const router = Router();
const ADMIN_SECRET = process.env.ADMIN_SECRET || '';

function isAdmin(req: Request): boolean {
  if (!ADMIN_SECRET) return true;
  const header = req.headers['x-admin-secret'] || req.body?.adminSecret;
  return header === ADMIN_SECRET;
}

// GET current ladder state for a guild
router.get('/guilds/:guildId/ladder', (req: Request, res: Response) => {
  try {
    const { guildId } = req.params;
    const state = ladderService.getLadderState(guildId);
    if (!state) {
      return res.status(404).json({ error: 'No ladder found for this guild' });
    }
    res.json(state);
  } catch (error: any) {
    console.error('Error getting ladder:', error);
    res.status(500).json({ error: error.message || 'Failed to get ladder state' });
  }
});

// POST start a new ladder (admin). Optional body: genreNames[], releaseYear, releaseYearMin, releaseYearMax, gameModeNames[], platformNames[]
router.post('/guilds/:guildId/ladder/start', async (req: Request, res: Response) => {
  try {
    if (!isAdmin(req)) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    const { guildId } = req.params;
    const body = req.body || {};
    const bracketSize = parseInt(body.bracketSize as string) || 16;
    const constraintsInput = {
      genreNames: Array.isArray(body.genreNames) ? body.genreNames : (body.genreNames ? [body.genreNames] : undefined),
      releaseYear: body.releaseYear != null ? parseInt(body.releaseYear as string, 10) : undefined,
      releaseYearMin: body.releaseYearMin != null ? parseInt(body.releaseYearMin as string, 10) : undefined,
      releaseYearMax: body.releaseYearMax != null ? parseInt(body.releaseYearMax as string, 10) : undefined,
      gameModeNames: Array.isArray(body.gameModeNames) ? body.gameModeNames : (body.gameModeNames ? [body.gameModeNames] : undefined),
      platformNames: Array.isArray(body.platformNames) ? body.platformNames : (body.platformNames ? [body.platformNames] : undefined),
    };
    const state = await ladderService.startLadder(guildId, bracketSize, constraintsInput);
    res.json(state);
  } catch (error: any) {
    console.error('Error starting ladder:', error);
    const status = error.message?.includes('Unknown') ? 400 : 500;
    res.status(status).json({ error: error.message || 'Failed to start ladder' });
  }
});

// POST matchup vote (bracket phase)
router.post('/guilds/:guildId/ladder/matchup-vote', (req: Request, res: Response) => {
  try {
    const { guildId } = req.params;
    const { matchupId, votedGameId, userId, platform } = req.body;
    if (!matchupId || !votedGameId || !userId || !platform) {
      return res.status(400).json({
        error: 'Missing required fields: matchupId, votedGameId, userId, platform',
      });
    }
    if (platform !== 'web' && platform !== 'discord') {
      return res.status(400).json({ error: 'Platform must be "web" or "discord"' });
    }
    ladderService.addMatchupVote(guildId, {
      matchupId: Number(matchupId),
      votedGameId: Number(votedGameId),
      userId,
      platform: platform as 'web' | 'discord',
    });
    res.json({ success: true, message: 'Matchup vote recorded' });
  } catch (error: any) {
    console.error('Error recording matchup vote:', error);
    res.status(400).json({ error: error.message || 'Failed to record vote' });
  }
});

// POST close nominations and seed bracket (admin)
router.post('/guilds/:guildId/ladder/close-nominations', (req: Request, res: Response) => {
  try {
    if (!isAdmin(req)) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    const { guildId } = req.params;
    const bracketSize = req.body?.bracketSize ? parseInt(req.body.bracketSize as string) : undefined;
    const state = ladderService.closeNominations(guildId, bracketSize);
    res.json(state);
  } catch (error: any) {
    console.error('Error closing nominations:', error);
    res.status(400).json({ error: error.message || 'Failed to close nominations' });
  }
});

// POST close current round and advance (admin)
router.post('/guilds/:guildId/ladder/close-round', (req: Request, res: Response) => {
  try {
    if (!isAdmin(req)) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    const { guildId } = req.params;
    const state = ladderService.closeRound(guildId);
    res.json(state);
  } catch (error: any) {
    console.error('Error closing round:', error);
    res.status(400).json({ error: error.message || 'Failed to close round' });
  }
});

export default router;
