const asyncHandler = require("express-async-handler");
const mongoose = require("mongoose");
const User = require("../models/User");
const Post = require("../models/Post");
const Notification = require("../models/Notification");
const FriendRequest = require("../models/FriendRequest");
const { cloudinary } = require("../config/cloudinary");

// ==========================================
// 1. LẤY THÔNG TIN CÁ NHÂN (CỦA USER ĐANG ĐĂNG NHẬP)
// ==========================================
const getCurrent = asyncHandler(async (req, res) => {
  return res.status(200).json({
    success: true,
    data: req.user,
  });
});

// ==========================================
// 2. CẬP NHẬT THÔNG TIN CÁ NHÂN
// ==========================================
const updateUser = asyncHandler(async (req, res) => {
  const { _id } = req.user;

  if (
    Object.keys(req.body).length === 0 &&
    (!req.files || Object.keys(req.files).length === 0)
  ) {
    throw new Error("Vui lòng cung cấp dữ liệu cần cập nhật");
  }

  const { displayName, bio } = req.body;
  const dataToUpdate = {};

  if (displayName) dataToUpdate.displayName = displayName;
  if (bio !== undefined) dataToUpdate.bio = bio;

  const currentUser = await User.findById(_id);

  if (req.files && req.files.avatar) {
    if (currentUser.avatar && currentUser.avatar.public_id) {
      await cloudinary.uploader.destroy(currentUser.avatar.public_id);
    }
    dataToUpdate.avatar = {
      url: req.files.avatar[0].path,
      public_id: req.files.avatar[0].filename,
    };
  }

  if (req.files && req.files.coverImage) {
    if (currentUser.coverImage && currentUser.coverImage.public_id) {
      await cloudinary.uploader.destroy(currentUser.coverImage.public_id);
    }
    dataToUpdate.coverImage = {
      url: req.files.coverImage[0].path,
      public_id: req.files.coverImage[0].filename,
    };
  }

  const updatedUser = await User.findByIdAndUpdate(_id, dataToUpdate, {
    returnDocument: "after",
  }).select("-password -role");

  return res.status(200).json({
    success: true,
    message: "Cập nhật thông tin thành công",
    data: updatedUser,
  });
});

// ==========================================
// 3. ADMIN: LẤY DANH SÁCH TOÀN BỘ USERS
// ==========================================
const getUsers = asyncHandler(async (req, res) => {
  const queries = { ...req.query };
  const excludeFields = ["limit", "sort", "page", "fields", "search"];
  excludeFields.forEach((el) => delete queries[el]);
  let formatedQueries = { ...queries };

  // 1. Loại trừ bản thân ra khỏi kết quả tìm kiếm
  formatedQueries._id = { $ne: req.user._id };

  if (req.query.search) {
    formatedQueries.$or = [
      { displayName: { $regex: req.query.search, $options: "i" } },
      { email: { $regex: req.query.search, $options: "i" } },
    ];
  }

  // THÊM .lean() ĐỂ CHO PHÉP CHỈNH SỬA OBJECT DATA
  let queryCommand = User.find(formatedQueries).select("-password").lean();

  if (req.query.sort) {
    const sortBy = req.query.sort.split(",").join(" ");
    queryCommand = queryCommand.sort(sortBy);
  } else {
    queryCommand = queryCommand.sort("displayName");
  }

  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 20;
  const skip = (page - 1) * limit;
  queryCommand = queryCommand.skip(skip).limit(limit);

  const users = await queryCommand;
  const counts = await User.countDocuments(formatedQueries);

  // ========================================================
  // 2. TÍNH TOÁN TRẠNG THÁI KẾT BẠN CHO TỪNG KẾT QUẢ TÌM KIẾM
  // ========================================================
  // Lấy danh sách bạn bè hiện tại
  const currentUser = await User.findById(req.user._id).select("friends");

  // Lấy tất cả yêu cầu kết bạn (Gửi đi và Nhận về)
  const pendingRequests = await FriendRequest.find({
    $or: [{ sender: req.user._id }, { receiver: req.user._id }],
  });

  // Gắn trạng thái vào từng user
  const usersWithStatus = users.map((u) => {
    let status = "none"; // Mặc định chưa kết bạn
    let requestId = null; // Cần ID của request để Hủy hoặc Chấp nhận

    // Kiểm tra xem đã là bạn bè chưa
    const isFriend = currentUser.friends.some(
      (friendId) => friendId.toString() === u._id.toString(),
    );

    if (isFriend) {
      status = "friend"; // Đã là bạn bè
    } else {
      // Tìm xem có request nào kẹt giữa 2 người không
      const reqRel = pendingRequests.find(
        (pr) =>
          pr.sender.toString() === u._id.toString() ||
          pr.receiver.toString() === u._id.toString(),
      );

      if (reqRel) {
        requestId = reqRel._id;
        if (reqRel.sender.toString() === req.user._id.toString()) {
          status = "sent"; // Mình đã gửi cho họ
        } else {
          status = "received"; // Họ đã gửi cho mình
        }
      }
    }

    return {
      ...u,
      connectionStatus: status,
      requestId: requestId,
    };
  });

  return res.status(200).json({
    success: true,
    counts,
    users: usersWithStatus, // Trả về mảng đã được gắn trạng thái
  });
});

