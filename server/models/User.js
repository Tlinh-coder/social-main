const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
    },
    password: {
      type: String,
      required: true,
    },
    displayName: {
      type: String,
      required: true,
    },
    bio: {
      type: String,
      default: "",
    },
    role: {
      type: String,
      enum: ["admin", "user"],
      default: "user",
    },
    avatar: {
      url: { type: String, default: "" },
      public_id: { type: String, default: "" },
    },
    coverImage: {
      url: { type: String, default: "" },
      public_id: { type: String, default: "" },
    },
    status: {
      type: String,
      enum: ["active", "block"],
      default: "active", // ĐÃ ĐỔI THÀNH ACTIVE
    },

    lastActive: {
      type: Date,
      defaul: Date.now(),
    },

    // ==========================================
    // CÁC TÍNH NĂNG KẾT NỐI MẠNG XÃ HỘI
    // ==========================================
    friends: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    // CHUẨN BỊ SẴN CHO TÍNH NĂNG CHẶN NGƯỜI DÙNG (BLOCK)
    blockedUsers: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
  },
  {
    timestamps: true,
  },
);

module.exports = mongoose.model("User", userSchema);
