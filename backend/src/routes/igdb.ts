import { Router, Request, Response } from 'express';
import igdbService from '../services/igdb';

const router = Router();

router.get('/genres', async (_req: Request, res: Response) => {
  try {
    const list = await igdbService.getGenres();
    res.json(list);
  } catch (error: any) {
    console.error('Error fetching genres:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch genres' });
  }
});

router.get('/game-modes', async (_req: Request, res: Response) => {
  try {
    const list = await igdbService.getGameModes();
    res.json(list);
  } catch (error: any) {
    console.error('Error fetching game modes:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch game modes' });
  }
});

router.get('/platforms', async (_req: Request, res: Response) => {
  try {
    const list = await igdbService.getPlatforms();
    res.json(list);
  } catch (error: any) {
    console.error('Error fetching platforms:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch platforms' });
  }
});

export default router;
