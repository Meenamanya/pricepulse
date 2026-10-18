import { Routes, Route, Navigate, useLocation, Link } from 'react-router-dom';
import Navbar from './components/Navbar';
import { Loading, ErrorBox } from './components/ui';
import { useAuth } from './auth';
import Home from './pages/Home';
import Product from './pages/Product';
import { Login, Register } from './pages/AuthPages';
import Watchlist from './pages/Watchlist';
import Admin from './pages/Admin';

function Protected({ children, admin }) {
  const { user, ready } = useAuth();
  const loc = useLocation();
  if (!ready) return <Loading />;
  if (!user) return <Navigate to="/login" state={{ from: loc.pathname + loc.search }} replace />;
  if (admin && user.role !== 'admin') return <ErrorBox message="This page needs an administrator account." />;
  return children;
}

export default function App() {
  return (
    <>
      <a className="skip" href="#main">Skip to content</a>
      <Navbar />
      <main id="main" className="page">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/products/:id" element={<Product />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/watchlist" element={<Protected><Watchlist /></Protected>} />
          <Route path="/admin" element={<Protected admin><Admin /></Protected>} />
          <Route path="*" element={<div className="state"><h2>Page not found</h2><p><Link to="/">Back to products</Link></p></div>} />
        </Routes>
      </main>
      <footer className="foot">Prices on PricePulse are seeded sample data for demonstration. They are not live market prices, and PricePulse does not sell products.</footer>
    </>
  );
}
