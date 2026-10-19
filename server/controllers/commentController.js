// controllers/commentController.js
const asyncHandler = require("express-async-handler");
const Comment = require("../models/Comment");
const Post = require("../models/Post");
const Notification = require("../models/Notification");
const { cloudinary } = require("../config/cloudinary");

// ==========================================
// 1. TẠO BÌNH LUẬN MỚI
// ==========================================
const createComment = asyncHandler(async (req, res) => {
  const { postId } = req.params;
  const { content, parentComment } = req.body;
  const { _id } = req.user; // _id của người đang comment

  if (!content) {
    return res.status(400).json({
      success: false,
      message: "Nội dung bình luận không được để trống",
    });
  }

  const post = await Post.findById(postId);
  if (!post) {
    return res
      .status(404)
      .json({ success: false, message: "Bài viết không tồn tại" });
  }

  // 1. Tạo bình luận lưu vào DB

  const commentData = {
    post: postId,
    user: _id,
    content,
    parentComment: parentComment || null,
  };

  // NẾU CÓ ẢNH ĐƯỢC GỬI KÈM -> Thêm vào object
  if (req.file) {
    commentData.image = {
      url: req.file.path,
      public_id: req.file.filename,
    };
  }

  const comment = await Comment.create(commentData);

  // 2. TỐI ƯU HIỆU NĂNG: Tăng bộ đếm bình luận của Bài viết lên 1
  await Post.findByIdAndUpdate(postId, { $inc: { commentCount: 1 } });

  // 3. Lấy thông tin người tạo để trả về ngay cho Frontend hiển thị
  await comment.populate("user", "displayName avatar.url");

  // ==========================================
  // 4. PHÁT SÓNG THÔNG BÁO (BỔ SUNG THÔNG BÁO KÉP)
  // ==========================================
  const io = req.app.get("io");

  if (io) {
    // KỊCH BẢN A: Đây là một câu Trả Lời (Reply)
    if (parentComment) {
      const parent = await Comment.findById(parentComment);

      if (parent) {
        // Hành động 1: Gửi thông báo cho CHỦ NHÂN CỦA BÌNH LUẬN GỐC
        if (parent.user.toString() !== _id.toString()) {
          const replyNotification = await Notification.create({
            recipient: parent.user,
            sender: _id,
            type: "comment",
            post: postId,
            comment: comment._id,
            content: `${req.user.displayName} đã trả lời bình luận của bạn! 💬`,
          });
          await replyNotification.populate("sender", "displayName avatar.url");
          io.to(parent.user.toString()).emit(
            "new_notification",
            replyNotification,
          );
        }

        // Hành động 2 (MỚI): Gửi thông báo cho CHỦ BÀI VIẾT
        // Điều kiện chặn spam:
        // 1. Người comment KHÔNG PHẢI là chủ bài viết
        // 2. Chủ bài viết KHÔNG PHẢI là chủ của bình luận gốc (Tránh nhận 2 thông báo cùng lúc)
        if (
          post.user.toString() !== _id.toString() &&
          post.user.toString() !== parent.user.toString()
        ) {
          const postOwnerNotification = await Notification.create({
            recipient: post.user,
            sender: _id,
            type: "comment",
            post: postId,
            comment: comment._id, // Trỏ thẳng vào comment mới để bấm vào là nhảy tới
            content: `${req.user.displayName} cũng đã bình luận về bài viết của bạn.`,
          });
          await postOwnerNotification.populate(
            "sender",
            "displayName avatar.url",
          );
          io.to(post.user.toString()).emit(
            "new_notification",
            postOwnerNotification,
          );
        }
      }
    }
    // KỊCH BẢN B: Đây là Bình luận gốc (Bình luận thẳng vào bài viết)
    else {
      // Chỉ gửi thông báo cho CHỦ BÀI VIẾT
      if (post.user.toString() !== _id.toString()) {
        const notification = await Notification.create({
          recipient: post.user,
          sender: _id,
          type: "comment",
          post: postId,
          comment: comment._id,
          content: `${req.user.displayName} vừa bình luận về bài viết của bạn! 💌`,
        });
        await notification.populate("sender", "displayName avatar.url");
        io.to(post.user.toString()).emit("new_notification", notification);
      }
    }
    const roomName = postId.toString();
    io.to(roomName).emit("receive_new_comment", comment);
  }

  return res.status(201).json({
    success: true,
    message: "Đã thêm bình luận",
    data: comment,
  });
});

