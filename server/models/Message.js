const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema(
  {
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    receiver: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    content: {
      type: String,
      default: "", // Rỗng vì có thể chỉ gửi mỗi ảnh
    },
    images: [
      {
        url: { type: String, required: true },
        public_id: { type: String, required: true },
      },
    ],
    parentMessage: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Message",
      default: null,
    },
    referencedPost: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Post",
      default: null,
    },
    isRead: {
      type: Boolean,
      default: false,
    },

    // ==========================================
    // NHỮNG NÂNG CẤP MỚI CHO SOCIAL NETWORK
    // ==========================================

    // 1. Cờ đánh dấu tin nhắn đã bị thu hồi
    isRevoked: {
      type: Boolean,
      default: false,
    },

    // 2. Thả cảm xúc vào tin nhắn (Giống Messenger)
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

    // 3. ID Nhóm Chat (Chuẩn bị sẵn cho tương lai nếu bạn làm Group Chat)
    conversationId: {
      type: mongoose.Schema.Types.ObjectId, // ref: "Conversation" (Sau này nếu có)
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

module.exports = mongoose.model("Message", messageSchema);
