// central axios instance — use this everywhere instead of direct axios
import axios from 'axios';

const apiBase = import.meta.env.VITE_API_URL ||
  (import.meta.env.VITE_BASE_URL ? `${import.meta.env.VITE_BASE_URL}/api` : 'http://localhost:5000/api');

const api = axios.create({
  baseURL: apiBase
});

// attach token if present (localStorage key might differ in your app)
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token') || localStorage.getItem('authToken');
  if (token) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
}, (error) => Promise.reject(error));

export default api;
