import axios from 'axios';

const API_URL = 'http://localhost:8001/api';

export const api = axios.create({
  baseURL: API_URL,
});

// Add request interceptor to ensure token is always sent
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      const cleanToken = token.replace(/"/g, '');
      config.headers.Authorization = `Bearer ${cleanToken}`;
      console.log('🔐 API Interceptor: Adding token to request', config.url);
    } else {
      console.log('⚠️ API Interceptor: No token found for request', config.url);
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Authentication is now handled by AuthContext + API interceptor
// This ensures every request has the token even if headers get reset
