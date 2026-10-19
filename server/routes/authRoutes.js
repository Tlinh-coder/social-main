// routes/authRoutes.js
const express = require("express");
const router = express.Router();
const rateLimit = require("express-rate-limit");

// Import Controllers
const {
  sendOtpToRegister,
  verifyOtpAndRegister,
  login,
  logout,
  forgotPassword,
  verifyOtpAndResetPassword,
  refreshToken, // Tính năng cấp lại Token mới
} = require("../controllers/authController");
const { protect } = require("../middlewares/authMiddleware");

// ==========================================
// CẤU HÌNH RATE LIMIT (CHỐNG SPAM)
// ==========================================
// Khóa IP nếu gọi API gửi OTP quá 3 lần trong 15 phút
const otpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 3,
  message: {
    message:
      "Bạn đã yêu cầu gửi mã quá nhiều lần. Vui lòng thử lại sau 15 phút.",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Khóa IP nếu đăng nhập sai quá 10 lần trong 10 phút (Chống dò mật khẩu)
const loginLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 10,
  message: {
    message: "Thao tác quá nhanh, hệ thống tạm khóa. Thử lại sau 10 phút.",
  },
});

// ==========================================
// CÁC ROUTES CÔNG KHAI
// ==========================================
router.post("/send-otp", otpLimiter, sendOtpToRegister); // Đã gắn khiên chống spam
router.post("/register", verifyOtpAndRegister);
router.post("/login", loginLimiter, login); // Đã gắn khiên chống spam
router.post("/forgot-password", otpLimiter, forgotPassword); // Đã gắn khiên chống spam
router.post("/reset-password", verifyOtpAndResetPassword);
router.get("/refresh-token", refreshToken); // Route cấp lại Access Token mới

// ==========================================
// CÁC ROUTES CẦN BẢO VỆ
// ==========================================
router.post("/logout", protect, logout);

module.exports = router;
