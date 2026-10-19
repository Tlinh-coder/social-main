// routes/commentRoutes.js
const express = require("express");
const router = express.Router();
const {
  createComment,
  getPostComments,
  deleteComment,
  updateComment, // Import thêm
  reactToComment, // Import thêm
} = require("../controllers/commentController");
const { protect } = require("../middlewares/authMiddleware");
const { uploadCloud } = require("../config/cloudinary");

router.use(protect);

// ==========================================
// 1. CÁC API TƯƠNG TÁC VỚI BÀI VIẾT (POST)
// ==========================================
router.get("/:postId", getPostComments);
router.post(
  "/:postId",
  uploadCloud.single("image"), // Cho phép Frontend gửi kèm 1 file ảnh có key là "image"
  createComment,
);

// ==========================================
// 2. CÁC API TƯƠNG TÁC TRỰC TIẾP VỚI BÌNH LUẬN
// ==========================================

// Sửa bình luận
router.put("/:commentId", updateComment);

router.put("/:commentId/react", reactToComment);

// Xóa bình luận
router.delete("/:commentId", deleteComment);

module.exports = router;
