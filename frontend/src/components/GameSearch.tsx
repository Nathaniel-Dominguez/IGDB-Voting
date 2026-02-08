import React, { useState } from 'react';
import axios from 'axios';
import './GameSearch.css';

interface Game {
  id: number;
  name: string;
  summary?: string;
  cover?: { url: string };
  rating?: number;
  genres?: Array<{ name: string }>;
  platforms?: Array<{ name: string }>;
}

interface GameSearchProps {
  apiUrl: string;
  onGameSelect?: (game: Game) => void;
}

const GameSearch: React.FC<GameSearchProps> = ({ apiUrl, onGameSelect }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchTerm.trim()) return;

    setLoading(true);
    setError(null);

    try {
      const response = await axios.get(`${apiUrl}/games/search`, {
        params: { q: searchTerm, limit: 20 },
      });
      setGames(response.data);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to search games');
      setGames([]);
    } finally {
      setLoading(false);
    }
  };

  const handleGameClick = (game: Game) => {
    if (onGameSelect) {
      onGameSelect(game);
    }
  };

  return (
    <div className="GameSearch">
      <form onSubmit={handleSearch} className="search-form">
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Search for a game..."
          className="search-input"
        />
        <button type="submit" disabled={loading} className="search-button">
          {loading ? 'Searching...' : 'Search'}
        </button>
      </form>

      {error && <div className="error-message">{error}</div>}

      {games.length > 0 && (
        <div className="games-grid">
          {games.map((game) => (
            <div
              key={game.id}
              className="game-card"
              onClick={() => handleGameClick(game)}
            >
              {game.cover?.url && (
                <img
                  src={`https:${game.cover.url}`}
                  alt={game.name}
                  className="game-cover"
                />
              )}
              <div className="game-info">
                <h3>{game.name}</h3>
                {game.rating && (
                  <div className="game-rating">⭐ {game.rating.toFixed(1)}</div>
                )}
                {game.genres && game.genres.length > 0 && (
                  <div className="game-genres">
                    {game.genres.map((g) => g.name).join(', ')}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default GameSearch;
