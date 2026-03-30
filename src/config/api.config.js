// API Configuration
export const API_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api/v1';
// export const API_URL = import.meta.env.VITE_API_BASE_URL || 'https://guts-admin.n6t.online/api/v1';
// export const API_URL = import.meta.env.VITE_API_BASE_URL || 'https://guts.n6t.online/api/v1';
// export const API_URL = import.meta.env.VITE_API_BASE_URL || 'https://crown-colleagues-formerly-exceptional.trycloudflare.com/api/v1';
console.log("API URL:", API_URL);

export const API_CONFIG = {
    headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
    },
    getAuthHeader: () => {
        const token = localStorage.getItem('token');
        const employeeCode = localStorage.getItem('emp_code') || '';

        return {
            ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
            ...(employeeCode ? { 'X-Employee-Code': employeeCode } : {}),
        };
    }
};
