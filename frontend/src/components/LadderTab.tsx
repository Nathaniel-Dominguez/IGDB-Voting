import React, { useState, useEffect } from 'react';
import axios from 'axios';

interface Matchup {
  id: number;
  round: number;
  gameAId: number;
  gameBId: number | null;
  gameAName: string;
  gameBName: string | null;
  winnerGameId: number | null;
  votesA: number;
  votesB: number;
}

interface LadderState {
  guildId: string;
  phase: 'nominations' | 'bracket' | 'complete';
  bracketSize: number;
  ladderId: number;
  constraintsDisplay?: string | null;
  topGames?: Array<{ gameId: number; gameName: string; votes: number }>;
  currentRound?: number;
  matchups?: Matchup[];
  champion?: { gameId: number; gameName: string };
}

interface LadderTabProps {
  apiUrl: string;
  guildId: string;
  userId: string;
}

const LadderTab: React.FC<LadderTabProps> = ({ apiUrl, guildId, userId }) => {
  const [state, setState] = useState<LadderState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [votingFor, setVotingFor] = useState<{ matchupId: number; votedGameId: number } | null>(null);

  const fetchLadder = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await axios.get<LadderState>(`${apiUrl}/guilds/${guildId}/ladder`);
      setState(data);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load ladder');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLadder();
    const interval = setInterval(fetchLadder, 8000);
    return () => clearInterval(interval);
  }, [guildId]);

  const handleMatchupVote = async (matchupId: number, votedGameId: number) => {
    setVotingFor({ matchupId, votedGameId });
    try {
      await axios.post(`${apiUrl}/guilds/${guildId}/ladder/matchup-vote`, {
        matchupId,
        votedGameId,
        userId,
        platform: 'web',
      });
      await fetchLadder();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Vote failed');
    } finally {
      setVotingFor(null);
    }
  };

  if (loading) return <div className="LadderTab loading">Loading ladder...</div>;
  if (error) return <div className="LadderTab error">{error}</div>;
  if (!state) return null;

  if (state.phase === 'nominations') {
    const top = state.topGames || [];
    return (
      <div className="LadderTab">
        <h2>Nominations</h2>
        {state.constraintsDisplay && (
          <p className="ladder-constraints">This round: {state.constraintsDisplay}</p>
        )}
        <p>Top {state.bracketSize} games will advance to the bracket. Nominate with the Vote tab.</p>
        {top.length === 0 ? (
          <p>No nominations yet.</p>
        ) : (
          <ul className="ladder-nominations-list">
            {top.map((g, i) => (
              <li key={g.gameId}>
                <span className="rank">#{i + 1}</span>
                <span className="name">{g.gameName}</span>
                <span className="votes">{g.votes} votes</span>
              </li>
            ))}
          </ul>
        )}
        <button type="button" onClick={fetchLadder}>Refresh</button>
      </div>
    );
  }

  if (state.phase === 'complete' && state.champion) {
    return (
      <div className="LadderTab">
        <h2>Champion</h2>
        <p className="champion-name">{state.champion.gameName}</p>
      </div>
    );
  }

  if (state.phase === 'bracket' && state.matchups?.length) {
    const open = state.matchups.filter(m => m.winnerGameId == null);
    return (
      <div className="LadderTab">
        <h2>Bracket – Round {state.currentRound ?? 1}</h2>
        {state.constraintsDisplay && (
          <p className="ladder-constraints">This round: {state.constraintsDisplay}</p>
        )}
        <p>Vote for the game you want to advance.</p>
        <div className="matchups">
          {open.map(m => (
            <div key={m.id} className="matchup-card">
              <div className="matchup-games">
                <button
                  type="button"
                  className="matchup-option"
                  onClick={() => handleMatchupVote(m.id, m.gameAId)}
                  disabled={votingFor !== null}
                >
                  {m.gameAName} ({m.votesA ?? 0})
                </button>
                <span className="vs">vs</span>
                <button
                  type="button"
                  className="matchup-option"
                  onClick={() => handleMatchupVote(m.id, m.gameBId!)}
                  disabled={votingFor !== null || m.gameBId == null}
                >
                  {m.gameBName} ({m.votesB ?? 0})
                </button>
              </div>
            </div>
          ))}
        </div>
        <button type="button" onClick={fetchLadder}>Refresh</button>
      </div>
    );
  }

  return (
    <div className="LadderTab">
      <p>No active bracket. Start a ladder in Discord with /ladder start.</p>
    </div>
  );
};

export default LadderTab;
