// src/components/UserCard.jsx
import React from "react";
import { Link } from "react-router-dom";
import { UserPlus, UserCheck, X, Check } from "lucide-react";

const UserCard = ({
  user,
  type,
  onSendRequest,
  onAcceptRequest,
  onRejectRequest,
  onCancelRequest,
}) => {
  return (
    <div className="bg-surface rounded-xl border border-border overflow-hidden shadow-sm hover:shadow-md transition-all flex flex-col">
      {/* ========================================== */}
      {/* NỬA TRÊN: THÔNG TIN NGƯỜI DÙNG */}
      {/* ========================================== */}
      <div className="p-4 flex flex-col items-center text-center flex-1">
        <Link to={`/profile/${user._id}`}>
          <img
            src={
              user?.avatar?.url ||
              `https://ui-avatars.com/api/?name=${user.displayName}&size=150`
            }
            alt={user.displayName}
            className="w-24 h-24 rounded-full object-cover border-4 border-hover mb-3 hover:opacity-80 transition-opacity"
          />
        </Link>
        <Link
          to={`/profile/${user._id}`}
          className="font-bold text-foreground hover:text-primary-600 text-lg line-clamp-1 transition-colors"
        >
          {user.displayName}
        </Link>

        {type === "search_result" && (
          <span className="text-sm text-muted mt-1 truncate w-full px-2">
            {user.email}
          </span>
        )}

        {type === "suggestions" && (
          <span className="text-sm text-muted mt-1">
            {user.mutualFriendsCount || 0} bạn chung
          </span>
        )}
      </div>

      {/* ========================================== */}
      {/* NỬA DƯỚI: NÚT BẤM DỰA TRÊN LOẠI (TYPE) */}
      {/* ========================================== */}
      <div className="p-4 pt-0 mt-auto">
        {/* CHẾ ĐỘ 1: TAB ĐỀ XUẤT */}
        {type === "suggestions" && (
          <button
            onClick={() => onSendRequest(user._id)}
            className="w-full py-2 bg-primary-50 text-primary-600 font-semibold rounded-lg hover:bg-primary-600 hover:text-on-primary transition-colors flex items-center justify-center gap-2"
          >
            <UserPlus size={18} /> Gửi kết bạn
          </button>
        )}

        {/* CHẾ ĐỘ 2: TÌM KIẾM TOÀN CẦU (HIỂN THỊ THÔNG MINH) */}
        {type === "search_result" && (
          <>
            {(!user.connectionStatus || user.connectionStatus === "none") && (
              <button
                onClick={() => onSendRequest(user._id)}
                className="w-full py-2 bg-primary-50 text-primary-600 font-semibold rounded-lg hover:bg-primary-600 hover:text-on-primary transition-colors flex items-center justify-center gap-2"
              >
                <UserPlus size={18} /> Gửi kết bạn
              </button>
            )}

            {user.connectionStatus === "sent" && (
              <button
                onClick={() => onCancelRequest(user.requestId)}
                className="w-full py-2 bg-hover text-foreground font-semibold rounded-lg hover:opacity-80 transition-opacity flex items-center justify-center gap-2"
              >
                <X size={18} /> Hủy yêu cầu
              </button>
            )}

            {user.connectionStatus === "sent_just_now" && (
              <button
                disabled
                className="w-full py-2 bg-hover text-muted font-semibold rounded-lg flex items-center justify-center gap-2 cursor-not-allowed"
              >
                <Check size={18} /> Đã gửi
              </button>
            )}

            {user.connectionStatus === "received" && (
              <div className="flex gap-2">
                <button
                  onClick={() => onAcceptRequest(user.requestId)}
                  className="flex-1 py-2 bg-primary-600 text-on-primary font-semibold rounded-lg hover:bg-primary-700 transition-colors flex items-center justify-center gap-1"
                >
                  <Check size={18} /> Nhận
                </button>
                <button
                  onClick={() => onRejectRequest(user.requestId)}
                  className="flex-1 py-2 bg-hover text-foreground font-semibold rounded-lg hover:opacity-80 transition-opacity flex items-center justify-center gap-1"
                >
                  <X size={18} /> Xóa
                </button>
              </div>
            )}

            {user.connectionStatus === "friend" && (
              <button
                disabled
                className="w-full py-2 bg-hover text-foreground font-semibold rounded-lg transition-colors flex items-center justify-center gap-2 cursor-default"
              >
                <UserCheck size={18} /> Bạn bè
              </button>
            )}
          </>
        )}

        {/* CHẾ ĐỘ 3: TAB YÊU CẦU NHẬN ĐƯỢC */}
        {type === "requests" && (
          <div className="flex gap-2">
            <button
              onClick={() => onAcceptRequest(user.requestId)}
              className="flex-1 py-2 bg-primary-600 text-on-primary font-semibold rounded-lg hover:bg-primary-700 transition-colors flex items-center justify-center gap-1"
            >
              <Check size={18} /> Nhận
            </button>
            <button
              onClick={() => onRejectRequest(user.requestId)}
              className="flex-1 py-2 bg-hover text-foreground font-semibold rounded-lg hover:opacity-80 transition-opacity flex items-center justify-center gap-1"
            >
              <X size={18} /> Xóa
            </button>
          </div>
        )}

        {/* CHẾ ĐỘ 4: TAB YÊU CẦU ĐÃ GỬI ĐI */}
        {type === "sent_requests" && (
          <button
            onClick={() => onCancelRequest(user.requestId)}
            className="w-full py-2 bg-hover text-foreground font-semibold rounded-lg hover:opacity-80 transition-opacity flex items-center justify-center gap-2"
          >
            <X size={18} /> Hủy yêu cầu
          </button>
        )}

        {/* CHẾ ĐỘ 5: TAB BẠN BÈ */}
        {type === "friends" && (
          <button className="w-full py-2 bg-hover text-foreground font-semibold rounded-lg transition-colors flex items-center justify-center gap-2 cursor-default">
            <UserCheck size={18} /> Bạn bè
          </button>
        )}
      </div>
    </div>
  );
};

export default UserCard;
