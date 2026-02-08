import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './Stats.css';

interface StatsProps {
  apiUrl: string;
  guildId: string | null;
}

const Stats: React.FC<StatsProps> = ({ apiUrl, guildId }) => {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = async () => {
    if (!guildId) {
      setError('Server not configured. Set VITE_APP_GUILD_ID for this deployment.');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);

    try {
      const response = await axios.get(`${apiUrl}/votes/stats`, {
        params: { guildId },
      });
      setStats(response.data);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to fetch statistics');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
    const interval = setInterval(fetchStats, 10000);
    return () => clearInterval(interval);
  }, [guildId]);

  if (loading) {
    return <div className="Stats loading">Loading statistics...</div>;
  }

  if (error) {
    return <div className="Stats error">{error}</div>;
  }

  if (!stats) {
    return <div className="Stats">No statistics available</div>;
  }

  return (
    <div className="Stats">
      <div className="stats-card">
        <h2>📊 Voting Statistics</h2>

        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-icon">🗳️</div>
            <div className="stat-value">{stats.totalVotes}</div>
            <div className="stat-label">Total Votes</div>
          </div>

          <div className="stat-card">
            <div className="stat-icon">🎮</div>
            <div className="stat-value">{stats.totalGames}</div>
            <div className="stat-label">Total Games</div>
          </div>

          <div className="stat-card">
            <div className="stat-icon">📈</div>
            <div className="stat-value">
              {stats.totalVotes > 0
                ? (stats.totalVotes / stats.totalGames).toFixed(1)
                : '0'}
            </div>
            <div className="stat-label">Avg Votes per Game</div>
          </div>
        </div>

        {stats.topGames && stats.topGames.length > 0 && (
          <div className="top-games-section">
            <h3>Top 10 Games</h3>
            <div className="top-games-list">
              {stats.topGames.slice(0, 10).map((game: any, index: number) => (
                <div key={game.gameId} className="top-game-item">
                  <span className="rank">#{index + 1}</span>
                  <span className="name">{game.gameName}</span>
                  <span className="votes">{game.votes} votes</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <button onClick={fetchStats} className="refresh-button">
          🔄 Refresh
        </button>
      </div>
    </div>
  );
};

export default Stats;
