// src/utils/api.js
import axios from "axios";
// Import Zustand Store trực tiếp (không dùng hook) để xài ngoài file React
import { useAuthStore } from "../store/useAuthStore";

const api = axios.create({
  baseURL: import.meta.env.VITE_BACKEND_URL,
  withCredentials: true,
});

// =========================================================
// 1. GẮN ACCESS TOKEN VÀO MỌI REQUEST
// =========================================================
api.interceptors.request.use(
  (config) => {
    // Lấy token trực tiếp từ Zustand
    const token = useAuthStore.getState().accessToken;
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error),
);

// =========================================================
// 2. XỬ LÝ TỰ ĐỘNG REFRESH TOKEN KHI BỊ LỖI 401
// =========================================================
let isRefreshing = false;
let failedQueue = [];

// Hàm xử lý hàng đợi các API bị lỗi 401 cùng lúc
const processQueue = (error, token = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

api.interceptors.response.use(
  (response) => {
    return response;
  },
  async (error) => {
    const originalRequest = error.config;

    // Nếu lỗi 401 (Hết hạn Token) và request này chưa từng được retry
    if (error.response?.status === 401 && !originalRequest._retry) {
      // BƯỚC NGOẶT QUAN TRỌNG NHẤT (ĐÃ SỬA):
      // Thêm "/logout" vào danh sách chặn để khóa chết vòng lặp vô tận!
      if (
        originalRequest.url.includes("/login") ||
        originalRequest.url.includes("/refresh-token") ||
        originalRequest.url.includes("/logout")
      ) {
        return Promise.reject(error);
      }

      // NẾU ĐANG CÓ REQUEST KHÁC ĐI XIN REFRESH TOKEN RỒI -> CHO VÀO HÀNG ĐỢI
      if (isRefreshing) {
        return new Promise(function (resolve, reject) {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            originalRequest.headers.Authorization = "Bearer " + token;
            return api(originalRequest);
          })
          .catch((err) => Promise.reject(err));
      }

      // Đánh dấu là đang bắt đầu xin token mới
      originalRequest._retry = true;
      isRefreshing = true;

      try {
        // ĐÃ SỬA: Đổi sang axios.get() để đồng bộ với cách bạn gọi ở useAuthStore.js,
        // giúp triệt tiêu lỗi 404 Not Found (Trừ khi API backend của bạn bắt buộc dùng POST).
        const res = await axios.get(
          `${import.meta.env.VITE_BACKEND_URL}/api/auth/refresh-token`,
          { withCredentials: true },
        );
        console.log(res);
        const newAccessToken = res.data.accessToken;

        // Lưu Access Token mới vào Zustand
        useAuthStore.getState().setAccessToken(newAccessToken);

        // Chạy lại các request đang xếp hàng chờ
        processQueue(null, newAccessToken);

        // Chạy lại request ban đầu vừa bị lỗi
        originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
        return api(originalRequest);
      } catch (refreshError) {
        // NẾU REFRESH TOKEN CŨNG HẾT HẠN HOẶC BỊ XÓA -> BẮT BUỘC ĐĂNG XUẤT
        processQueue(refreshError, null);
        useAuthStore.getState().logout();

        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false; // Mở khóa cho phép refresh ở các lần sau
      }
    }

    return Promise.reject(error);
  },
);

export default api;
