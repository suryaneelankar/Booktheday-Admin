import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import adminApi, { getApiError } from '../api/adminApi';
import { useAdminAuth } from '../context/AdminAuthContext';
import '../styles/vendors.css';

const PAGE_SIZE = 20;

export default function Vendors() {
  const { checkSession } = useAdminAuth();
  const [searchInput, setSearchInput] = useState('');
  const [filters, setFilters] = useState({ search: '', status: 'all', page: 1 });
  const [vendors, setVendors] = useState([]);
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
        const response = await adminApi.get('/vendors', {
          params: { ...filters, limit: PAGE_SIZE },
          signal: controller.signal,
        });

        if (controller.signal.aborted) return;
        setVendors(response.data.data || []);
        setTotalItems(response.data.totalItems || 0);
        setTotalPages(response.data.totalPages || 0);
      } catch (requestError) {
        if (controller.signal.aborted) return;
        if (requestError.response?.status === 401) {
          await checkSession();
          return;
        }
        setError(getApiError(requestError, 'Unable to load vendors.'));
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }

    load();
    return () => controller.abort();
  }, [filters, checkSession]);

  function submitSearch(event) {
    event.preventDefault();
    setFilters(current => ({ ...current, search: searchInput.trim(), page: 1 }));
  }

  return (
    <>
      <div className="page-heading vendor-heading-row">
        <div>
          <span className="section-label">VENDOR MANAGEMENT</span>
          <h1>Vendors</h1>
          <p className="muted">Onboard vendors and manage their linked venues.</p>
        </div>
        <Link className="primary-button" to="/vendors/new">+ Add vendor</Link>
      </div>

      <section className="panel">
        <form className="vendor-toolbar" onSubmit={submitSearch}>
          <div className="form-field vendor-search">
            <label htmlFor="vendor-search">Search vendors</label>
            <input
              id="vendor-search"
              type="search"
              value={searchInput}
              maxLength={100}
              placeholder="Name, mobile number or email"
              onChange={event => setSearchInput(event.target.value)}
            />
          </div>

          <div className="form-field">
            <label htmlFor="vendor-status">Account status</label>
            <select
              id="vendor-status"
              value={filters.status}
              onChange={event => setFilters(current => ({
                ...current,
                status: event.target.value,
                page: 1,
              }))}
            >
              <option value="all">All accounts</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>

          <button className="primary-button" type="submit" disabled={loading}>
            Search
          </button>
        </form>

        {loading ? (
          <div className="vendor-state" role="status">Loading vendors…</div>
        ) : error ? (
          <div className="vendor-state error-message" role="alert">{error}</div>
        ) : vendors.length === 0 ? (
          <div className="vendor-state">
            <h2>No vendors found</h2>
            <p className="muted">Add a vendor or change the filters.</p>
          </div>
        ) : (
          <>
            <p className="vendor-count">{vendors.length} of {totalItems} vendors</p>
            <div className="vendor-table-scroll">
              <table className="vendor-table">
                <thead>
                  <tr>
                    <th>Vendor</th>
                    <th>Mobile number</th>
                    <th>Linked venues</th>
                    <th>KYC</th>
                    <th>Status</th>
                    <th><span className="sr-only">Actions</span></th>
                  </tr>
                </thead>
                <tbody>
                  {vendors.map(vendor => (
                    <tr key={vendor._id}>
                      <td>
                        <strong>{vendor.fullName || 'Name not provided'}</strong>
                        <span className="vendor-subtext">{vendor.email || 'No email'}</span>
                      </td>
                      <td>{vendor.mobileNumber}</td>
                      <td>{vendor.venueCount}</td>
                      <td>{vendor.kycStatus || 'Not submitted'}</td>
                      <td>
                        <span className={`vendor-badge ${vendor.accountStatus}`}>
                          {vendor.accountStatus === 'inactive' ? 'Inactive' : 'Active'}
                        </span>
                      </td>
                      <td><Link to={`/vendors/${vendor._id}`}>View details →</Link></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {totalPages > 1 && (
              <div className="vendor-pagination">
                <button
                  className="secondary-button"
                  disabled={filters.page <= 1}
                  onClick={() => setFilters(current => ({ ...current, page: current.page - 1 }))}
                >
                  Previous
                </button>
                <span>Page {filters.page} of {totalPages}</span>
                <button
                  className="secondary-button"
                  disabled={filters.page >= totalPages}
                  onClick={() => setFilters(current => ({ ...current, page: current.page + 1 }))}
                >
                  Next
                </button>
              </div>
            )}
          </>
        )}
      </section>
    </>
  );
}
