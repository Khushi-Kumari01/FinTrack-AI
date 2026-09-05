// src/components/Sidebar.jsx
import React from "react";
import { NavLink, useLocation } from "react-router-dom";

const Sidebar = () => {
  const location = useLocation();

  const navItems = [
    { label: "Dashboard", icon: "📊", path: "/dashboard" },
    { label: "Agent Console", icon: "🤖", path: "/agent-console" },
  ];

  const isActive = (path) => location.pathname === path;

  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <div className="sidebar-logo-icon">₹</div>
        <div className="sidebar-logo-text">
          <span>FinTrack AI</span>
          <span>Personal finance copilots</span>
        </div>
      </div>

      <div className="nav-section-title">Main</div>
      <nav className="sidebar-nav">
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={`nav-item ${isActive(item.path) ? "active" : ""}`}
          >
            <span className="nav-item-icon">{item.icon}</span>
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>

      <div style={{ marginTop: "auto", paddingTop: 16, fontSize: 11 }}>
        <div style={{ color: "var(--text-subtle)", marginBottom: 4 }}>
          Environment
        </div>
        <div className="chip">
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: 999,
              background: "#22c55e",
              display: "inline-block",
            }}
          />
          DEV • http://localhost:5000/api
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