// ==========================================
// 4. ADMIN: XÓA USER BẤT KỲ
// ==========================================
const deleteUserByAdmin = asyncHandler(async (req, res) => {
  const { uid } = req.params;
  const user = await User.findByIdAndDelete(uid);
  const io = req.app.get("io");

  if (io && user) {
    io.to(user._id.toString()).emit("force_logout", {
      message: "Tài khoản của bạn đã bị Quản trị viên xóa do vi phạm quy định!",
    });
  }

  return res.status(200).json({
    success: user ? true : false,
    message: user ? `Đã xóa user thành công` : "Không tìm thấy user",
  });
});

// ==========================================
// 5. LẤY THÔNG TIN CHI TIẾT 1 USER BẤT KỲ
// ==========================================
const getUser = asyncHandler(async (req, res) => {
  const { uid } = req.params;
  console.log(uid);
  const user = await User.findById(uid).select("-password").lean();

  if (!user) {
    return res
      .status(404)
      .json({ success: false, message: "Không tìm thấy người dùng" });
  }

  let status = "none";
  let requestId = null;

  // Nếu KHÔNG PHẢI trang của chính mình -> Kiểm tra mối quan hệ
  if (req.user._id.toString() !== user._id.toString()) {
    const currentUser = await User.findById(req.user._id);

    // Kiểm tra xem có trong danh sách bạn bè chưa
    const isFriend = currentUser.friends.some(
      (id) => id.toString() === user._id.toString(),
    );

    if (isFriend) {
      status = "friend";
    } else {
      // Tìm xem có request nào đang gửi qua lại không
      const request = await FriendRequest.findOne({
        $or: [
          { sender: req.user._id, receiver: user._id },
          { sender: user._id, receiver: req.user._id },
        ],
      });

      if (request) {
        requestId = request._id;
        if (request.sender.toString() === req.user._id.toString()) {
          status = "sent"; // Mình đã gửi cho họ
        } else {
          status = "received"; // Họ gửi cho mình
        }
      }
    }
  }

  res.status(200).json({
    success: true,
    data: {
      ...user,
      connectionStatus: status,
      requestId: requestId,
    },
  });
});

// ==========================================
// 6. KHÓA TÀI KHOẢN (BLOCK)
// ==========================================
const blockUser = asyncHandler(async (req, res) => {
  const { uid } = req.params;
  const user = await User.findById(uid);

  if (!user)
    return res
      .status(404)
      .json({ success: false, message: "Không tìm thấy người dùng" });

  if (user.status === "block") {
    user.status = "active";
    await user.save();
    return res
      .status(200)
      .json({ success: true, message: `Đã mở khóa cho ${user.displayName}` });
  }

  user.status = "block";
  await user.save();

  const io = req.app.get("io");
  if (io) {
    io.to(user._id.toString()).emit("force_logout", {
      message:
        "Tài khoản của bạn đã bị Quản trị viên khóa do vi phạm quy định!",
    });
  }

  return res
    .status(200)
    .json({ success: true, message: `Đã khóa tài khoản ${user.displayName}` });
});