// ==========================================
// 2. LẤY DANH SÁCH BÌNH LUẬN (PHÂN TRANG 2 CẤP ĐỘ NHƯ FACEBOOK)
// ==========================================
const getPostComments = asyncHandler(async (req, res) => {
  const { postId } = req.params;

  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10; // Mỗi lần bấm "Xem thêm" tải 10 bình luận
  const skip = (page - 1) * limit;

  // FIX LỖI: Đếm tổng số lượng bình luận gốc trước để dùng cho phân trang
  const totalRootComments = await Comment.countDocuments({
    post: postId,
    parentComment: null,
  });

  // BƯỚC 1: Chỉ lấy các Bình luận Gốc (Không có cha) của trang hiện tại
  const rootComments = await Comment.find({ post: postId, parentComment: null })
    .sort({ createdAt: -1 }) // Gốc thì lấy mới nhất lên đầu
    .skip(skip)
    .limit(limit)
    .populate("user", "displayName avatar.url")
    .lean();

  // BƯỚC 2: Lấy tất cả ID của các bình luận gốc vừa tìm được
  const rootCommentIds = rootComments.map((comment) => comment._id);

  // BƯỚC 3: Tìm TẤT CẢ các câu trả lời (replies) thuộc về nhóm bình luận gốc trên
  const replies = await Comment.find({ parentComment: { $in: rootCommentIds } })
    .sort({ createdAt: 1 }) // Trả lời thì xếp từ cũ đến mới (đọc từ trên xuống dưới)
    .populate("user", "displayName avatar.url")
    .lean();

  // BƯỚC 4: Phân phối reply vào đúng mảng `replies` của từng bình luận gốc
  rootComments.forEach((root) => {
    root.replies = replies.filter(
      (reply) => reply.parentComment.toString() === root._id.toString(),
    );
  });

  return res.status(200).json({
    success: true,
    pagination: {
      currentPage: page,
      totalPages: Math.ceil(totalRootComments / limit),
      hasNextPage: skip + rootComments.length < totalRootComments,
    },
    data: rootComments, // Trả về cấu trúc cây 2 cấp siêu phẳng
  });
});

// ==========================================
// 3. XÓA BÌNH LUẬN (VÀ DỌN DẸP BÌNH LUẬN CON)
// ==========================================
const deleteComment = asyncHandler(async (req, res) => {
  const { commentId } = req.params;

  const comment = await Comment.findById(commentId);
  if (!comment) {
    return res
      .status(404)
      .json({ success: false, message: "Không tìm thấy bình luận" });
  }

  // PHÂN QUYỀN: Chỉ chủ nhân bình luận HOẶC Admin mới được xóa
  if (
    comment.user.toString() !== req.user._id.toString() &&
    req.user.role !== "admin"
  ) {
    return res.status(403).json({
      success: false,
      message: "Bạn không có quyền xóa bình luận này",
    });
  }

  if (comment.image && comment.image.public_id) {
    await cloudinary.uploader.destroy(comment.image.public_id);
  }

  // 1. Xóa tất cả các bình luận con (reply) của bình luận này (nếu có)
  const deletedReplies = await Comment.deleteMany({ parentComment: commentId });

  // 2. Tính tổng số bình luận đã thực sự bị xóa (1 bình luận mẹ + số lượng bình luận con)
  const totalDeleted = 1 + deletedReplies.deletedCount;

  // 3. Xóa bình luận mẹ
  await comment.deleteOne();

  // 4. Trừ chính xác số lượng khỏi bộ đếm commentCount của Bài viết
  await Post.findByIdAndUpdate(comment.post, {
    $inc: { commentCount: -totalDeleted },
  });

  const io = req.app.get("io");
  if (io) {
    io.to(comment.post.toString()).emit("receive_deleted_comment", {
      commentId: commentId,
      parentComment: comment.parentComment, // Gửi kèm ID cha để Frontend biết đường gỡ reply con
    });
  }

  return res.status(200).json({
    success: true,
    message: "Đã xóa bình luận",
  });
});

