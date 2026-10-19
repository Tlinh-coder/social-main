import React, { useState, useEffect } from "react";
import {
  Bell,
  Loader2,
  Heart,
  MessageCircle,
  UserPlus,
  Info,
  Trash2,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import api from "../utils/api";

const Notifications = () => {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [clearing, setClearing] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchNotifications = async () => {
      try {
        const res = await api.get("/api/notifications");
        if (res.data.success) {
          setNotifications(res.data.data);
        }
      } catch (error) {
        console.error("Lỗi lấy thông báo:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchNotifications();
  }, []);

  // XỬ LÝ CLICK THÔNG BÁO
  const handleNotificationClick = (notif) => {
    // 1. Đánh dấu đọc
    if (!notif.isRead) {
      setNotifications((prev) =>
        prev.map((n) => (n._id === notif._id ? { ...n, isRead: true } : n)),
      );
      api.put(`/api/notifications/${notif._id}/read`).catch(console.error);
      window.dispatchEvent(new Event("notification_read"));
    }

    // 2. HÀM HELPER: Trích xuất chính xác ID
    const extractId = (item) => {
      if (!item) return null;
      return typeof item === "object" ? item._id : item;
    };

    // ĐIỀU HƯỚNG DỰA VÀO LOẠI THÔNG BÁO
    if (notif.type === "friend_request") {
      navigate("/people");
    } else if (notif.post) {
      const postId = extractId(notif.post);
      const commentId = extractId(notif.comment) || extractId(notif.entityId);

      if (notif.type === "comment" || notif.type === "reply") {
        navigate("/", {
          state: {
            openPostId: postId,
            targetCommentId: commentId,
          },
        });
      } else {
        navigate("/", { state: { openPostId: postId } });
      }
    } else {
      navigate("/");
    }
  };

  // CHỨC NĂNG XÓA TOÀN BỘ THÔNG BÁO
  const handleClearAll = async () => {
    if (!window.confirm("Bạn có chắc chắn muốn xóa tất cả thông báo?")) return;
    setClearing(true);
    try {
      const res = await api.delete("/api/notifications");
      if (res.data.success) {
        setNotifications([]);
        window.dispatchEvent(new Event("notifications_cleared"));
      }
    } catch (error) {
      alert("Lỗi khi xóa thông báo!");
    } finally {
      setClearing(false);
    }
  };

  const getNotificationIcon = (type) => {
    switch (type) {
      case "comment":
      case "reply":
        return <MessageCircle size={18} className="text-primary-500" />;
      case "like":
        return <Heart size={18} className="text-red-500" />;
      case "friend_request":
        return <UserPlus size={18} className="text-green-500" />;
      default:
        return <Info size={18} className="text-primary-500" />;
    }
  };

  return (
    <main className="max-w-2xl mx-auto px-4 mt-6 transition-colors duration-300">
      <div className="bg-surface rounded-3xl shadow-sm border border-border overflow-hidden transition-colors duration-300">
        {/* HEADER */}
        <div className="p-5 border-b border-border sticky top-0 bg-surface/95 backdrop-blur-sm z-10 flex items-center justify-between transition-colors">
          <h2 className="text-xl font-bold text-foreground flex items-center gap-2 transition-colors">
            <Bell className="text-primary-600" size={24} />
            Thông báo của bạn
          </h2>
          {notifications.length > 0 && (
            <button
              onClick={handleClearAll}
              disabled={clearing}
              className="text-sm font-medium text-red-500 hover:text-red-600 hover:bg-red-50 px-3 py-1.5 rounded-full transition-colors flex items-center gap-1"
            >
              {clearing ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Trash2 size={16} />
              )}
              <span className="hidden sm:inline">Xóa tất cả</span>
            </button>
          )}
        </div>

        {/* DANH SÁCH THÔNG BÁO */}
        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="animate-spin text-primary-500" size={32} />
          </div>
        ) : notifications.length === 0 ? (
          <div className="text-center py-20 px-4">
            <div className="w-16 h-16 bg-primary-50 text-primary-400 rounded-full flex items-center justify-center mx-auto mb-4 transition-colors">
              <Bell size={32} />
            </div>
            <p className="text-muted font-medium transition-colors">
              Bạn chưa có thông báo nào.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {notifications.map((notif) => (
              <div
                key={notif._id}
                onClick={() => handleNotificationClick(notif)}
                className={`p-4 transition-colors flex items-start gap-3 sm:gap-4 cursor-pointer hover:bg-hover ${
                  !notif.isRead ? "bg-primary-50/60" : "bg-surface"
                }`}
              >
                <div className="relative flex-shrink-0 mt-1">
                  <img
                    src={
                      notif.sender?.avatar?.url ||
                      `https://ui-avatars.com/api/?name=${notif.sender?.displayName || "User"}`
                    }
                    alt="avatar"
                    className="w-12 h-12 rounded-full object-cover border border-border shadow-sm transition-colors"
                  />
                  <div className="absolute -bottom-1 -right-1 bg-surface p-1 rounded-full shadow-sm border border-border transition-colors">
                    {getNotificationIcon(notif.type)}
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <p
                    className={`text-sm sm:text-base text-foreground transition-colors ${!notif.isRead ? "font-semibold" : "font-normal"}`}
                  >
                    {notif.content}
                  </p>
                  <p className="text-xs text-muted mt-1.5 font-medium transition-colors">
                    {new Date(notif.createdAt).toLocaleDateString("vi-VN")} lúc{" "}
                    {new Date(notif.createdAt).toLocaleTimeString("vi-VN", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
                {!notif.isRead && (
                  <div className="w-2.5 h-2.5 bg-primary-600 rounded-full mt-2 flex-shrink-0 shadow-sm transition-colors"></div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
};

export default Notifications;
