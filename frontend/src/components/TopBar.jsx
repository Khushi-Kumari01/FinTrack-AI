import React, { useContext } from "react";
import { useNavigate } from "react-router-dom";
import { AuthContext } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import UpgradeButton from "./Profile";

const TopBar = () => {
  const navigate = useNavigate();
  const { user, logout } = useContext(AuthContext);
  const { theme, toggleTheme } = useTheme();

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <header className="topbar">
      <div className="topbar-left">
        <span className="pill pill-green">DEV</span>
        <span className="env-text">http://localhost:5000/api</span>
      </div>

      <div className="topbar-right">
        {/* Theme switch */}
        <button className="icon-btn" onClick={toggleTheme}>
          {theme === "dark" ? "🌙" : "☀️"}
        </button>

        {/* User profile chip */}
        <div className="user-chip">
          <div className="avatar-circle">
            {user?.name?.[0]?.toUpperCase() || "U"}
          </div>
          <div className="user-meta">
            <div className="user-name">{user?.name || "User"}</div>
            <div className="user-role">FinTrack</div>
          </div>
        </div>

        <UpgradeButton />

        {/* Logout */}
        <button className="logout-btn" onClick={handleLogout}>
          Logout
        </button>
      </div>
    </header>
  );
};

export default TopBar;
