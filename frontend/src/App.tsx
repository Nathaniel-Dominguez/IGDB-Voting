import React, { useState, useMemo } from 'react';
import './App.css';
import VotingTab from './components/VotingTab';
import TopGames from './components/TopGames';
import Stats from './components/Stats';
import LadderTab from './components/LadderTab';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';

// Single server per deployment: set REACT_APP_GUILD_ID to your Discord server ID.
// Optional: ?guildId= in URL for local dev or bot-shared links.
function useGuildId(): string | null {
  return useMemo(() => {
    const env = process.env.REACT_APP_GUILD_ID;
    if (env) return env;
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      return params.get('guildId');
    }
    return null;
  }, [typeof window !== 'undefined' ? window.location.search : '']);
}

function App() {
  const guildId = useGuildId();
  const [activeTab, setActiveTab] = useState<'vote' | 'top' | 'stats' | 'ladder'>('vote');
  const [userId] = useState(() => {
    let id = localStorage.getItem('userId');
    if (!id) {
      id = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      localStorage.setItem('userId', id);
    }
    return id;
  });

  return (
    <div className="App">
      <header className="App-header">
        <h1>🎮 IGDB Game Voting</h1>
        <p>
          {guildId
            ? 'Server ladder: nominate games, then vote in the bracket.'
            : 'Not linked to a server. Set REACT_APP_GUILD_ID to this server’s Discord ID when deploying.'}
        </p>
      </header>

      <nav className="App-nav">
        <button
          className={activeTab === 'vote' ? 'active' : ''}
          onClick={() => setActiveTab('vote')}
        >
          Vote
        </button>
        <button
          className={activeTab === 'top' ? 'active' : ''}
          onClick={() => setActiveTab('top')}
        >
          Top Games
        </button>
        <button
          className={activeTab === 'stats' ? 'active' : ''}
          onClick={() => setActiveTab('stats')}
        >
          Statistics
        </button>
        {guildId && (
          <button
            className={activeTab === 'ladder' ? 'active' : ''}
            onClick={() => setActiveTab('ladder')}
          >
            Ladder
          </button>
        )}
      </nav>

      <main className="App-main">
        {activeTab === 'vote' && (
          <VotingTab apiUrl={API_BASE_URL} userId={userId} guildId={guildId} />
        )}
        {activeTab === 'top' && <TopGames apiUrl={API_BASE_URL} guildId={guildId} />}
        {activeTab === 'stats' && <Stats apiUrl={API_BASE_URL} guildId={guildId} />}
        {activeTab === 'ladder' && guildId && (
          <LadderTab apiUrl={API_BASE_URL} guildId={guildId} userId={userId} />
        )}
      </main>
    </div>
  );
}

export default App;
