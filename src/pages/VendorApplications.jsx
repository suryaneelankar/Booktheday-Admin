import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';

import adminApi, { getApiError } from '../api/adminApi';
import { useAdminAuth } from '../context/AdminAuthContext';
import '../styles/vendor-approval.css';

const PAGE_SIZE = 20;

export default function VendorApplications() {
  const location = useLocation();
  const { checkSession } = useAdminAuth();
  const [searchInput, setSearchInput] = useState('');
  const [filters, setFilters] = useState({ search: '', status: 'pending', page: 1 });
  const [data, setData] = useState([]);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      setLoading(true);
      setError('');
      try {
        const response = await adminApi.get('/vendor-applications', {
          params: { ...filters, limit: PAGE_SIZE },
          signal: controller.signal,
        });
        if (controller.signal.aborted) return;
        setData(response.data.data || []);
        setTotalItems(response.data.totalItems || 0);
        setTotalPages(response.data.totalPages || 0);
      } catch (requestError) {
        if (controller.signal.aborted) return;
        if (requestError.response?.status === 401) {
          await checkSession();
          return;
        }
        setError(getApiError(requestError, 'Unable to load vendor registrations.'));
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    load();
    return () => controller.abort();
  }, [filters, checkSession]);

  function search(event) {
    event.preventDefault();
    setFilters(current => ({ ...current, search: searchInput.trim(), page: 1 }));
  }

  return (
    <>
      <div className="page-heading">
        <span className="section-label">VENDOR VERIFICATION</span>
        <h1>Vendor registrations</h1>
        <p className="muted">Verify each applicant before giving access to venue ownership.</p>
      </div>

      <section className="panel">
        {location.state?.successMessage && (
          <div className="success-message" role="status">
            {location.state.successMessage}
          </div>
        )}
        <form className="vendor-approval-toolbar" onSubmit={search}>
          <div className="form-field vendor-approval-search">
            <label htmlFor="vendor-application-search">Search</label>
            <input
              id="vendor-application-search"
              type="search"
              placeholder="Vendor name, mobile or email"
              value={searchInput}
              maxLength={100}
              onChange={event => setSearchInput(event.target.value)}
            />
          </div>
          <div className="form-field">
            <label htmlFor="application-status">Status</label>
            <select
              id="application-status"
              value={filters.status}
              onChange={event => setFilters(current => ({
                ...current,
                status: event.target.value,
                page: 1,
              }))}
            >
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
              <option value="suspended">Suspended</option>
              <option value="all">All</option>
            </select>
          </div>
          <button className="primary-button" type="submit" disabled={loading}>Search</button>
        </form>

        {loading ? (
          <div className="vendor-approval-state" role="status">Loading registrations…</div>
        ) : error ? (
          <div className="vendor-approval-state error-message" role="alert">{error}</div>
        ) : data.length === 0 ? (
          <div className="vendor-approval-state">
            <h2>No registrations found</h2>
            <p className="muted">There are no vendors matching this filter.</p>
          </div>
        ) : (
          <>
            <p className="vendor-approval-count">{data.length} of {totalItems} registrations</p>
            <div className="vendor-approval-table-wrap">
              <table className="vendor-approval-table">
                <thead>
                  <tr>
                    <th>Vendor</th>
                    <th>Mobile</th>
                    <th>Matching venues</th>
                    <th>Requested</th>
                    <th>Status</th>
                    <th><span className="sr-only">Action</span></th>
                  </tr>
                </thead>
                <tbody>
                  {data.map(vendor => (
                    <tr key={vendor._id}>
                      <td>
                        <strong>{vendor.fullName}</strong>
                        <span className="vendor-approval-subtext">{vendor.email || 'No email'}</span>
                      </td>
                      <td>{vendor.mobileNumber}</td>
                      <td>{vendor.matchingVenueCount}</td>
                      <td>{vendor.accountRequestedAt ? new Date(vendor.accountRequestedAt).toLocaleDateString('en-IN') : '—'}</td>
                      <td><span className={`vendor-status ${vendor.accountStatus}`}>{vendor.accountStatus}</span></td>
                      <td><Link to={`/vendor-applications/${vendor._id}`}>Review →</Link></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {totalPages > 1 && (
              <div className="vendor-approval-pagination">
                <button
                  className="secondary-button"
                  disabled={filters.page <= 1}
                  onClick={() => setFilters(current => ({ ...current, page: current.page - 1 }))}
                >Previous</button>
                <span>Page {filters.page} of {totalPages}</span>
                <button
                  className="secondary-button"
                  disabled={filters.page >= totalPages}
                  onClick={() => setFilters(current => ({ ...current, page: current.page + 1 }))}
                >Next</button>
              </div>
            )}
          </>
        )}
      </section>
    </>
  );
}
