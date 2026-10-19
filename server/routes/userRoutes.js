// routes/userRoutes.js
const express = require("express");
const router = express.Router();
const {
  getCurrent,
  updateUser,
  getUsers,
  deleteUserByAdmin,
  getUser,
  blockUser,
  acceptFriendRequest,
  rejectFriendRequest,
  getSuggestions,
  getFriendRequests,
  getFriends,
  sendFriendRequest, // Bổ sung
  getUserProfile, // Bổ sung
  getSentFriendRequests,
  removeFriend,
} = require("../controllers/userController");
const { protect, authorizeAdmin } = require("../middlewares/authMiddleware");

// Import middleware uploadCloud
const { uploadCloud } = require("../config/cloudinary");

// ========================================================
// Tất cả các routes trong file này đều yêu cầu đăng nhập
// ========================================================
router.use(protect);

// ========================================================
// 1. CÁC ROUTE TĨNH (KHÔNG CÓ DẤU :) PHẢI ĐẶT LÊN TRÊN CÙNG
// ========================================================
router.get("/current", getCurrent);
router.get("/suggestions", getSuggestions);
router.get("/requests", getFriendRequests);
router.get("/friends", getFriends); // Bổ sung route lấy danh sách bạn bè

// Admin: Lấy danh sách tất cả user
router.get("/", getUsers);

// Cập nhật thông tin cá nhân (hứng 2 loại ảnh)
router.put(
  "/update",
  uploadCloud.fields([
    { name: "avatar", maxCount: 1 },
    { name: "coverImage", maxCount: 1 },
  ]),
  updateUser,
);

// ========================================================
// 2. CÁC ROUTE ĐỘNG CÓ TIỀN TỐ RIÊNG
// ========================================================
// Xử lý kết bạn
router.post("/requests/:targetUserId", sendFriendRequest); // Gửi yêu cầu
router.post("/requests/:requestId/accept", acceptFriendRequest); // Đồng ý
router.delete("/requests/:requestId/reject", rejectFriendRequest); // Từ chối

// Admin: Khóa tài khoản người dùng
router.put("/block/:uid", authorizeAdmin, blockUser);

// Lấy thông tin trang cá nhân kèm bài viết
router.get("/profile/:uid", getUserProfile);

// ========================================================
// 3. CÁC ROUTE ĐỘNG CATCH-ALL (CHỈ CÓ /:UID) BẮT BUỘC ĐỂ CUỐI CÙNG
// ========================================================
// Lấy thông tin cơ bản 1 user
router.get("/:uid", getUser);
router.delete("/friends/:id", protect, removeFriend);

// Admin: Xóa user
router.delete("/:uid", authorizeAdmin, deleteUserByAdmin);
router.get("/requests/sent", getSentFriendRequests);

module.exports = router;