// ==========================================
// 7. LẤY THÔNG TIN TRANG CÁ NHÂN (Profile + Bài viết)
// ==========================================
const getUserProfile = asyncHandler(async (req, res) => {
  const { uid } = req.params;
  const user = await User.findById(uid).select("-password");

  if (!user)
    return res
      .status(404)
      .json({ success: false, message: "Không tìm thấy người dùng" });

  const posts = await Post.find({ user: uid })
    .populate("user", "displayName avatar.url")
    .populate("reactions.user", "displayName avatar.url")
    .sort({ createdAt: -1 });

  return res.status(200).json({
    success: true,
    data: {
      profile: user,
      posts: posts,
    },
  });
});

// ==========================================
// 8. GỬI YÊU CẦU KẾT BẠN (Hàm mới bổ sung)
// ==========================================
const sendFriendRequest = asyncHandler(async (req, res) => {
  const senderId = req.user._id;
  const { targetUserId } = req.params;

  if (senderId.toString() === targetUserId) {
    return res
      .status(400)
      .json({ success: false, message: "Không thể tự kết bạn với chính mình" });
  }

  const currentUser = await User.findById(senderId);
  if (currentUser.friends.includes(targetUserId)) {
    return res.status(400).json({ success: false, message: "Đã là bạn bè" });
  }

  const existingRequest = await FriendRequest.findOne({
    $or: [
      { sender: senderId, receiver: targetUserId },
      { sender: targetUserId, receiver: senderId },
    ],
  });

  if (existingRequest) {
    return res
      .status(400)
      .json({ success: false, message: "Yêu cầu kết bạn đã tồn tại" });
  }

  // 1. Tạo yêu cầu kết bạn
  await FriendRequest.create({
    sender: senderId,
    receiver: targetUserId,
  });

  // ==========================================
  // THÊM XỬ LÝ THÔNG BÁO VÀ THỜI GIAN THỰC
  // ==========================================

  // 2. Lưu thông báo vào Database
  const notification = await Notification.create({
    recipient: targetUserId, // ĐỔI TÊN Ở ĐÂY
    sender: senderId,
    type: "friend_request",
    content: "đã gửi cho bạn một yêu cầu kết bạn",
    // link: `/people`
  });

  // Lấy thêm thông tin người gửi (Tên, Avatar) để bắn qua Socket
  await notification.populate("sender", "displayName avatar");

  // 3. Bắn sự kiện Real-time qua Socket.IO
  const io = req.app.get("io"); // Lấy instance của io đã cấu hình trong server
  if (io) {
    // Chỉ gửi thông báo đích danh tới phòng (room) có ID của người nhận
    io.to(targetUserId.toString()).emit("new_notification", notification);
  }

  return res
    .status(200)
    .json({ success: true, message: "Đã gửi yêu cầu kết bạn" });
});

// ==========================================
// 9. CHẤP NHẬN YÊU CẦU KẾT BẠN
// ==========================================
const acceptFriendRequest = asyncHandler(async (req, res) => {
  const currentUserId = req.user._id;
  const { requestId } = req.params;

  const request = await FriendRequest.findById(requestId);
  if (!request) {
    return res.status(404).json({
      success: false,
      message: "Yêu cầu không tồn tại hoặc đã bị xóa",
    });
  }

  if (String(request.receiver) !== String(currentUserId)) {
    return res
      .status(403)
      .json({ success: false, message: "Không có quyền thao tác" });
  }

  const senderId = request.sender;

  await Promise.all([
    User.findByIdAndUpdate(currentUserId, { $addToSet: { friends: senderId } }),
    User.findByIdAndUpdate(senderId, { $addToSet: { friends: currentUserId } }),
  ]);

  await FriendRequest.findByIdAndDelete(requestId);

  res.status(200).json({ success: true, message: "Đã trở thành bạn bè!" });
});

// ==========================================
// 10. TỪ CHỐI / XÓA YÊU CẦU KẾT BẠN
// ==========================================
const rejectFriendRequest = asyncHandler(async (req, res) => {
  const currentUserId = req.user._id;
  const { requestId } = req.params;

  const request = await FriendRequest.findById(requestId);
  if (!request) {
    return res
      .status(404)
      .json({ success: false, message: "Yêu cầu không tồn tại" });
  }

  if (
    String(request.receiver) !== String(currentUserId) &&
    String(request.sender) !== String(currentUserId)
  ) {
    return res
      .status(403)
      .json({ success: false, message: "Không có quyền thao tác" });
  }

  await FriendRequest.findByIdAndDelete(requestId);

  res.status(200).json({ success: true, message: "Đã xóa yêu cầu kết bạn" });
});

