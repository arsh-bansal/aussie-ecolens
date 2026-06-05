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

  return (
    <>
      <header className="topbar">
        <div>
          <div className="page-title">Profile</div>
          <div className="page-sub">Manage your account details</div>
        </div>
      </header>

      <div className="page" style={{ maxWidth: '680px' }}>
        {/* Identity card */}
        <div className="panel" style={{ marginBottom: '22px' }}>
          <div className="panel-body" style={{ display: 'flex', alignItems: 'center', gap: '20px', padding: '22px 24px' }}>
            <div style={{
              width: '60px', height: '60px', borderRadius: '50%', flexShrink: 0,
              background: 'var(--ochre-tint)', color: 'var(--ochre)',
              display: 'grid', placeItems: 'center',
              fontSize: '22px', fontWeight: 700, fontFamily: 'var(--font-serif)',
            }}>
              {initials}
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: '17px' }}>
                {[user?.given_name, user?.family_name].filter(Boolean).join(' ') || 'Observer'}
              </div>
              <div style={{ fontSize: '13.5px', color: 'var(--ink-soft)', marginTop: '3px', fontFamily: 'var(--font-mono)' }}>
                {user?.email}
              </div>
              <span className="badge badge-euc" style={{ marginTop: '8px', display: 'inline-flex' }}>Observer</span>
            </div>
          </div>
        </div>

        {/* Update name */}
        <div className="panel" style={{ marginBottom: '20px' }}>
          <div className="panel-head"><h3>Display name</h3></div>
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
        <div className="panel" style={{ marginBottom: '20px' }}>
          <div className="panel-head"><h3>Email address</h3></div>
          <div style={{ padding: '18px 24px' }}>
            <div className="field">
              <label>Email</label>
              <input className="input" type="email" value={user?.email ?? ''} readOnly style={{ opacity: 0.6, cursor: 'not-allowed' }} />
            </div>
            <p style={{ fontSize: '12.5px', color: 'var(--ink-faint)', marginTop: '8px' }}>
              Email is tied to your Cognito identity and cannot be changed here.
            </p>
          </div>
        </div>

        {/* Change password */}
        <div className="panel">
          <div className="panel-head"><h3>Change password</h3></div>
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
            <div>
              <button className="btn btn-primary" type="submit" disabled={savingPw || !pwForm.current || !pwForm.next || !pwForm.confirm}>
                {savingPw ? 'Changing…' : 'Change password'}
              </button>
            </div>
            <p style={{ fontSize: '12.5px', color: 'var(--ink-faint)', margin: 0 }}>
              You will be signed out after a successful password change.
            </p>
          </form>
        </div>
      </div>
    </>
  );
}
