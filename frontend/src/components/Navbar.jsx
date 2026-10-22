import { useEffect, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth';
import { api } from '../api';

export default function Navbar() {
  const { user, logout } = useAuth();
  const nav = useNavigate();
  const loc = useLocation();
  const [reached, setReached] = useState(0);

  
  useEffect(() => {
    if (!user) { setReached(0); return; }
    api('/alerts').then((r) => setReached(r.data.filter((a) => a.status === 'reached').length)).catch(() => {});
  }, [user, loc.pathname]);

  return (
    <header className="nav">
      <Link to="/" className="brand" aria-label="PricePulse home">
        <svg width="26" height="18" viewBox="0 0 26 18" aria-hidden="true"><polyline points="1,10 7,10 10,3 14,16 17,8 19,10 25,10" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
        PricePulse
      </Link>
      <nav className="links" aria-label="Main">
        <NavLink to="/" end>Browse</NavLink>
        {user && <NavLink to="/watchlist">Watchlist{reached > 0 && <span className="badge">{reached} target{reached > 1 ? 's' : ''} reached</span>}</NavLink>}
        {user?.role === 'admin' && <NavLink to="/admin">Admin</NavLink>}
      </nav>
      <div className="who">
        {user ? (
          <>
            <span className="muted">{user.email}</span>
            <button className="btn ghost" onClick={() => { logout(); nav('/'); }}>Log out</button>
          </>
        ) : (
          <>
            <Link className="btn ghost" to="/login">Log in</Link>
            <Link className="btn" to="/register">Create account</Link>
          </>
        )}
      </div>
    </header>
  );
}
