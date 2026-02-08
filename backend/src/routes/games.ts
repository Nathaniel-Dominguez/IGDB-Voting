import { Router, Request, Response } from 'express';
import igdbService from '../services/igdb';
import votingService from '../services/voting';

const router = Router();

// Get games by category
router.get('/category/:categoryId', async (req: Request, res: Response) => {
  try {
    const categoryId = parseInt(req.params.categoryId);
    const limit = parseInt(req.query.limit as string) || 50;

    const games = await igdbService.getGamesByCategory(categoryId, limit);
    
    // Cache game data
    games.forEach(game => {
      if (game.id) {
        votingService.setGameData(game.id, game);
      }
    });

    res.json(games);
  } catch (error: any) {
    console.error('Error fetching games by category:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch games' });
  }
});

// Search games
router.get('/search', async (req: Request, res: Response) => {
  try {
    const searchTerm = req.query.q as string;
    const limit = parseInt(req.query.limit as string) || 20;

    if (!searchTerm) {
      return res.status(400).json({ error: 'Search term is required' });
    }

    const games = await igdbService.searchGames(searchTerm, limit);
    
    // Cache game data
    games.forEach(game => {
      if (game.id) {
        votingService.setGameData(game.id, game);
      }
    });

    res.json(games);
  } catch (error: any) {
    console.error('Error searching games:', error);
    res.status(500).json({ error: error.message || 'Failed to search games' });
  }
});

// Get game by ID
router.get('/:gameId', async (req: Request, res: Response) => {
  try {
    const gameId = parseInt(req.params.gameId);
    const game = await igdbService.getGameById(gameId);
    
    if (game) {
      votingService.setGameData(gameId, game);
    }

    res.json(game);
  } catch (error: any) {
    console.error('Error fetching game:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch game' });
  }
});

// Get categories
router.get('/categories/list', async (req: Request, res: Response) => {
  try {
    const categories = await igdbService.getCategories();
    res.json(categories);
  } catch (error: any) {
    console.error('Error fetching categories:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch categories' });
  }
});

export default router;
