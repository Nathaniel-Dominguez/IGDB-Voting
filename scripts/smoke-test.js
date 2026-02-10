/**
 * Optional smoke test for the backend (mock or real DB).
 * Run from repo root with backend up: npm run smoke
 * Env: BASE_URL (default http://localhost:3001), GUILD_ID (default smoke-test-guild).
 */

const BASE_URL = process.env.BASE_URL || 'http://localhost:3001';
const GUILD_ID = process.env.GUILD_ID || 'smoke-test-guild';

const checks = [
  { name: 'health', url: `${BASE_URL}/health`, expect: (body) => /"status"\s*:\s*"ok"/.test(body) },
  { name: 'ladder', url: `${BASE_URL}/api/guilds/${GUILD_ID}/ladder`, expect: (body) => body.includes('"phase"') },
  { name: 'votes/top', url: `${BASE_URL}/api/votes/top?guildId=${GUILD_ID}`, expect: (body) => body.includes('"games"') },
  { name: 'votes/stats', url: `${BASE_URL}/api/votes/stats?guildId=${GUILD_ID}`, expect: (body) => body.includes('"totalVotes"') },
];

async function run() {
  let failed = 0;
  for (const { name, url, expect } of checks) {
    try {
      const res = await fetch(url);
      const body = await res.text();
      const ok = res.ok && expect(body);
      console.log(ok ? `${name} OK` : `${name} FAIL`);
      if (!ok) failed++;
    } catch (err) {
      console.log(`${name} FAIL (${err.message})`);
      failed++;
    }
  }
  process.exit(failed > 0 ? 1 : 0);
}

run();
