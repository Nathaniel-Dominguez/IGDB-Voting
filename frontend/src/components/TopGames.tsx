import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './TopGames.css';

interface GameVoteCount {
  gameId: number;
  gameName: string;
  votes: number;
  gameData?: any;
}

interface TopGamesProps {
  apiUrl: string;
  guildId: string | null;
}

const TopGames: React.FC<TopGamesProps> = ({ apiUrl, guildId }) => {
  const [topGames, setTopGames] = useState<GameVoteCount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<{ totalVotes: number; totalGames: number } | null>(null);

  const fetchTopGames = async () => {
    if (!guildId) {
      setError('Server not configured. Set REACT_APP_GUILD_ID for this deployment.');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);

    try {
      const response = await axios.get(`${apiUrl}/votes/top`, {
        params: { guildId, limit: 100 },
      });
      setTopGames(response.data.games);
      setStats({
        totalVotes: response.data.totalVotes,
        totalGames: response.data.totalGames,
      });
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to fetch top games');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTopGames();
    const interval = setInterval(fetchTopGames, 10000);
    return () => clearInterval(interval);
  }, [guildId]);

  if (loading) {
    return <div className="TopGames loading">Loading top games...</div>;
  }

  if (error) {
    return <div className="TopGames error">{error}</div>;
  }

  return (
    <div className="TopGames">
      <div className="top-games-header">
        <h2>🏆 Top 100 Games</h2>
        {stats && (
          <div className="stats-summary">
            <div className="stat-item">
              <span className="stat-label">Total Votes:</span>
              <span className="stat-value">{stats.totalVotes}</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">Total Games:</span>
              <span className="stat-value">{stats.totalGames}</span>
            </div>
          </div>
        )}
      </div>

      {topGames.length === 0 ? (
        <div className="no-games">
          <p>No votes have been cast yet. Be the first to vote!</p>
        </div>
      ) : (
        <div className="games-list">
          {topGames.map((game, index) => (
            <div key={game.gameId} className="game-item">
              <div className="game-rank">#{index + 1}</div>
              <div className="game-details">
                <h3>{game.gameName}</h3>
                {game.gameData?.rating && (
                  <div className="game-rating">⭐ {game.gameData.rating.toFixed(1)}</div>
                )}
              </div>
              <div className="game-votes">
                <span className="votes-count">{game.votes}</span>
                <span className="votes-label">vote{game.votes !== 1 ? 's' : ''}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      <button onClick={fetchTopGames} className="refresh-button">
        🔄 Refresh
      </button>
    </div>
  );
};

export default TopGames;
