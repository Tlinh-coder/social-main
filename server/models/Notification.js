const mongoose = require("mongoose");

const notificationSchema = new mongoose.Schema(
  {
    recipient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    type: {
      type: String,
      // ĐÃ XÓA 'inbox'. Giữ lại các tương tác chuẩn của Mạng xã hội:
      enum: ["reaction", "comment", "friend_request", "system", "post"],
      required: true,
    },
    content: {
      type: String,
      required: true,
    },
    post: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Post",
    },
    comment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Comment",
    },
    isRead: {
      type: Boolean,
      default: false,
    },
    readAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

// Tự động xóa thông báo sau 3 ngày kể từ lúc đọc
notificationSchema.index({ readAt: 1 }, { expireAfterSeconds: 259200 });

module.exports = mongoose.model("Notification", notificationSchema);
