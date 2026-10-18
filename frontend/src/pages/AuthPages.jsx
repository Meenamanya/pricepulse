import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth';
import { Msg } from '../components/ui';

function useAuthForm(action) {
  const nav = useNavigate();
  const loc = useLocation();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const submit = async (e, validate, run) => {
    e.preventDefault();
    const problem = validate();
    if (problem) return setMsg({ type: 'error', text: problem });
    setBusy(true); setMsg(null);
    try { await run(); nav(loc.state?.from || '/', { replace: true }); }
    catch (err) { setMsg({ type: 'error', text: err.message }); }
    finally { setBusy(false); }
  };
  return { busy, msg, submit, action };
}

export function Login() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { busy, msg, submit } = useAuthForm();
  return (
    <form className="narrow panel" onSubmit={(e) => submit(e, () => (!email || !password ? 'Enter your email and password.' : ''), () => login(email.trim(), password))}>
      <h1>Log in</h1>
      <label>Email<input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></label>
      <label>Password<input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required /></label>
      <Msg m={msg} />
      <button className="btn" disabled={busy}>{busy ? 'Logging in' : 'Log in'}</button>
      <p className="small muted">New here? <Link to="/register">Create an account</Link></p>
    </form>
  );
}

export function Register() {
  const { register } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { busy, msg, submit } = useAuthForm();
  const check = () => {
    if (name.trim().length < 2) return 'Enter your name (at least 2 characters).';
    if (password.length < 8 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) return 'Password needs at least 8 characters, including a letter and a number.';
    return '';
  };
  return (
    <form className="narrow panel" onSubmit={(e) => submit(e, check, () => register(name.trim(), email.trim(), password))}>
      <h1>Create account</h1>
      <label>Name<input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" required maxLength={80} /></label>
      <label>Email<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required /></label>
      <label>Password<input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" required /></label>
      <p className="small muted">At least 8 characters, with a letter and a number.</p>
      <Msg m={msg} />
      <button className="btn" disabled={busy}>{busy ? 'Creating account' : 'Create account'}</button>
      <p className="small muted">Already registered? <Link to="/login">Log in</Link></p>
    </form>
  );
}
