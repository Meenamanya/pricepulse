export const Loading = ({ text = 'Loading' }) => <div className="state" role="status"><span className="spinner" aria-hidden="true" />{text}</div>;
export const Empty = ({ title, children }) => <div className="state"><h3>{title}</h3>{children && <p>{children}</p>}</div>;
export const ErrorBox = ({ message, onRetry }) => (
  <div className="state error" role="alert">
    <h3>Something went wrong</h3>
    <p>{message}</p>
    {onRetry && <button className="btn" onClick={onRetry}>Try again</button>}
  </div>
);
export const Msg = ({ m }) => (m ? <p className={`msg ${m.type}`} role={m.type === 'error' ? 'alert' : 'status'}>{m.text}</p> : null);