const updateComment = asyncHandler(async (req, res) => {
  const { commentId } = req.params;
  const { content } = req.body;
  const userId = req.user._id;

  if (!content) {
    return res
      .status(400)
      .json({ success: false, message: "Nội dung không được để trống" });
  }

  const comment = await Comment.findById(commentId);
  if (!comment) {
    return res
      .status(404)
      .json({ success: false, message: "Không tìm thấy bình luận" });
  }

  // Phân quyền: Chỉ chủ nhân bình luận mới được sửa
  if (comment.user.toString() !== userId.toString()) {
    return res.status(403).json({
      success: false,
      message: "Bạn không có quyền sửa bình luận này",
    });
  }

  comment.content = content;
  comment.isEdited = true; // Bật cờ "Đã chỉnh sửa" lên
  await comment.save();

  // Populate lại thông tin user để trả về Frontend
  await comment.populate("user", "displayName avatar.url");

  const io = req.app.get("io");
  if (io) {
    io.to(comment.post.toString()).emit("receive_updated_comment", comment);
  }

  return res.status(200).json({
    success: true,
    message: "Đã cập nhật bình luận",
    data: comment,
  });
});

// ==========================================
// 5. THÍCH / BỎ THÍCH BÌNH LUẬN
// ==========================================
const reactToComment = asyncHandler(async (req, res) => {
  const { commentId } = req.params;
  const { reactionType } = req.body; // Nhận loại cảm xúc từ Frontend (VD: "love", "haha")
  const userId = req.user._id;

  // Nếu Frontend không gửi loại cảm xúc, mặc định là "like"
  const typeToApply = reactionType || "like";

  const comment = await Comment.findById(commentId);
  if (!comment) {
    return res
      .status(404)
      .json({ success: false, message: "Không tìm thấy bình luận" });
  }

  // Tìm xem User này đã từng thả cảm xúc vào bình luận này chưa
  const existingReaction = comment.reactions.find(
    (r) => r.user.toString() === userId.toString(),
  );

  if (existingReaction) {
    // TRƯỜNG HỢP 1: ĐÃ THẢ CẢM XÚC RỒI
    if (existingReaction.type === typeToApply) {
      // Bấm lại đúng cảm xúc cũ => Xóa cảm xúc (Unlike)
      comment.reactions = comment.reactions.filter(
        (r) => r.user.toString() !== userId.toString(),
      );
      await comment.save();
      return res
        .status(200)
        .json({ success: true, message: "Đã gỡ cảm xúc", data: comment });
    } else {
      // Bấm cảm xúc mới => Cập nhật loại cảm xúc (Ví dụ: Từ Like chuyển sang Love)
      existingReaction.type = typeToApply;
      await comment.save();
      return res
        .status(200)
        .json({ success: true, message: "Đã cập nhật cảm xúc", data: comment });
    }
  } else {
    // TRƯỜNG HỢP 2: CHƯA THẢ CẢM XÚC => TIẾN HÀNH THÊM MỚI
    comment.reactions.push({ user: userId, type: typeToApply });
    await comment.save();

    // --- Bắn thông báo cho chủ nhân bình luận ---
    const io = req.app.get("io");
    if (io && comment.user.toString() !== userId.toString()) {
      const notification = await Notification.create({
        recipient: comment.user,
        sender: userId,
        type: "reaction", // Loại thông báo là Reaction
        post: comment.post,
        comment: comment._id,
        content: `${req.user.displayName} đã bày tỏ cảm xúc về bình luận của bạn.`,
      });
      await notification.populate("sender", "displayName avatar.url");
      io.to(comment.user.toString()).emit("new_notification", notification);
    }

    if (io) {
      io.to(comment.post.toString()).emit("receive_comment_reaction", {
        commentId: comment._id,
        reactions: comment.reactions, // Gửi lại mảng cảm xúc mới nhất để Frontend tự đếm và vẽ lại
      });
    }

    return res
      .status(200)
      .json({ success: true, message: "Đã thêm cảm xúc", data: comment });
  }
});

module.exports = {
  createComment,
  getPostComments,
  deleteComment,
  updateComment,
  reactToComment,
};
