// controllers/notificationController.js
const asyncHandler = require("express-async-handler");
const Notification = require("../models/Notification");

// ==========================================
// 1. LẤY DANH SÁCH THÔNG BÁO (CÓ PHÂN TRANG)
// ==========================================
const getNotifications = asyncHandler(async (req, res) => {
  const currentUserId = req.user._id;

  // Lấy page và limit từ query, nếu không có thì mặc định trang 1, 20 items
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 20;
  const skip = (page - 1) * limit;

  const notifications = await Notification.find({
    recipient: currentUserId,
    // Nên lấy tất cả các loại ngoại trừ tin nhắn (nếu tin nhắn bạn quản lý riêng)
    type: { $ne: "inbox" },
  })
    .sort("-createdAt")
    .skip(skip)
    .limit(limit)
    .populate("sender", "displayName avatar.url")
    .populate("post", "content");

  // Tính xem còn trang tiếp theo không để Frontend hiện nút "Xem thêm"
  const totalNotifications = await Notification.countDocuments({
    recipient: currentUserId,
    type: { $ne: "inbox" },
  });

  const hasMore = skip + notifications.length < totalNotifications;

  return res.status(200).json({
    success: true,
    data: notifications,
    pagination: {
      currentPage: page,
      hasMore: hasMore,
    },
  });
});

// ==========================================
// 2. LẤY SỐ LƯỢNG CHƯA ĐỌC
// ==========================================
const getCountNotification = asyncHandler(async (req, res) => {
  const currentUserId = req.user._id;

  // ĐÃ FIX BUG: Đếm tất cả thông báo hệ thống (loại trừ inbox)
  const unreadNotificationCount = await Notification.countDocuments({
    recipient: currentUserId,
    type: { $ne: "inbox" }, // Dùng $ne (not equal) sẽ bao quát cả post, comment, reaction, follow...
    isRead: false,
  });

  const unreadInbox = await Notification.countDocuments({
    recipient: currentUserId,
    type: "inbox",
    isRead: false,
  });

  return res.status(200).json({
    success: true,
    unreadNotificationCount,
    unreadInbox,
  });
});

// ==========================================
// 3. ĐÁNH DẤU TẤT CẢ LÀ ĐÃ ĐỌC (TÍNH NĂNG MỚI)
// ==========================================
const markAllAsRead = asyncHandler(async (req, res) => {
  const currentUserId = req.user._id;

  // Cập nhật toàn bộ thông báo chưa đọc của user này
  await Notification.updateMany(
    {
      recipient: currentUserId,
      isRead: false,
    },
    {
      $set: {
        isRead: true,
        readAt: new Date(), // Kích hoạt bộ đếm ngược xóa tự động (TTL Index)
      },
    },
  );

  return res.status(200).json({
    success: true,
    message: "Đã đánh dấu tất cả là đã đọc",
  });
});

// ==========================================
// 4. ĐÁNH DẤU 1 THÔNG BÁO LÀ ĐÃ ĐỌC
// ==========================================
const markAsRead = asyncHandler(async (req, res) => {
  const currentUserId = req.user._id;
  const { notificationId } = req.params;

  const notification = await Notification.findOneAndUpdate(
    {
      _id: notificationId,
      recipient: currentUserId,
      isRead: false,
    },
    {
      $set: {
        isRead: true,
        readAt: new Date(),
      },
    },
    { new: true },
  );

  if (!notification) {
    return res.status(404).json({
      success: false,
      message: "Không tìm thấy thông báo hoặc đã được đọc trước đó",
    });
  }

  return res.status(200).json({
    success: true,
    message: "Đã đánh dấu đọc",
    data: notification,
  });
});

// ==========================================
// 5. XÓA TẤT CẢ THÔNG BÁO
// ==========================================
const deleteAll = asyncHandler(async (req, res) => {
  const currentUserId = req.user._id;
  await Notification.deleteMany({ recipient: currentUserId });

  return res.status(200).json({
    success: true,
    message: "Tất cả thông báo đã được xóa",
  });
});

// Nhớ xuất đủ 5 hàm nhé
module.exports = {
  getNotifications,
  getCountNotification,
  markAllAsRead,
  markAsRead,
  deleteAll,
};
