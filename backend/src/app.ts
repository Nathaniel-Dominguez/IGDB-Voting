import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import gamesRouter from './routes/games';
import votesRouter from './routes/votes';
import ladderRouter from './routes/ladder';
import igdbRouter from './routes/igdb';
import guildsRouter from './routes/guilds';

const app = express();

// Middleware: allow multiple origins so local dev (any port) and deployed frontends work
const allowedOrigins = [
  process.env.FRONTEND_URL,
  'http://localhost:3000',
  'http://localhost:5173',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:5173',
].filter(Boolean) as string[];

app.use(cors({
  origin: (origin, cb) => {
    if (!origin) return cb(null, true); // same-origin or non-browser
    if (allowedOrigins.includes(origin)) return cb(null, true);
    if (origin.endsWith('.github.io')) return cb(null, true); // GitHub Pages
    cb(null, false);
  },
  credentials: true,
}));
app.use(express.json());

// Routes
app.use('/api/games', gamesRouter);
app.use('/api/votes', votesRouter);
app.use('/api', ladderRouter);
app.use('/api', guildsRouter);
app.use('/api/igdb', igdbRouter);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

export default app;
