import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import InsightsPanel from '../components/InsightsPanel.jsx';

const zeroReports = { totalReports: 0, accuracy: null };
const fewReports = {
  totalReports: 3,
  meanAbsoluteError: '1.5',
  breakdown: [{ predictedBucket: 6, avgReported: 7, count: 3 }],
};
const manyReports = {
  totalReports: 10,
  meanAbsoluteError: '2.1',
  breakdown: [
    { predictedBucket: 4, avgReported: 5, count: 4 },
    { predictedBucket: 8, avgReported: 7, count: 6 },
  ],
};

describe('InsightsPanel render', () => {
  beforeEach(() => { vi.spyOn(global, 'fetch'); });
  afterEach(() => { vi.restoreAllMocks(); });

  it('renders nothing on fetch error', async () => {
    fetch.mockRejectedValue(new Error('network'));
    const { container } = render(<InsightsPanel />);
    await waitFor(() => expect(container.firstChild).toBeNull());
  });

  it('shows "..." while loading', () => {
    fetch.mockReturnValue(new Promise(() => {}));
    render(<InsightsPanel />);
    expect(screen.getByText(/\.\.\./)).toBeTruthy();
  });

  it('shows "no reports yet" in header at 0 reports', async () => {
    fetch.mockResolvedValue({ ok: true, json: async () => zeroReports });
    render(<InsightsPanel />);
    await waitFor(() => expect(screen.getByText(/no reports yet/)).toBeTruthy());
  });

  it('shows report count in header when reports exist', async () => {
    fetch.mockResolvedValue({ ok: true, json: async () => fewReports });
    render(<InsightsPanel />);
    await waitFor(() => expect(screen.getByText(/3 reports/)).toBeTruthy());
  });

  it('is collapsed by default', async () => {
    fetch.mockResolvedValue({ ok: true, json: async () => fewReports });
    render(<InsightsPanel />);
    await waitFor(() => screen.getByText(/3 reports/));
    expect(screen.queryByText(/Avg error/)).toBeNull();
  });

  it('expands on click', async () => {
    fetch.mockResolvedValue({ ok: true, json: async () => fewReports });
    render(<InsightsPanel />);
    await waitFor(() => screen.getByText(/3 reports/));
    fireEvent.click(screen.getByRole('button'));
    expect(screen.getByText(/Avg error/)).toBeTruthy();
  });

  it('collapses again on second click', async () => {
    fetch.mockResolvedValue({ ok: true, json: async () => fewReports });
    render(<InsightsPanel />);
    await waitFor(() => screen.getByText(/3 reports/));
    fireEvent.click(screen.getByRole('button'));
    fireEvent.click(screen.getByRole('button'));
    expect(screen.queryByText(/Avg error/)).toBeNull();
  });

  it('shows sparse note when totalReports < 5', async () => {
    fetch.mockResolvedValue({ ok: true, json: async () => fewReports });
    render(<InsightsPanel />);
    await waitFor(() => screen.getByText(/3 reports/));
    fireEvent.click(screen.getByRole('button'));
    expect(screen.getByText(/Only 3/)).toBeTruthy();
  });

  it('does not show sparse note when totalReports >= 5', async () => {
    fetch.mockResolvedValue({ ok: true, json: async () => manyReports });
    render(<InsightsPanel />);
    await waitFor(() => screen.getByText(/10 reports/));
    fireEvent.click(screen.getByRole('button'));
    expect(screen.queryByText(/Only/)).toBeNull();
  });

  it('shows no MAE line when 0 reports', async () => {
    fetch.mockResolvedValue({ ok: true, json: async () => zeroReports });
    render(<InsightsPanel />);
    await waitFor(() => screen.getByText(/no reports yet/));
    fireEvent.click(screen.getByRole('button'));
    expect(screen.queryByText(/Avg error/)).toBeNull();
    expect(screen.getByText(/No reports yet/)).toBeTruthy();
  });

  it('renders breakdown table rows', async () => {
    fetch.mockResolvedValue({ ok: true, json: async () => manyReports });
    render(<InsightsPanel />);
    await waitFor(() => screen.getByText(/10 reports/));
    fireEvent.click(screen.getByRole('button'));
    expect(screen.getByText('Predicted')).toBeTruthy();
    expect(screen.getAllByRole('row').length).toBeGreaterThan(1);
  });
});
