// middlewares/authMiddleware.js
const jwt = require("jsonwebtoken");
const User = require("../models/User");

// 1. Kiểm tra xem user đã đăng nhập chưa (Token có hợp lệ không)
exports.protect = async (req, res, next) => {
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer")
  ) {
    try {
      // Lấy token từ header (Bearer token)
      token = req.headers.authorization.split(" ")[1];

      // Giải mã token để lấy user ID
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      // Tìm user trong DB (không lấy password)
      const currentUser = await User.findById(decoded.id).select("-password");

      // ==================================================
      // BỔ SUNG BẢO MẬT: KIỂM TRA TRẠNG THÁI NGƯỜI DÙNG
      // ==================================================
      if (!currentUser) {
        return res
          .status(401)
          .json({ message: "Người dùng này không còn tồn tại trên hệ thống!" });
      }

      if (currentUser.status === "block") {
        return res
          .status(403)
          .json({
            message: "Tài khoản của bạn đã bị khóa, không thể truy cập!",
          });
      }

      // Gán user hợp lệ vào request để các Controller sử dụng
      req.user = currentUser;

      next(); // Cho phép đi tiếp vào Controller
    } catch (error) {
      return res
        .status(401)
        .json({ message: "Không có quyền truy cập, token hỏng hoặc hết hạn!" });
    }
  }

  if (!token) {
    return res.status(401).json({ message: "Không tìm thấy token xác thực!" });
  }
};

// 2. Kiểm tra xem user có phải là Admin không
exports.authorizeAdmin = (req, res, next) => {
  if (req.user && req.user.role === "admin") {
    next(); // Là admin, cho đi tiếp
  } else {
    return res.status(403).json({
      message:
        "Truy cập bị từ chối! Chỉ Admin mới có quyền thực hiện hành động này.",
    });
  }
};
