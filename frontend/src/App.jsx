// src/App.jsx
import React, { useContext } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

import Dashboard from "./pages/Dashboard";
import AgentConsole from "./pages/AgentConsole";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import VerifyEmailPage from "./pages/VerifyEmailPage";

import Layout from "./components/Layout";
import { AuthProvider, AuthContext } from "./context/AuthContext";
import { ThemeProvider } from "./context/ThemeContext";

// 🔐 Protect routes (redirect if token missing)
function ProtectedRoute({ children }) {
  const { token } = useContext(AuthContext);

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  return children;
}

const App = () => {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <Routes>

            {/* PUBLIC ROUTES */}
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/verify-email" element={<VerifyEmailPage />} />

            {/* PROTECTED ROUTES */}
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <Layout>
                    <Dashboard />
                  </Layout>
                </ProtectedRoute>
              }
            />

            <Route
              path="/agent-console"
              element={
                <ProtectedRoute>
                  <Layout>
                    <AgentConsole />
                  </Layout>
                </ProtectedRoute>
              }
            />

            {/* DEFAULT → DASHBOARD */}
            <Route path="/" element={<Navigate to="/dashboard" />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  );
};

export default App;
