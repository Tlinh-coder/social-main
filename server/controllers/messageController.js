// controllers/messageController.js
const asyncHandler = require("express-async-handler");
const Message = require("../models/Message");
const User = require("../models/User");
const cloudinary = require("cloudinary").v2;

// ==========================================
// 1. GỬI TIN NHẮN (CHỈ DÀNH CHO BẠN BÈ)
// ==========================================
const sendMessage = asyncHandler(async (req, res) => {
  const { content, receiverId, parentMessage, referencedPost } = req.body;
  const senderId = req.user._id;

  if (!receiverId) {
    return res
      .status(400)
      .json({ success: false, message: "Vui lòng chọn người nhận tin nhắn" });
  }

  // Validate: Phải có ít nhất nội dung chữ HOẶC một tấm ảnh
  if (!content && (!req.files || req.files.length === 0)) {
    return res.status(400).json({
      success: false,
      message: "Vui lòng nhập tin nhắn hoặc chọn ảnh",
    });
  }

  // Kiểm tra người nhận có tồn tại không
  const receiverExists = await User.findById(receiverId);
  if (!receiverExists) {
    return res
      .status(404)
      .json({ success: false, message: "Người dùng không tồn tại" });
  }

  // Kiểm tra bảo mật: Chỉ cho phép nhắn tin nếu đã là bạn bè
  const senderUser = await User.findById(senderId).select("friends");
  const isFriend = senderUser.friends.some(
    (friendId) => friendId.toString() === receiverId.toString(),
  );

  if (!isFriend) {
    return res.status(403).json({
      success: false,
      message: "Bạn chỉ có thể nhắn tin với những người đã kết bạn!",
    });
  }

  // Xử lý mảng ảnh được Multer đẩy lên Cloudinary
  let uploadedImages = [];
  if (req.files && req.files.length > 0) {
    uploadedImages = req.files.map((file) => ({
      url: file.path,
      public_id: file.filename,
    }));
  }

  // Tạo record tin nhắn mới trong DB
  const message = await Message.create({
    sender: senderId,
    receiver: receiverId,
    content: content || "",
    images: uploadedImages,
    parentMessage: parentMessage || null,
    referencedPost: referencedPost || null,
  });

  // Populate thông tin người gửi & đính kèm
  await message.populate("sender", "displayName avatar.url");
  if (parentMessage) {
    await message.populate("parentMessage", "content images isRecalled");
  }
  if (referencedPost) {
    await message.populate("referencedPost", "content images");
  }

  // Bắn sự kiện real-time (Socket.io)
  const io = req.app.get("io");
  if (io) {
    const targetRoomId = receiverId.toString();

    io.to(targetRoomId).emit("receive_message", message);
    io.to(targetRoomId).emit("update_inbox", {
      newMessage: message,
      senderData: {
        _id: req.user._id,
        displayName: req.user.displayName,
        avatar: req.user.avatar,
      },
    });

    io.to(senderId.toString()).emit("update_inbox", {
      newMessage: message,
      senderData: {
        _id: receiverExists._id,
        displayName: receiverExists.displayName,
        avatar: receiverExists.avatar,
      },
    });
  }

  return res.status(201).json({
    success: true,
    data: message,
  });
});

// ==========================================
// 2. LẤY LỊCH SỬ CHAT CỤ THỂ
// ==========================================
const getChatHistory = asyncHandler(async (req, res) => {
  const currentUserId = req.user._id;
  const targetUserId = req.params.userId;

  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 30;
  const skip = (page - 1) * limit;

  const chatHistory = await Message.find({
    $or: [
      { sender: currentUserId, receiver: targetUserId },
      { sender: targetUserId, receiver: currentUserId },
    ],
  })
    .sort("-createdAt")
    .skip(skip)
    .limit(limit)
    .populate("sender", "displayName avatar.url")
    .populate("receiver", "displayName avatar.url")
    .populate("parentMessage", "content images isRecalled")
    .populate("referencedPost", "content images");

  const sortedChat = chatHistory.reverse();
  const hasMore = chatHistory.length === limit;

  return res.status(200).json({
    success: true,
    data: sortedChat,
    pagination: {
      currentPage: page,
      hasMore: hasMore,
    },
  });
});

