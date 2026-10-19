// src/store/useAuthStore.js
import { create } from "zustand";
import api from "../utils/api";
import socket from "../utils/socket";

export const useAuthStore = create((set, get) => ({
  // 1. TRẠNG THÁI (STATE)
  // Lấy user từ LocalStorage lên (nếu có) để giao diện hiện ngay avatar/tên lúc F5
  user: JSON.parse(localStorage.getItem("user")) || null,
  accessToken: null,
  isAuthenticated: false,
  isCheckingAuth: true, // Ban đầu là true để hiện màn hình "Đang tải dữ liệu..."

  // 2. HÀM CẬP NHẬT NHANH TOKEN (Dành cho file api.js)
  setAccessToken: (token) => {
    set({ accessToken: token });
    // Nếu có token mới, cập nhật luôn chìa khóa cho Socket
    if (token && socket.connected) {
      socket.auth = { token: `Bearer ${token}` };
    }
  },

  // 3. ĐĂNG NHẬP
  login: (userData, token) => {
    // Lưu thông tin hiển thị (Avatar, Name) vào trình duyệt
    localStorage.setItem("user", JSON.stringify(userData));

    set({
      user: userData,
      accessToken: token,
      isAuthenticated: true,
      isCheckingAuth: false,
    });

    // Bật công tắc Socket Real-time
    socket.auth = { token: `Bearer ${token}` };
    socket.connect();
  },

  // 4. ĐĂNG XUẤT
  logout: async () => {
    try {
      // Báo cho Backend xóa HttpOnly Cookie
      await api.post("/api/auth/logout");
    } catch (error) {
      console.error("Lỗi khi đăng xuất:", error);
    } finally {
      // Dù API lỗi hay không, trên Frontend cũng phải "dọn dẹp" sạch sẽ
      localStorage.removeItem("user");
      set({
        user: null,
        accessToken: null,
        isAuthenticated: false,
      });
      // Rút phích cắm Socket
      socket.disconnect();
    }
  },

  // 5. CẬP NHẬT HỒ SƠ
  updateUser: (newData) =>
    set((state) => {
      const updatedUser = { ...state.user, ...newData };
      // Nhớ lưu cả vào LocalStorage để F5 không bị mất
      localStorage.setItem("user", JSON.stringify(updatedUser));
      return { user: updatedUser };
    }),

  // 6. KIỂM TRA PHIÊN ĐĂNG NHẬP (Chạy ở useEffect trong App.jsx)
  checkAuth: async () => {
    try {
      // Chủ động xin cấp lại Token bằng Refresh Token (nằm trong Cookie)
      const res = await api.get("/api/auth/refresh-token");
      const token = res.data.accessToken;
      const currentUser = get().user;

      if (token && currentUser) {
        set({
          accessToken: token,
          isAuthenticated: true,
          isCheckingAuth: false,
        });

        // Nối lại kết nối Socket nếu người dùng vừa tải lại trang
        socket.auth = { token: `Bearer ${token}` };
        if (!socket.connected) {
          socket.connect();
        }
      } else {
        // Có token nhưng mất user (VD: ai đó xóa LocalStorage) -> Buộc đăng xuất cho an toàn
        get().logout();
      }
    } catch (error) {
      // Bị lỗi (Cookie hết hạn hoặc không có) -> Đá văng về trang Login
      localStorage.removeItem("user");
      set({
        user: null,
        accessToken: null,
        isAuthenticated: false,
        isCheckingAuth: false,
      });
    }
  },
}));
