import * as ladderService from './ladder';
import { Vote, GameVoteCount } from '../models/Vote';

export async function addVote(vote: Vote): Promise<void> {
  await ladderService.addNominationVote(vote.guildId, {
    gameId: vote.gameId,
    gameName: vote.gameName,
    category: vote.category,
    userId: vote.userId,
    platform: vote.platform,
  });
}

export function getTopGames(guildId: string, limit: number = 100): GameVoteCount[] {
  return ladderService.getTopNominations(guildId, limit);
}

export function getVoteCount(guildId: string): number {
  return ladderService.getNominationVoteCount(guildId);
}

export function getTotalGames(guildId: string): number {
  return ladderService.getNominationGameCount(guildId);
}

export function setGameData(guildId: string, gameId: number, gameData: unknown): void {
  ladderService.setGameCache(guildId, gameId, gameData);
}

export function getGameData(guildId: string, gameId: number): unknown {
  return ladderService.getGameCache(guildId, gameId);
}

export function getVotesForGame(guildId: string, gameId: number) {
  return ladderService.getVotesForGame(guildId, gameId);
}

export function getLadderState(guildId: string) {
  return ladderService.getLadderState(guildId);
}
