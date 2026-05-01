import { useState, useEffect } from 'react';

export function maeColor(mae) {
  if (mae < 2) return '#00e887';
  if (mae <= 3) return '#f5a623';
  return '#ff2b55';
}

export default function InsightsPanel() {
  const [status, setStatus] = useState('loading');
  const [insights, setInsights] = useState(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    fetch('/api/insights')
      .then(r => { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(data => { setInsights(data); setStatus('ok'); })
      .catch(() => setStatus('error'));
  }, []);

  if (status === 'error') return null;

  const total = insights?.totalReports ?? 0;
  const headerCount = status === 'loading' ? '...' : total === 0 ? 'no reports yet' : `${total} report${total === 1 ? '' : 's'}`;

  return (
    <div className="card px-4 py-3">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between"
        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
      >
        <span className="text-[11px] font-semibold" style={{ color: '#5a7fa0' }}>
          Model accuracy · {headerCount}
        </span>
        <span className="text-[10px]" style={{ color: '#3a5a70' }}>{open ? '▲' : '▼'}</span>
      </button>

      {open && insights && (
        <div className="flex flex-col gap-2 mt-3 text-[11px]" style={{ color: '#7a9ab8' }}>
          {total === 0 ? (
            <p>No reports yet — keep reporting after each session to calibrate the model.</p>
          ) : (
            <>
              {(() => {
                const mae = parseFloat(insights.meanAbsoluteError);
                const color = maeColor(mae);
                return (
                  <p>
                    <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: color, marginRight: 6, verticalAlign: 'middle' }} />
                    Avg error: {mae.toFixed(1)} pts
                  </p>
                );
              })()}

              {total < 5 && (
                <p style={{ color: '#5a7fa0' }}>
                  Only {total} report{total === 1 ? '' : 's'} so far — keep reporting after each session
                </p>
              )}

              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ color: '#3a5a70' }}>
                    <th style={{ textAlign: 'left', fontWeight: 600, paddingBottom: 4 }}>Predicted</th>
                    <th style={{ textAlign: 'left', fontWeight: 600, paddingBottom: 4 }}>Reported</th>
                    <th style={{ textAlign: 'left', fontWeight: 600, paddingBottom: 4 }}>Reports</th>
                  </tr>
                </thead>
                <tbody>
                  {(insights.breakdown ?? []).map(row => (
                    <tr key={row.predictedBucket}>
                      <td style={{ paddingBottom: 2 }}>{row.predictedBucket}</td>
                      <td style={{ paddingBottom: 2 }}>{row.avgReported}</td>
                      <td style={{ paddingBottom: 2 }}>{row.count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </div>
      )}
    </div>
  );
}
