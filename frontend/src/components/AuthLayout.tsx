import type { ReactNode } from "react";

export function AuthLayout({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="auth-shell">
      <div className="auth-card">
        <header className="auth-header">
          <h1 className="brand">Aussie EcoLens</h1>
          <h2 className="page-title">{title}</h2>
        </header>
        {children}
      </div>
    </div>
  );
}
