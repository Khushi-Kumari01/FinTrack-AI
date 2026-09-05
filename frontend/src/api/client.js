// frontend/src/api/client.js
import axios from "axios";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "/api";

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json"
  }
});

let sessionRedirectInProgress = false;

// Attach JWT token automatically if present
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token"); // stored by AuthContext
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Simple response interceptor (optional)
api.interceptors.response.use(
  (res) => res,
  (err) => {
    console.error("API error:", err?.response?.data || err.message);
    if (err?.response?.status === 401 && !sessionRedirectInProgress) {
      localStorage.removeItem("token");
      localStorage.removeItem("user");

      if (window.location.pathname !== "/login") {
        sessionRedirectInProgress = true;
        window.location.assign("/login");
      }
    }
    return Promise.reject(err);
  }
);