// ==========================================
// 11. LẤY DANH SÁCH GỢI Ý (DỰA TRÊN BẠN CHUNG)
// ==========================================
const getSuggestions = asyncHandler(async (req, res) => {
  const currentUserId = new mongoose.Types.ObjectId(req.user._id);

  const currentUser = await User.findById(currentUserId);
  if (!currentUser) {
    return res
      .status(404)
      .json({ success: false, message: "Không tìm thấy người dùng" });
  }
  const currentUserFriends = currentUser.friends || [];

  const pendingRequests = await FriendRequest.find({
    $or: [{ sender: currentUserId }, { receiver: currentUserId }],
  });

  const pendingIds = pendingRequests.map((req) =>
    String(req.sender) === String(currentUserId)
      ? new mongoose.Types.ObjectId(req.receiver)
      : new mongoose.Types.ObjectId(req.sender),
  );

  const excludedIds = [currentUserId, ...currentUserFriends, ...pendingIds];

  const suggestions = await User.aggregate([
    { $match: { _id: { $nin: excludedIds } } },
    {
      $addFields: {
        mutualFriendsCount: {
          $size: {
            $setIntersection: [
              { $ifNull: ["$friends", []] },
              currentUserFriends,
            ],
          },
        },
      },
    },
    { $sort: { mutualFriendsCount: -1 } },
    { $limit: 10 },
    {
      $project: {
        displayName: 1,
        avatar: 1,
        mutualFriendsCount: 1,
      },
    },
  ]);

  res.status(200).json({ success: true, data: suggestions });
});

// ==========================================
// 12. LẤY DANH SÁCH YÊU CẦU KẾT BẠN ĐẾN (Đã sửa lỗi logic)
// ==========================================
const getFriendRequests = asyncHandler(async (req, res) => {
  const currentUserId = req.user._id;

  const requests = await FriendRequest.find({
    receiver: currentUserId,
  })
    .populate("sender", "displayName avatar")
    .sort({ createdAt: -1 });

  const formattedRequests = requests.map((req) => ({
    requestId: req._id,
    ...req.sender._doc,
    time: req.createdAt,
  }));

  res.status(200).json({ success: true, data: formattedRequests });
});

// ==========================================
// 13. LẤY DANH SÁCH BẠN BÈ HIỆN TẠI
// ==========================================
const getFriends = asyncHandler(async (req, res) => {
  const currentUser = await User.findById(req.user._id).populate(
    "friends",
    "displayName avatar role",
  );

  res.status(200).json({ success: true, data: currentUser.friends });
});

const getSentFriendRequests = asyncHandler(async (req, res) => {
  const currentUserId = req.user._id;

  const requests = await FriendRequest.find({
    sender: currentUserId, // Tìm những request do BẠN gửi đi
  })
    .populate("receiver", "displayName avatar") // Lấy thông tin người nhận
    .sort({ createdAt: -1 });

  // Format lại dữ liệu cho giống với frontend
  const formattedRequests = requests.map((req) => ({
    requestId: req._id,
    ...req.receiver._doc,
    time: req.createdAt,
  }));

  res.status(200).json({ success: true, data: formattedRequests });
});

const removeFriend = asyncHandler(async (req, res) => {
  const targetUserId = req.params.id;
  const currentUserId = req.user._id;

  // 1. Xóa ID của người kia khỏi danh sách bạn bè của MÌNH
  await User.findByIdAndUpdate(currentUserId, {
    $pull: { friends: targetUserId },
  });

  // 2. Xóa ID của mình khỏi danh sách bạn bè của NGƯỜI KIA
  await User.findByIdAndUpdate(targetUserId, {
    $pull: { friends: currentUserId },
  });

  res.status(200).json({
    success: true,
    message: "Đã hủy kết bạn thành công",
  });
});

module.exports = {
  getCurrent,
  updateUser,
  getUsers,
  deleteUserByAdmin,
  getUser,
  blockUser,
  getUserProfile,
  sendFriendRequest, // Export hàm mới
  getSuggestions,
  getFriendRequests,
  getFriends,
  acceptFriendRequest,
  rejectFriendRequest,
  getSentFriendRequests,
  removeFriend,
};
