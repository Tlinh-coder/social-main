const mongoose = require("mongoose");

const commentSchema = new mongoose.Schema(
  {
    post: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Post",
      required: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    content: {
      type: String,
      required: true,
    },
    // Bình luận cha (để làm tính năng Reply)
    parentComment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Comment",
      default: null,
    },
    // NÂNG CẤP 1: Cho phép đính kèm 1 ảnh trong bình luận (tuỳ chọn)
    image: {
      url: { type: String, default: "" },
      public_id: { type: String, default: "" },
    },
    // NÂNG CẤP 2: Cho phép thả cảm xúc vào bình luận
    reactions: [
      {
        user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        type: {
          type: String,
          enum: ["like", "love", "haha", "wow", "sad", "angry"],
          default: "like",
        },
      },
    ],
    // NÂNG CẤP 3: Cờ đánh dấu bình luận đã bị chỉnh sửa
    isEdited: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  },
);

module.exports = mongoose.model("Comment", commentSchema);
