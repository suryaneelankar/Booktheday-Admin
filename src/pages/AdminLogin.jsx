import { useState } from 'react';
import { Navigate } from 'react-router-dom';

import { useAdminAuth } from '../context/AdminAuthContext';
import { getApiError } from '../api/adminApi';

export default function AdminLogin() {
  const { login, status } = useAdminAuth();

  const [mobileNumber, setMobileNumber] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  if (status === 'authenticated') {
    return <Navigate to="/dashboard" replace />;
  }

  const handleSubmit = async event => {
    event.preventDefault();

    if (isSubmitting) return;

    setError('');

    if (!/^[6-9]\d{9}$/.test(mobileNumber)) {
      setError('Enter a valid 10-digit Indian mobile number.');
      return;
    }

    if (!password) {
      setError('Enter your password.');
      return;
    }

    setIsSubmitting(true);

    try {
      await login(mobileNumber, password);
    } catch (loginError) {
      setError(
        getApiError(
          loginError,
          'Unable to sign in. Please try again.',
        ),
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="login-page">
      <section className="brand-panel">
        <div className="brand brand-light">
          <span className="brand-mark" aria-hidden="true">B</span>
          <span>BookTheDay</span>
        </div>

        <div className="brand-copy">
          <span className="eyebrow">ADMIN WORKSPACE</span>
          <h1>Behind every<br />special day.</h1>
          <p>
            Your workspace for managing venues and keeping
            BookTheDay’s information up to date.
          </p>
        </div>

        <div className="brand-footer">
          <span className="accent-line" />
          Hyderabad · Venue operations
        </div>
      </section>

      <section className="login-panel" aria-labelledby="login-title">
        <div className="login-card">
          <span className="section-label">BOOKTHEDAY ADMIN</span>

          <h2 id="login-title">Welcome back</h2>

          <p className="muted">
            Sign in with your registered admin mobile number.
          </p>

          <form onSubmit={handleSubmit} aria-busy={isSubmitting}>
            <div className="field">
              <label htmlFor="mobileNumber">Mobile number</label>

              <div className="phone-input">
                <span className="country-prefix">+91</span>

                <input
                  id="mobileNumber"
                  name="mobileNumber"
                  type="tel"
                  inputMode="numeric"
                  autoComplete="username"
                  maxLength={10}
                  value={mobileNumber}
                  placeholder="10-digit mobile number"
                  required
                  disabled={isSubmitting}
                  onChange={event => {
                    setMobileNumber(
                      event.target.value.replace(/\D/g, '').slice(0, 10),
                    );
                  }}
                  aria-describedby={error ? 'login-error' : undefined}
                />
              </div>
            </div>

            <div className="field">
              <label htmlFor="password">Password</label>

              <div className="password-input">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={password}
                  placeholder="Enter your password"
                  required
                  disabled={isSubmitting}
                  onChange={event => setPassword(event.target.value)}
                  aria-describedby={error ? 'login-error' : undefined}
                />

                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setShowPassword(current => !current)}
                  disabled={isSubmitting}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  aria-pressed={showPassword}
                >
                  {showPassword ? 'Hide' : 'Show'}
                </button>
              </div>
            </div>

            {error && (
              <div id="login-error" className="error-message" role="alert">
                {error}
              </div>
            )}

            <button
              className="primary-button login-submit"
              type="submit"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Signing in…' : 'Sign in to dashboard'}
              {!isSubmitting && <span aria-hidden="true">→</span>}
            </button>
          </form>

          <p className="access-note">
            Authorized administrators only. Public registration is
            not available.
          </p>
        </div>

        <footer className="login-footer">
          © {new Date().getFullYear()} BookTheDay
        </footer>
      </section>
    </main>
  );
}