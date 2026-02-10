import { Router, Request, Response } from 'express';
import { getDb } from '../db';

const router = Router();

router.get('/guilds', (_req: Request, res: Response) => {
  try {
    const db = getDb();
    const rows = db.prepare(
      `SELECT guild_id AS guildId, guild_name AS guildName, bracket_size AS bracketSize
       FROM guilds
       ORDER BY created_at DESC`
    ).all() as Array<{ guildId: string; guildName: string | null; bracketSize: number }>;
    res.json({ guilds: rows });
  } catch (err: unknown) {
    console.error('GET /api/guilds:', err);
    res.status(500).json({ error: 'Failed to fetch guilds' });
  }
});

export default router;
