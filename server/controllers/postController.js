// controllers/postController.js
const asyncHandler = require("express-async-handler");
const Post = require("../models/Post");
const Notification = require("../models/Notification");
const Comment = require("../models/Comment");
const User = require("../models/User");
const { cloudinary } = require("../config/cloudinary");

// ==========================================
// 1. TẠO BÀI VIẾT MỚI
// ==========================================
const createPost = asyncHandler(async (req, res) => {
  const { content } = req.body;

  if (!content && (!req.files || req.files.length === 0)) {
    return res.status(400).json({
      success: false,
      message: "Nội dung bài viết hoặc hình ảnh không được để trống",
    });
  }

  let uploadedImages = [];
  if (req.files && req.files.length > 0) {
    uploadedImages = req.files.map((file) => ({
      url: file.path,
      public_id: file.filename,
    }));
  }

  // 1. TẠO BÀI VIẾT VÀ LẤY THÔNG TIN
  const newPost = await Post.create({
    user: req.user._id,
    content,
    images: uploadedImages,
  });

  await newPost.populate("user", "displayName avatar.url");

  // ========================================================
  // 2. TRẢ VỀ RESPONSE NGAY LẬP TỨC (Không bắt Client chờ)
  // ========================================================
  res.status(201).json({
    success: true,
    message: "Tạo bài viết thành công",
    data: newPost,
  });

  // ========================================================
  // 3. XỬ LÝ BACKGROUND: THÔNG BÁO VÀ REALTIME SOCKET
  // Chạy logic trong hàm vô danh để không block quá trình trả response
  // ========================================================
  (async () => {
    try {
      // Chỉ select trường friends (danh sách ID), không cần populate để nhẹ DB
      const currentUser = await User.findById(req.user._id).select("friends");

      if (currentUser && currentUser.friends.length > 0) {
        // Tạo mảng thông báo
        const notifications = currentUser.friends.map((friendId) => ({
          recipient: friendId,
          sender: req.user._id,
          type: "post",
          content: `${req.user.displayName} vừa đăng một bài viết mới! 📢`,
          post: newPost._id,
        }));

        // Insert đồng loạt vào DB
        await Notification.insertMany(notifications);

        const io = req.app.get("io");
        if (io) {
          currentUser.friends.forEach((friendId) => {
            const socketId = friendId.toString();

            // A. Sự kiện 1: Báo cho Quả chuông thông báo (Topbar)
            io.to(socketId).emit("new_notification", {
              message: `${req.user.displayName} vừa đăng bài viết mới!`,
              post: newPost._id,
            });

            // B. Sự kiện 2: Báo cho Bảng tin Timeline (Gửi toàn bộ object bài viết)
            io.to(socketId).emit("new_timeline_post", newPost);
          });
        }
      }
    } catch (error) {
      console.error("Lỗi khi phát thông báo ngầm:", error);
    }
  })();
});
// ==========================================
// 2. LẤY DANH SÁCH BÀI VIẾT (Timeline)
// ==========================================
// Đừng quên import Model User ở đầu file nếu chưa có
// const User = require("../models/User");

const getPosts = asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const skip = (page - 1) * limit;

  // Nhận userId từ query (VD: /api/posts?userId=123)
  const targetUserId = req.query.userId;
  const currentUserId = req.user._id;

  // 1. Lấy danh sách bạn bè của user hiện tại
  const currentUser = await User.findById(currentUserId).select("friends");
  const friendIds = currentUser.friends.map((id) => id.toString());

  // 2. Tạo bộ lọc (Filter)
  let queryFilter = {};

  if (targetUserId) {
    // TRƯỜNG HỢP 2: Lấy bài viết của 1 người cụ thể (Trang cá nhân)
    const isSelf = targetUserId === currentUserId.toString();
    const isFriend = friendIds.includes(targetUserId);

    if (!isSelf && !isFriend) {
      // Nếu không phải mình và cũng không phải bạn bè -> Trả về lỗi 403 (Không có quyền)
      // (Hoặc bạn có thể return data: [] nếu muốn giao diện không báo lỗi đỏ)
      return res.status(403).json({
        success: false,
        message: "Bạn chỉ có thể xem bài viết của bạn bè.",
      });
    }

    // Đủ điều kiện -> Lấy bài của đúng người này
    queryFilter = { user: targetUserId };
  } else {
    // TRƯỜNG HỢP 1: Lấy Bảng tin (Lấy bài của BẢN THÂN và BẠN BÈ)
    // Toán tử $in sẽ tìm tất cả bài viết có thuộc tính 'user' nằm trong mảng truyền vào
    queryFilter = {
      user: { $in: [...currentUser.friends, currentUserId] },
    };
  }

  // 3. Truy vấn DB có kèm theo queryFilter
  // TỐI ƯU SIÊU TỐC: Dùng lean() và giới hạn kết quả trả về
  const posts = await Post.find(queryFilter)
    .sort("-createdAt")
    .skip(skip)
    .limit(limit)
    .populate("user", "displayName avatar.url")
    .populate("reactions.user", "displayName avatar.url")
    .lean();

  // Đếm tổng số bài viết CŨNG PHẢI ĐẾM THEO FILTER (Để tính tổng số trang chính xác)
  const totalPosts = await Post.countDocuments(queryFilter);

  return res.status(200).json({
    success: true,
    totalPosts,
    totalPages: Math.ceil(totalPosts / limit),
    currentPage: page,
    data: posts,
  });
});
const getPost = asyncHandler(async (req, res) => {
  const { pid } = req.params;

  const post = await Post.findById(pid)
    .populate("user", "displayName avatar.url")
    .populate("reactions.user", "displayName avatar.url");

  if (!post) {
    return res
      .status(404)
      .json({ success: false, message: "Không tìm thấy bài viết" });
  }

  return res.status(200).json({
    success: true,
    data: post,
  });
});

