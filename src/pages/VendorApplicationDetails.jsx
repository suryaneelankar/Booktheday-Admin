import {
  useCallback,
  useEffect,
  useState,
} from 'react';

import {
  Link,
  useNavigate,
  useParams,
} from 'react-router-dom';

import adminApi, {
  getApiError,
} from '../api/adminApi';

import {
  useAdminAuth,
} from '../context/AdminAuthContext';

import '../styles/vendor-approval.css';

export default function VendorApplicationDetails() {
  const { vendorId } = useParams();

  const navigate = useNavigate();

  const { checkSession } =
    useAdminAuth();

  const [vendor, setVendor] =
    useState(null);

  const [loading, setLoading] =
    useState(true);

  const [working, setWorking] =
    useState(false);

  const [error, setError] =
    useState('');

  const [verified, setVerified] =
    useState(false);

  const [rejecting, setRejecting] =
    useState(false);

  const [reason, setReason] =
    useState('');

  const load = useCallback(
    async () => {
      setLoading(true);
      setError('');

      try {
        const response =
          await adminApi.get(
            `/vendor-applications/${vendorId}`,
          );

        setVendor(
          response.data.data,
        );
      } catch (requestError) {
        if (
          requestError.response?.status ===
          401
        ) {
          await checkSession();
        } else {
          setError(
            getApiError(
              requestError,
              'Unable to load vendor registration.',
            ),
          );
        }
      } finally {
        setLoading(false);
      }
    },
    [
      vendorId,
      checkSession,
    ],
  );

  useEffect(() => {
    load();
  }, [load]);

  const matchingVenues =
    Array.isArray(
      vendor?.matchingVenues,
    )
      ? vendor.matchingVenues
      : [];

  const matchingVenueCount =
    Number.isInteger(
      vendor?.matchingVenueCount,
    )
      ? vendor.matchingVenueCount
      : matchingVenues.length;

  /*
   * Use the backend value when supplied.
   * The fallback supports the UI during
   * frontend/backend rollout.
   */
  const canLinkVenues =
    vendor?.canLinkVenues === true ||
    matchingVenueCount > 0;

  async function approve() {
    if (!verified || working) {
      return;
    }

    const confirmationMessage =
      canLinkVenues
        ? `Approve this vendor and link ${matchingVenueCount} admin-created venue${
            matchingVenueCount === 1
              ? ''
              : 's'
          }?`
        : 'Approve this vendor account? There are no admin-created venues to link.';

    if (
      !window.confirm(
        confirmationMessage,
      )
    ) {
      return;
    }

    setWorking(true);
    setError('');

    try {
      const response =
        await adminApi.patch(
          `/vendor-applications/${vendorId}/approve`,
          {
            confirmed: true,
          },
        );

      navigate(
        '/vendor-applications',
        {
          replace: true,

          state: {
            successMessage:
              response.data.message,
          },
        },
      );
    } catch (requestError) {
      setError(
        getApiError(
          requestError,
          'Unable to approve vendor.',
        ),
      );
    } finally {
      setWorking(false);
    }
  }

  async function reject() {
    if (working) {
      return;
    }

    if (
      reason.trim().length < 5
    ) {
      setError(
        'Enter a clear rejection reason.',
      );

      return;
    }

    if (
      !window.confirm(
        'Reject this vendor registration?',
      )
    ) {
      return;
    }

    setWorking(true);
    setError('');

    try {
      const response =
        await adminApi.patch(
          `/vendor-applications/${vendorId}/reject`,
          {
            reason:
              reason.trim(),
          },
        );

      navigate(
        '/vendor-applications',
        {
          replace: true,

          state: {
            successMessage:
              response.data.message,
          },
        },
      );
    } catch (requestError) {
      setError(
        getApiError(
          requestError,
          'Unable to reject vendor.',
        ),
      );
    } finally {
      setWorking(false);
    }
  }

  if (loading) {
    return (
      <div className="vendor-approval-state">
        Loading registration…
      </div>
    );
  }

  if (!vendor) {
    return (
      <div className="vendor-approval-state error-message">
        {error ||
          'Vendor not found.'}
      </div>
    );
  }

  const pending =
    vendor.accountStatus ===
    'pending';

  return (
    <>
      <div className="page-heading">
        <Link
          className="back-link"
          to="/vendor-applications"
        >
          ← Vendor registrations
        </Link>

        <h1>{vendor.fullName}</h1>

        <p className="muted">
          Review the vendor’s identity
          before granting access.
        </p>
      </div>

      {error && (
        <div
          className="error-message"
          role="alert"
        >
          {error}
        </div>
      )}

      <section className="panel vendor-identity">
        <div>
          <span>Mobile number</span>

          <strong>
            {vendor.mobileNumber}
          </strong>
        </div>

        <div>
          <span>Email</span>

          <strong>
            {vendor.email ||
              'Not provided'}
          </strong>
        </div>

        <div>
          <span>Status</span>

          <strong
            className={
              `vendor-status ${
                vendor.accountStatus
              }`
            }
          >
            {vendor.accountStatus}
          </strong>
        </div>

        <div>
          <span>
            Admin venues to link
          </span>

          <strong>
            {matchingVenueCount}
          </strong>
        </div>
      </section>

      <section className="panel">
        <h2>
          Admin-created venue records
        </h2>

        <p className="muted">
          Only unclaimed venues added by
          an admin and matching this
          mobile number are shown here.
        </p>

        {!matchingVenues.length ? (
          <div className="vendor-approval-state">
            <strong>
              No venues need linking
            </strong>

            <p className="muted">
              This vendor can still be
              approved. Any venue they
              add through the vendor app
              will follow the normal
              listing approval process.
            </p>
          </div>
        ) : (
          <div className="vendor-match-grid">
            {matchingVenues.map(
              venue => (
                <Link
                  className="vendor-match-card"
                  key={venue._id}
                  to={`/venues/${venue._id}`}
                >
                  {venue
                    .professionalImage
                    ?.url ? (
                    <img
                      src={
                        venue
                          .professionalImage
                          .url
                      }
                      alt={
                        venue
                          .functionHallName
                      }
                      loading="lazy"
                    />
                  ) : (
                    <div className="vendor-match-placeholder">
                      No photo
                    </div>
                  )}

                  <div>
                    <strong>
                      {
                        venue
                          .functionHallName
                      }
                    </strong>

                    <span>
                      {venue
                        .venueCategory ||
                        'Venue'}
                    </span>

                    <span>
                      {venue
                        .verificationStatus ||
                        'onhold'}
                      {' · '}
                      Admin added
                    </span>

                    <span>
                      {venue
                        .functionHallAddress
                        ?.address ||
                        'Address unavailable'}
                    </span>
                  </div>
                </Link>
              ),
            )}
          </div>
        )}
      </section>

      {pending && (
        <section className="panel vendor-decision-panel">
          <h2>
            Verification decision
          </h2>

          <p className="muted">
            {canLinkVenues
              ? `${matchingVenueCount} admin-created venue${
                  matchingVenueCount ===
                  1
                    ? ''
                    : 's'
                } will be linked after approval.`
              : 'The vendor account will be approved without linking any venue.'}
          </p>

          <label className="vendor-confirm-check">
            <input
              type="checkbox"
              checked={verified}
              onChange={event =>
                setVerified(
                  event.target.checked,
                )
              }
            />

            <span>
              I called the registered
              number and verified this
              vendor’s identity and
              business details.
            </span>
          </label>

          <div className="vendor-decision-actions">
            <button
              type="button"
              className="primary-button"
              disabled={
                !verified ||
                working
              }
              onClick={approve}
            >
              {working
                ? 'Processing…'
                : canLinkVenues
                  ? `Approve and link ${
                      matchingVenueCount
                    } venue${
                      matchingVenueCount ===
                      1
                        ? ''
                        : 's'
                    }`
                  : 'Approve vendor'}
            </button>

            <button
              type="button"
              className="secondary-button"
              disabled={working}
              onClick={() =>
                setRejecting(
                  current =>
                    !current,
                )
              }
            >
              {rejecting
                ? 'Cancel rejection'
                : 'Reject registration'}
            </button>
          </div>

          {rejecting && (
            <div className="vendor-reject-box">
              <label htmlFor="rejection-reason">
                Reason for rejection
              </label>

              <textarea
                id="rejection-reason"
                rows={3}
                maxLength={500}
                value={reason}
                onChange={event =>
                  setReason(
                    event.target.value,
                  )
                }
                placeholder="Explain why this registration cannot be approved."
              />

              <button
                type="button"
                className="danger-button"
                disabled={
                  working ||
                  reason.trim().length < 5
                }
                onClick={reject}
              >
                Confirm rejection
              </button>
            </div>
          )}
        </section>
      )}
    </>
  );
}