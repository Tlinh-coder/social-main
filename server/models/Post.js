const mongoose = require("mongoose");

const postSchema = new mongoose.Schema(
  {
    content: {
      type: String,
      required: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    images: [
      {
        url: { type: String, required: true },
        public_id: { type: String, required: true },
      },
    ],
    reactions: [
      {
        user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        type: {
          type: String,
          enum: ["like", "love", "haha", "wow", "sad", "angry"],
          default: "love",
        },
      },
    ],

    // ==========================================
    // NÂNG CẤP DÀNH CHO MẠNG XÃ HỘI
    // ==========================================

    // 1. Quyền riêng tư của bài viết
    privacy: {
      type: String,
      enum: ["public", "followers", "private"],
      default: "public",
    },

    // 2. Lưu trữ các thẻ Hashtag (VD: ["#dulich", "#cuoituan"])
    hashtags: [
      {
        type: String,
      },
    ],

    // 3. Đánh dấu bài viết đã từng bị chỉnh sửa nội dung
    isEdited: {
      type: Boolean,
      default: false,
    },
    commentCount: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  },
);

module.exports = mongoose.model("Post", postSchema);
