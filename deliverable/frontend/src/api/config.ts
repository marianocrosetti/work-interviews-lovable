export const API_BASE_URL = import.meta.env.DEV
  ? 'http://localhost:3001' 
  : window.location.origin;

export const API_CONFIG = {
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
  mode: 'cors' as RequestMode,
  timeout: 10000, // 10 seconds
};
