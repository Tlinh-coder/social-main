// server.js
const express = require("express");
const dotenv = require("dotenv");
const cors = require("cors");
const http = require("http");
const path = require("path");
const cookieParser = require("cookie-parser");
const connectDB = require("./config/db");
const initRoutes = require("./routes");
const { Server } = require("socket.io");
const User = require("./models/User");

dotenv.config();
connectDB();

const app = express();
app.set('trust proxy', 1);
app.use(
  cors({
    origin: process.env.CLIENT_URL, // Cho phép chính xác Frontend Vite của bạn truy cập
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  }),
);
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Tạo HTTP Server chuẩn
const server = http.createServer(app);

// 2. Khởi tạo Socket.io và cấu hình CORS để cho phép Frontend kết nối
const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL,
    methods: ["GET", "POST", "PUT", "DELETE"],
    credentials: true,
  },
});

// 3. MIDDLEWARE THẦN THÁNH: Bơm `io` vào `req` để dùng ở mọi Controller
app.set("io", io);

// Khởi tạo các routes API
initRoutes(app);

const onlineUsers = new Map();

// 4. LẮNG NGHE CÁC SỰ KIỆN KẾT NỐI WEBSOCKET
io.on("connection", (socket) => {
  console.log(`🔌 Thiết bị kết nối: ${socket.id}`);

  // 4.1 Điểm danh Trạng thái Hoạt động & Cổng thông báo cá nhân
  socket.on("join_user_room", (userId) => {
    if (!userId) return;

    // Ghi nhận thiết bị vào phòng thông báo cá nhân
    socket.join(userId);
    console.log(`👤 User ${userId} đã mở cổng thông báo cá nhân.`);
    socket.userId = userId;

    // XỬ LÝ MULTI-TABS: Nếu user chưa có trong danh sách online, tạo mới một Set chứa socketId
    if (!onlineUsers.has(userId)) {
      onlineUsers.set(userId, new Set());
    }
    onlineUsers.get(userId).add(socket.id);

    // Phát sóng danh sách ID duy nhất đang trực tuyến cho TẤT CẢ mọi người
    io.emit("update_online_users", Array.from(onlineUsers.keys()));
  });

  // 4.2 Tham gia phòng Toàn Server (Nhận thông báo từ Admin)
  socket.on("join_global_server", () => {
    socket.join("global_server");
    console.log(`🌍 Thiết bị ${socket.id} đã tham gia phòng Toàn Hệ Thống.`);
  });

  // 4.4 Luồng Chat: Vào phòng chat cụ thể
  socket.on("join_conversation", (conversationId) => {
    socket.join(conversationId);
    console.log(`💬 User gõ cửa vào phòng chat: ${conversationId}`);
  });

  socket.on("leave_conversation", (conversationId) => {
    socket.leave(conversationId);
    console.log(`🚪 User rời phòng chat: ${conversationId}`);
  });

  // 4.5 Luồng Chat: Gửi và nhận tin nhắn trực tiếp
  socket.on("send_message", (messageData) => {
    // messageData ở đây chính là Object Message hoàn chỉnh trả về từ Database
    const { receiver, parentMessage, referencedPost } = messageData;

    // Lấy ID phòng chat (thường là ID người nhận nếu chat đôi, hoặc ID nhóm chat)
    const roomTarget = messageData.conversationId || String(receiver);

    // 1. Bắn tin nhắn trực tiếp vào phòng cho người đang mở hộp thoại chat
    socket.to(roomTarget).emit("receive_message", messageData);

    // 2. Bắn cảnh báo Notification (Cục đỏ nhảy số) nếu người kia đang không mở khung chat
    const receiverId = typeof receiver === "object" ? receiver._id : receiver;
    if (receiverId) {
      socket.to(String(receiverId)).emit("new_message_notification", {
        sender: messageData.sender,
        content: messageData.content,
        images: messageData.images,
        parentMessage,
        referencedPost,
      });
    }
  });

  // 4.6 Xử lý ngắt kết nối (F5, tắt ứng dụng)
  socket.on("disconnect", async () => {
    console.log(`❌ Thiết bị ngắt kết nối: ${socket.id}`);

    // BỌC THÊM ĐIỀU KIỆN VÀ TRY CATCH ĐỂ CHỐNG SẬP SERVER
    if (socket.userId) {
      try {
        await User.findByIdAndUpdate(socket.userId, {
          lastActive: new Date(), // Lưu mốc thời gian vừa thoát
        });
      } catch (error) {
        console.error("Lỗi cập nhật lastActive:", error);
      }
    }

    // Duyệt qua danh sách để tìm và xóa socket.id vừa ngắt kết nối
    for (const [userId, socketIds] of onlineUsers.entries()) {
      if (socketIds.has(socket.id)) {
        socketIds.delete(socket.id); // Xóa socket của tab vừa tắt

        // Nếu user này KHÔNG còn tab nào khác đang mở (Set trống trơn) -> Người này chính thức Offline
        if (socketIds.size === 0) {
          onlineUsers.delete(userId);
        }
        break;
      }
    }

    // Cập nhật lại danh sách trực tuyến mới nhất cho những người còn lại
    io.emit("update_online_users", Array.from(onlineUsers.keys()));
  });

  socket.on("call_user", (data) => {
    /* data gửi lên bao gồm:
       - userToCall: ID của người nhận cuộc gọi
       - signalData: Thông số WebRTC (SDP Offer)
       - from: ID của người gọi (Người A)
       - callerInfo: { displayName, avatar } của người A
       - type: 'audio' hoặc 'video'
    */

    // Tổng đài chuyển tiếp cuộc gọi đến đúng phòng (room) của người B
    io.to(data.userToCall).emit("incoming_call", {
      signal: data.signalData,
      caller: {
        _id: data.from,
        displayName: data.callerInfo.displayName,
        avatar: data.callerInfo.avatar,
      },
      type: data.type,
    });
  });

  // 2. NGƯỜI B CHẤP NHẬN CUỘC GỌI (NHẤC MÁY)
  socket.on("answer_call", (data) => {
    /* data gửi lên bao gồm:
       - to: ID của người A (người gọi ban đầu)
       - signal: Thông số WebRTC (SDP Answer) của người B
    */

    // Báo lại cho người A biết người B đã nhấc máy kèm theo tín hiệu kết nối
    io.to(data.to).emit("call_accepted", data.signal);
  });

  // 3. KẾT NỐI MẠNG (ICE CANDIDATE)
  // Đây là quá trình hai bên liên tục gửi địa chỉ IP cho nhau để đục tường lửa kết nối P2P
  socket.on("ice_candidate", (data) => {
    io.to(data.to).emit("ice_candidate", data.candidate);
  });

  // 4. KẾT THÚC HOẶC TỪ CHỐI CUỘC GỌI
  socket.on("end_call", (data) => {
    // data.to: ID của đối phương
    io.to(data.to).emit("call_ended");
  });
});

// ==========================================
// 5. MIDDLEWARE BẮT LỖI TOÀN CỤC (Đã mở lại và tối ưu)
// ==========================================
app.use((err, req, res, next) => {
  const statusCode = res.statusCode === 200 ? 500 : res.statusCode;
  console.error("🔥 Lỗi Backend:", err.message);

  res.status(statusCode).json({
    success: false,
    message: err.message || "Lỗi server nội bộ!",
    // Ẩn chi tiết lỗi khi đưa lên server thực tế (production) để bảo mật
    stack: process.env.NODE_ENV === "production" ? null : err.stack,
  });
});

// ==========================================
// 6. PHỤC VỤ FILE FRONTEND (REACT/VITE)
// ==========================================
const frontendBuildPath = path.join(__dirname, "../client/dist");

app.use(express.static(frontendBuildPath));

app.get(/.*/, (req, res) => {
  res.sendFile(path.join(frontendBuildPath, "index.html"));
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`🚀 Server đang chạy real-time trên cổng ${PORT}`);
});
