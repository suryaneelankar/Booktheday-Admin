import axios from 'axios';

const adminApi = axios.create({
  baseURL: '/api/admin',
  withCredentials: true,
  timeout: 15000,
});

export function getApiError(error, fallback) {
  if (!error.response) {
    return 'Unable to reach the server. Check your connection and try again.';
  }

  const message = error.response.data?.message;

  return typeof message === 'string'
    ? message
    : fallback;
}

export default adminApi;