import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { useAsync } from '../hooks';
import { money, when, label, variantName } from '../format';
import { Loading, ErrorBox, Empty, Msg } from '../components/ui';

const ATTRS = ['ram', 'storage', 'color', 'region'];
const num = (s) => (s === '' || s === null || s === undefined ? null : Number(s));
const bad = (n) => n !== null && (Number.isNaN(n) || n < 0);

function useAction() {
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);
  const run = async (fn, ok) => {
    setBusy(true); setMsg(null);
    try { const r = await fn(); setMsg({ type: 'ok', text: typeof ok === 'function' ? ok(r) : ok }); return r; }
    catch (e) { setMsg({ type: 'error', text: e.message }); }
    finally { setBusy(false); }
  };
  return { msg, setMsg, busy, run };
}

function Analytics() {
  const { data, loading, error, reload } = useAsync(() => api('/admin/analytics'), []);
  if (loading && !data) return <Loading />;
  if (error) return <ErrorBox message={error.message} onRetry={reload} />;
  const t = data.totals;
  const rows = [['Products (all)', t.products], ['Active products', t.activeProducts], ['Merchant offers (all)', t.offers], ['Active offers (in stock)', t.activeOffers], ['Unavailable offers (out of stock)', t.unavailableOffers], ['Deactivated offers', t.inactiveOffers], ['User targets reached', data.targetsReached.count]];
  return (
    <>
      <dl className="stats">{rows.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>
      <h3>Largest price differences between merchants</h3>
      <p className="small muted">Spread between the highest and lowest known total for the same variant, using in-stock offers with known shipping.</p>
      {data.largestPriceDifferences.length === 0 ? <Empty title="Not enough comparable offers yet" /> : (
        <div className="tablewrap"><table className="plain"><thead><tr><th>Product</th><th>Variant</th><th className="num">Lowest</th><th className="num">Highest</th><th className="num">Difference</th></tr></thead>
          <tbody>{data.largestPriceDifferences.map((r) => (
            <tr key={String(r.productId) + r.variantLabel}><td><Link to={`/products/${r.productId}`}>{r.productName}</Link></td><td>{r.variantLabel || variantName({ attributes: r.variantAttributes })}</td><td className="num">{money(r.min)}</td><td className="num">{money(r.max)}</td><td className="num"><strong>{money(r.difference)}</strong></td></tr>
          ))}</tbody></table></div>
      )}
      <h3>Products whose price reached a user target</h3>
      {data.targetsReached.items.length === 0 ? <Empty title="No targets reached yet" /> : (
        <div className="tablewrap"><table className="plain"><thead><tr><th>Product</th><th>User</th><th className="num">Target</th><th className="num">Current</th><th>Reached</th></tr></thead>
          <tbody>{data.targetsReached.items.map((a) => (
            <tr key={a.alertId}><td>{a.product}</td><td>{a.user}</td><td className="num">{money(a.targetPrice)}</td><td className="num">{money(a.currentPrice)}</td><td className="small">{when(a.triggeredAt)}</td></tr>
          ))}</tbody></table></div>
      )}
    </>
  );
}

function ProductEdit({ product, categories, onSaved, onDeactivated }) {
  const [f, setF] = useState({ name: product.name, brand: product.brand, model: product.model, category: product.category, description: product.description || '', imageUrl: product.imageUrl || '', isActive: product.isActive });
  const { msg, setMsg, busy, run } = useAction();
  const set = (k) => (e) => setF({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });
  const submit = async (e) => {
    e.preventDefault();
    if (f.name.trim().length < 2 || !f.brand.trim() || !f.model.trim()) return setMsg({ type: 'error', text: 'Name, brand and model are required.' });
    const r = await run(() => api(`/products/${product._id}`, { method: 'PUT', body: { ...f, name: f.name.trim(), brand: f.brand.trim(), model: f.model.trim() } }), 'Product saved.');
    if (r) (f.isActive ? onSaved : onDeactivated)();
  };
  return (
    <form className="panel grid2" onSubmit={submit}>
      <h3 className="span2">Product details</h3>
      <label>Name<input value={f.name} onChange={set('name')} /></label>
      <label>Category<select value={f.category} onChange={set('category')}>{categories.map((c) => <option key={c} value={c}>{label(c)}</option>)}</select></label>
      <label>Brand<input value={f.brand} onChange={set('brand')} /></label>
      <label>Model<input value={f.model} onChange={set('model')} /></label>
      <label className="span2">Image URL<input value={f.imageUrl} onChange={set('imageUrl')} placeholder="https://" /></label>
      <label className="span2">Description<textarea rows="2" value={f.description} onChange={set('description')} /></label>
      <label className="check span2"><input type="checkbox" checked={f.isActive} onChange={set('isActive')} /> Product is active. Clear this and save to deactivate it and hide it from shoppers.</label>
      <div className="span2"><button className="btn" disabled={busy}>Save product</button><Msg m={msg} /></div>
    </form>
  );
}

function OfferRow({ o, onSaved }) {
  const [price, setPrice] = useState(String(o.price));
  const [shipping, setShipping] = useState(o.shipping === null ? '' : String(o.shipping));
  const [avail, setAvail] = useState(o.availability);
  const { msg, setMsg, busy, run } = useAction();
  const save = async (extra = {}) => {
    const p = Number(price); const s = num(shipping);
    if (!(p > 0) || bad(s)) return setMsg({ type: 'error', text: 'Price must be above zero. Shipping must be zero or more, or blank for unknown.' });
    const changes = { ...extra };
    if (p !== o.price) changes.price = p;
    if (s !== o.shipping) changes.shipping = s;
    if (avail !== o.availability) changes.availability = avail;
    if (!Object.keys(changes).length) return setMsg({ type: 'error', text: 'Nothing changed.' });
    const r = await run(() => api(`/offers/${o._id}`, { method: 'PUT', body: changes }), 'Saved. A history record was added where price, shipping or stock changed.');
    if (r) onSaved();
  };
  return (
    <tr>
      <td>{o.merchant?.name}<div className="small muted">Updated {when(o.lastUpdatedAt)}</div></td>
      <td><input aria-label="Price" className="sm" type="number" min="1" value={price} onChange={(e) => setPrice(e.target.value)} /></td>
      <td><input aria-label="Shipping, blank for unknown" className="sm" type="number" min="0" value={shipping} onChange={(e) => setShipping(e.target.value)} placeholder="Unknown" /></td>
      <td><select aria-label="Availability" value={avail} onChange={(e) => setAvail(e.target.value)}><option value="in_stock">In stock</option><option value="out_of_stock">Out of stock</option></select></td>
      <td className="nowrap">
        <button className="btn small-btn" disabled={busy} onClick={() => save()}>Save</button>{' '}
        <button className="btn ghost small-btn" disabled={busy} onClick={() => window.confirm(`Deactivate the ${o.merchant?.name} offer? It will be hidden from shoppers.`) && save({ isActive: false })}>Deactivate</button>
        <Msg m={msg} />
      </td>
    </tr>
  );
}

function RecordPrice({ offers, onSaved }) {
  const [offerId, setOfferId] = useState('');
  const [f, setF] = useState({ price: '', shipping: '', unknown: false, availability: '', recordedAt: '' });
  const { msg, setMsg, busy, run } = useAction();
  const set = (k) => (e) => setF({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });
  const submit = async (e) => {
    e.preventDefault();
    const id = offerId || offers[0]?._id;
    const price = Number(f.price); const s = num(f.shipping);
    if (!id) return setMsg({ type: 'error', text: 'Choose an offer.' });
    if (!(price > 0) || bad(s)) return setMsg({ type: 'error', text: 'Enter a price above zero. Shipping must be zero or more.' });
    const body = { price };
    if (f.unknown) body.shipping = null; else if (s !== null) body.shipping = s;
    if (f.availability) body.availability = f.availability;
    if (f.recordedAt) body.recordedAt = new Date(f.recordedAt).toISOString();
    const r = await run(() => api(`/offers/${id}/price-history`, { method: 'POST', body }), (res) => (res.appliedAsCurrent ? 'Recorded and applied as the current price. Comparisons and alerts were re-evaluated.' : 'Recorded as an earlier historical point. The current price is unchanged.'));
    if (r) { setF({ price: '', shipping: '', unknown: false, availability: '', recordedAt: '' }); onSaved(); }
  };
  if (!offers.length) return null;
  return (
    <form className="panel grid2" onSubmit={submit}>
      <h3 className="span2">Record a price</h3>
      <label>Offer<select value={offerId} onChange={(e) => setOfferId(e.target.value)}>{offers.map((o) => <option key={o._id} value={o._id}>{o.merchant?.name}</option>)}</select></label>
      <label>Price (₹)<input type="number" min="1" value={f.price} onChange={set('price')} /></label>
      <label>Shipping (₹), blank keeps current<input type="number" min="0" value={f.shipping} onChange={set('shipping')} disabled={f.unknown} /></label>
      <label className="check"><input type="checkbox" checked={f.unknown} onChange={set('unknown')} /> Shipping is unknown</label>
      <label>Availability<select value={f.availability} onChange={set('availability')}><option value="">Keep current</option><option value="in_stock">In stock</option><option value="out_of_stock">Out of stock</option></select></label>
      <label>Recorded at, blank means now<input type="datetime-local" value={f.recordedAt} onChange={set('recordedAt')} /></label>
      <p className="small muted span2">A date earlier than the offer's latest update is added to history only. Otherwise it becomes the current price.</p>
      <div className="span2"><button className="btn" disabled={busy}>Record price</button><Msg m={msg} /></div>
    </form>
  );
}

function AddOffer({ pid, vid, merchants, onSaved }) {
  const [f, setF] = useState({ merchantId: '', price: '', shipping: '', availability: 'in_stock', url: '' });
  const { msg, setMsg, busy, run } = useAction();
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const m = merchants.find((x) => x._id === (f.merchantId || merchants[0]?._id));
  const submit = async (e) => {
    e.preventDefault();
    const price = Number(f.price); const s = num(f.shipping);
    if (!m) return setMsg({ type: 'error', text: 'Choose a merchant.' });
    if (!(price > 0) || bad(s)) return setMsg({ type: 'error', text: 'Enter a price above zero. Shipping must be zero or more, or blank for unknown.' });
    if (!/^https?:\/\//i.test(f.url)) return setMsg({ type: 'error', text: 'Enter a full product URL starting with https://' });
    const r = await run(() => api(`/products/${pid}/offers`, { method: 'POST', body: { variantId: vid, merchantId: m._id, price, shipping: s, availability: f.availability, url: f.url.trim() } }), 'Offer added.');
    if (r) { setF({ ...f, price: '', shipping: '', url: '' }); onSaved(); }
  };
  return (
    <form className="panel grid2" onSubmit={submit}>
      <h3 className="span2">Add a merchant offer</h3>
      <label>Merchant<select value={f.merchantId || m?._id || ''} onChange={set('merchantId')}>{merchants.map((x) => <option key={x._id} value={x._id}>{x.name}</option>)}</select></label>
      <label>Availability<select value={f.availability} onChange={set('availability')}><option value="in_stock">In stock</option><option value="out_of_stock">Out of stock</option></select></label>
      <label>Listed price (₹)<input type="number" min="1" value={f.price} onChange={set('price')} /></label>
      <label>Shipping (₹), blank means unknown<input type="number" min="0" value={f.shipping} onChange={set('shipping')} /></label>
      <label className="span2">Product URL{m && <span className="small muted"> (must be on {m.domain})</span>}<input value={f.url} onChange={set('url')} placeholder="https://" /></label>
      <div className="span2"><button className="btn" disabled={busy}>Add offer</button><Msg m={msg} /></div>
    </form>
  );
}

function AddVariant({ pid, onSaved }) {
  const [a, setA] = useState({});
  const { msg, run, busy } = useAction();
  const submit = async (e) => {
    e.preventDefault();
    const attributes = Object.fromEntries(Object.entries(a).filter(([, v]) => v && v.trim()).map(([k, v]) => [k, v.trim()]));
    const r = await run(() => api(`/products/${pid}/variants`, { method: 'POST', body: { attributes } }), 'Variant added.');
    if (r) { setA({}); onSaved(); }
  };
  return (
    <form className="panel grid2" onSubmit={submit}>
      <h3 className="span2">Add a variant</h3>
      {ATTRS.map((k) => <label key={k}>{label(k)}<input value={a[k] || ''} onChange={(e) => setA({ ...a, [k]: e.target.value })} /></label>)}
      <div className="span2"><button className="btn" disabled={busy}>Add variant</button><Msg m={msg} /></div>
    </form>
  );
}

function Manage({ categories }) {
  const products = useAsync(() => api('/products?limit=50&sort=newest'), []);
  const merchants = useAsync(() => api('/merchants'), []);
  const [pid, setPid] = useState('');
  const [vid, setVid] = useState('');
  const detail = useAsync(() => (pid ? api(`/products/${pid}`) : Promise.resolve(null)), [pid]);
  const cmp = useAsync(() => (pid && vid ? api(`/products/${pid}/compare?variantId=${vid}`) : Promise.resolve(null)), [pid, vid]);

  useEffect(() => {
    const vs = detail.data?.variants || [];
    if (vs.length && !vs.some((v) => v._id === vid)) setVid(vs[0]._id);
  }, [detail.data]); 

  if (products.loading && !products.data) return <Loading />;
  if (products.error) return <ErrorBox message={products.error.message} onRetry={products.reload} />;
  const refresh = () => { cmp.reload(); products.reload(); };

  return (
    <>
      <label className="pick">Choose a product to manage
        <select value={pid} onChange={(e) => { setPid(e.target.value); setVid(''); }}>
          <option value="">Select a product</option>
          {products.data.data.map((p) => <option key={p._id} value={p._id}>{p.name}</option>)}
        </select>
      </label>
      {!pid && <Empty title="Select a product to edit it and manage its offers" />}
      {pid && detail.loading && !detail.data && <Loading />}
      {pid && detail.error && <ErrorBox message={detail.error.message} onRetry={detail.reload} />}
      {detail.data && (
        <>
          <ProductEdit key={detail.data.product._id + detail.data.product.updatedAt} product={detail.data.product} categories={categories} onSaved={() => { detail.reload(); products.reload(); }} onDeactivated={() => { setPid(''); products.reload(); }} />
          <AddVariant pid={pid} onSaved={detail.reload} />
          <h3>Offers</h3>
          <label className="pick">Variant
            <select value={vid} onChange={(e) => setVid(e.target.value)}>{detail.data.variants.map((v) => <option key={v._id} value={v._id}>{variantName(v)}</option>)}</select>
          </label>
          {cmp.loading && !cmp.data && <Loading />}
          {cmp.error && <ErrorBox message={cmp.error.message} onRetry={cmp.reload} />}
          {cmp.data && (
            <>
              {cmp.data.offers.length === 0 ? <Empty title="No active offers for this variant" /> : (
                <div className="tablewrap"><table className="plain"><thead><tr><th>Merchant</th><th>Price (₹)</th><th>Shipping (₹)</th><th>Availability</th><th><span className="sr">Actions</span></th></tr></thead>
                  <tbody>{cmp.data.offers.map((o) => <OfferRow key={o._id + o.lastUpdatedAt} o={o} onSaved={refresh} />)}</tbody></table></div>
              )}
              <p className="small muted">Deactivated offers are hidden from shoppers and no longer appear here.</p>
              <RecordPrice offers={cmp.data.offers} onSaved={refresh} />
              {merchants.data && <AddOffer pid={pid} vid={vid} merchants={merchants.data.merchants} onSaved={refresh} />}
            </>
          )}
        </>
      )}
    </>
  );
}

function NewProduct({ categories }) {
  const blank = { name: '', brand: '', model: '', category: categories[0] || 'smartphones', description: '', imageUrl: '' };
  const [f, setF] = useState(blank);
  const [vs, setVs] = useState([{}]);
  const [created, setCreated] = useState(null);
  const { msg, setMsg, busy, run } = useAction();
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const submit = async (e) => {
    e.preventDefault();
    if (f.name.trim().length < 2 || !f.brand.trim() || !f.model.trim()) return setMsg({ type: 'error', text: 'Name, brand and model are required.' });
    const variants = vs.map((v) => ({ attributes: Object.fromEntries(Object.entries(v).filter(([, x]) => x && x.trim()).map(([k, x]) => [k, x.trim()])) }));
    const body = { ...f, name: f.name.trim(), brand: f.brand.trim(), model: f.model.trim(), variants };
    if (!body.imageUrl) delete body.imageUrl;
    const r = await run(() => api('/products', { method: 'POST', body }), 'Product created.');
    if (r) { setCreated(r.product); setF(blank); setVs([{}]); }
  };
  return (
    <form className="panel grid2" onSubmit={submit}>
      <h3 className="span2">New canonical product</h3>
      <label>Name<input value={f.name} onChange={set('name')} /></label>
      <label>Category<select value={f.category} onChange={set('category')}>{categories.map((c) => <option key={c} value={c}>{label(c)}</option>)}</select></label>
      <label>Brand<input value={f.brand} onChange={set('brand')} /></label>
      <label>Model<input value={f.model} onChange={set('model')} /></label>
      <label className="span2">Image URL, optional<input value={f.imageUrl} onChange={set('imageUrl')} placeholder="https://" /></label>
      <label className="span2">Description, optional<textarea rows="2" value={f.description} onChange={set('description')} /></label>
      <h4 className="span2">Variants</h4>
      {vs.map((v, i) => (
        <div className="span2 vrow" key={i}>
          {ATTRS.map((k) => <label key={k}>{label(k)}<input value={v[k] || ''} onChange={(e) => setVs(vs.map((x, j) => (j === i ? { ...x, [k]: e.target.value } : x)))} /></label>)}
          {vs.length > 1 && <button type="button" className="btn ghost small-btn" onClick={() => setVs(vs.filter((_, j) => j !== i))}>Remove variant</button>}
        </div>
      ))}
      <div className="span2"><button type="button" className="btn ghost" onClick={() => setVs([...vs, {}])}>Add another variant</button></div>
      <div className="span2"><button className="btn" disabled={busy}>Create product</button><Msg m={msg} />
        {created && <p><Link to={`/products/${created._id}`}>Open {created.name}</Link>. Add offers from the Products and offers tab.</p>}</div>
    </form>
  );
}

export default function Admin() {
  const [tab, setTab] = useState('analytics');
  const meta = useAsync(() => api('/products/meta/filters'), []);
  const tabs = [['analytics', 'Analytics'], ['manage', 'Products and offers'], ['new', 'New product']];
  return (
    <>
      <h1>Admin dashboard</h1>
      <div className="tabs" role="tablist">
        {tabs.map(([k, t]) => <button key={k} role="tab" aria-selected={tab === k} className={`tab ${tab === k ? 'on' : ''}`} onClick={() => setTab(k)}>{t}</button>)}
      </div>
      {tab === 'analytics' && <Analytics />}
      {meta.error && <ErrorBox message={meta.error.message} onRetry={meta.reload} />}
      {meta.data && tab === 'manage' && <Manage categories={meta.data.categories} />}
      {meta.data && tab === 'new' && <NewProduct categories={meta.data.categories} />}
    </>
  );
}
