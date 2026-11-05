/**
 * Global frontend configuration.
 * Reads API base URL from VITE_API_URL or defaults to http://localhost:3000.
 */
export const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';
