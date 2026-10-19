const mongoose = require("mongoose");

const otpSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
  },
  otp: {
    type: String,
    required: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
    expires: 300, // Cứ sau 300 giây (5 phút), MongoDB sẽ tự động xóa mã OTP này
  },
});

module.exports = mongoose.model("Otp", otpSchema);
