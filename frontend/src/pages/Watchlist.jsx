import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { useAsync } from '../hooks';
import { money, when, variantName } from '../format';
import { Loading, ErrorBox, Empty, Msg } from '../components/ui';

export default function Watchlist() {
  const wl = useAsync(() => api('/watchlist'), []);
  const al = useAsync(() => api('/alerts'), []);
  const [msg, setMsg] = useState(null);

  const act = async (fn, ok) => {
    setMsg(null);
    try { await fn(); setMsg({ type: 'ok', text: ok }); wl.reload(); al.reload(); }
    catch (e) { setMsg({ type: 'error', text: e.message }); }
  };

  return (
    <>
      <h1>Your watchlist</h1>
      <Msg m={msg} />
      {wl.loading && !wl.data && <Loading />}
      {wl.error && <ErrorBox message={wl.error.message} onRetry={wl.reload} />}
      {wl.data && (wl.data.data.length === 0
        ? <Empty title="You are not watching any products">Open a product and choose Add to watchlist. <Link to="/">Browse products</Link></Empty>
        : (
          <ul className="list">
            {wl.data.data.map(({ product: p, alerts, addedAt }) => (
              <li key={p._id} className="panel rowbetween">
                <div>
                  <h3><Link to={`/products/${p._id}`}>{p.name}</Link></h3>
                  <p>{p.hasPrice ? <>Latest recorded lowest total from <strong>{money(p.startingPrice)}</strong></> : <span className="muted">No comparable price recorded yet</span>}</p>
                  <p className="small muted">Added {when(addedAt)}</p>
                  {alerts.map((a) => (
                    <p key={a._id} className={`status ${a.status}`}>{variantName(a.variantId)}: target {money(a.targetPrice)}, {a.status === 'reached' ? `reached at ${money(a.currentPrice)}` : 'not reached yet'}</p>
                  ))}
                </div>
                <button className="btn ghost" onClick={() => act(() => api(`/watchlist/${p._id}`, { method: 'DELETE' }), 'Removed from watchlist.')}>Remove</button>
              </li>
            ))}
          </ul>
        ))}

      <h2>Price alerts</h2>
      {al.loading && !al.data && <Loading />}
      {al.error && <ErrorBox message={al.error.message} onRetry={al.reload} />}
      {al.data && (al.data.data.length === 0
        ? <Empty title="No price alerts yet">Set a target price on any product page to be told when it is reached.</Empty>
        : (
          <div className="tablewrap">
            <table className="plain">
              <thead><tr><th>Product</th><th>Variant</th><th className="num">Target</th><th className="num">Lowest known total</th><th>Status</th><th><span className="sr">Actions</span></th></tr></thead>
              <tbody>
                {al.data.data.map((a) => (
                  <tr key={a._id}>
                    <td><Link to={`/products/${a.productId?._id}?variant=${a.variantId?._id}`}>{a.productId?.name}</Link></td>
                    <td>{variantName(a.variantId)}</td>
                    <td className="num">{money(a.targetPrice)}</td>
                    <td className="num">{a.currentPrice === null ? 'Not available' : money(a.currentPrice)}</td>
                    <td><span className={`tag ${a.status === 'reached' ? 'best' : ''}`}>{a.status === 'reached' ? 'Target reached' : 'Waiting'}</span></td>
                    <td><button className="btn ghost small-btn" onClick={() => act(() => api(`/alerts/${a._id}`, { method: 'DELETE' }), 'Alert deleted.')}>Delete</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
    </>
  );
}
