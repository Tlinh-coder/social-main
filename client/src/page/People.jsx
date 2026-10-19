// src/pages/People.jsx
import React, { useState, useEffect } from "react";
import {
  Search,
  UserPlus,
  UserCheck,
  Users,
  Loader2,
  Send,
} from "lucide-react";
import api from "../utils/api";
import socket from "../utils/socket";
import { toast } from "react-hot-toast";

// IMPORT COMPONENT CON
import UserCard from "../components/UserCard";

const People = () => {
  const [activeTab, setActiveTab] = useState("suggestions");
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingSearch, setLoadingSearch] = useState(false);

  const [suggestions, setSuggestions] = useState([]);
  const [requests, setRequests] = useState([]);
  const [sentRequests, setSentRequests] = useState([]);
  const [friends, setFriends] = useState([]);
  const [searchResults, setSearchResults] = useState([]);

  const [hasViewedRequests, setHasViewedRequests] = useState(false);

  const fetchPeopleData = async () => {
    if (searchQuery.trim()) return;
    setLoading(true);
    try {
      if (activeTab === "suggestions") {
        const res = await api.get("/api/users/suggestions");
        if (res.data.success) setSuggestions(res.data.data);
      } else if (activeTab === "requests") {
        const res = await api.get("/api/users/requests");
        if (res.data.success) setRequests(res.data.data);
      } else if (activeTab === "sent_requests") {
        const res = await api.get("/api/users/requests/sent");
        if (res.data.success) setSentRequests(res.data.data);
      } else if (activeTab === "friends") {
        const res = await api.get("/api/users/friends");
        if (res.data.success) setFriends(res.data.data);
      }
    } catch (error) {
      console.error("Lỗi khi tải dữ liệu:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPeopleData();
    if (activeTab === "requests") setHasViewedRequests(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  useEffect(() => {
    if (!socket) return;
    const handleNewNotification = async (notification) => {
      if (notification.type === "friend_request") {
        if (activeTab !== "requests") setHasViewedRequests(false);
        try {
          const res = await api.get("/api/users/requests");
          if (res.data.success) setRequests(res.data.data);
        } catch (error) {}
      }
    };
    socket.on("new_notification", handleNewNotification);
    return () => socket.off("new_notification", handleNewNotification);
  }, [activeTab]);

  useEffect(() => {
    const delayDebounceFn = setTimeout(async () => {
      if (searchQuery.trim()) {
        setLoadingSearch(true);
        try {
          const res = await api.get(`/api/users?search=${searchQuery}`);
          if (res.data.success) setSearchResults(res.data.users);
        } catch (error) {
        } finally {
          setLoadingSearch(false);
        }
      } else {
        searchResults([]);
      }
    }, 500);
    return () => clearTimeout(delayDebounceFn);
  }, [searchQuery]);

  // CÁC HÀM XỬ LÝ HÀNH ĐỘNG
  const handleSendRequest = async (targetUserId) => {
    try {
      const res = await api.post(`/api/users/requests/${targetUserId}`);
      if (res.data.success) {
        setSuggestions((prev) => prev.filter((u) => u._id !== targetUserId));
        setSearchResults((prev) =>
          prev.map((u) =>
            u._id === targetUserId
              ? { ...u, connectionStatus: "sent_just_now" }
              : u,
          ),
        );
        toast.success("Đã gửi lời mời kết bạn");
      }
    } catch (error) {
      toast.error("Có lỗi xảy ra");
    }
  };

  const handleAcceptRequest = async (requestId) => {
    try {
      const res = await api.post(`/api/users/requests/${requestId}/accept`);
      if (res.data.success) {
        setRequests((prev) =>
          prev.filter((req) => req.requestId !== requestId),
        );
        setSearchResults((prev) =>
          prev.map((u) =>
            u.requestId === requestId
              ? { ...u, connectionStatus: "friend" }
              : u,
          ),
        );
        toast.success("Đã thêm bạn bè");
        window.dispatchEvent(new Event("friend_request_handled"));
      }
    } catch (error) {}
  };

  const handleRejectRequest = async (requestId) => {
    try {
      const res = await api.delete(`/api/users/requests/${requestId}/reject`);
      if (res.data.success) {
        setRequests((prev) =>
          prev.filter((req) => req.requestId !== requestId),
        );
        setSearchResults((prev) =>
          prev.map((u) =>
            u.requestId === requestId
              ? { ...u, connectionStatus: "none", requestId: null }
              : u,
          ),
        );
        window.dispatchEvent(new Event("friend_request_handled"));
      }
    } catch (error) {}
  };

  const handleCancelSentRequest = async (requestId) => {
    try {
      const res = await api.delete(`/api/users/requests/${requestId}/reject`);
      if (res.data.success) {
        setSentRequests((prev) =>
          prev.filter((req) => req.requestId !== requestId),
        );
        setSearchResults((prev) =>
          prev.map((u) =>
            u.requestId === requestId
              ? { ...u, connectionStatus: "none", requestId: null }
              : u,
          ),
        );
        toast.success("Đã hủy yêu cầu");
      }
    } catch (error) {
      toast.error("Không thể hủy yêu cầu");
    }
  };

  // HÀM HELPER ĐỂ RENDER THẺ NGƯỜI DÙNG
  const renderUserCards = (usersList, type) => {
    return usersList.map((user) => (
      <UserCard
        key={user.requestId || user._id}
        user={user}
        type={type}
        onSendRequest={handleSendRequest}
        onAcceptRequest={handleAcceptRequest}
        onRejectRequest={handleRejectRequest}
        onCancelRequest={handleCancelSentRequest}
      />
    ));
  };

  return (
    <div className="min-h-screen bg-background pb-10 transition-colors duration-300">
      <div className="max-w-6xl mx-auto px-4 pt-6">
        {/* HEADER & SEARCH */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <h1 className="text-2xl font-extrabold text-foreground">Mọi người</h1>
          <div className="relative w-full md:w-96">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              {/* Thay icon xám thành xanh (Primary) */}
              <Search size={18} className="text-primary-500" />
            </div>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Tìm kiếm bằng tên hoặc email..."
              className="w-full pl-10 pr-4 py-2.5 bg-surface text-foreground placeholder:text-muted border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 shadow-sm transition-colors"
            />
          </div>
        </div>

        {/* TABS MENU */}
        {!searchQuery.trim() && (
          <div className="flex overflow-x-auto hide-scrollbar gap-2 mb-6 border-b border-border pb-px">
            <button
              onClick={() => setActiveTab("suggestions")}
              className={`flex items-center gap-2 px-5 py-3 font-semibold text-sm whitespace-nowrap border-b-2 transition-colors ${
                activeTab === "suggestions"
                  ? "border-primary-600 text-primary-600"
                  : "border-transparent text-muted hover:bg-hover hover:text-primary-600"
              }`}
            >
              {/* Đã thêm màu xanh cho icon kể cả khi không active */}
              <Users
                size={18}
                className={
                  activeTab === "suggestions"
                    ? "text-primary-600"
                    : "text-primary-400"
                }
              />{" "}
              Đề xuất
            </button>
            <button
              onClick={() => setActiveTab("requests")}
              className={`flex items-center gap-2 px-5 py-3 font-semibold text-sm whitespace-nowrap border-b-2 transition-colors ${
                activeTab === "requests"
                  ? "border-primary-600 text-primary-600"
                  : "border-transparent text-muted hover:bg-hover hover:text-primary-600"
              }`}
            >
              <UserPlus
                size={18}
                className={
                  activeTab === "requests"
                    ? "text-primary-600"
                    : "text-primary-400"
                }
              />{" "}
              Yêu cầu nhận
              {requests.length > 0 && !hasViewedRequests && (
                <span className="bg-red-500 text-white text-[11px] px-2 py-0.5 rounded-full ml-1 shadow-sm">
                  {requests.length}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab("sent_requests")}
              className={`flex items-center gap-2 px-5 py-3 font-semibold text-sm whitespace-nowrap border-b-2 transition-colors ${
                activeTab === "sent_requests"
                  ? "border-primary-600 text-primary-600"
                  : "border-transparent text-muted hover:bg-hover hover:text-primary-600"
              }`}
            >
              <Send
                size={18}
                className={
                  activeTab === "sent_requests"
                    ? "text-primary-600"
                    : "text-primary-400"
                }
              />{" "}
              Đã gửi
            </button>
            <button
              onClick={() => setActiveTab("friends")}
              className={`flex items-center gap-2 px-5 py-3 font-semibold text-sm whitespace-nowrap border-b-2 transition-colors ${
                activeTab === "friends"
                  ? "border-primary-600 text-primary-600"
                  : "border-transparent text-muted hover:bg-hover hover:text-primary-600"
              }`}
            >
              <UserCheck
                size={18}
                className={
                  activeTab === "friends"
                    ? "text-primary-600"
                    : "text-primary-400"
                }
              />{" "}
              Bạn bè của tôi
            </button>
          </div>
        )}

        {/* DANH SÁCH USER */}
        {loading || loadingSearch ? (
          <div className="flex justify-center py-20">
            <Loader2 size={32} className="text-primary-600 animate-spin" />
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
              {searchQuery.trim() &&
                renderUserCards(searchResults, "search_result")}
              {!searchQuery.trim() &&
                activeTab === "suggestions" &&
                renderUserCards(suggestions, "suggestions")}
              {!searchQuery.trim() &&
                activeTab === "requests" &&
                renderUserCards(requests, "requests")}
              {!searchQuery.trim() &&
                activeTab === "sent_requests" &&
                renderUserCards(sentRequests, "sent_requests")}
              {!searchQuery.trim() &&
                activeTab === "friends" &&
                renderUserCards(friends, "friends")}
            </div>

            {/* THÔNG BÁO EMPTY ĐƯỢC LÀM LẠI CHO ĐẸP HƠN */}
            {((searchQuery.trim() && searchResults.length === 0) ||
              (!searchQuery.trim() &&
                activeTab === "suggestions" &&
                suggestions.length === 0) ||
              (!searchQuery.trim() &&
                activeTab === "requests" &&
                requests.length === 0) ||
              (!searchQuery.trim() &&
                activeTab === "sent_requests" &&
                sentRequests.length === 0) ||
              (!searchQuery.trim() &&
                activeTab === "friends" &&
                friends.length === 0)) && (
              <div className="text-center py-20 animate-in fade-in duration-300">
                <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-primary-50/60 border border-primary-100 mb-5 shadow-sm">
                  <Search size={36} className="text-primary-500" />
                </div>
                <h3 className="text-lg font-bold text-foreground mb-1">
                  {searchQuery ? "Không tìm thấy kết quả" : "Không có dữ liệu"}
                </h3>
                <p className="text-muted text-sm max-w-md mx-auto">
                  {searchQuery
                    ? `Thử tìm kiếm với tên gọi hoặc địa chỉ email khác xem sao.`
                    : activeTab === "sent_requests"
                      ? "Bạn chưa gửi yêu cầu kết bạn cho ai. Hãy sang tab Đề xuất để kết nối nhé."
                      : "Chưa có danh sách nào ở mục này cả. Mọi thông tin mới sẽ hiện ở đây!"}
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default People;
