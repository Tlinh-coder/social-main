// src/components/Navbar.jsx
import React, { useState, useEffect, useCallback } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuthStore } from "../store/useAuthStore";
import {
  LogOut,
  Bell,
  MessageSquare,
  Home,
  Users,
  Settings as SettingsIcon,
} from "lucide-react";
import api from "../utils/api";
import socket from "../utils/socket";

const Navbar = () => {
  const { user, logout } = useAuthStore();
  const location = useLocation();
  const currentPath = location.pathname;

  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [friendRequestCount, setFriendRequestCount] = useState(0);

  // ==========================================
  // HÀM TẢI SỐ LƯỢNG CHUNG
  // ==========================================
  const fetchUnreadCounts = useCallback(async () => {
    if (!user) return;
    try {
      const res = await api.get("/api/notifications/count");
      if (res.data.success) {
        setUnreadNotifications(res.data.unreadNotificationCount);
        setUnreadMessages(res.data.unreadInbox);
      }

      if (!currentPath.startsWith("/people")) {
        const reqRes = await api.get("/api/users/requests");
        if (reqRes.data.success) {
          setFriendRequestCount(reqRes.data.data.length);
        }
      } else {
        setFriendRequestCount(0);
      }
    } catch (error) {
      console.error("Lỗi lấy số lượng thông báo/tin nhắn chưa đọc:", error);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  useEffect(() => {
    if (!user) return;
    fetchUnreadCounts();
  }, [user, fetchUnreadCounts]);

  useEffect(() => {
    if (currentPath.startsWith("/people")) {
      setFriendRequestCount(0);
    }
  }, [currentPath]);

  // ==========================================
  // 2. LẮNG NGHE SOCKET THỜI GIAN THỰC
  // ==========================================
  useEffect(() => {
    if (!socket || !user) return;

    socket.emit("join_user_room", user._id);
    socket.emit("join_global_server");

    const handleNewNotification = (notification) => {
      setUnreadNotifications((prev) => prev + 1);

      if (notification.type === "friend_request") {
        if (!window.location.pathname.startsWith("/people")) {
          setFriendRequestCount((prev) => prev + 1);
        }
      }
    };

    const handleReceiveMessage = (newMsg) => {
      const isMeReceiver = String(newMsg.receiver) === String(user._id);

      if (isMeReceiver) {
        setTimeout(() => {
          if (location.pathname !== "/messages") {
            setUnreadMessages((prev) => prev + 1);
          } else {
            fetchUnreadCounts();
          }
        }, 500);
      }
    };

    const handleForceLogout = (data) => {
      alert(
        data.message || "Tài khoản của bạn đã bị buộc đăng xuất từ hệ thống.",
      );
      logout();
    };

    socket.on("new_notification", handleNewNotification);
    socket.on("receive_message", handleReceiveMessage);
    socket.on("force_logout", handleForceLogout);

    return () => {
      socket.off("new_notification", handleNewNotification);
      socket.off("receive_message", handleReceiveMessage);
      socket.off("force_logout", handleForceLogout);
    };
  }, [user, location.pathname, fetchUnreadCounts, logout]);

  // ==========================================
  // 3. LẮNG NGHE SỰ KIỆN CUSTOM TỪ BÊN TRONG APP
  // ==========================================
  useEffect(() => {
    const handleRead = () =>
      setUnreadNotifications((prev) => Math.max(0, prev - 1));
    const handleClearAll = () => setUnreadNotifications(0);
    const handleUpdateUnreadMessages = () => fetchUnreadCounts();

    const handleFriendRequestHandled = () => {
      setFriendRequestCount((prev) => Math.max(0, prev - 1));
    };

    window.addEventListener("notification_read", handleRead);
    window.addEventListener("notifications_cleared", handleClearAll);
    window.addEventListener("update_unread_badge", handleUpdateUnreadMessages);
    window.addEventListener(
      "friend_request_handled",
      handleFriendRequestHandled,
    );

    return () => {
      window.removeEventListener("notification_read", handleRead);
      window.removeEventListener("notifications_cleared", handleClearAll);
      window.removeEventListener(
        "update_unread_badge",
        handleUpdateUnreadMessages,
      );
      window.removeEventListener(
        "friend_request_handled",
        handleFriendRequestHandled,
      );
    };
  }, [fetchUnreadCounts]);

  // 4. HÀM TẠO CLASS CHO NÚT BẤM (Sử dụng biến màu Theme)
  const getNavItemClass = (isActive) => {
    return `relative flex items-center justify-center p-2 sm:px-3 sm:py-2 rounded-xl transition-all duration-200 font-bold text-sm shrink-0 ${
      isActive
        ? "text-primary-600 bg-primary-50"
        : "text-muted hover:text-primary-600 hover:bg-hover"
    }`;
  };

  return (
    <>
      <style>
        {`
          .hide-scrollbar::-webkit-scrollbar {
            display: none;
          }
          .hide-scrollbar {
            -ms-overflow-style: none;
            scrollbar-width: none;
          }
        `}
      </style>

      {/* Đổi bg-white thành bg-surface, border-gray-200 thành border-border */}
      <nav className="bg-surface/95 backdrop-blur-md sticky top-0 z-40 border-b border-border shadow-sm transition-colors duration-300">
        <div className="max-w-6xl mx-auto px-2 sm:px-4 h-14 sm:h-16 flex items-center justify-between">
          {/* KHU VỰC TRÁI: LOGO */}
          <div className="flex items-center shrink-0 mr-2 sm:mr-6">
            <Link
              to="/"
              className="font-extrabold text-[19px] sm:text-2xl text-primary-600 tracking-tight"
            >
              HLSocial
            </Link>
          </div>

          {/* MENU ĐIỀU HƯỚNG BÊN PHẢI */}
          <div className="flex-1 flex justify-end min-w-0">
            <div className="flex items-center gap-0.5 sm:gap-2 overflow-x-auto hide-scrollbar max-w-full py-1">
              <Link to="/" className={getNavItemClass(currentPath === "/")}>
                <Home
                  className="w-[22px] h-[22px] sm:w-6 sm:h-6"
                  strokeWidth={isActive(currentPath, "/") ? 2.5 : 2}
                />
                <span className="hidden lg:block ml-2">Trang chủ</span>
              </Link>

              <Link
                to="/people"
                className={getNavItemClass(currentPath.startsWith("/people"))}
              >
                <div className="relative flex items-center justify-center">
                  <Users
                    className="w-[22px] h-[22px] sm:w-6 sm:h-6"
                    strokeWidth={currentPath.startsWith("/people") ? 2.5 : 2}
                  />
                  {friendRequestCount > 0 && (
                    <span className="absolute -top-1 -right-1.5 sm:-top-1.5 sm:-right-2 flex items-center justify-center min-w-[16px] h-[16px] sm:min-w-[18px] sm:h-[18px] px-1 bg-red-500 text-white text-[9px] sm:text-[11px] font-bold rounded-full border-2 border-surface shadow-sm">
                      {friendRequestCount > 99 ? "99+" : friendRequestCount}
                    </span>
                  )}
                </div>
                <span className="hidden lg:block ml-2">Mọi người</span>
              </Link>

              <Link
                to="/messages"
                className={getNavItemClass(currentPath.startsWith("/messages"))}
              >
                <div className="relative flex items-center justify-center">
                  <MessageSquare
                    className="w-[22px] h-[22px] sm:w-6 sm:h-6"
                    strokeWidth={currentPath.startsWith("/messages") ? 2.5 : 2}
                  />
                  {unreadMessages > 0 && (
                    <span className="absolute -top-1 -right-1.5 sm:-top-1.5 sm:-right-2 flex items-center justify-center min-w-[16px] h-[16px] sm:min-w-[18px] sm:h-[18px] px-1 bg-red-500 text-white text-[9px] sm:text-[11px] font-bold rounded-full border-2 border-surface shadow-sm">
                      {unreadMessages > 99 ? "99+" : unreadMessages}
                    </span>
                  )}
                </div>
                <span className="hidden lg:block ml-2">Tin nhắn</span>
              </Link>

              <Link
                to="/notifications"
                className={getNavItemClass(
                  currentPath.startsWith("/notifications"),
                )}
              >
                <div className="relative flex items-center justify-center">
                  <Bell
                    className="w-[22px] h-[22px] sm:w-6 sm:h-6"
                    strokeWidth={
                      currentPath.startsWith("/notifications") ? 2.5 : 2
                    }
                  />
                  {unreadNotifications > 0 && (
                    <span className="absolute -top-1 -right-1.5 sm:-top-1.5 sm:-right-1.5 flex items-center justify-center min-w-[16px] h-[16px] sm:min-w-[18px] sm:h-[18px] px-1 bg-red-500 text-white text-[9px] sm:text-[11px] font-bold rounded-full border-2 border-surface shadow-sm">
                      {unreadNotifications > 99 ? "99+" : unreadNotifications}
                    </span>
                  )}
                </div>
                <span className="hidden lg:block ml-2">Thông báo</span>
              </Link>

              {/* Vạch kẻ phân cách đổi sang biến border */}
              <div className="h-5 sm:h-8 w-px bg-border mx-0.5 sm:mx-2 shrink-0"></div>

              {/* NÚT CÀI ĐẶT */}
              <Link
                to="/settings"
                className="flex text-muted hover:text-primary-600 transition-colors p-1.5 sm:p-2 sm:bg-hover rounded-full hover:bg-primary-50 shrink-0"
                title="Cài đặt"
              >
                <SettingsIcon className="w-[22px] h-[22px] sm:w-5 sm:h-5" />
              </Link>

              {/* AVATAR NGƯỜI DÙNG */}
              <Link
                to={`/profile/${user?._id}`}
                className="hover:opacity-80 transition-opacity shrink-0 ml-0.5 sm:ml-1"
              >
                <img
                  src={
                    user?.avatar?.url ||
                    `https://ui-avatars.com/api/?name=${user?.displayName}`
                  }
                  alt="avatar"
                  className="w-7 h-7 sm:w-9 sm:h-9 rounded-full border border-border object-cover"
                />
              </Link>

              {/* NÚT ĐĂNG XUẤT */}
              <button
                onClick={logout}
                className="hidden sm:flex text-muted hover:text-red-600 transition-colors p-2 bg-hover rounded-full hover:bg-red-50 shrink-0 ml-1"
                title="Đăng xuất"
              >
                <LogOut size={20} />
              </button>
            </div>
          </div>
        </div>
      </nav>
    </>
  );
};

function isActive(currentPath, targetPath) {
  if (targetPath === "/") return currentPath === "/";
  return currentPath.startsWith(targetPath);
}

export default Navbar;
