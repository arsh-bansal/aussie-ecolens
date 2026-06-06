'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { updateUserAttributes, changePassword } from '@/lib/cognito';

export default function ProfilePage() {
  const { user, logout } = useAuth();
  const toast = useToast();

  const [nameForm, setNameForm] = useState({ firstName: '', lastName: '' });
  const [pwForm, setPwForm] = useState({ current: '', next: '', confirm: '' });
  const [savingName, setSavingName] = useState(false);
  const [savingPw, setSavingPw] = useState(false);

  useEffect(() => {
    if (user) {
      setNameForm({
        firstName: user.given_name ?? '',
        lastName: user.family_name ?? '',
      });
    }
  }, [user]);

  const handleName = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingName(true);
    try {
      await updateUserAttributes({
        given_name: nameForm.firstName.trim(),
        family_name: nameForm.lastName.trim(),
      });
      toast.success('Name updated.');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to update name');
    } finally {
      setSavingName(false);
    }
  };

  const handlePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pwForm.next !== pwForm.confirm) {
      toast.error('New passwords do not match.');
      return;
    }
    if (!/[A-Z]/.test(pwForm.next) || !/[0-9]/.test(pwForm.next) || pwForm.next.length < 8) {
      toast.error('New password must be 8+ chars with an uppercase letter and a number.');
      return;
    }
    setSavingPw(true);
    try {
      await changePassword(pwForm.current, pwForm.next);
      toast.success('Password changed. Please sign in again.');
      setPwForm({ current: '', next: '', confirm: '' });
      await logout();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to change password');
    } finally {
      setSavingPw(false);
    }
  };

  const initials = [user?.given_name, user?.family_name]
    .filter(Boolean)
    .map(s => s![0].toUpperCase())
    .join('') || user?.email[0].toUpperCase() || '?';

  const displayName = [user?.given_name, user?.family_name].filter(Boolean).join(' ') || 'Observer';

  return (
    <>
      <header className="topbar">
        <div>
          <div className="page-title">Profile</div>
          <div className="page-sub">Manage your account details</div>
        </div>
      </header>

      <div className="page">
        <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: '24px', alignItems: 'start' }}>

          {/* Left column — identity */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div className="panel">
              <div style={{ padding: '32px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', textAlign: 'center' }}>
                <div style={{
                  width: '80px', height: '80px', borderRadius: '50%', flexShrink: 0,
                  background: 'var(--ochre-tint)',
                  border: '3px solid var(--ochre)',
                  display: 'grid', placeItems: 'center',
                  fontSize: '28px', fontWeight: 700, fontFamily: 'var(--font-serif)',
                  color: 'var(--ochre)',
                }}>
                  {initials}
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '18px', lineHeight: 1.2 }}>{displayName}</div>
                  <div style={{ fontSize: '12.5px', color: 'var(--ink-faint)', marginTop: '5px', fontFamily: 'var(--font-mono)', wordBreak: 'break-all' }}>
                    {user?.email}
                  </div>
                </div>
                <span className="badge badge-euc" style={{ fontSize: '11px', padding: '3px 12px' }}>Observer</span>
              </div>
            </div>

            {/* Account info strip */}
            <div className="panel">
              <div className="panel-head"><h3>Account</h3></div>
              <div style={{ padding: '4px 0 8px' }}>
                {[
                  { label: 'Role', value: 'Observer' },
                  { label: 'Auth', value: 'AWS Cognito' },
                  { label: 'Region', value: 'ap-southeast-2' },
                ].map(({ label, value }) => (
                  <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 24px', borderBottom: '1px solid var(--line)' }}>
                    <span style={{ fontSize: '13px', color: 'var(--ink-soft)' }}>{label}</span>
                    <span style={{ fontSize: '12.5px', fontFamily: 'var(--font-mono)', color: 'var(--ink-faint)' }}>{value}</span>
                  </div>
                ))}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 24px' }}>
                  <span style={{ fontSize: '13px', color: 'var(--ink-soft)' }}>Project</span>
                  <span style={{ fontSize: '12.5px', fontFamily: 'var(--font-mono)', color: 'var(--ink-faint)' }}>Aussie EcoLens</span>
                </div>
              </div>
            </div>
          </div>

          {/* Right column — forms */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

            {/* Update name */}
            <div className="panel">
              <div className="panel-head">
                <h3>Display name</h3>
                <p style={{ margin: 0, fontSize: '13px', color: 'var(--ink-faint)' }}>This is how you appear across the observatory.</p>
              </div>
              <form onSubmit={handleName} style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                  <div className="field">
                    <label htmlFor="fn">First name</label>
                    <input
                      className="input" id="fn" type="text"
                      value={nameForm.firstName}
                      onChange={e => setNameForm(f => ({ ...f, firstName: e.target.value }))}
                      required
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="ln">Last name</label>
                    <input
                      className="input" id="ln" type="text"
                      value={nameForm.lastName}
                      onChange={e => setNameForm(f => ({ ...f, lastName: e.target.value }))}
                      required
                    />
                  </div>
                </div>
                <div>
                  <button className="btn btn-primary" type="submit" disabled={savingName}>
                    {savingName ? 'Saving…' : 'Save name'}
                  </button>
                </div>
              </form>
            </div>

            {/* Email (read-only) */}
            <div className="panel">
              <div className="panel-head">
                <h3>Email address</h3>
                <p style={{ margin: 0, fontSize: '13px', color: 'var(--ink-faint)' }}>Tied to your Cognito identity — cannot be changed here.</p>
              </div>
              <div style={{ padding: '18px 24px' }}>
                <div className="field">
                  <label>Email</label>
                  <input className="input" type="email" value={user?.email ?? ''} readOnly style={{ opacity: 0.55, cursor: 'not-allowed' }} />
                </div>
              </div>
            </div>

            {/* Change password */}
            <div className="panel">
              <div className="panel-head">
                <h3>Change password</h3>
                <p style={{ margin: 0, fontSize: '13px', color: 'var(--ink-faint)' }}>You will be signed out after a successful change.</p>
              </div>
              <form onSubmit={handlePassword} style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div className="field">
                  <label htmlFor="cpw">Current password</label>
                  <input
                    className="input" id="cpw" type="password"
                    placeholder="Enter current password"
                    value={pwForm.current}
                    onChange={e => setPwForm(f => ({ ...f, current: e.target.value }))}
                    required
                  />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                  <div className="field">
                    <label htmlFor="npw">New password</label>
                    <input
                      className="input" id="npw" type="password"
                      placeholder="8+ chars, uppercase, number"
                      value={pwForm.next}
                      onChange={e => setPwForm(f => ({ ...f, next: e.target.value }))}
                      required
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="cpw2">Confirm new password</label>
                    <input
                      className="input" id="cpw2" type="password"
                      placeholder="Repeat new password"
                      value={pwForm.confirm}
                      onChange={e => setPwForm(f => ({ ...f, confirm: e.target.value }))}
                      required
                    />
                  </div>
                </div>
                <div>
                  <button className="btn btn-primary" type="submit" disabled={savingPw || !pwForm.current || !pwForm.next || !pwForm.confirm}>
                    {savingPw ? 'Changing…' : 'Change password'}
                  </button>
                </div>
              </form>
            </div>

          </div>
        </div>
      </div>
    </>
  );
}