// ==========================================
// 3. LẤY DANH SÁCH HỘP THƯ (INBOX - CÓ LASTACTIVE)
// ==========================================
const getInboxList = asyncHandler(async (req, res) => {
  const currentUserId = req.user._id;

  const inboxList = await Message.aggregate([
    {
      $match: {
        $or: [{ sender: currentUserId }, { receiver: currentUserId }],
      },
    },
    { $sort: { createdAt: -1 } },
    {
      $group: {
        _id: {
          $cond: [{ $eq: ["$sender", currentUserId] }, "$receiver", "$sender"],
        },
        lastMessage: { $first: "$content" },
        lastImages: { $first: "$images" },
        isRecalled: { $first: "$isRecalled" },
        createdAt: { $first: "$createdAt" },
        isRead: { $first: "$isRead" },
        lastSender: { $first: "$sender" },
        unreadCount: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $eq: ["$receiver", currentUserId] },
                  { $eq: ["$isRead", false] },
                ],
              },
              1,
              0,
            ],
          },
        },
      },
    },
    {
      $lookup: {
        from: "users",
        localField: "_id",
        foreignField: "_id",
        as: "userDetail",
      },
    },
    { $unwind: { path: "$userDetail", preserveNullAndEmptyArrays: true } },
    {
      $project: {
        _id: 1,
        lastMessage: 1,
        lastImages: 1,
        isRecalled: 1,
        createdAt: 1,
        isRead: 1,
        lastSender: 1,
        unreadCount: 1,
        "userDetail.displayName": 1,
        "userDetail.avatar.url": 1,
        "userDetail.lastActive": 1, // Đã bổ sung lastActive để Frontend hiển thị trạng thái
      },
    },
    { $sort: { createdAt: -1 } },
  ]);

  return res.status(200).json({ success: true, data: inboxList });
});

// ==========================================
// 4. LẤY DANH SÁCH GỢI Ý CHAT (BẠN BÈ)
// ==========================================
const getContactList = asyncHandler(async (req, res) => {
  const currentUserId = req.user._id;

  const user = await User.findById(currentUserId).populate(
    "friends",
    "displayName avatar.url createdAt lastActive", // Đã bổ sung lastActive
  );

  return res.status(200).json({
    success: true,
    data: user.friends,
  });
});

// ==========================================
// 5. ĐẾM TỔNG TIN CHƯA ĐỌC
// ==========================================
const getUnreadMessageCount = asyncHandler(async (req, res) => {
  const currentUserId = req.user._id;

  const unreadCount = await Message.countDocuments({
    receiver: currentUserId,
    isRead: false,
  });

  return res.status(200).json({ success: true, count: unreadCount });
});

// ==========================================
// 6. ĐÁNH DẤU ĐÃ ĐỌC
// ==========================================
const markMessagesAsRead = asyncHandler(async (req, res) => {
  const currentUserId = req.user._id;
  const senderId = req.params.senderId;

  const updatedMessages = await Message.updateMany(
    { sender: senderId, receiver: currentUserId, isRead: false },
    { $set: { isRead: true } },
  );

  if (updatedMessages.modifiedCount > 0) {
    const io = req.app.get("io");
    if (io) {
      io.to(senderId.toString()).emit("message_seen", {
        readerId: currentUserId,
        chatWithId: currentUserId,
      });
    }
  }

  return res
    .status(200)
    .json({ success: true, message: "Đã cập nhật trạng thái đọc" });
});

// ==========================================
// 7. THU HỒI TIN NHẮN
// ==========================================
const recallMessage = asyncHandler(async (req, res) => {
  const { messageId } = req.params;
  const userId = req.user._id;

  const message = await Message.findById(messageId);

  if (!message) {
    return res
      .status(404)
      .json({ success: false, message: "Không tìm thấy tin nhắn" });
  }

  if (message.sender.toString() !== userId.toString()) {
    return res.status(403).json({
      success: false,
      message: "Bạn không có quyền thu hồi tin nhắn này",
    });
  }

  if (message.images && message.images.length > 0) {
    for (const image of message.images) {
      if (image.public_id) {
        try {
          await cloudinary.uploader.destroy(image.public_id);
        } catch (error) {
          console.error("Lỗi xóa ảnh khi thu hồi:", error);
        }
      }
    }
  }

  message.content = "Tin nhắn đã bị thu hồi";
  message.images = [];
  message.isRecalled = true;
  await message.save();

  const io = req.app.get("io");
  if (io) {
    const targetRoomId = message.receiver.toString();
    const payload = { messageId: message._id, content: message.content };
    io.to(targetRoomId).emit("message_recalled", payload);
    io.to(userId.toString()).emit("message_recalled", payload);
  }

  return res.status(200).json({
    success: true,
    message: "Đã thu hồi tin nhắn",
    data: message,
  });
});

module.exports = {
  sendMessage,
  getChatHistory,
  getInboxList,
  getContactList,
  getUnreadMessageCount,
  markMessagesAsRead,
  recallMessage,
};
