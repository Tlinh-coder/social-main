// routes/messageRoutes.js
const express = require("express");
const router = express.Router();

const {
  sendMessage,
  getChatHistory,
  getInboxList,
  getContactList,
  getUnreadMessageCount,
  markMessagesAsRead,
  recallMessage,
} = require("../controllers/messageController");

const { protect } = require("../middlewares/authMiddleware");
const { uploadCloud } = require("../config/cloudinary");

// Bắt buộc đăng nhập cho TẤT CẢ các route bên dưới
router.use(protect);

// 1. Lấy tổng số tin nhắn chưa đọc toàn hệ thống
router.get("/unread-count", getUnreadMessageCount);

// 2. Lấy danh sách liên hệ để tạo chat mới (Giờ đây là lấy danh sách Bạn bè)
router.get("/contact-list", getContactList);

// 3. Lấy danh sách hộp thư đến (Inbox - Những người đã từng chat)
router.get("/inbox", getInboxList);

// 4. Lấy lịch sử chat với một user cụ thể (Phân trang)
router.get("/history/:userId", getChatHistory);

// 5. Đánh dấu toàn bộ tin nhắn từ 1 người gửi thành "Đã đọc"
router.put("/read/:senderId", markMessagesAsRead);

// 6. Thu hồi (xóa) 1 tin nhắn dựa vào ID tin nhắn
router.delete("/:messageId", recallMessage);

// 7. Gửi tin nhắn mới (Hỗ trợ upload tối đa 5 ảnh cùng lúc lên Cloudinary)
router.post("/", uploadCloud.array("images", 5), sendMessage);

module.exports = router;
