const express = require("express");
const router = express.Router();
const {
  getNotifications,
  markAsRead,
  markAllAsRead, // <-- TÍNH NĂNG MỚI NÊN THÊM
  getCountNotification,
  deleteAll,
} = require("../controllers/notificationController");
const { protect } = require("../middlewares/authMiddleware");

// Tất cả các route bên dưới đều bắt buộc đăng nhập (Chỉ khai báo 1 lần ở đây)
router.use(protect);

// 1. Lấy danh sách thông báo
router.get("/", getNotifications);

// 2. Lấy số lượng thông báo chưa đọc (Hiển thị cục đỏ Navbar)
router.get("/count", getCountNotification);

// 3. Đánh dấu TẤT CẢ thông báo thành "Đã đọc" (Nút Mark All as Read)
router.put("/read-all", markAllAsRead);

// 4. Đánh dấu 1 thông báo cụ thể thành "Đã đọc" (Khi user click vào thông báo)
router.put("/:notificationId/read", markAsRead);

// 5. Xóa tất cả thông báo
router.delete("/", deleteAll);

module.exports = router;
