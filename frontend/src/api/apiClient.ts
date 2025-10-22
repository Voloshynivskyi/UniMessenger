/**
 * frontend/src/api/apiClient.ts
 * Axios HTTP client configuration with authentication interceptors for API requests
 */

import axios from "axios";
const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:7007";

const apiClient = axios.create({
  baseURL: BASE_URL,
  timeout: 10000,
  headers: {
    "Content-Type": "application/json",
    Accept: "application/json",
  },
});

function getToken() {
  return localStorage.getItem("authToken");
}

apiClient.interceptors.request.use((config) => {
  const token = getToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status;

    if (status === 401) {
      localStorage.removeItem("authToken");
    }

    return Promise.reject(error);
  }
);

export default apiClient;
