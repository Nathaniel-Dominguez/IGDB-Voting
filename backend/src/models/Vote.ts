export interface Vote {
  guildId: string;
  gameId: number;
  gameName: string;
  category: string;
  userId: string;
  platform: 'web' | 'discord';
  timestamp: Date;
}

export interface GameVoteCount {
  gameId: number;
  gameName: string;
  votes: number;
  gameData?: any;
}
