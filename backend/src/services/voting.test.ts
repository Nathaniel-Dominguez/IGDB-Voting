import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as voting from './voting';
import * as ladderService from './ladder';

vi.mock('./ladder');

describe('voting service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getTopGames', () => {
    it('should return top games from ladder service', () => {
      const mockGames = [
        { gameId: 1, gameName: 'Game A', votes: 5 },
        { gameId: 2, gameName: 'Game B', votes: 3 },
      ];
      vi.mocked(ladderService.getTopNominations).mockReturnValue(mockGames);

      const result = voting.getTopGames('guild-123', 10);

      expect(ladderService.getTopNominations).toHaveBeenCalledWith('guild-123', 10);
      expect(result).toEqual(mockGames);
    });

    it('should use default limit of 100 when not specified', () => {
      vi.mocked(ladderService.getTopNominations).mockReturnValue([]);

      voting.getTopGames('guild-123');

      expect(ladderService.getTopNominations).toHaveBeenCalledWith('guild-123', 100);
    });
  });

  describe('getVoteCount', () => {
    it('should return vote count from ladder service', () => {
      vi.mocked(ladderService.getNominationVoteCount).mockReturnValue(42);

      const result = voting.getVoteCount('guild-123');

      expect(ladderService.getNominationVoteCount).toHaveBeenCalledWith('guild-123');
      expect(result).toBe(42);
    });
  });

  describe('getTotalGames', () => {
    it('should return total games from ladder service', () => {
      vi.mocked(ladderService.getNominationGameCount).mockReturnValue(12);

      const result = voting.getTotalGames('guild-123');

      expect(ladderService.getNominationGameCount).toHaveBeenCalledWith('guild-123');
      expect(result).toBe(12);
    });
  });

  describe('setGameData and getGameData', () => {
    it('should set and get game cache via ladder service', () => {
      const gameData = { id: 1, name: 'Test Game' };
      vi.mocked(ladderService.setGameCache).mockImplementation(() => {});
      vi.mocked(ladderService.getGameCache).mockReturnValue(gameData);

      voting.setGameData('guild-123', 1, gameData);
      const result = voting.getGameData('guild-123', 1);

      expect(ladderService.setGameCache).toHaveBeenCalledWith('guild-123', 1, gameData);
      expect(ladderService.getGameCache).toHaveBeenCalledWith('guild-123', 1);
      expect(result).toEqual(gameData);
    });
  });

  describe('getVotesForGame', () => {
    it('should return votes for game from ladder service', () => {
      const mockVotes = [{ userId: 'u1', platform: 'web', timestamp: '2024-01-01T00:00:00.000Z' }];
      vi.mocked(ladderService.getVotesForGame).mockReturnValue(mockVotes);

      const result = voting.getVotesForGame('guild-123', 1);

      expect(ladderService.getVotesForGame).toHaveBeenCalledWith('guild-123', 1);
      expect(result).toEqual(mockVotes);
    });
  });

  describe('getLadderState', () => {
    it('should return ladder state from ladder service', () => {
      const mockState = { guildId: 'guild-123', phase: 'nominations' as const, bracketSize: 16, ladderId: 1 };
      vi.mocked(ladderService.getLadderState).mockReturnValue(mockState);

      const result = voting.getLadderState('guild-123');

      expect(ladderService.getLadderState).toHaveBeenCalledWith('guild-123');
      expect(result).toEqual(mockState);
    });
  });

  describe('addVote', () => {
    it('should delegate to ladder addNominationVote', async () => {
      vi.mocked(ladderService.addNominationVote).mockResolvedValue(undefined);

      const vote = {
        guildId: 'guild-123',
        gameId: 1,
        gameName: 'Test Game',
        category: 'Action',
        userId: 'user-1',
        platform: 'web' as const,
        timestamp: new Date(),
      };

      await voting.addVote(vote);

      expect(ladderService.addNominationVote).toHaveBeenCalledWith('guild-123', {
        gameId: 1,
        gameName: 'Test Game',
        category: 'Action',
        userId: 'user-1',
        platform: 'web',
      });
    });
  });
});
