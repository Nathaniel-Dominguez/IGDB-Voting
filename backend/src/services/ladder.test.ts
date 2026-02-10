import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as ladder from './ladder';

describe('ladder service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getLadderState', () => {
    it('should return ladder state for a guild with nominations phase', () => {
      const state = ladder.getLadderState('test-guild-1');

      expect(state).toBeDefined();
      expect(state).toHaveProperty('guildId', 'test-guild-1');
      expect(state).toHaveProperty('phase');
      expect('nominations').toBe(state?.phase);
      expect(state).toHaveProperty('bracketSize');
      expect(state).toHaveProperty('ladderId');
    });

    it('should return different ladder state for different guilds', () => {
      const state1 = ladder.getLadderState('guild-a');
      const state2 = ladder.getLadderState('guild-b');

      expect(state1?.guildId).toBe('guild-a');
      expect(state2?.guildId).toBe('guild-b');
    });
  });

  describe('addNominationVote', () => {
    it('should accept a valid nomination vote', async () => {
      await expect(
        ladder.addNominationVote('test-guild-vote', {
          gameId: 1,
          gameName: 'Test Game',
          category: 'Action',
          userId: 'user-1',
          platform: 'web',
        })
      ).resolves.toBeUndefined();
    });

    it('should allow subsequent votes for same game by different user', async () => {
      await ladder.addNominationVote('test-guild-vote', {
        gameId: 2,
        gameName: 'Another Game',
        category: 'RPG',
        userId: 'user-1',
        platform: 'web',
      });
      await expect(
        ladder.addNominationVote('test-guild-vote', {
          gameId: 2,
          gameName: 'Another Game',
          category: 'RPG',
          userId: 'user-2',
          platform: 'discord',
        })
      ).resolves.toBeUndefined();
    });
  });

  describe('getTopNominations', () => {
    it('should return top games for a guild', () => {
      const top = ladder.getTopNominations('test-guild-1', 10);

      expect(Array.isArray(top)).toBe(true);
    });

    it('should respect limit parameter', () => {
      const top = ladder.getTopNominations('test-guild-1', 5);

      expect(top.length).toBeLessThanOrEqual(5);
    });
  });

  describe('gameMatchesLadderConstraints', () => {
    it('should return true when constraints is null', () => {
      expect(ladder.gameMatchesLadderConstraints({}, null)).toBe(true);
    });

    it('should return true when constraints is empty object', () => {
      expect(ladder.gameMatchesLadderConstraints({}, {})).toBe(true);
    });

    it('should return false when genreIds constraint fails', () => {
      const gameData = { genres: [{ id: 1 }] };
      const constraints = { genreIds: [99] };

      expect(ladder.gameMatchesLadderConstraints(gameData, constraints)).toBe(false);
    });

    it('should return true when genreIds constraint is satisfied', () => {
      const gameData = { genres: [{ id: 1 }] };
      const constraints = { genreIds: [1] };

      expect(ladder.gameMatchesLadderConstraints(gameData, constraints)).toBe(true);
    });
  });
});
