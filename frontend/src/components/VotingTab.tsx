import React, { useState } from 'react';
import GameSearch from './GameSearch';
import VotingInterface from './VotingInterface';

interface Game {
  id: number;
  name: string;
  summary?: string;
  cover?: { url: string };
  rating?: number;
}

interface VotingTabProps {
  apiUrl: string;
  userId: string;
  guildId: string | null;
}

const VotingTab: React.FC<VotingTabProps> = ({ apiUrl, userId, guildId }) => {
  const [selectedGame, setSelectedGame] = useState<Game | null>(null);

  if (!guildId) {
    return (
      <div className="voting-tab-no-guild">
        <p>This app is not linked to a server. Set <code>REACT_APP_GUILD_ID</code> to your Discord server ID when deploying for this server.</p>
      </div>
    );
  }

  return (
    <div>
      <GameSearch apiUrl={apiUrl} onGameSelect={setSelectedGame} />
      <VotingInterface
        apiUrl={apiUrl}
        userId={userId}
        guildId={guildId}
        selectedGame={selectedGame}
        onGameChange={setSelectedGame}
      />
    </div>
  );
};

export default VotingTab;
