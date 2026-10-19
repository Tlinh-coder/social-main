import React, { useEffect } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
  Outlet,
} from "react-router-dom";

// 1. Import các Store (Zustand)
import { useAuthStore } from "./store/useAuthStore";
import { useThemeStore } from "./store/useThemeStore"; // <-- IMPORT THÊM THEME STORE NÀY

import Login from "./page/Login";
import Timeline from "./page/Timeline";
import Notifications from "./page/Notifications";
import Settings from "./page/Settings";
import Messages from "./page/Messages";
import Layout from "./components/Layout";
import People from "./page/People";
import Profile from "./page/Profile";
// import Request from "./pages/Requests";
// import UserManagement from "./pages/UserManagement";

// ==========================================
// KHIÊN BẢO VỆ 1: CHỈ NGƯỜI ĐÃ ĐĂNG NHẬP (USER & ADMIN)
// ==========================================
const ProtectedRoute = () => {
  // Lấy state trực tiếp từ Zustand
  const { user, isCheckingAuth } = useAuthStore();

  // Trạng thái đang kiểm tra Token lúc mới F5 web
  if (isCheckingAuth) {
    return (
      <div className="flex items-center justify-center min-h-screen text-blue-500 font-medium bg-blue-50/50">
        Đang tải dữ liệu...
      </div>
    );
  }

  // Nếu không có user -> Đá văng ra trang Login
  if (!user) return <Navigate to="/login" replace />;

  return <Outlet />;
};

// ==========================================
// KHIÊN BẢO VỆ 2: CHỈ ADMIN MỚI ĐƯỢC VÀO
// ==========================================
const AdminRoute = () => {
  const { user, accessToken } = useAuthStore();
  console.log({ user, accessToken });

  // Nếu là User thường mà cố tình gõ link /users -> Đá về trang chủ
  if (user?.role !== "admin") return <Navigate to="/" replace />;

  return <Outlet />;
};

function AppRoutes() {
  const { user } = useAuthStore();

  return (
    <Routes>
      {/* 1. TRANG PUBLIC (Không cần Layout) */}
      <Route
        path="/login"
        element={user ? <Navigate to="/" replace /> : <Login />}
      />

      {/* 2. NHÓM TRANG CẦN BẢO VỆ (Phải đăng nhập) */}
      <Route element={<ProtectedRoute />}>
        {/* 3. NHÓM TRANG DÙNG CHUNG NAVBAR (Sử dụng Layout) */}
        <Route element={<Layout />}>
          {/* Các trang ai cũng vào được */}
          <Route path="/" element={<Timeline />} />
          <Route path="/people" element={<People />} />
          <Route path="/profile/:userId" element={<Profile />} />
          <Route path="/messages" element={<Messages />} />
          <Route path="/notifications" element={<Notifications />} />
          <Route path="/settings" element={<Settings />} />

          {/* TRANG RIÊNG CỦA ADMIN: Được bọc thêm 1 lớp AdminRoute */}
          {/* <Route element={<AdminRoute />}>
            <Route path="/users" element={<UserManagement />} />
          </Route> */}
        </Route>
      </Route>
    </Routes>
  );
}

function App() {
  // Lấy hàm checkAuth từ Auth Store
  const { checkAuth } = useAuthStore();

  // Lấy hàm initTheme từ Theme Store
  const { initTheme } = useThemeStore();

  // Khởi động các cấu hình quan trọng ngay khi App chạy
  useEffect(() => {
    checkAuth(); // Kích hoạt kiểm tra phiên đăng nhập (Token)
    initTheme(); // Kích hoạt đọc Theme từ LocalStorage và áp dụng lên giao diện
  }, [checkAuth, initTheme]);

  return (
    <Router>
      <AppRoutes />
    </Router>
  );
}

export default App;
