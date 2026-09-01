import { useEffect, useState } from 'react';

import adminApi, { getApiError } from '../api/adminApi';
import { useAdminAuth } from '../context/AdminAuthContext';
import { Link, useLocation } from 'react-router-dom';

const PAGE_SIZE = 20;

function formatPrice(value) {
    if (value === null || value === undefined || value === '') {
        return 'Not provided';
    }

    const amount = Number(value);

    if (!Number.isFinite(amount) || amount <= 0) {
        return 'Not provided';
    }

    return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        maximumFractionDigits: 0,
    }).format(amount);
}

function statusLabel(status) {
    if (status === 'approved') return 'Approved';
    if (status === 'onhold') return 'On hold';

    return status || 'Not set';
}

export default function Venues() {
    const { checkSession } = useAdminAuth();

    const [searchInput, setSearchInput] = useState('');
    const [filters, setFilters] = useState({
        search: '',
        status: 'all',
        page: 1,
    });

    const location = useLocation();

    const [venues, setVenues] = useState([]);
    const [totalItems, setTotalItems] = useState(0);
    const [totalPages, setTotalPages] = useState(0);

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [reloadKey, setReloadKey] = useState(0);

    useEffect(() => {
        const controller = new AbortController();

        async function loadVenues() {
            setLoading(true);
            setError('');

            try {
                const response = await adminApi.get('/venues', {
                    params: {
                        ...filters,
                        limit: PAGE_SIZE,
                    },
                    signal: controller.signal,
                });

                if (controller.signal.aborted) return;

                setVenues(response.data.data);
                setTotalItems(response.data.totalItems);
                setTotalPages(response.data.totalPages);
            } catch (requestError) {
                if (controller.signal.aborted) return;

                if (requestError.response?.status === 401) {
                    await checkSession();
                    return;
                }

                setError(
                    getApiError(requestError, 'Unable to load venues.'),
                );
            } finally {
                if (!controller.signal.aborted) {
                    setLoading(false);
                }
            }
        }

        loadVenues();

        return () => controller.abort();
    }, [filters, reloadKey, checkSession]);

    function handleSearch(event) {
        event.preventDefault();

        setFilters(current => ({
            ...current,
            search: searchInput.trim(),
            page: 1,
        }));
    }

    return (
        <>
            <div className="page-heading">
                <span className="section-label">VENUE MANAGEMENT</span>
                <h1>All venues</h1>
                <p className="muted">
                    Search your listings and review their approval status.
                </p>
            </div>

            <div className="venue-page-actions">
                <Link to="/venues/new" className="primary-button">
                    + Add venue
                </Link>
            </div>

            {location.state?.successMessage && (
                <div className="success-message" role="status">
                    {location.state.successMessage}
                </div>
            )}

            <section className="panel">
                <form className="venue-toolbar" onSubmit={handleSearch}>
                    <div className="venue-search">
                        <label htmlFor="venue-search">
                            Search venues
                        </label>

                        <input
                            id="venue-search"
                            type="search"
                            placeholder="Venue, address or vendor number"
                            value={searchInput}
                            maxLength={100}
                            onChange={event => setSearchInput(event.target.value)}
                        />
                    </div>

                    <div className="venue-filter">
                        <label htmlFor="venue-status">Approval status</label>

                        <select
                            id="venue-status"
                            value={filters.status}
                            onChange={event => {
                                const status = event.target.value;

                                setFilters(current => ({
                                    ...current,
                                    status,
                                    page: 1,
                                }));
                            }}
                        >
                            <option value="all">All statuses</option>
                            <option value="approved">Approved</option>
                            <option value="onhold">On hold</option>
                        </select>
                    </div>

                    <button
                        type="submit"
                        className="primary-button"
                        disabled={loading}
                    >
                        Search
                    </button>
                </form>

                {loading ? (
                    <div className="venue-state" role="status">
                        Loading venues…
                    </div>
                ) : error ? (
                    <div className="venue-state">
                        <p className="error-message" role="alert">{error}</p>

                        <button
                            className="secondary-button"
                            onClick={() => setReloadKey(current => current + 1)}
                        >
                            Retry
                        </button>
                    </div>
                ) : (
                    <>
                        <p className="venue-count" role="status">
                            {totalItems} matching {totalItems === 1 ? 'venue' : 'venues'}
                        </p>

                        {venues.length === 0 ? (
                            <div className="venue-state">
                                <h2>No venues found</h2>
                                <p className="muted">
                                    Try a different search or approval status.
                                </p>
                            </div>
                        ) : (
                            <div
                                className="venue-table-scroll"
                                role="region"
                                aria-label="Venue listings"
                                tabIndex={0}
                            >
                                <table className="venue-table">
                                    <caption className="sr-only">
                                        Venues matching the selected search and status
                                    </caption>

                                    <thead>
                                        <tr>
                                            <th scope="col">Venue</th>
                                            <th scope="col">Vendor number</th>
                                            <th scope="col">Daily rent</th>
                                            <th scope="col">Approval</th>
                                            <th scope="col">Listing availability</th>
                                        </tr>
                                    </thead>

                                    <tbody>
                                        {venues.map(venue => (
                                            <tr key={venue._id}>
                                                <td>
                                                    <Link to={`/venues/${venue._id}`} aria-label={`Review ${venue.functionHallName}`}>
                                                        <strong>{venue.functionHallName}</strong>
                                                    </Link>

                                                    <span className="venue-subtext">
                                                        {venue.venueCategory || 'Category not set'}
                                                    </span>

                                                    <span className="venue-subtext">
                                                        {[
                                                            venue.functionHallAddress?.address,
                                                            venue.functionHallAddress?.city,
                                                        ].filter(Boolean).join(', ') || 'Address not provided'}
                                                    </span>
                                                </td>

                                                <td>{venue.vendorMobileNumber || 'Not provided'}</td>

                                                <td>{formatPrice(venue.rentPricePerDay)}</td>

                                                <td>
                                                    <span
                                                        className={
                                                            venue.verificationStatus === 'approved'
                                                                ? 'venue-badge approved'
                                                                : 'venue-badge pending'
                                                        }
                                                    >
                                                        {statusLabel(venue.verificationStatus)}
                                                    </span>
                                                </td>

                                                <td>
                                                    {venue.available === true
                                                        ? 'Available'
                                                        : venue.available === false
                                                            ? 'Unavailable'
                                                            : 'Not set'}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}

                        <div className="venue-pagination">
                            <button
                                className="secondary-button"
                                disabled={filters.page <= 1}
                                onClick={() => {
                                    setFilters(current => ({
                                        ...current,
                                        page: current.page - 1,
                                    }));
                                }}
                            >
                                Previous
                            </button>

                            <span>
                                Page {filters.page} of {Math.max(1, totalPages)}
                            </span>

                            <button
                                className="secondary-button"
                                disabled={filters.page >= totalPages}
                                onClick={() => {
                                    setFilters(current => ({
                                        ...current,
                                        page: current.page + 1,
                                    }));
                                }}
                            >
                                Next
                            </button>
                        </div>

                        <p className="venue-footnote">
                            Listing availability is not availability for a specific event date.
                        </p>
                    </>
                )}
            </section>
        </>
    );
}
