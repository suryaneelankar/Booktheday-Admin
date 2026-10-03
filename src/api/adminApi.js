import axios from 'axios';

const adminApi = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
  withCredentials: true,
  timeout: 30000,
});

export function getApiError(
  error,
  fallbackMessage = 'Something went wrong.',
) {
  return (
    error?.response?.data?.message ||
    error?.message ||
    fallbackMessage
  );
}

export default adminApi;