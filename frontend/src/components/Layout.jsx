// src/components/Layout.jsx
import React from "react";
import Sidebar from "./Sidebar";
import TopBar from "./TopBar";
import ChatUI from "./ChatUI";
import ToastHost from "./ToastHost";

const Layout = ({ children }) => {
  return (
    <div className="app-shell">
      <Sidebar />
      <div className="main-content">
        <TopBar />
        {children}
      </div>

      {/* Global helpers */}
      <ChatUI />
      <ToastHost />
    </div>
  );
};

export default Layout;
