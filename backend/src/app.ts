import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import gamesRouter from './routes/games';
import votesRouter from './routes/votes';
import ladderRouter from './routes/ladder';
import igdbRouter from './routes/igdb';

const app = express();

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
}));
app.use(express.json());

// Routes
app.use('/api/games', gamesRouter);
app.use('/api/votes', votesRouter);
app.use('/api', ladderRouter);
app.use('/api/igdb', igdbRouter);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

export default app;
