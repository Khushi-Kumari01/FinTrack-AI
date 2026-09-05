// frontend/src/context/AuthContext.jsx
import React, { createContext, useEffect, useState } from "react";
import { api } from "../api/client";

export const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    const raw = localStorage.getItem("user");
    return raw ? JSON.parse(raw) : null;
  });
  const [token, setToken] = useState(() => localStorage.getItem("token") || "");
  const [loading, setLoading] = useState(false);

  const persistAuth = (token, user) => {
    setToken(token);
    setUser(user);
    if (token) localStorage.setItem("token", token);
    if (user) localStorage.setItem("user", JSON.stringify(user));
  };

  const clearAuth = () => {
    setToken("");
    setUser(null);
    localStorage.removeItem("token");
    localStorage.removeItem("user");
  };

  const login = async (email, password) => {
    setLoading(true);
    try {
      const res = await api.post("/auth/login", { email, password });
      persistAuth(res.data.token, res.data.user);
      return { ok: true };
    } catch (err) {
      console.error("Login failed", err);
      const msg = err?.response?.data?.message || "Login failed";
      const emailVerificationRequired = !!err?.response?.data?.emailVerificationRequired;
      return { ok: false, message: msg, emailVerificationRequired };
    } finally {
      setLoading(false);
    }
  };

  const register = async (name, email, password) => {
    setLoading(true);
    try {
      const res = await api.post("/auth/register", { name, email, password });
      persistAuth(res.data.token, res.data.user);
      return { ok: true };
    } catch (err) {
      console.error("Register failed", err);
      const msg = err?.response?.data?.message || "Register failed";
      return { ok: false, message: msg };
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    clearAuth();
  };

  useEffect(() => {
    // Optionally: verify token by calling /auth/me on first load
    const verify = async () => {
      if (!token) return;
      try {
        const res = await api.get("/auth/me");
        if (res.data?.user) {
          setUser(res.data.user);
        }
      } catch (err) {
        console.warn("Token invalid or expired, clearing auth");
        clearAuth();
      }
    };
    verify();
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: !!token,
        loading,
        login,
        register,
        logout
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