// ==========================================
// 3. CẬP NHẬT BÀI VIẾT (CÓ XỬ LÝ ẢNH MỚI)
// ==========================================
const updatePost = asyncHandler(async (req, res) => {
  const { pid } = req.params;
  const { content } = req.body;

  const post = await Post.findById(pid);
  if (!post) {
    return res
      .status(404)
      .json({ success: false, message: "Không tìm thấy bài viết" });
  }

  // PHÂN QUYỀN: Chỉ chủ bài viết hoặc Admin mới được sửa
  if (
    post.user.toString() !== req.user._id.toString() &&
    req.user.role !== "admin"
  ) {
    return res
      .status(403)
      .json({ success: false, message: "Bạn không có quyền sửa bài viết này" });
  }

  post.content = content || post.content;

  // NẾU CÓ UPLOAD ẢNH MỚI -> Dọn rác ảnh cũ trên Cloudinary rồi gán ảnh mới vào
  if (req.files && req.files.length > 0) {
    // 1. Xóa ảnh cũ trên Cloudinary
    if (post.images && post.images.length > 0) {
      const deleteImagePromises = post.images.map((img) =>
        cloudinary.uploader.destroy(img.public_id),
      );
      await Promise.all(deleteImagePromises);
    }

    // 2. Gán ảnh mới
    post.images = req.files.map((file) => ({
      url: file.path,
      public_id: file.filename,
    }));
  }

  await post.save();
  await post.populate("user", "displayName avatar.url");

  return res.status(200).json({
    success: true,
    message: "Cập nhật bài viết thành công",
    data: post,
  });
});

// ==========================================
// 4. XÓA BÀI VIẾT
// ==========================================
const deletePost = asyncHandler(async (req, res) => {
  const { pid } = req.params;

  const post = await Post.findById(pid);
  if (!post) {
    return res
      .status(404)
      .json({ success: false, message: "Không tìm thấy bài viết" });
  }

  // PHÂN QUYỀN: Chỉ chủ bài viết hoặc Admin mới được xóa
  if (
    post.user.toString() !== req.user._id.toString() &&
    req.user.role !== "admin"
  ) {
    return res
      .status(403)
      .json({ success: false, message: "Bạn không có quyền xóa bài viết này" });
  }

  // Xóa ảnh trên Cloudinary
  if (post.images && post.images.length > 0) {
    const deleteImagePromises = post.images.map((img) =>
      cloudinary.uploader.destroy(img.public_id),
    );
    await Promise.all(deleteImagePromises);
  }

  await post.deleteOne(); // Dùng deleteOne thay cho findByIdAndDelete vì ta đã tìm ra document
  await Comment.deleteMany({ post: pid });

  return res.status(200).json({
    success: true,
    message: "Đã xóa bài viết và toàn bộ ảnh đi kèm thành công!",
  });
});

// ==========================================
// 5. THẢ CẢM XÚC BÀI VIẾT
// ==========================================
const reactToPost = asyncHandler(async (req, res) => {
  const { pid } = req.params;
  const { type } = req.body;
  const { _id, displayName } = req.user;

  const post = await Post.findById(pid);
  if (!post) {
    return res
      .status(404)
      .json({ success: false, message: "Không tìm thấy bài viết" });
  }

  const existingReactionIndex = post.reactions.findIndex(
    (reaction) => reaction.user.toString() === _id.toString(),
  );

  let isUnliked = false;

  if (existingReactionIndex !== -1) {
    if (post.reactions[existingReactionIndex].type === type) {
      post.reactions.splice(existingReactionIndex, 1);
      isUnliked = true;
    } else {
      post.reactions[existingReactionIndex].type = type;
    }
  } else {
    post.reactions.push({ user: _id, type });
  }

  await post.save();

  // FIX LỖI GIẬT LAG: Phải populate lại mảng reactions trước khi trả về cho Frontend
  await post.populate("reactions.user", "displayName avatar.url");

  // Bắn thông báo
  if (!isUnliked && post.user.toString() !== _id.toString()) {
    const notification = await Notification.create({
      recipient: post.user,
      sender: _id,
      type: "reaction",
      post: pid,
      content: `${displayName} đã thả ${type} lên bài viết của bạn! ❤️`,
    });

    // Populate người gửi để Frontend hiện Avatar trong popup thông báo
    await notification.populate("sender", "displayName avatar.url");

    const io = req.app.get("io");
    if (io) {
      io.to(post.user.toString()).emit("new_notification", notification);
    }
  }

  return res.status(200).json({
    success: true,
    message: "Cập nhật cảm xúc thành công",
    data: post.reactions, // Lúc này dữ liệu đã có đủ Tên và Avatar
  });
});

module.exports = {
  createPost,
  getPosts,
  updatePost,
  deletePost,
  reactToPost,
  getPost,
};
