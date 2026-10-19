import { create } from "zustand";

export const useThemeStore = create((set) => ({
  // Mặc định đọc từ localStorage, nếu chưa có thì lấy 'light' (Sáng)
  theme: localStorage.getItem("theme") || "light",

  // Hàm thay đổi Theme
  setTheme: (newTheme) => {
    // 1. Lưu vào LocalStorage
    localStorage.setItem("theme", newTheme);
    // 2. Thêm attribute data-theme vào thẻ <html> để CSS nhận diện
    document.documentElement.setAttribute("data-theme", newTheme);
    // 3. Cập nhật State
    set({ theme: newTheme });
  },

  // Hàm khởi tạo (Gọi 1 lần khi App chạy)
  initTheme: () => {
    const savedTheme = localStorage.getItem("theme") || "light";
    document.documentElement.setAttribute("data-theme", savedTheme);
    set({ theme: savedTheme });
  },
}));
