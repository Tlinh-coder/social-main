// controllers/authController.js
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const asyncHandler = require("express-async-handler");
const Joi = require("joi");
const User = require("../models/User");
const Otp = require("../models/Otp");
const sendEmail = require("../utils/sendEmail");
const Notification = require("../models/Notification");

// ==========================================
// HÀM TẠO TOKEN (ACCESS & REFRESH)
// ==========================================
const generateAccessToken = (id, role) => {
  return jwt.sign({ id, role }, process.env.JWT_SECRET, { expiresIn: "15m" });
};

const generateRefreshToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_REFRESH_SECRET, { expiresIn: "7d" });
};

// ==========================================
// SCHEMAS KIỂM TRA DỮ LIỆU ĐẦU VÀO (JOI)
// ==========================================
const registerSchema = Joi.object({
  email: Joi.string().email().required().messages({
    "string.email": "Email không đúng định dạng",
    "any.required": "Vui lòng nhập email",
  }),
  password: Joi.string().min(6).required().messages({
    "string.min": "Mật khẩu phải có ít nhất 6 ký tự",
    "any.required": "Vui lòng nhập mật khẩu",
  }),
  displayName: Joi.string().required(),
  bio: Joi.string().allow(""),
  otp: Joi.string().required(),
});

// ==========================================
// 1. GỬI OTP ĐĂNG KÝ
// ==========================================
exports.sendOtpToRegister = asyncHandler(async (req, res) => {
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ message: "Vui lòng cung cấp email!" });
  }

  const existingUser = await User.findOne({ email });
  console.log("existingUser", existingUser);
  if (existingUser) {
    return res.status(400).json({ message: "Email này đã được sử dụng!" });
  }

  const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
  await Otp.deleteMany({ email });
  await Otp.create({ email, otp: otpCode });

  const html = `Mã OTP đăng ký tài khoản của bạn là: <strong>${otpCode}</strong>. Mã có hiệu lực trong 5 phút.`;
  await sendEmail({ email, subject: "Mã xác nhận đăng ký Mạng Xã Hội", html });

  res
    .status(200)
    .json({ success: true, message: "Mã OTP đã được gửi đến email!" });
});

// ==========================================
// 2. XÁC NHẬN OTP & TẠO TÀI KHOẢN
// ==========================================
exports.verifyOtpAndRegister = asyncHandler(async (req, res) => {
  // Validate dữ liệu đầu vào
  const { error } = registerSchema.validate(req.body);
  if (error) {
    return res.status(400).json({ message: error.details[0].message });
  }

  const { email, password, displayName, bio, otp } = req.body;

  const otpRecord = await Otp.findOne({ email }).sort({ createdAt: -1 });
  if (!otpRecord || otpRecord.otp !== otp) {
    return res.status(400).json({
      success: false,
      message: "Mã OTP không hợp lệ hoặc đã hết hạn.",
    });
  }

  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(password, salt);

  const newUser = await User.create({
    email,
    password: hashedPassword,
    displayName,
    bio,
    avatar: {
      url: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRP3rZuuCpHH7wBvg1w0jZyPM38Ghn6EfQWYFXS90JiAw&s=10",
    },
    role: "user",
    status: "active",
  });

  await Otp.deleteMany({ email });

  res.status(201).json({
    success: true,
    message: "Đăng ký thành công! Bạn có thể đăng nhập ngay.",
  });
});

// ==========================================
// 3. ĐĂNG NHẬP
// ==========================================
exports.login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res
      .status(400)
      .json({ message: "Vui lòng nhập email và mật khẩu." });
  }

  const user = await User.findOne({ email });
  if (!user || user.status === "block") {
    return res
      .status(403)
      .json({ message: "Tài khoản không tồn tại hoặc đã bị khóa." });
  }

  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) {
    return res.status(400).json({ message: "Email hoặc mật khẩu không đúng." });
  }

  const accessToken = generateAccessToken(user._id, user.role);
  const refreshToken = generateRefreshToken(user._id);

  res.cookie("refreshToken", refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });

  res.status(200).json({
    _id: user._id,
    displayName: user.displayName,
    role: user.role,
    avatar: user.avatar.url,
    accessToken,
  });
});

// ==========================================
// 4. LÀM MỚI TOKEN (REFRESH TOKEN)
// ==========================================
exports.refreshToken = asyncHandler(async (req, res) => {
  const token = req.cookies.refreshToken;
  console.log("refreshToken", token);

  if (!token) {
    return res.status(401).json({
      message: "Không tìm thấy Refresh Token. Vui lòng đăng nhập lại.",
    });
  }

  try {
    // 1. Dùng try-catch với jwt.verify đồng bộ (không dùng callback)
    const decoded = jwt.verify(token, process.env.JWT_REFRESH_SECRET);

    // 2. PHẢI query lại User từ DB để lấy Role mới nhất (Phòng trường hợp Admin bị giáng chức hoặc User bị khóa)
    const user = await User.findById(decoded.id);

    if (!user || user.status === "block") {
      return res
        .status(403)
        .json({ message: "Tài khoản không tồn tại hoặc đã bị khóa." });
    }

    // 3. Tạo Access Token mới với Role chính xác
    const newAccessToken = generateAccessToken(user._id, user.role);

    return res.status(200).json({ accessToken: newAccessToken });
  } catch (err) {
    // Bắt lỗi Token hết hạn hoặc bị can thiệp
    return res
      .status(403)
      .json({ message: "Refresh Token hết hạn hoặc không hợp lệ." });
  }
});

// ==========================================
// 5. ĐĂNG XUẤT
// ==========================================
exports.logout = asyncHandler(async (req, res) => {
  res.clearCookie("refreshToken", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
  });
  res.status(200).json({ message: "Đã đăng xuất thành công!" });
});
// ==========================================
// 6. QUÊN MẬT KHẨU
// ==========================================
exports.forgotPassword = asyncHandler(async (req, res) => {
  const { email } = req.body;
  const user = await User.findOne({ email });

  if (!user || user.status === "block") {
    return res
      .status(404)
      .json({ message: "Tài khoản không tồn tại hoặc đã bị khóa." });
  }

  const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
  await Otp.deleteMany({ email });
  await Otp.create({ email, otp: otpCode });

  const html = `Mã khôi phục mật khẩu: <strong>${otpCode}</strong> (Hết hạn sau 5 phút).`;
  await sendEmail({ email, subject: "Mã OTP khôi phục mật khẩu", html });

  res.status(200).json({ success: true, message: "Mã OTP đã gửi." });
});

// ==========================================
// 7. ĐẶT LẠI MẬT KHẨU
// ==========================================
exports.verifyOtpAndResetPassword = asyncHandler(async (req, res) => {
  const { email, otpCode, newPassword } = req.body;

  if (!email || !otpCode || !newPassword || newPassword.length < 6) {
    return res
      .status(400)
      .json({ message: "Dữ liệu không hợp lệ. Mật khẩu cần ít nhất 6 ký tự." });
  }

  const otpRecord = await Otp.findOne({ email });
  if (!otpRecord || otpRecord.otp !== otpCode) {
    return res
      .status(400)
      .json({ message: "Mã OTP không hợp lệ hoặc đã hết hạn." });
  }

  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(newPassword, salt);

  await User.findOneAndUpdate({ email }, { password: hashedPassword });
  await Otp.deleteOne({ email });

  res
    .status(200)
    .json({ success: true, message: "Mật khẩu đã được cập nhật." });
});
