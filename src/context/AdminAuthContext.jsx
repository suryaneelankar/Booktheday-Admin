
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';

import adminApi, { getApiError } from '../api/adminApi';

const AdminAuthContext = createContext(null);

export function AdminAuthProvider({ children }) {
  const [admin, setAdmin] = useState(null);
  const [status, setStatus] = useState('loading');
  const [sessionError, setSessionError] = useState('');

  const checkSession = useCallback(async signal => {
    setStatus('loading');
    setSessionError('');

    try {
      const response = await adminApi.get('/me', { signal });

      if (signal?.aborted) return;

      setAdmin(response.data.data);
      setStatus('authenticated');
    } catch (error) {
      if (signal?.aborted) return;

      setAdmin(null);

      if (error.response?.status === 401) {
        setStatus('unauthenticated');
      } else {
        setSessionError(
          getApiError(error, 'Unable to verify your session.'),
        );
        setStatus('error');
      }
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    checkSession(controller.signal);

    return () => controller.abort();
  }, [checkSession]);

  const login = async (mobileNumber, password) => {
    await adminApi.post('/login', {
      mobileNumber,
      password,
    });

    // Confirm the browser actually retained and sends the cookie.
    const response = await adminApi.get('/me');

    setAdmin(response.data.data);
    setSessionError('');
    setStatus('authenticated');
  };

  const logout = async () => {
    try {
      await adminApi.post('/logout');
    } catch (error) {
      // An expired/revoked session is already logged out.
      if (error.response?.status !== 401) {
        throw error;
      }
    }

    setAdmin(null);
    setSessionError('');
    setStatus('unauthenticated');
  };

  return (
    <AdminAuthContext.Provider
      value={{
        admin,
        status,
        sessionError,
        checkSession,
        login,
        logout,
      }}
    >
      {children}
    </AdminAuthContext.Provider>
  );
}

export function useAdminAuth() {
  const context = useContext(AdminAuthContext);

  if (!context) {
    throw new Error(
      'useAdminAuth must be used inside AdminAuthProvider.',
    );
  }

  return context;
}