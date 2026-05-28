import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/useAuth";
import { AuthLayout } from "../components/AuthLayout";

export function ForgotPassword() {
  const { forgotPassword } = useAuth();
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await forgotPassword(email);
      nav(`/reset?email=${encodeURIComponent(email)}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start reset");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthLayout title="Forgot password">
      <p className="muted">We'll email you a code to reset your password.</p>
      <form onSubmit={handleSubmit} className="auth-form">
        <label>
          Email
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
          />
        </label>
        {error && <p className="error">{error}</p>}
        <button type="submit" disabled={submitting}>
          {submitting ? "Sending…" : "Send reset code"}
        </button>
        <p className="alt">
          <Link to="/login">Back to login</Link>
        </p>
      </form>
    </AuthLayout>
  );
}
