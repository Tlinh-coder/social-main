// routes/postRoutes.js
const express = require("express");
const router = express.Router();
const {
  createPost,
  getPosts,
  updatePost,
  deletePost,
  reactToPost,
  getPost,
} = require("../controllers/postController");

// Đã gỡ bỏ authorizeAdmin ra khỏi import
const { protect } = require("../middlewares/authMiddleware");
const { uploadCloud } = require("../config/cloudinary");

// Yêu cầu đăng nhập cho tất cả các thao tác
router.use(protect);

// ==========================================
// 1. TẠO & SỬA & XÓA BÀI VIẾT (Dành cho MỌI USER)
// ==========================================
// Ai cũng có quyền đăng tối đa 10 ảnh
router.post("/", uploadCloud.array("images", 10), createPost);

// Cho phép thêm ảnh mới khi sửa bài viết
router.put("/:pid", uploadCloud.array("images", 10), updatePost);

router.delete("/:pid", deletePost);

// ==========================================
// 2. ĐỌC & TƯƠNG TÁC BÀI VIẾT
// ==========================================
router.get("/", getPosts);
router.get("/:pid", getPost);
router.put("/react/:pid", reactToPost);

module.exports = router;
