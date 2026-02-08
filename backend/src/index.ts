import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import gamesRouter from './routes/games';
import votesRouter from './routes/votes';
import ladderRouter from './routes/ladder';
import igdbRouter from './routes/igdb';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

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

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Backend server running on port ${PORT}`);
  console.log(`📡 IGDB API configured: ${process.env.IGDB_CLIENT_ID ? 'Yes' : 'No'}`);
});
