import { useState, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import '../App.css';
import VotingTab from './VotingTab';
import TopGames from './TopGames';
import Stats from './Stats';
import LadderTab from './LadderTab';

const API_BASE_URL = import.meta.env.VITE_APP_API_URL || 'http://localhost:3001/api';

type TabType = 'vote' | 'top' | 'stats' | 'ladder';

function VotingApp() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const guildId = useMemo(() => {
    const env = import.meta.env.VITE_APP_GUILD_ID;
    if (env) return env;
    return searchParams.get('guildId');
  }, [searchParams]);

  const tabParam = searchParams.get('tab') || 'vote';
  const activeTab: TabType = ['vote', 'top', 'stats', 'ladder'].includes(tabParam) ? tabParam as TabType : 'vote';

  const setTab = (tab: TabType) => {
    const params = new URLSearchParams(searchParams);
    params.set('tab', tab);
    if (guildId) params.set('guildId', guildId);
    navigate({ search: params.toString() }, { replace: true });
  };

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
        <h1>IGDB Game Voting</h1>
        <p>
          {guildId
            ? 'Server ladder: nominate games, then vote in the bracket.'
            : 'Not linked to a server. Get the link from your Discord server or enter a server ID on the home page.'}
        </p>
      </header>

      <nav className="App-nav">
        <button
          className={activeTab === 'vote' ? 'active' : ''}
          onClick={() => setTab('vote')}
        >
          Vote
        </button>
        <button
          className={activeTab === 'top' ? 'active' : ''}
          onClick={() => setTab('top')}
        >
          Top Games
        </button>
        <button
          className={activeTab === 'stats' ? 'active' : ''}
          onClick={() => setTab('stats')}
        >
          Statistics
        </button>
        {guildId && (
          <button
            className={activeTab === 'ladder' ? 'active' : ''}
            onClick={() => setTab('ladder')}
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

export default VotingApp;
