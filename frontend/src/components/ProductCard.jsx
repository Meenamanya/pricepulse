import { Link } from 'react-router-dom';
import { money, label } from '../format';

export default function ProductCard({ p }) {
  return (
    <article className="pcard">
      <div className="pimg">{p.imageUrl ? <img src={p.imageUrl} alt={p.name} loading="lazy" /> : <span>{p.brand[0]}</span>}</div>
      <div className="pbody">
        <p className="muted small">{label(p.category)}</p>
        <h3><Link to={`/products/${p._id}`}>{p.name}</Link></h3>
        <p className="small">Brand {p.brand}, model {p.model}</p>
        <p className="pprice">
          {p.hasPrice ? <>From <strong>{money(p.startingPrice)}</strong></> : <span className="muted">Comparable price not available yet</span>}
        </p>
        <p className="small muted">{p.availableOfferCount} offer{p.availableOfferCount === 1 ? '' : 's'} in stock</p>
        <Link className="btn block" to={`/products/${p._id}`}>Compare offers</Link>
      </div>
    </article>
  );
}
