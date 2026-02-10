import { useState, FormEvent, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import axios from 'axios';
import './Landing.css';

const API_BASE_URL = import.meta.env.VITE_APP_API_URL || 'http://localhost:3001/api';

interface GuildInfo {
  guildId: string;
  guildName: string | null;
  bracketSize: number;
}

interface LandingProps {
  basePath?: string;
}

const Landing: React.FC<LandingProps> = ({ basePath = '/app' }) => {
  const [searchParams] = useSearchParams();
  const guildIdFromUrl = searchParams.get('guildId');
  const [guildIdInput, setGuildIdInput] = useState('');
  const [guilds, setGuilds] = useState<GuildInfo[]>([]);
  const [guildsError, setGuildsError] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    axios.get<{ guilds: GuildInfo[] }>(`${API_BASE_URL}/guilds`)
      .then((res) => setGuilds(res.data.guilds || []))
      .catch(() => setGuildsError('Could not load servers'));
  }, []);

  // If guildId in URL, redirect to app
  useEffect(() => {
    if (guildIdFromUrl?.trim()) {
      navigate(`${basePath}?guildId=${encodeURIComponent(guildIdFromUrl.trim())}&tab=vote`, { replace: true });
    }
  }, [guildIdFromUrl, basePath, navigate]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = guildIdInput.trim();
    if (trimmed) {
      navigate(`${basePath}?guildId=${encodeURIComponent(trimmed)}&tab=vote`);
    }
  };

  if (guildIdFromUrl?.trim()) {
    return <div className="Landing Landing-redirect">Redirecting...</div>;
  }

  return (
    <div className="Landing">
      <header className="Landing-header">
        <h1>IGDB Game Voting</h1>
        <p className="Landing-message">
          Open the voting link from your Discord server to nominate games and vote
          in the bracket.
        </p>
      </header>
      {guilds.length > 0 && (
        <section className="Landing-servers">
          <h2 className="Landing-servers-title">Select a server</h2>
          {guildsError && <p className="Landing-servers-error">{guildsError}</p>}
          <ul className="Landing-servers-list">
            {guilds.map((g) => (
              <li key={g.guildId}>
                <Link
                  to={`${basePath}?guildId=${encodeURIComponent(g.guildId)}&tab=vote`}
                  className="Landing-server-link"
                >
                  {g.guildName || `Server ${g.guildId}`}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
      <section className="Landing-form">
        <p className="Landing-hint">
          Use <code>/ladder link</code> in Discord to get your server&apos;s link.
        </p>
        <form onSubmit={handleSubmit} className="Landing-guild-form">
          <label htmlFor="guildId">
            Or enter your Discord server ID (optional):
          </label>
          <div className="Landing-input-row">
            <input
              id="guildId"
              type="text"
              value={guildIdInput}
              onChange={(e) => setGuildIdInput(e.target.value)}
              placeholder="e.g. 123456789012345678"
              className="Landing-input"
            />
            <button type="submit" className="Landing-button">
              Go
            </button>
          </div>
        </form>
      </section>
    </div>
  );
};

export default Landing;
