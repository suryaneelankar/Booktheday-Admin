import { useState } from 'react';

import {
    NavLink,
    Outlet,
} from 'react-router-dom';

import {
    useAdminAuth,
} from '../context/AdminAuthContext';

import {
    getApiError,
} from '../api/adminApi';

function navigationClass({
    isActive,
}) {
    return `nav-link ${isActive
            ? 'active'
            : ''
        }`;
}

export default function AdminLayout() {
    const {
        admin,
        logout,
    } = useAdminAuth();

    const [
        isLoggingOut,
        setIsLoggingOut,
    ] = useState(false);

    const [
        error,
        setError,
    ] = useState('');

    const handleLogout = async () => {
        if (isLoggingOut) return;

        setError('');
        setIsLoggingOut(true);

        try {
            await logout();
        } catch (logoutError) {
            setError(
                getApiError(
                    logoutError,
                    'Unable to log out. Please retry.',
                ),
            );
        } finally {
            setIsLoggingOut(false);
        }
    };

    return (
        <div className="admin-shell">
            <aside className="sidebar">
                <div className="brand brand-light">
                    <span
                        className="brand-mark"
                        aria-hidden="true"
                    >
                        B
                    </span>

                    <span>BookTheDay</span>
                </div>

                <span className="sidebar-label">
                    WORKSPACE
                </span>

                <nav aria-label="Admin navigation">
                    <NavLink
                        to="/dashboard"
                        end
                        className={navigationClass}
                    >
                        <span aria-hidden="true">
                            ▦
                        </span>

                        Overview
                    </NavLink>

                    <NavLink
                        to="/venues"
                        end
                        className={({ isActive }) =>
                            `nav-link ${isActive ? 'active' : ''}`
                        }
                    >
                        <span aria-hidden="true">▤</span>
                        All venues
                    </NavLink>

                    <NavLink
                        to="/venues/import"
                        end
                        className={navigationClass}
                    >
                        <span aria-hidden="true">⇧</span>
                        Bulk import
                    </NavLink>

                    <NavLink
                        to="/vendor-applications"
                        className={navigationClass}
                    >
                        <span aria-hidden="true">
                            ♙
                        </span>

                        Vendor registrations
                    </NavLink>
                </nav>

                <div className="sidebar-bottom">
                    <p>Admin access</p>

                    <span>
                        BookTheDay operations
                    </span>
                </div>
            </aside>

            <div className="admin-main">
                <header className="topbar">
                    <div>
                        <span className="section-label">
                            ADMIN CONSOLE
                        </span>

                        <p className="signed-in-name">
                            {admin?.fullName ||
                                'Administrator'}
                        </p>
                    </div>

                    <button
                        type="button"
                        className="secondary-button"
                        onClick={handleLogout}
                        disabled={isLoggingOut}
                    >
                        {isLoggingOut
                            ? 'Signing out…'
                            : 'Sign out'}
                    </button>
                </header>

                <main className="dashboard-content">
                    {error && (
                        <div
                            className="error-message"
                            role="alert"
                        >
                            {error}
                        </div>
                    )}

                    <Outlet />
                </main>
            </div>
        </div>
    );
}
