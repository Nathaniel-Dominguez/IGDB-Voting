import {
  Client,
  GatewayIntentBits,
  SlashCommandBuilder,
  REST,
  Routes,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
} from 'discord.js';
import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3001/api';

interface Game {
  id: number;
  name: string;
  summary?: string;
  cover?: { url: string };
  rating?: number;
  rating_count?: number;
  genres?: Array<{ name: string }>;
  platforms?: Array<{ name: string }>;
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
  ],
});

function requireGuild(interaction: { guildId: string | null }): string | null {
  return interaction.guildId;
}

// Register slash commands
const commands = [
  new SlashCommandBuilder()
    .setName('vote')
    .setDescription('Nominate a game for this server ladder')
    .addStringOption(option =>
      option
        .setName('game')
        .setDescription('Name of the game to vote for')
        .setRequired(true)
    )
    .addStringOption(option =>
      option
        .setName('category')
        .setDescription('Category for this vote (e.g., Action, RPG, Strategy)')
        .setRequired(true)
    ),
  new SlashCommandBuilder()
    .setName('search')
    .setDescription('Search for games')
    .addStringOption(option =>
      option
        .setName('query')
        .setDescription('Game name to search for')
        .setRequired(true)
    ),
  new SlashCommandBuilder()
    .setName('top')
    .setDescription('View the top nominated games for this server')
    .addIntegerOption(option =>
      option
        .setName('limit')
        .setDescription('Number of games to show (default: 10, max: 100)')
        .setMinValue(1)
        .setMaxValue(100)
    ),
  new SlashCommandBuilder()
    .setName('stats')
    .setDescription('View voting statistics for this server'),
  new SlashCommandBuilder()
    .setName('games')
    .setDescription('Get games by category ID')
    .addIntegerOption(option =>
      option
        .setName('category')
        .setDescription('IGDB category ID (0=Main Game, 1=DLC, 2=Expansion, etc.)')
        .setRequired(true)
    )
    .addIntegerOption(option =>
      option
        .setName('limit')
        .setDescription('Number of games to show (default: 10)')
        .setMinValue(1)
        .setMaxValue(50)
    ),
  new SlashCommandBuilder()
    .setName('ladder')
    .setDescription('View or manage the seeded ladder for this server')
    .addSubcommand(sc => sc.setName('show').setDescription('Show current ladder state (nominations or bracket)'))
    .addSubcommand(sc =>
      sc
        .setName('start')
        .setDescription('Start a new ladder (admin)')
        .addIntegerOption(opt =>
          opt
            .setName('size')
            .setDescription('Bracket size (8, 16, or 32)')
            .setMinValue(8)
            .setMaxValue(32)
            .addChoices(
              { name: '8', value: 8 },
              { name: '16', value: 16 },
              { name: '32', value: 32 }
            )
        )
        .addStringOption(opt =>
          opt.setName('genre').setDescription('Restrict to genre(s), comma-separated (e.g. RPG, Action)')
        )
        .addIntegerOption(opt =>
          opt.setName('year').setDescription('Restrict to release year (e.g. 2023)')
        )
        .addStringOption(opt =>
          opt.setName('game_mode').setDescription('Restrict to game mode(s), comma-separated (e.g. Single player, Multiplayer)')
        )
        .addStringOption(opt =>
          opt.setName('platform').setDescription('Restrict to platform(s), comma-separated (e.g. PlayStation 5, PC)')
        )
    )
    .addSubcommand(sc => sc.setName('close-nominations').setDescription('Close nominations and seed bracket (admin)'))
    .addSubcommand(sc => sc.setName('close-round').setDescription('Close current bracket round (admin)')),
].map(command => command.toJSON());

async function registerCommands() {
  const token = process.env.DISCORD_TOKEN;
  const clientId = process.env.DISCORD_CLIENT_ID;

  if (!token || !clientId) {
    console.error('Missing DISCORD_TOKEN or DISCORD_CLIENT_ID in environment variables');
    return;
  }

  const rest = new REST({ version: '10' }).setToken(token);

  try {
    console.log('Started refreshing application (/) commands.');
    await rest.put(Routes.applicationCommands(clientId), { body: commands });
    console.log('Successfully reloaded application (/) commands.');
  } catch (error) {
    console.error('Error registering commands:', error);
  }
}

client.once('ready', () => {
  console.log(`🤖 Discord bot logged in as ${client.user?.tag}!`);
  registerCommands();
});

