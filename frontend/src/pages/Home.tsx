import { useAuth } from "../auth/useAuth";

export function Home() {
  const { user, signOut, getIdToken } = useAuth();
  const token = getIdToken();
  const preview = token ? `${token.slice(0, 32)}…${token.slice(-12)}` : "(no token)";

  return (
    <div className="app-shell">
      <header className="topbar">
        <h1 className="brand">Aussie EcoLens</h1>
        <div className="topbar-right">
          <span className="muted">{user?.email}</span>
          <button onClick={() => void signOut()} className="ghost">
            Sign out
          </button>
        </div>
      </header>
      <main className="content">
        <h2>Welcome, {user?.firstName || user?.email}.</h2>
        <p className="muted">
          You are logged in. This is the placeholder home page that Shaurya (P4)
          will replace with the upload + search UI.
        </p>

        <section className="card">
          <h3>Your session</h3>
          <dl className="kv">
            <dt>Email</dt>
            <dd>{user?.email}</dd>
            <dt>Name</dt>
            <dd>
              {user?.firstName} {user?.lastName}
            </dd>
            <dt>User sub</dt>
            <dd>
              <code>{user?.sub}</code>
            </dd>
            <dt>ID token (preview)</dt>
            <dd>
              <code className="token">{preview}</code>
            </dd>
          </dl>
          <p className="muted small">
            P4 attaches <code>Authorization: Bearer &lt;ID token&gt;</code> to every
            API call. The full token is available via{" "}
            <code>useAuth().getIdToken()</code>.
          </p>
        </section>
      </main>
    </div>
  );
}
