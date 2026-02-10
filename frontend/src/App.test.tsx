import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import App from './App';

// Mock components to isolate App behavior
vi.mock('./components/VotingTab', () => ({ default: () => <div data-testid="voting-tab">VotingTab</div> }));
vi.mock('./components/TopGames', () => ({ default: () => <div data-testid="top-games">TopGames</div> }));
vi.mock('./components/Stats', () => ({ default: () => <div data-testid="stats">Stats</div> }));
vi.mock('./components/LadderTab', () => ({ default: () => <div data-testid="ladder-tab">LadderTab</div> }));

describe('App', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  describe('Landing route (/)', () => {
    it('should render the landing with title', () => {
      render(
        <MemoryRouter initialEntries={['/']}>
          <App />
        </MemoryRouter>
      );

      expect(screen.getByRole('heading', { name: /IGDB Game Voting/i })).toBeInTheDocument();
      expect(screen.getByText(/Open the voting link from your Discord server/i)).toBeInTheDocument();
    });

    it('should show guild ID input and hint', () => {
      render(
        <MemoryRouter initialEntries={['/']}>
          <App />
        </MemoryRouter>
      );

      expect(screen.getByPlaceholderText(/e.g. 123456789012345678/i)).toBeInTheDocument();
      expect(screen.getByText(/\/ladder link/i)).toBeInTheDocument();
    });
  });

  describe('VotingApp route (/app)', () => {
    it('should show message when not linked to a server (no guildId)', () => {
      render(
        <MemoryRouter initialEntries={['/app']}>
          <App />
        </MemoryRouter>
      );

      expect(screen.getByText(/Not linked to a server/i)).toBeInTheDocument();
    });

    it('should show Vote tab by default', () => {
      render(
        <MemoryRouter initialEntries={['/app']}>
          <App />
        </MemoryRouter>
      );

      expect(screen.getByTestId('voting-tab')).toBeInTheDocument();
    });

    it('should switch to Top Games tab when clicked', () => {
      render(
        <MemoryRouter initialEntries={['/app']}>
          <App />
        </MemoryRouter>
      );

      fireEvent.click(screen.getByRole('button', { name: /Top Games/i }));

      expect(screen.getByTestId('top-games')).toBeInTheDocument();
    });

    it('should switch to Statistics tab when clicked', () => {
      render(
        <MemoryRouter initialEntries={['/app']}>
          <App />
        </MemoryRouter>
      );

      fireEvent.click(screen.getByRole('button', { name: /Statistics/i }));

      expect(screen.getByTestId('stats')).toBeInTheDocument();
    });

    it('should not show Ladder button when guildId is missing', () => {
      render(
        <MemoryRouter initialEntries={['/app']}>
          <App />
        </MemoryRouter>
      );

      expect(screen.queryByRole('button', { name: /Ladder/i })).not.toBeInTheDocument();
    });

    it('should show Ladder button and Server ladder message when guildId from URL', () => {
      render(
        <MemoryRouter initialEntries={['/app?guildId=test-guild-123']}>
          <App />
        </MemoryRouter>
      );

      expect(screen.getByText(/Server ladder/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Ladder/i })).toBeInTheDocument();
    });

    it('should switch to Ladder tab when guildId present and Ladder clicked', () => {
      render(
        <MemoryRouter initialEntries={['/app?guildId=test-guild-123']}>
          <App />
        </MemoryRouter>
      );

      fireEvent.click(screen.getByRole('button', { name: /Ladder/i }));

      expect(screen.getByTestId('ladder-tab')).toBeInTheDocument();
    });
  });
});
