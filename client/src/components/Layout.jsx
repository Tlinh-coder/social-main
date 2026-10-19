import React from "react";
import { Outlet } from "react-router-dom";
import Navbar from "./Navbar";
import GlobalSocket from "./GlobalSocket";
import { Toaster } from "react-hot-toast"; // 1. IMPORT TOASTER Ở ĐÂY

const Layout = () => {
  return (
    <div className="min-h-screen bg-background relative transition-colors duration-300">
      {/* 2. ĐẶT TOASTER VÀO ĐÂY (Cài đặt z-index cực cao để nó luôn nổi lên trên cùng) */}
      <Toaster
        position="top-center"
        reverseOrder={false}
        toastOptions={{
          style: {
            zIndex: 999999, // Đảm bảo không bị thằng nào che mất
          },
        }}
      />

      {/* Radar chạy ngầm bắt thông báo và cuộc gọi ở mọi nơi */}
      <GlobalSocket />

      {/* Navbar luôn luôn nằm trên cùng */}
      <Navbar />

      <main>
        <Outlet />
      </main>
    </div>
  );
};

export default Layout;
