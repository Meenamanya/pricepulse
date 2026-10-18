import { useState } from 'react';
import { Link, useLocation, useParams, useSearchParams } from 'react-router-dom';
import { api } from '../api';
import { useAsync } from '../hooks';
import { useAuth } from '../auth';
import { money, when, label, safeUrl, variantName } from '../format';
import { Loading, ErrorBox, Empty, Msg } from '../components/ui';
import PriceChart from '../components/PriceChart';

function CompareTable({ cmp }) {
  const best = cmp.offers.filter((o) => o.isLowest).map((o) => o.merchant?.name).join(' and ');
  return (
    <>
      <p className="verdict">
        {cmp.lowestTotal !== null
          ? <>Lowest known total: <strong>{money(cmp.lowestTotal)}</strong> at {best}.</>
          : <>A lowest price cannot be determined yet.</>}
      </p>
      {cmp.notes.length > 0 && <ul className="notice">{cmp.notes.map((n) => <li key={n}>{n}</li>)}</ul>}
      {cmp.offers.length === 0 ? <Empty title="No offers for this variant yet" /> : (
        <div className="tablewrap">
          <table className="cmp">
            <caption className="sr">Merchant offers for the selected variant</caption>
            <thead><tr><th>Merchant</th><th className="num">Listed price</th><th className="num">Shipping</th><th className="num">Total cost</th><th>Availability</th><th>Last updated</th><th><span className="sr">Store link</span></th></tr></thead>
            <tbody>
              {cmp.offers.map((o) => {
                const cls = o.isLowest ? 'best' : o.status === 'shipping_unknown' ? 'unknown' : !o.purchasable ? 'gone' : '';
                return (
                  <tr key={o._id} className={cls}>
                    <td>{o.merchant?.name}{o.isLowest && <span className="tag best">Lowest known total</span>}</td>
                    <td className="num">{money(o.price)}</td>
                    <td className={`num ${o.shipping === null ? 'hatch' : ''}`}>{o.shipping === null ? 'Unknown' : o.shipping === 0 ? 'Free' : money(o.shipping)}</td>
                    <td className={`num ${o.totalCost === null ? 'hatch' : ''}`}><strong>{o.totalCost === null ? 'Unknown' : money(o.totalCost)}</strong></td>
                    <td>{o.purchasable ? 'In stock' : 'Out of stock'}</td>
                    <td className="small">{when(o.lastUpdatedAt)}</td>
                    <td>{o.purchasable && safeUrl(o.url) ? <a className="btn small-btn" href={o.url} target="_blank" rel="noopener noreferrer nofollow">View at {o.merchant?.name}</a> : <span className="muted small">Not available</span>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <p className="small muted">{cmp.disclaimer}</p>
    </>
  );
}

function LoggedInPanel({ product, variant, lowestTotal }) {
  const wl = useAsync(() => api('/watchlist'), []);
  const al = useAsync(() => api('/alerts'), []);
  const [target, setTarget] = useState('');
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);

  const inList = wl.data?.data.some((i) => i.product._id === product._id);
  const alert = al.data?.data.find((a) => a.variantId?._id === variant._id);

  const run = async (fn, ok) => {
    setBusy(true); setMsg(null);
    try { await fn(); setMsg({ type: 'ok', text: ok }); wl.reload(); al.reload(); }
    catch (e) { setMsg({ type: 'error', text: e.message }); }
    finally { setBusy(false); }
  };
  const saveAlert = (e) => {
    e.preventDefault();
    const n = Number(target || alert?.targetPrice);
    if (!n || n <= 0) return setMsg({ type: 'error', text: 'Enter a target price greater than zero.' });
    run(() => (alert ? api(`/alerts/${alert._id}`, { method: 'PUT', body: { targetPrice: n } }) : api('/alerts', { method: 'POST', body: { productId: product._id, variantId: variant._id, targetPrice: n } })), 'Target price saved.');
    setTarget('');
  };

  return (
    <div className="panel">
      <h2>Track this product</h2>
      <button className="btn" disabled={busy || wl.loading} onClick={() => run(() => api(`/watchlist/${product._id}`, { method: inList ? 'DELETE' : 'POST' }), inList ? 'Removed from watchlist.' : 'Added to watchlist.')}>
        {inList ? 'Remove from watchlist' : 'Add to watchlist'}
      </button>

      <h3>Target price for {variantName(variant)}</h3>
      {alert && (
        <p className={`status ${alert.status}`}>
          {alert.status === 'reached'
            ? <>Target reached. The lowest known total is {money(alert.currentPrice)}, at or below your target of {money(alert.targetPrice)}.</>
            : <>Not reached yet. Your target is {money(alert.targetPrice)}; the lowest known total is {lowestTotal === null ? 'not available yet' : money(lowestTotal)}.</>}
        </p>
      )}
      <form className="row" onSubmit={saveAlert}>
        <label className="inline">Target total (₹)<input type="number" min="1" step="1" value={target} onChange={(e) => setTarget(e.target.value)} placeholder={alert ? String(alert.targetPrice) : 'e.g. 25000'} /></label>
        <button className="btn" disabled={busy}>{alert ? 'Update target' : 'Set target'}</button>
        {alert && <button type="button" className="btn ghost" disabled={busy} onClick={() => run(() => api(`/alerts/${alert._id}`, { method: 'DELETE' }), 'Alert deleted.')}>Delete alert</button>}
      </form>
      <p className="small muted">Alerts compare your target with the lowest known total (price plus shipping) of in-stock offers for this variant.</p>
      <Msg m={msg} />
    </div>
  );
}

export default function Product() {
  const { id } = useParams();
  const loc = useLocation();
  const { user } = useAuth();
  const [sp, setSp] = useSearchParams();
  const variantId = sp.get('variant') || '';

  const cmp = useAsync(() => api(`/products/${id}/compare${variantId ? `?variantId=${variantId}` : ''}`), [id, variantId]);
  const vid = cmp.data?.variant?._id;
  const hist = useAsync(() => (vid ? api(`/products/${id}/price-history?variantId=${vid}`) : Promise.resolve(null)), [id, vid]);

  if (cmp.loading && !cmp.data) return <Loading text="Loading comparison" />;
  if (cmp.error) return <ErrorBox message={cmp.error.status === 404 ? 'This product could not be found. It may have been removed.' : cmp.error.message} onRetry={cmp.reload} />;
  const c = cmp.data;
  const p = c.product;

  return (
    <>
      <p className="small"><Link to="/">Back to products</Link></p>
      <header className="phead">
        <div className="pimg big">{p.imageUrl ? <img src={p.imageUrl} alt={p.name} /> : <span>{p.brand[0]}</span>}</div>
        <div>
          <p className="muted small">{label(p.category)}</p>
          <h1>{p.name}</h1>
          <p>Brand {p.brand}, model {p.model}</p>
          {p.description && <p className="muted">{p.description}</p>}
        </div>
      </header>

      <section>
        <h2>Compare offers</h2>
        {c.variants.length > 1 && (
          <div className="variants" role="group" aria-label="Choose a variant">
            {c.variants.map((v) => (
              <button key={v._id} className={`chip ${v._id === c.variant._id ? 'on' : ''}`} aria-pressed={v._id === c.variant._id} onClick={() => setSp({ variant: v._id })}>{variantName(v)}</button>
            ))}
          </div>
        )}
        <p className="small muted">Only offers for this exact variant are compared. Different RAM, storage, color or region are separate variants.</p>
        <CompareTable cmp={c} />
      </section>

      <section>
        <h2>Price history</h2>
        {hist.loading && <Loading text="Loading price history" />}
        {hist.error && <ErrorBox message={hist.error.message} onRetry={hist.reload} />}
        {hist.data && (hist.data.series.length ? <PriceChart series={hist.data.series} /> : <Empty title="No price history recorded for this variant yet" />)}
      </section>

      <section>
        {user
          ? <LoggedInPanel product={p} variant={c.variant} lowestTotal={c.lowestTotal} />
          : <div className="panel"><h2>Track this product</h2><p>Log in to add this product to your watchlist and set a target price.</p><Link className="btn" to="/login" state={{ from: loc.pathname + loc.search }}>Log in</Link></div>}
      </section>
    </>
  );
}
