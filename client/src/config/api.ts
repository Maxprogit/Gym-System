const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';


console.log('API URL:', BASE_URL); 

export const API = {
    base: BASE_URL,
    members: `${BASE_URL}/api/members`,
    plans: `${BASE_URL}/api/plans`,
    payments: `${BASE_URL}/api/payments`,
    renew: `${BASE_URL}/api/renew`,
    dashboard: `${BASE_URL}/api/dashboard`,
};