client.on('interactionCreate', async interaction => {
  if (interaction.isButton()) {
    const guildId = interaction.guildId;
    if (!guildId) {
      await interaction.reply({ content: 'Use this in a server.', ephemeral: true });
      return;
    }
    const customId = interaction.customId;
    if (customId.startsWith('matchup:')) {
      const parts = customId.split(':');
      const matchupId = parseInt(parts[1], 10);
      const votedGameId = parseInt(parts[2], 10);
      if (isNaN(matchupId) || isNaN(votedGameId)) {
        await interaction.reply({ content: 'Invalid button.', ephemeral: true });
        return;
      }
      try {
        await axios.post(
          `${API_BASE_URL}/guilds/${guildId}/ladder/matchup-vote`,
          {
            matchupId,
            votedGameId,
            userId: interaction.user.id,
            platform: 'discord',
          }
        );
        await interaction.reply({ content: '✅ Vote recorded!', ephemeral: true });
      } catch (err: any) {
        await interaction.reply({
          content: `❌ ${err.response?.data?.error || err.message}`,
          ephemeral: true,
        });
      }
    }
    return;
  }

  if (!interaction.isChatInputCommand()) return;

  const { commandName } = interaction;
  const guildId = requireGuild(interaction);

  if (commandName !== 'search' && commandName !== 'games' && !guildId) {
    await interaction.reply({
      content: '❌ This command must be used in a server (not DMs).',
      ephemeral: true,
    });
    return;
  }

  try {
    if (commandName === 'vote') {
      const gameName = interaction.options.getString('game', true);
      const category = interaction.options.getString('category', true);
      const userId = interaction.user.id;

      await interaction.deferReply();

      try {
        const searchResponse = await axios.get(`${API_BASE_URL}/games/search`, {
          params: { q: gameName, limit: 5 },
        });
        const games: Game[] = searchResponse.data;
        if (games.length === 0) {
          await interaction.editReply({
            content: `❌ No games found matching "${gameName}". Try /search first.`,
          });
          return;
        }
        const selectedGame = games[0];

        const voteResponse = await axios.post(`${API_BASE_URL}/votes`, {
          guildId,
          gameId: selectedGame.id,
          gameName: selectedGame.name,
          category,
          userId,
          platform: 'discord',
        });

        const embed = new EmbedBuilder()
          .setTitle('✅ Nomination Recorded!')
          .setDescription(`You nominated **${selectedGame.name}** in **${category}**`)
          .addFields(
            { name: 'Total Votes', value: String(voteResponse.data.totalVotes), inline: true },
            { name: 'Total Games', value: String(voteResponse.data.totalGames), inline: true }
          )
          .setColor(0x00ae86)
          .setTimestamp();
        if (selectedGame.cover?.url) {
          embed.setThumbnail(`https:${selectedGame.cover.url}`);
        }
        await interaction.editReply({ embeds: [embed] });
      } catch (error: any) {
        console.error('Error processing vote:', error);
        await interaction.editReply({
          content: `❌ ${error.response?.data?.error || error.message}`,
        });
      }
    }

    if (commandName === 'search') {
      const query = interaction.options.getString('query', true);
      await interaction.deferReply();
      try {
        const response = await axios.get(`${API_BASE_URL}/games/search`, {
          params: { q: query, limit: 10 },
        });
        const games: Game[] = response.data;
        if (games.length === 0) {
          await interaction.editReply({ content: `❌ No games found for "${query}"` });
          return;
        }
        const embed = new EmbedBuilder()
          .setTitle(`🔍 Search: "${query}"`)
          .setDescription(
            games.slice(0, 10).map((g, i) => `${i + 1}. **${g.name}** (ID: ${g.id})`).join('\n')
          )
          .setColor(0x00ae86)
          .setFooter({ text: 'Use /vote in a server to nominate' });
        await interaction.editReply({ embeds: [embed] });
      } catch (error: any) {
        await interaction.editReply({
          content: `❌ ${error.response?.data?.error || error.message}`,
        });
      }
    }

    if (commandName === 'top') {
      const limit = interaction.options.getInteger('limit') || 10;
      await interaction.deferReply();
      try {
        const response = await axios.get(`${API_BASE_URL}/votes/top`, {
          params: { guildId, limit },
        });
        const topGames = response.data.games;
        if (topGames.length === 0) {
          await interaction.editReply({
            content: '📊 No nominations yet. Use /vote to nominate a game!',
          });
          return;
        }
        const embed = new EmbedBuilder()
          .setTitle(`🏆 Top ${topGames.length} Nominations`)
          .setDescription(
            topGames
              .map(
                (g: any, i: number) =>
                  `${i + 1}. **${g.gameName}** – ${g.votes} vote${g.votes !== 1 ? 's' : ''}`
              )
              .join('\n')
          )
          .addFields(
            { name: 'Total Votes', value: String(response.data.totalVotes), inline: true },
            { name: 'Total Games', value: String(response.data.totalGames), inline: true }
          )
          .setColor(0xffd700)
          .setTimestamp();
        await interaction.editReply({ embeds: [embed] });
      } catch (error: any) {
        await interaction.editReply({
          content: `❌ ${error.response?.data?.error || error.message}`,
        });
      }
    }

    if (commandName === 'stats') {
      await interaction.deferReply();
      try {
        const response = await axios.get(`${API_BASE_URL}/votes/stats`, {
          params: { guildId },
        });
        const stats = response.data;
        const top10 = (stats.topGames || []).slice(0, 10);
        const embed = new EmbedBuilder()
          .setTitle('📊 Server Voting Statistics')
          .addFields(
            { name: 'Total Votes', value: String(stats.totalVotes), inline: true },
            { name: 'Total Games', value: String(stats.totalGames), inline: true },
            {
              name: 'Top 10',
              value:
                top10.length > 0
                  ? top10.map((g: any, i: number) => `${i + 1}. ${g.gameName} (${g.votes})`).join('\n')
                  : 'No votes yet',
              inline: false,
            }
          )
          .setColor(0x5865f2)
          .setTimestamp();
        await interaction.editReply({ embeds: [embed] });
      } catch (error: any) {
        await interaction.editReply({
          content: `❌ ${error.response?.data?.error || error.message}`,
        });
      }
    }

    if (commandName === 'games') {
      const categoryId = interaction.options.getInteger('category', true);
      const limit = interaction.options.getInteger('limit') || 10;
      await interaction.deferReply();
      try {
        const response = await axios.get(
          `${API_BASE_URL}/games/category/${categoryId}`,
          { params: { limit } }
        );
        const games: Game[] = response.data;
        if (games.length === 0) {
          await interaction.editReply({ content: `❌ No games for category ${categoryId}` });
          return;
        }
        const embed = new EmbedBuilder()
          .setTitle(`🎮 Games (Category ${categoryId})`)
          .setDescription(
            games
              .slice(0, 10)
              .map(
                (g, i) =>
                  `${i + 1}. **${g.name}**${g.rating ? ` ⭐ ${g.rating.toFixed(1)}` : ''}`
              )
              .join('\n')
          )
          .setColor(0x00ae86)
          .setFooter({ text: 'Use /vote in a server to nominate' });
        await interaction.editReply({ embeds: [embed] });
      } catch (error: any) {
        await interaction.editReply({
          content: `❌ ${error.response?.data?.error || error.message}`,
        });
      }
    }

    if (commandName === 'ladder') {
      const sub = interaction.options.getSubcommand();
      await interaction.deferReply();

      const adminSecret = process.env.ADMIN_SECRET;
      const isAdmin = !adminSecret || (interaction.memberPermissions?.has?.('Administrator') ?? false);

      if (sub === 'start') {
        if (!isAdmin) {
          await interaction.editReply({ content: '❌ Admin only.' });
          return;
        }
        const size = interaction.options.getInteger('size') || 16;
        const genre = interaction.options.getString('genre');
        const year = interaction.options.getInteger('year');
        const gameMode = interaction.options.getString('game_mode');
        const platform = interaction.options.getString('platform');
        const body: any = { bracketSize: size };
        if (genre) body.genreNames = genre.split(',').map((s: string) => s.trim()).filter(Boolean);
        if (year != null) body.releaseYear = year;
        if (gameMode) body.gameModeNames = gameMode.split(',').map((s: string) => s.trim()).filter(Boolean);
        if (platform) body.platformNames = platform.split(',').map((s: string) => s.trim()).filter(Boolean);
        try {
          const { data } = await axios.post(
            `${API_BASE_URL}/guilds/${guildId}/ladder/start`,
            body,
            { headers: adminSecret ? { 'X-Admin-Secret': adminSecret } : {} }
          );
          const restrictions = data.constraintsDisplay ? ` Restrictions: ${data.constraintsDisplay}.` : '';
          await interaction.editReply({
            content: `✅ Ladder started (bracket size: ${data.bracketSize}).${restrictions} Nominate games with /vote!`,
          });
        } catch (e: any) {
          await interaction.editReply({
            content: `❌ ${e.response?.data?.error || e.message}`,
          });
        }
        return;
      }

      if (sub === 'close-nominations') {
        if (!isAdmin) {
          await interaction.editReply({ content: '❌ Admin only.' });
          return;
        }
        try {
          const { data } = await axios.post(
            `${API_BASE_URL}/guilds/${guildId}/ladder/close-nominations`,
            {},
            { headers: adminSecret ? { 'X-Admin-Secret': adminSecret } : {} }
          );
          await interaction.editReply({
            content: `✅ Nominations closed. Bracket seeded with ${data.matchups?.length ?? 0} matchups. Vote with the buttons below or /ladder show!`,
          });
        } catch (e: any) {
          await interaction.editReply({
            content: `❌ ${e.response?.data?.error || e.message}`,
          });
        }
        return;
      }

      if (sub === 'close-round') {
        if (!isAdmin) {
          await interaction.editReply({ content: '❌ Admin only.' });
          return;
        }
        try {
          const { data } = await axios.post(
            `${API_BASE_URL}/guilds/${guildId}/ladder/close-round`,
            {},
            { headers: adminSecret ? { 'X-Admin-Secret': adminSecret } : {} }
          );
          if (data.phase === 'complete' && data.champion) {
            await interaction.editReply({
              content: `🏆 **Champion: ${data.champion.gameName}**`,
            });
          } else {
            await interaction.editReply({
              content: `✅ Round closed. Next round has ${data.matchups?.length ?? 0} matchups.`,
            });
          }
        } catch (e: any) {
          await interaction.editReply({
            content: `❌ ${e.response?.data?.error || e.message}`,
          });
        }
        return;
      }

      if (sub === 'show') {
        try {
          const { data } = await axios.get(`${API_BASE_URL}/guilds/${guildId}/ladder`);
          if (data.phase === 'nominations') {
            const top = (data.topGames || []).slice(0, data.bracketSize || 16);
            const embed = new EmbedBuilder()
              .setTitle('📋 Ladder: Nominations')
              .setDescription(
                top.length > 0
                  ? top.map((g: any, i: number) => `${i + 1}. **${g.gameName}** (${g.votes} votes)`).join('\n')
                  : 'No nominations yet. Use /vote to nominate!'
              )
              .setColor(0x00ae86)
              .setTimestamp();
            if (data.constraintsDisplay) {
              embed.addFields({ name: 'Restrictions', value: data.constraintsDisplay, inline: false });
            }
            embed.setFooter({ text: `Top ${data.bracketSize} will advance to bracket. Admin: /ladder close-nominations` });
            await interaction.editReply({ embeds: [embed] });
            return;
          }
          if (data.phase === 'bracket' && data.matchups?.length) {
            const open = data.matchups.filter((m: any) => m.winnerGameId == null);
            const embed = new EmbedBuilder()
              .setTitle(`🏆 Bracket – Round ${data.currentRound ?? 1}`)
              .setColor(0xffd700)
              .setTimestamp();
            const rows: ActionRowBuilder<ButtonBuilder>[] = [];
            for (const m of open.slice(0, 5)) {
              const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
                new ButtonBuilder()
                  .setCustomId(`matchup:${m.id}:${m.gameAId}`)
                  .setLabel(m.gameAName?.slice(0, 80) ?? 'Game A')
                  .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                  .setCustomId(`matchup:${m.id}:${m.gameBId}`)
                  .setLabel(m.gameBName?.slice(0, 80) ?? 'Game B')
                  .setStyle(ButtonStyle.Secondary)
              );
              rows.push(row);
              embed.addFields({
                name: `Matchup ${m.id}`,
                value: `**${m.gameAName}** (${m.votesA ?? 0}) vs **${m.gameBName}** (${m.votesB ?? 0})`,
                inline: false,
              });
            }
            if (open.length > 5) {
              embed.setFooter({ text: `Showing 5 of ${open.length} matchups. Vote on the buttons above.` });
            } else {
              embed.setFooter({ text: 'Click a button to vote for that game.' });
            }
            await interaction.editReply({ embeds: [embed], components: rows });
            return;
          }
          if (data.phase === 'complete' && data.champion) {
            await interaction.editReply({
              content: `🏆 **Champion: ${data.champion.gameName}**`,
            });
            return;
          }
          await interaction.editReply({
            content: 'No active ladder. Admin: use /ladder start to begin.',
          });
        } catch (e: any) {
          await interaction.editReply({
            content: `❌ ${e.response?.data?.error || e.message}`,
          });
        }
      }
    }
  } catch (error: any) {
    console.error(`Error handling ${commandName}:`, error);
    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({
        content: `❌ ${error.message}`,
        ephemeral: true,
      });
    }
  }
});

const token = process.env.DISCORD_TOKEN;
if (!token) {
  console.error('DISCORD_TOKEN is not set');
  process.exit(1);
}
client.login(token);
