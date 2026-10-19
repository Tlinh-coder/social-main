import { io } from "socket.io-client";

// URL của Backend Server.
// Nếu sau này bạn deploy lên mạng, hãy thay localhost:5000 bằng domain thật của Backend
const SOCKET_URL = import.meta.env.VITE_SOCKET_URL;

// Khởi tạo kết nối
const socket = io(SOCKET_URL, {
  autoConnect: false, // Tắt tự động kết nối để kiểm soát (chỉ kết nối khi đã đăng nhập)
});

export default socket;
