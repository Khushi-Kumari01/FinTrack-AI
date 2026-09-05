import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api/client";

const RegisterPage = () => {
  const navigate = useNavigate();

  const [form, setForm] = useState({
    name: "",
    email: "",
    password: ""
  });

  const [error, setError] = useState("");

  const handleChange = (e) => {
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    try {
      await api.post("/auth/register", form);
      navigate("/login");
    } catch (err) {
      setError(err?.response?.data?.message || "Server unreachable");
    }
  };

  return (
    <div className="auth-root">
      <div className="auth-glow" />

      <div className="auth-card">
        <div className="auth-left">
          <h1 className="auth-heading">Create Account 🚀</h1>
          <p className="auth-subheading">
            Start tracking your expenses with the most advanced AI finance assistant.
          </p>
        </div>

        <div className="auth-right">
          <form className="auth-form" onSubmit={handleSubmit}>
            <h2 className="auth-form-title">Register</h2>
            <p className="auth-form-subtitle">
              Already have an account?{" "}
              <Link to="/login" className="link-primary">Login</Link>
            </p>

            {error && <div className="auth-error">{error}</div>}

            <label className="auth-label">Full Name</label>
            <input
              className="auth-input"
              type="text"
              name="name"
              value={form.name}
              onChange={handleChange}
              required
            />

            <label className="auth-label">Email</label>
            <input
              className="auth-input"
              type="email"
              name="email"
              value={form.email}
              onChange={handleChange}
              required
            />

            <label className="auth-label">Password</label>
            <input
              className="auth-input"
              type="password"
              name="password"
              value={form.password}
              onChange={handleChange}
              required
            />

            <button className="auth-submit" type="submit">
              Create Account
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default RegisterPage;
