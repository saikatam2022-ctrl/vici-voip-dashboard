import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

// Create axios instance
const apiClient = axios.create({
    baseURL: API_URL,
    headers: {
        'Content-Type': 'application/json',
    },
});

// Request interceptor - Add token to every request
apiClient.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('token');
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
            console.log('✅ Token added to request');
        } else {
            console.log('⚠️  No token found in localStorage');
        }
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

// Response interceptor - Handle 401 errors
apiClient.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response?.status === 401) {
            console.log('❌ 401 Unauthorized - Redirecting to login');
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            window.location.href = '/login';
        }
        return Promise.reject(error);
    }
);

export default apiClient;