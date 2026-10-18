import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../api';
import { useAsync } from '../hooks';
import { label } from '../format';
import ProductCard from '../components/ProductCard';
import Pagination from '../components/Pagination';
import { Loading, ErrorBox, Empty } from '../components/ui';

export default function Home() {
  const [sp, setSp] = useSearchParams();
  const params = Object.fromEntries(sp);
  const page = Number(params.page || 1);
  const qs = new URLSearchParams({ ...params, page: String(page), limit: '12' }).toString();

  const list = useAsync(() => api('/products?' + qs), [qs]);
  const meta = useAsync(() => api('/products/meta/filters'), []);
  const [f, setF] = useState({ q: params.q || '', category: params.category || '', brand: params.brand || '', minPrice: params.minPrice || '', maxPrice: params.maxPrice || '', sort: params.sort || 'newest' });
  const [formError, setFormError] = useState('');
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const apply = (e) => {
    e.preventDefault();
    const min = f.minPrice === '' ? null : Number(f.minPrice);
    const max = f.maxPrice === '' ? null : Number(f.maxPrice);
    if ((min !== null && (Number.isNaN(min) || min < 0)) || (max !== null && (Number.isNaN(max) || max < 0))) return setFormError('Prices must be positive numbers.');
    if (min !== null && max !== null && min > max) return setFormError('Minimum price cannot be higher than maximum price.');
    setFormError('');
    const next = {};
    Object.entries(f).forEach(([k, v]) => { if (v !== '' && !(k === 'sort' && v === 'newest')) next[k] = v.trim ? v.trim() : v; });
    setSp(next);
  };
  const reset = () => { setF({ q: '', category: '', brand: '', minPrice: '', maxPrice: '', sort: 'newest' }); setFormError(''); setSp({}); };

  return (
    <>
      <section className="intro">
        <h1>Find the lowest total price, not just the lowest sticker price.</h1>
        <p>PricePulse compares the same product variant across stores and tells you when shipping is unknown instead of guessing.</p>
        <form className="searchbar" onSubmit={apply} role="search">
          <label className="sr" htmlFor="q">Search by name, brand or model</label>
          <input id="q" value={f.q} onChange={set('q')} placeholder="Search by name, brand or model" maxLength={100} />
          <button className="btn" type="submit">Search</button>
        </form>
      </section>

      <div className="layout">
        <details className="filters" open>
          <summary>Filters and sorting</summary>
          <form onSubmit={apply}>
            <label>Category
              <select value={f.category} onChange={set('category')}>
                <option value="">All categories</option>
                {meta.data?.categories.map((c) => <option key={c} value={c}>{label(c)}</option>)}
              </select>
            </label>
            <label>Brand
              <select value={f.brand} onChange={set('brand')}>
                <option value="">All brands</option>
                {meta.data?.brands.map((b) => <option key={b}>{b}</option>)}
              </select>
            </label>
            <div className="two">
              <label>Min price (₹)<input type="number" min="0" inputMode="numeric" value={f.minPrice} onChange={set('minPrice')} /></label>
              <label>Max price (₹)<input type="number" min="0" inputMode="numeric" value={f.maxPrice} onChange={set('maxPrice')} /></label>
            </div>
            <label>Sort by
              <select value={f.sort} onChange={set('sort')}>
                <option value="newest">Newest additions</option>
                <option value="price_asc">Lowest price</option>
                <option value="price_desc">Highest price</option>
              </select>
            </label>
            {formError && <p className="msg error" role="alert">{formError}</p>}
            <div className="row"><button className="btn" type="submit">Apply filters</button><button className="btn ghost" type="button" onClick={reset}>Clear all</button></div>
          </form>
        </details>

        <section aria-live="polite">
          {list.loading && !list.data && <Loading text="Loading products" />}
          {list.error && <ErrorBox message={list.error.message} onRetry={list.reload} />}
          {list.data && (
            <>
              <p className="muted small">{list.data.total} product{list.data.total === 1 ? '' : 's'} found</p>
              {list.data.data.length === 0 ? (
                <Empty title="No products match these filters">Try a different search term, widen the price range, or <button className="link" onClick={reset}>clear all filters</button>.</Empty>
              ) : (
                <div className="grid">{list.data.data.map((p) => <ProductCard key={p._id} p={p} />)}</div>
              )}
              <Pagination page={list.data.page} totalPages={list.data.totalPages} onPage={(p) => { setSp({ ...params, page: String(p) }); window.scrollTo({ top: 0 }); }} />
            </>
          )}
        </section>
      </div>
    </>
  );
}
