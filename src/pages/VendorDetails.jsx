import { useCallback, useEffect, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';

import adminApi, { getApiError } from '../api/adminApi';
import { useAdminAuth } from '../context/AdminAuthContext';
import '../styles/vendors.css';

export default function VendorDetails() {
  const { id } = useParams();
  const location = useLocation();
  const { checkSession } = useAdminAuth();
  const [vendor, setVendor] = useState(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState(location.state?.successMessage || '');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await adminApi.get(`/vendors/${id}`);
      setVendor(response.data.data);
    } catch (requestError) {
      if (requestError.response?.status === 401) {
        await checkSession();
        return;
      }
      setError(getApiError(requestError, 'Unable to load vendor.'));
    } finally {
      setLoading(false);
    }
  }, [id, checkSession]);

  useEffect(() => { load(); }, [load]);

  async function relink() {
    if (!window.confirm('Link every unclaimed venue with this vendor mobile number?')) return;
    setWorking(true);
    setError('');
    try {
      const response = await adminApi.post(`/vendors/${id}/link-venues`);
      const result = response.data.linking;
      setNotice(
        `${result.linkedCount} newly linked, ${result.alreadyLinkedCount || 0} already linked, ${result.conflictCount} conflict(s).`,
      );
      await load();
    } catch (requestError) {
      setError(getApiError(requestError, 'Unable to link venues.'));
    } finally {
      setWorking(false);
    }
  }

  async function toggleStatus() {
    const nextStatus = vendor.accountStatus === 'inactive' ? 'active' : 'inactive';
    if (!window.confirm(`Mark this vendor account ${nextStatus}?`)) return;
    setWorking(true);
    setError('');
    try {
      await adminApi.patch(`/vendors/${id}/status`, { status: nextStatus });
      setNotice(`Vendor account marked ${nextStatus}.`);
      await load();
    } catch (requestError) {
      setError(getApiError(requestError, 'Unable to update vendor status.'));
    } finally {
      setWorking(false);
    }
  }

  if (loading) return <div className="vendor-state">Loading vendor…</div>;
  if (error && !vendor) return <div className="vendor-state error-message">{error}</div>;
  if (!vendor) return null;

  return (
    <>
      <div className="page-heading">
        <Link className="back-link" to="/vendors">← All vendors</Link>
        <h1>{vendor.fullName}</h1>
        <p className="muted">{vendor.mobileNumber} · {vendor.email || 'No email provided'}</p>
      </div>

      {notice && <div className="success-message" role="status">{notice}</div>}
      {error && <div className="error-message" role="alert">{error}</div>}

      <div className="vendor-summary-grid">
        <section className="panel vendor-summary-card">
          <span>Linked venues</span><strong>{vendor.venueCount}</strong>
        </section>
        <section className="panel vendor-summary-card">
          <span>Account</span><strong>{vendor.accountStatus || 'active'}</strong>
        </section>
        <section className="panel vendor-summary-card">
          <span>KYC</span><strong>{vendor.kycStatus || 'not submitted'}</strong>
        </section>
      </div>

      <div className="vendor-detail-actions">
        <button className="primary-button" disabled={working} onClick={relink}>
          Link matching venues again
        </button>
        <button className="secondary-button" disabled={working} onClick={toggleStatus}>
          Mark {vendor.accountStatus === 'inactive' ? 'active' : 'inactive'}
        </button>
      </div>

      <section className="panel">
        <div className="vendor-section-heading">
          <div><h2>Linked venues</h2><p className="muted">Ownership is based on the verified vendor mobile number.</p></div>
        </div>

        {!vendor.venues?.length ? (
          <div className="vendor-state">No venues are linked to this vendor yet.</div>
        ) : (
          <div className="vendor-venue-grid">
            {vendor.venues.map(venue => (
              <Link className="vendor-venue-card" key={venue._id} to={`/venues/${venue._id}`}>
                {venue.professionalImage?.url ? (
                  <img src={venue.professionalImage.url} alt="" loading="lazy" />
                ) : <div className="vendor-venue-placeholder">No photo</div>}
                <div>
                  <strong>{venue.functionHallName}</strong>
                  <span>{venue.venueCategory || 'Venue'}</span>
                  <span>{venue.verificationStatus || 'onhold'} · {venue.available ? 'Available' : 'Unavailable'}</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
