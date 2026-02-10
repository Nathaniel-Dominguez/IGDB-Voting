import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../app';

const BASE = '/api/votes';

describe('votes routes', () => {
  const guildId = 'test-guild-123';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /api/votes/top', () => {
    it('should return 400 when guildId is missing', async () => {
      const res = await request(app)
        .get(`${BASE}/top`)
        .expect(400);

      expect(res.body).toHaveProperty('error');
      expect(res.body.error).toMatch(/guildId/i);
    });

    it('should return 200 with games array when guildId provided', async () => {
      const res = await request(app)
        .get(`${BASE}/top`)
        .query({ guildId })
        .expect(200);

      expect(res.body).toHaveProperty('games');
      expect(res.body).toHaveProperty('total');
      expect(res.body).toHaveProperty('totalVotes');
      expect(res.body).toHaveProperty('totalGames');
      expect(Array.isArray(res.body.games)).toBe(true);
    });
  });

  describe('GET /api/votes/stats', () => {
    it('should return 400 when guildId is missing', async () => {
      const res = await request(app)
        .get(`${BASE}/stats`)
        .expect(400);

      expect(res.body).toHaveProperty('error');
      expect(res.body.error).toMatch(/guildId/i);
    });

    it('should return 200 with stats when guildId provided', async () => {
      const res = await request(app)
        .get(`${BASE}/stats`)
        .query({ guildId })
        .expect(200);

      expect(res.body).toHaveProperty('totalVotes');
      expect(res.body).toHaveProperty('totalGames');
      expect(res.body).toHaveProperty('topGames');
      expect(Array.isArray(res.body.topGames)).toBe(true);
    });
  });

  describe('POST /api/votes', () => {
    it('should return 400 when guildId is missing', async () => {
      const res = await request(app)
        .post(BASE)
        .send({
          gameId: 1,
          gameName: 'Test',
          category: 'Action',
          userId: 'u1',
          platform: 'web',
        })
        .expect(400);

      expect(res.body).toHaveProperty('error');
      expect(res.body.error).toMatch(/guildId/i);
    });

    it('should return 400 when required fields are missing', async () => {
      const res = await request(app)
        .post(BASE)
        .send({ guildId })
        .expect(400);

      expect(res.body).toHaveProperty('error');
      expect(res.body.error).toMatch(/gameId|gameName|category|userId|platform/i);
    });

    it('should return 400 when platform is invalid', async () => {
      const res = await request(app)
        .post(BASE)
        .send({
          guildId,
          gameId: 1,
          gameName: 'Test',
          category: 'Action',
          userId: 'u1',
          platform: 'invalid',
        })
        .expect(400);

      expect(res.body).toHaveProperty('error');
      expect(res.body.error).toMatch(/platform/i);
    });

    it('should return 200 and record vote with valid payload', async () => {
      const res = await request(app)
        .post(BASE)
        .send({
          guildId,
          gameId: 1,
          gameName: 'Test Game',
          category: 'Action',
          userId: 'user-1',
          platform: 'web',
        })
        .expect(200);

      expect(res.body).toHaveProperty('success', true);
      expect(res.body).toHaveProperty('message', 'Vote recorded');
      expect(res.body).toHaveProperty('totalVotes');
      expect(res.body).toHaveProperty('totalGames');
    });
  });
});
