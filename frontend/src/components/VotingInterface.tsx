import React, { useState } from 'react';
import axios from 'axios';
import './VotingInterface.css';

interface Game {
  id: number;
  name: string;
  summary?: string;
  cover?: { url: string };
  rating?: number;
}

interface VotingInterfaceProps {
  apiUrl: string;
  userId: string;
  guildId: string;
  selectedGame?: Game | null;
  onGameChange?: (game: Game | null) => void;
}

const VotingInterface: React.FC<VotingInterfaceProps> = ({
  apiUrl,
  userId,
  guildId,
  selectedGame: propSelectedGame,
  onGameChange,
}) => {
  const [internalSelectedGame, setInternalSelectedGame] = useState<Game | null>(null);
  const selectedGame = propSelectedGame !== undefined ? propSelectedGame : internalSelectedGame;
  const setSelectedGame = onGameChange || setInternalSelectedGame;
  
  const [category, setCategory] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const categories = [
    'Action', 'Adventure', 'RPG', 'Strategy', 'Simulation',
    'Sports', 'Racing', 'Fighting', 'Puzzle', 'Horror',
    'Platformer', 'Shooter', 'Indie', 'MMO', 'Other'
  ];

  const handleVote = async () => {
    if (!selectedGame) {
      setMessage({ type: 'error', text: 'Please select a game first' });
      return;
    }

    if (!category) {
      setMessage({ type: 'error', text: 'Please select a category' });
      return;
    }

    setSubmitting(true);
    setMessage(null);

    try {
      const response = await axios.post(`${apiUrl}/votes`, {
        guildId,
        gameId: selectedGame.id,
        gameName: selectedGame.name,
        category,
        userId,
        platform: 'web',
      });

      setMessage({
        type: 'success',
        text: `Vote recorded! Total votes: ${response.data.totalVotes}, Total games: ${response.data.totalGames}`,
      });

      // Reset form
      setSelectedGame(null);
      if (onGameChange) onGameChange(null);
      setCategory('');
    } catch (err: any) {
      setMessage({
        type: 'error',
        text: err.response?.data?.error || 'Failed to submit vote',
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="VotingInterface">
      <div className="voting-card">
        <h2>Cast Your Vote</h2>

        {selectedGame ? (
          <div className="selected-game">
            {selectedGame.cover?.url && (
              <img
                src={`https:${selectedGame.cover.url}`}
                alt={selectedGame.name}
                className="selected-game-cover"
              />
            )}
            <div className="selected-game-info">
              <h3>{selectedGame.name}</h3>
              {selectedGame.rating && (
                <div className="selected-game-rating">⭐ {selectedGame.rating.toFixed(1)}</div>
              )}
              <button
                onClick={() => {
                  setSelectedGame(null);
                  if (onGameChange) onGameChange(null);
                }}
                className="change-game-button"
              >
                Change Game
              </button>
            </div>
          </div>
        ) : (
          <div className="no-game-selected">
            <p>Search for a game above and click on it to select it for voting.</p>
          </div>
        )}

        <div className="category-selector">
          <label htmlFor="category">Category:</label>
          <select
            id="category"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="category-select"
          >
            <option value="">Select a category</option>
            {categories.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
        </div>

        {message && (
          <div className={`message ${message.type}`}>
            {message.text}
          </div>
        )}

        <button
          onClick={handleVote}
          disabled={!selectedGame || !category || submitting}
          className="vote-button"
        >
          {submitting ? 'Submitting...' : 'Submit Vote'}
        </button>
      </div>
    </div>
  );
};

export default VotingInterface;
