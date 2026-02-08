import axios from 'axios';

interface IGDBToken {
  access_token: string;
  expires_in: number;
  token_type: string;
}

class IGDBService {
  private clientId: string;
  private clientSecret: string;
  private accessToken: string | null = null;
  private tokenExpiry: number = 0;

  constructor() {
    this.clientId = process.env.IGDB_CLIENT_ID || '';
    this.clientSecret = process.env.IGDB_CLIENT_SECRET || '';
  }

  private async getAccessToken(): Promise<string> {
    // Check if token is still valid
    if (this.accessToken && Date.now() < this.tokenExpiry) {
      return this.accessToken;
    }

    // Get new token
    try {
      const response = await axios.post<IGDBToken>(
        'https://id.twitch.tv/oauth2/token',
        null,
        {
          params: {
            client_id: this.clientId,
            client_secret: this.clientSecret,
            grant_type: 'client_credentials',
          },
        }
      );

      this.accessToken = response.data.access_token;
      // Set expiry to 90% of actual expiry time for safety
      this.tokenExpiry = Date.now() + (response.data.expires_in * 900);

      return this.accessToken;
    } catch (error) {
      console.error('Error getting IGDB access token:', error);
      throw new Error('Failed to authenticate with IGDB API');
    }
  }

  async query(endpoint: string, query: string): Promise<any[]> {
    const token = await this.getAccessToken();

    try {
      const response = await axios.post(
        `https://api.igdb.com/v4/${endpoint}`,
        query,
        {
          headers: {
            'Client-ID': this.clientId,
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'text/plain',
          },
        }
      );

      return response.data;
    } catch (error: any) {
      console.error(`Error querying IGDB ${endpoint}:`, error.response?.data || error.message);
      throw new Error(`Failed to query IGDB API: ${error.message}`);
    }
  }

  private gameFields = 'id,name,summary,cover.url,rating,rating_count,genres.name,platforms.name,game_modes.name,first_release_date';

  async getGamesByCategory(categoryId: number, limit: number = 50): Promise<any[]> {
    const query = `
      fields ${this.gameFields};
      where category = ${categoryId} & rating > 0;
      sort rating desc;
      limit ${limit};
    `;
    return this.query('games', query);
  }

  async getGameById(gameId: number): Promise<any> {
    const query = `
      fields ${this.gameFields};
      where id = ${gameId};
    `;
    const results = await this.query('games', query);
    return results[0] || null;
  }

  async searchGames(searchTerm: string, limit: number = 20): Promise<any[]> {
    const query = `
      search "${searchTerm}";
      fields ${this.gameFields};
      limit ${limit};
    `;
    return this.query('games', query);
  }

  async getCategories(): Promise<any[]> {
    const query = `
      fields id,name,slug;
      limit 50;
    `;
    return this.query('game_categories', query);
  }

  async getGenres(): Promise<Array<{ id: number; name: string; slug?: string }>> {
    const results = await this.query('genres', 'fields id,name,slug; limit 100;');
    return results;
  }

  async getGameModes(): Promise<Array<{ id: number; name: string; slug?: string }>> {
    const results = await this.query('game_modes', 'fields id,name,slug; limit 50;');
    return results;
  }

  async getPlatforms(): Promise<Array<{ id: number; name: string; slug?: string }>> {
    const results = await this.query('platforms', 'fields id,name,slug; limit 500;');
    return results;
  }

  private matchNameOrSlug(entry: { name?: string; slug?: string }, name: string): boolean {
    const n = (name || '').trim().toLowerCase();
    if (!n) return false;
    const entryName = (entry.name || '').toLowerCase();
    const entrySlug = (entry.slug || '').toLowerCase();
    return entryName === n || entrySlug === n || entryName.includes(n) || entrySlug.includes(n);
  }

  async resolveGenreNamesToIds(names: string[]): Promise<number[]> {
    if (!names.length) return [];
    const genres = await this.getGenres();
    const ids: number[] = [];
    for (const name of names) {
      const found = genres.find(g => this.matchNameOrSlug(g, name));
      if (found) ids.push(found.id);
      else throw new Error(`Unknown genre: "${name}". Use /api/igdb/genres to list options.`);
    }
    return [...new Set(ids)];
  }

  async resolveGameModeNamesToIds(names: string[]): Promise<number[]> {
    if (!names.length) return [];
    const modes = await this.getGameModes();
    const ids: number[] = [];
    for (const name of names) {
      const found = modes.find(m => this.matchNameOrSlug(m, name));
      if (found) ids.push(found.id);
      else throw new Error(`Unknown game mode: "${name}". Use /api/igdb/game-modes to list options.`);
    }
    return [...new Set(ids)];
  }

  async resolvePlatformNamesToIds(names: string[]): Promise<number[]> {
    if (!names.length) return [];
    const platforms = await this.getPlatforms();
    const ids: number[] = [];
    for (const name of names) {
      const found = platforms.find(p => this.matchNameOrSlug(p, name));
      if (found) ids.push(found.id);
      else throw new Error(`Unknown platform: "${name}". Use /api/igdb/platforms to list options.`);
    }
    return [...new Set(ids)];
  }
}

export default new IGDBService();
