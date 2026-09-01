import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import adminApi, { getApiError } from '../api/adminApi';
import { useAdminAuth } from '../context/AdminAuthContext';
import '../styles/vendors.css';

function createTemporaryPassword() {
  const bytes = new Uint32Array(3);
  window.crypto.getRandomValues(bytes);
  return `Btd#${Array.from(bytes, value => value.toString(36)).join('').slice(0, 12)}9a`;
}

export default function AddVendor() {
  const navigate = useNavigate();
  const { checkSession } = useAdminAuth();
  const [values, setValues] = useState({
    fullName: '',
    mobileNumber: '',
    email: '',
    password: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const mobileIsValid = useMemo(
    () => /^[6-9]\d{9}$/.test(values.mobileNumber),
    [values.mobileNumber],
  );

  function update(event) {
    const { name, value } = event.target;
    setValues(current => ({
      ...current,
      [name]: name === 'mobileNumber' ? value.replace(/\D/g, '').slice(0, 10) : value,
    }));
  }

  async function submit(event) {
    event.preventDefault();
    if (saving) return;
    setError('');

    if (!mobileIsValid) {
      setError('Enter a valid 10-digit Indian mobile number.');
      return;
    }
    if (values.password.length < 8) {
      setError('Temporary password must contain at least 8 characters.');
      return;
    }

    setSaving(true);
    try {
      const response = await adminApi.post('/vendors', {
        fullName: values.fullName.trim(),
        mobileNumber: values.mobileNumber,
        email: values.email.trim(),
        password: values.password,
      });

      navigate(`/vendors/${response.data.data._id}`, {
        replace: true,
        state: {
          successMessage: response.data.message,
          linking: response.data.linking,
        },
      });
    } catch (requestError) {
      if (requestError.response?.status === 401) {
        await checkSession();
        return;
      }
      setError(getApiError(requestError, 'Unable to create vendor.'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <div className="page-heading">
        <Link className="back-link" to="/vendors">← All vendors</Link>
        <h1>Add vendor</h1>
        <p className="muted">
          Creating the account automatically links unclaimed venues using the same mobile number.
        </p>
      </div>

      <form className="panel vendor-form" onSubmit={submit}>
        {error && <div className="error-message" role="alert">{error}</div>}

        <div className="form-field">
          <label htmlFor="vendor-name">Full name *</label>
          <input
            id="vendor-name"
            name="fullName"
            required
            maxLength={150}
            value={values.fullName}
            onChange={update}
          />
        </div>

        <div className="form-field">
          <label htmlFor="vendor-mobile">Mobile number *</label>
          <input
            id="vendor-mobile"
            name="mobileNumber"
            type="tel"
            inputMode="numeric"
            required
            maxLength={10}
            placeholder="10 digits without +91"
            value={values.mobileNumber}
            onChange={update}
          />
          <small>This must exactly identify the owner used on their venue listings.</small>
        </div>

        <div className="form-field">
          <label htmlFor="vendor-email">Email (optional)</label>
          <input
            id="vendor-email"
            name="email"
            type="email"
            maxLength={254}
            value={values.email}
            onChange={update}
          />
        </div>

        <div className="form-field">
          <label htmlFor="vendor-password">Temporary password *</label>
          <div className="password-row">
            <input
              id="vendor-password"
              name="password"
              type={showPassword ? 'text' : 'password'}
              minLength={8}
              maxLength={128}
              required
              autoComplete="new-password"
              value={values.password}
              onChange={update}
            />
            <button
              type="button"
              className="secondary-button"
              onClick={() => setShowPassword(current => !current)}
            >
              {showPassword ? 'Hide' : 'Show'}
            </button>
          </div>
          <button
            type="button"
            className="text-button"
            onClick={() => {
              setValues(current => ({ ...current, password: createTemporaryPassword() }));
              setShowPassword(true);
            }}
          >
            Generate secure password
          </button>
          <small>Do not use the mobile number as the password.</small>
        </div>

        <div className="vendor-form-actions">
          <Link className="secondary-button" to="/vendors">Cancel</Link>
          <button className="primary-button" type="submit" disabled={saving}>
            {saving ? 'Creating vendor…' : 'Create vendor and link venues'}
          </button>
        </div>
      </form>
    </>
  );
}
