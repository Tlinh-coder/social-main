// config/cloudinary.js
require("dotenv").config();
const cloudinary = require("cloudinary").v2;
const { CloudinaryStorage } = require("multer-storage-cloudinary");
const multer = require("multer");

// 1. Cấu hình thông số tài khoản Cloudinary từ file .env
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_NAME,
  api_key: process.env.CLOUDINARY_KEY,
  api_secret: process.env.CLOUDINARY_SECRET,
});

// 2. Thiết lập cấu hình lưu trữ
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: "diary_love_assets",
    allowed_formats: ["jpg", "jpeg", "png", "webp", "gif", "mp4"], // Đã thêm gif và mp4 cho tương lai
    resource_type: "auto", // TỰ ĐỘNG NHẬN DIỆN LÀ ẢNH HAY VIDEO
    // Tùy chọn nén ảnh tự động (Rất khuyên dùng để web load nhanh hơn)
    // transformation: [{ width: 1280, height: 1280, crop: 'limit' }]
  },
});

// 3. Khởi tạo middleware Multer với cấu hình lưu trữ VÀ GIỚI HẠN DUNG LƯỢNG
const uploadCloud = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // GIỚI HẠN DUNG LƯỢNG MỖI FILE LÀ 5MB
  },
});

module.exports = {
  cloudinary,
  uploadCloud,
};
