import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ConditionsHistory from '../components/ConditionsHistory.jsx';

const makeEntry = (ts, northScore = 7, southScore = 6, overrides = {}) => ({
  ts,
  windSpeedKt: 5,
  windDirDeg: 270,
  waterTempF: 52,
  north: { score: northScore },
  south: { score: southScore },
  ...overrides,
});

const BASE_TS = new Date('2026-04-30T13:00:00Z').getTime();
const tenEntries = () => Array.from({ length: 10 }, (_, i) => makeEntry(BASE_TS + i * 3600000));

describe('ConditionsHistory render', () => {
  beforeEach(() => { vi.spyOn(global, 'fetch'); });
  afterEach(() => { vi.restoreAllMocks(); });

  it('shows error message when fetch fails', async () => {
    fetch.mockRejectedValue(new Error('network'));
    render(<ConditionsHistory />);
    await waitFor(() => {
      expect(screen.getByText(/Unable to load history/)).toBeTruthy();
    });
  });

  it('shows empty state when fewer than 6 entries returned', async () => {
    fetch.mockResolvedValue({ ok: true, json: async () => [makeEntry(BASE_TS, 5, 5)] });
    render(<ConditionsHistory />);
    await waitFor(() => {
      expect(screen.getByText(/Collecting history/)).toBeTruthy();
    });
  });

  it('renders block labels when data is sufficient', async () => {
    fetch.mockResolvedValue({ ok: true, json: async () => tenEntries() });
    render(<ConditionsHistory />);
    await waitFor(() => {
      expect(screen.getAllByText(/\w{3} (12a|6a|12p|6p)/).length).toBeGreaterThan(0);
    });
  });

  it('opens bottom sheet on block click', async () => {
    fetch.mockResolvedValue({ ok: true, json: async () => tenEntries() });
    const { container } = render(<ConditionsHistory />);
    await waitFor(() => screen.getAllByText(/\w{3} (12a|6a|12p|6p)/));
    const bar = container.querySelector('[style*="cursor: pointer"]');
    fireEvent.click(bar);
    expect(screen.getByText(/North:/)).toBeTruthy();
  });

  it('closes bottom sheet on Escape key', async () => {
    fetch.mockResolvedValue({ ok: true, json: async () => tenEntries() });
    const { container } = render(<ConditionsHistory />);
    await waitFor(() => screen.getAllByText(/\w{3} (12a|6a|12p|6p)/));
    fireEvent.click(container.querySelector('[style*="cursor: pointer"]'));
    expect(screen.getByText(/North:/)).toBeTruthy();
    fireEvent.keyDown(window, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByText(/North:/)).toBeNull());
  });

  it('closes bottom sheet on ✕ button', async () => {
    fetch.mockResolvedValue({ ok: true, json: async () => tenEntries() });
    const { container } = render(<ConditionsHistory />);
    await waitFor(() => screen.getAllByText(/\w{3} (12a|6a|12p|6p)/));
    fireEvent.click(container.querySelector('[style*="cursor: pointer"]'));
    fireEvent.click(screen.getByText('✕'));
    await waitFor(() => expect(screen.queryByText(/North:/)).toBeNull());
  });
});
