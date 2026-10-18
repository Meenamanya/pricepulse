import { useMemo, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, Legend, ResponsiveContainer } from 'recharts';
import { money, day, when } from '../format';

const COLORS = ['#2447F5', '#0E7A4F', '#B76E00', '#B3261E', '#6B3FA0'];
const signed = (n) => (n === null ? 'No earlier record' : `${n > 0 ? '+' : n < 0 ? '-' : ''}${money(Math.abs(n))}`);

export default function PriceChart({ series }) {
  const [pick, setPick] = useState('all');
  const shown = pick === 'all' ? series : series.filter((s) => s.merchant === pick);

  const rows = useMemo(() => {
    const times = [...new Set(shown.flatMap((s) => s.records.map((r) => r.recordedAt)))].sort();
    return times.map((t) => {
      const row = { t: new Date(t).getTime() };
      shown.forEach((s) => { const r = s.records.find((x) => x.recordedAt === t); if (r) row[s.merchant] = r.price; });
      return row;
    });
  }, [shown]);

  return (
    <div>
      <div className="row">
        <label className="inline">Show
          <select value={pick} onChange={(e) => setPick(e.target.value)}>
            <option value="all">All merchants</option>
            {series.map((s) => <option key={s.offerId} value={s.merchant}>{s.merchant}</option>)}
          </select>
        </label>
        <p className="small muted">Chart plots the listed price from stored records. Shipping is not included.</p>
      </div>
      <div className="chart" role="img" aria-label="Line chart of listed price over time">
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={rows} margin={{ top: 8, right: 16, bottom: 0, left: 8 }}>
            <CartesianGrid stroke="#D5DBD3" strokeDasharray="3 3" />
            <XAxis dataKey="t" type="number" scale="time" domain={['dataMin', 'dataMax']} tickFormatter={day} tick={{ fontSize: 12 }} />
            <YAxis domain={['auto', 'auto']} tickFormatter={(v) => `₹${Number(v).toLocaleString('en-IN')}`} width={78} tick={{ fontSize: 12 }} />
            <Tooltip labelFormatter={(t) => when(t)} formatter={(v) => money(v)} />
            <Legend />
            {shown.map((s, i) => <Line key={s.offerId} type="monotone" dataKey={s.merchant} stroke={COLORS[i % COLORS.length]} strokeWidth={2} dot={{ r: 2.5 }} connectNulls />)}
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="tablewrap">
        <table className="plain">
          <caption className="sr">Price history summary by merchant, calculated from stored records</caption>
          <thead><tr><th>Merchant</th><th className="num">Current recorded</th><th className="num">Lowest recorded</th><th className="num">Highest recorded</th><th className="num">Change from previous</th><th className="num">Records</th></tr></thead>
          <tbody>
            {shown.map((s) => (
              <tr key={s.offerId}>
                <td>{s.merchant}</td>
                <td className="num">{money(s.summary.current?.price)}</td>
                <td className="num">{money(s.summary.lowest?.price)}</td>
                <td className="num">{money(s.summary.highest?.price)}</td>
                <td className="num">{signed(s.summary.change)}{s.summary.changePercent !== null && ` (${s.summary.changePercent}%)`}</td>
                <td className="num">{s.summary.recordCount}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
