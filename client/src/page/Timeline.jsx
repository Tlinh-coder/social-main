// src/pages/Timeline.jsx
import React, { useState, useEffect, useRef } from "react";
import { useAuthStore } from "../store/useAuthStore";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import socket from "../utils/socket";
import {
  X,
  Image as ImageIcon,
  Loader2,
  Send,
  Check,
  ArrowUp,
} from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import api from "../utils/api";
import { toast } from "react-hot-toast";
import PostCard from "../components/PostCard";
import PostDetailModal from "../components/PostDetailModal";

const Timeline = () => {
  const { user } = useAuthStore();
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // ==========================================
  // LẤY DỮ LIỆU BÀI VIẾT
  // ==========================================
  const { data: posts = [], isLoading: loading } = useQuery({
    queryKey: ["posts"],
    queryFn: async () => {
      const res = await api.get("/api/posts");
      return res.data.success ? res.data.data : [];
    },
    staleTime: 1000 * 60 * 5,
  });

  // ==========================================
  // REAL-TIME: LẮNG NGHE BÀI VIẾT MỚI TỪ BẠN BÈ
  // ==========================================
  const [pendingPosts, setPendingPosts] = useState([]);

  useEffect(() => {
    if (!socket) return;

    const handleNewTimelinePost = (newPost) => {
      // 1. Lấy ID an toàn bất kể Backend trả về Object User hay String ID
      const authorId = String(newPost.user?._id || newPost.user);
      const myId = String(user?._id);

      // 2. Chặn tự nhận bài của mình
      if (authorId !== myId) {
        setPendingPosts((prev) => {
          // Tránh trường hợp Socket gửi 2 lần gây trùng lặp bài viết
          const isExist = prev.some((p) => p._id === newPost._id);
          if (isExist) return prev;

          return [newPost, ...prev];
        });
      }
    };

    socket.on("new_timeline_post", handleNewTimelinePost);

    return () => {
      socket.off("new_timeline_post", handleNewTimelinePost);
    };
  }, [user?._id]);

  // Hàm xử lý khi người dùng bấm nút "Có bài viết mới"
  const handleShowNewPosts = () => {
    queryClient.setQueryData(["posts"], (oldPosts = []) => {
      const existingIds = new Set(oldPosts.map((p) => p._id));
      const uniquePending = pendingPosts.filter((p) => !existingIds.has(p._id));
      return [...uniquePending, ...oldPosts];
    });
    setPendingPosts([]);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // Các State quản lý UI Modal
  const [postToShare, setPostToShare] = useState(null);
  const [shareMessage, setShareMessage] = useState("");
  const [selectedFriend, setSelectedFriend] = useState(null);
  const [isSharing, setIsSharing] = useState(false);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedPost, setSelectedPost] = useState(null);
  const [editingPost, setEditingPost] = useState(null);
  const [targetCommentId, setTargetCommentId] = useState(null);

  // State Form đăng bài / Sửa bài
  const [content, setContent] = useState("");
  const [images, setImages] = useState([]);
  const [previewUrls, setPreviewUrls] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editContent, setEditContent] = useState("");
  const fileInputRef = useRef(null);

  // ==========================================
  // LẤY DANH SÁCH BẠN BÈ ĐỂ CHIA SẺ
  // ==========================================
  const { data: friendsList = [], isLoading: loadingFriends } = useQuery({
    queryKey: ["friends_list"],
    queryFn: async () => {
      const res = await api.get("/api/users/friends");
      return res.data.success ? res.data.data : [];
    },
    enabled: !!postToShare,
  });

  // TỰ ĐỘNG BẬT BÀI VIẾT TỪ TRANG THÔNG BÁO
  useEffect(() => {
    if (location.state?.openPostId && !loading) {
      const postId = location.state.openPostId;
      if (location.state.targetCommentId)
        setTargetCommentId(location.state.targetCommentId);

      const postFromState = posts.find((p) => p._id === postId);

      if (postFromState) {
        setSelectedPost(postFromState);
      } else {
        api
          .get(`/api/posts/${postId}`)
          .then((res) => {
            if (res.data.success) setSelectedPost(res.data.data);
          })
          .catch(() => console.log("Không tìm thấy bài viết này"));
      }
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location.state, posts, loading, navigate]);

  // ==========================================
  // CÁC HÀM TƯƠNG TÁC
  // ==========================================
  const handleToggleLike = async (postId, reactionType = "like") => {
    try {
      const res = await api.put(`/api/posts/react/${postId}`, {
        type: reactionType,
      });
      if (res.data.success) {
        queryClient.setQueryData(["posts"], (oldPosts) =>
          oldPosts.map((p) =>
            p._id === postId ? { ...p, reactions: res.data.data } : p,
          ),
        );
        if (selectedPost?._id === postId) {
          setSelectedPost((prev) => ({ ...prev, reactions: res.data.data }));
        }
      }
    } catch (error) {
      console.error("Lỗi thả cảm xúc:", error);
    }
  };

  const handleCreatePost = async (e) => {
    e.preventDefault();
    if (!content.trim() && images.length === 0) return;
    setIsSubmitting(true);
    try {
      const formData = new FormData();
      formData.append("content", content);
      images.forEach((img) => formData.append("images", img));

      const res = await api.post("/api/posts", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      if (res.data.success) {
        queryClient.setQueryData(["posts"], (oldPosts) => [
          res.data.data,
          ...oldPosts,
        ]);
        setShowCreateModal(false);
        setContent("");
        setImages([]);
        setPreviewUrls([]);
      }
    } catch (error) {
      toast.error("Lỗi khi đăng bài viết!");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeletePost = async (postId) => {
    if (window.confirm("Bạn có chắc chắn muốn xóa bài viết này không?")) {
      try {
        const res = await api.delete(`/api/posts/${postId}`);
        if (res.data.success) {
          queryClient.setQueryData(["posts"], (oldPosts) =>
            oldPosts.filter((p) => p._id !== postId),
          );
        }
      } catch (error) {
        toast.error("Lỗi khi xóa bài viết!");
      }
    }
  };

  const handleUpdatePost = async () => {
    if (!editContent.trim()) return;
    setIsSubmitting(true);
    try {
      const res = await api.put(`/api/posts/${editingPost._id}`, {
        content: editContent,
      });
      if (res.data.success) {
        queryClient.setQueryData(["posts"], (oldPosts) =>
          oldPosts.map((p) =>
            p._id === editingPost._id ? { ...p, content: editContent } : p,
          ),
        );
        setEditingPost(null);
      }
    } catch (error) {
      toast.error("Lỗi khi cập nhật bài viết!");
    } finally {
      setIsSubmitting(false);
    }
  };

  // CHỨC NĂNG CHIA SẺ
  const openShareModal = (post) => {
    setPostToShare(post);
    setShareMessage("");
    setSelectedFriend(null);
  };

  const handleConfirmShare = async () => {
    if (!postToShare || !selectedFriend) return;
    setIsSharing(true);
    try {
      const res = await api.post("/api/messages", {
        receiverId: selectedFriend._id,
        content:
          shareMessage.trim() || "Mình vừa xem bài viết này nè, hay lắm!",
        referencedPost: postToShare._id,
      });
      if (res.data.success) {
        if (socket?.connected) socket.emit("send_message", res.data.data);
        toast.success(
          `Đã chia sẻ cho ${selectedFriend.displayName} thành công!`,
        );
        setPostToShare(null);
        setSelectedFriend(null);
      }
    } catch (error) {
      toast.error("Không thể gửi tin nhắn lúc này. Vui lòng thử lại!");
    } finally {
      setIsSharing(false);
    }
  };

  const handleImageChange = (e) => {
    const files = Array.from(e.target.files);
    if (files.length > 10) {
      alert("Chỉ được phép đăng tối đa 10 ảnh trong một bài viết!");
    }
    const allowedFiles = files.slice(0, 10);
    setImages(allowedFiles);
    setPreviewUrls(allowedFiles.map((file) => URL.createObjectURL(file)));
  };

  return (
    <div className="min-h-screen bg-background pb-20 relative font-sans transition-colors duration-300">
      {/* NÚT THÔNG BÁO BÀI VIẾT MỚI (NỔI CỐ ĐỊNH) */}
      {pendingPosts.length > 0 && (
        <div className="fixed top-24 left-1/2 -translate-x-1/2 z-[60] flex justify-center pointer-events-none">
          <button
            onClick={handleShowNewPosts}
            className="pointer-events-auto flex items-center gap-2 bg-primary-600 text-white px-5 py-2.5 rounded-full shadow-[0_4px_20px_rgba(0,0,0,0.3)] hover:bg-primary-700 hover:-translate-y-1 hover:scale-105 transition-all animate-in slide-in-from-top-8 duration-300 font-bold text-sm border border-primary-500"
          >
            <ArrowUp size={18} strokeWidth={2.5} />
            Có {pendingPosts.length} bài viết mới
          </button>
        </div>
      )}

      {/* 1. POPUP TẠO BÀI VIẾT */}
      {showCreateModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
          <div className="bg-surface rounded-xl w-full max-w-lg shadow-2xl animate-in fade-in zoom-in duration-200 border border-border">
            <div className="flex items-center justify-between p-4 border-b border-border">
              <h2 className="font-bold text-xl text-foreground text-center flex-1">
                Tạo bài viết
              </h2>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-muted hover:bg-hover p-2 rounded-full absolute right-4 transition-colors"
              >
                <X size={24} />
              </button>
            </div>
            <div className="p-4">
              <div className="flex items-center gap-3 mb-4">
                <img
                  src={
                    user?.avatar?.url ||
                    `https://ui-avatars.com/api/?name=${user?.displayName}`
                  }
                  alt="avatar"
                  className="w-10 h-10 rounded-full object-cover border border-border"
                />
                <div>
                  <span className="font-semibold text-sm text-foreground block">
                    {user?.displayName}
                  </span>
                  <span className="text-xs bg-hover text-muted px-2 py-0.5 rounded-md mt-0.5 inline-block font-medium">
                    🌎 Công khai
                  </span>
                </div>
              </div>
              <textarea
                placeholder={`${user?.displayName} ơi, bạn đang nghĩ gì thế?`}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                className="w-full min-h-[120px] resize-none outline-none bg-transparent text-foreground text-lg placeholder:text-muted transition-colors"
              />
              {previewUrls.length > 0 && (
                <div className="grid gap-2 mb-4 max-h-[300px] overflow-y-auto grid-cols-2 rounded-lg overflow-hidden border border-border">
                  {previewUrls.map((url, idx) => (
                    <img
                      key={idx}
                      src={url}
                      alt="preview"
                      className="w-full h-48 object-cover"
                    />
                  ))}
                </div>
              )}
              <div className="border border-border rounded-lg p-3 flex items-center justify-between mt-2 shadow-sm transition-colors">
                <span className="text-sm font-semibold text-foreground">
                  Thêm vào bài viết
                </span>
                <div className="flex items-center gap-2">
                  <span
                    className={`text-xs font-semibold ${images.length === 10 ? "text-red-500" : "text-muted"}`}
                  >
                    {images.length}/10
                  </span>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="p-2 text-green-500 hover:bg-green-50/20 rounded-full transition-colors"
                    title="Thêm ảnh/video"
                  >
                    <ImageIcon size={24} />
                  </button>
                </div>
                <input
                  type="file"
                  multiple
                  accept="image/*"
                  className="hidden"
                  ref={fileInputRef}
                  onChange={handleImageChange}
                />
              </div>
              <button
                onClick={handleCreatePost}
                disabled={
                  isSubmitting || (!content.trim() && images.length === 0)
                }
                className="w-full bg-primary-600 text-on-primary font-bold py-2.5 rounded-lg mt-4 hover:bg-primary-700 disabled:opacity-50 flex items-center justify-center gap-2 transition-colors"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 size={18} className="animate-spin" /> Đang đăng...
                  </>
                ) : (
                  "Đăng"
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2. POPUP CHỈNH SỬA BÀI VIẾT */}
      {editingPost && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
          <div className="bg-surface border border-border rounded-xl w-full max-w-lg shadow-2xl p-4 transition-colors">
            <div className="flex items-center justify-between border-b border-border pb-3 mb-3">
              <h2 className="font-bold text-xl text-foreground">
                Chỉnh sửa bài viết
              </h2>
              <button
                onClick={() => setEditingPost(null)}
                className="text-muted hover:bg-hover p-2 rounded-full transition-colors"
              >
                <X size={24} />
              </button>
            </div>
            <textarea
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              className="w-full min-h-[120px] resize-none outline-none bg-background text-foreground text-lg border border-border p-3 rounded-lg focus:border-primary-500 focus:ring-1 focus:ring-primary-500 transition-colors"
            />
            <button
              onClick={handleUpdatePost}
              disabled={isSubmitting || !editContent.trim()}
              className="w-full bg-primary-600 text-on-primary font-bold py-2.5 rounded-lg mt-4 hover:bg-primary-700 disabled:opacity-50 flex justify-center transition-colors"
            >
              {isSubmitting ? (
                <Loader2 size={18} className="animate-spin" />
              ) : (
                "Lưu thay đổi"
              )}
            </button>
          </div>
        </div>
      )}

      {/* 3. POPUP CHI TIẾT */}
      {selectedPost && (
        <PostDetailModal
          post={selectedPost}
          currentUser={user}
          targetCommentId={targetCommentId}
          onToggleLike={handleToggleLike}
          onSharePost={openShareModal}
          onClose={() => {
            setSelectedPost(null);
            setTargetCommentId(null);
          }}
        />
      )}

      {/* POPUP CHIA SẺ VÀO TIN NHẮN */}
      {postToShare && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
          <div className="bg-surface border border-border rounded-xl w-full max-w-md shadow-2xl p-5 animate-in fade-in zoom-in duration-200 transition-colors flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between border-b border-border pb-3 mb-4 shrink-0">
              <h2 className="font-bold text-xl text-foreground">
                Chia sẻ bài viết
              </h2>
              <button
                onClick={() => {
                  setPostToShare(null);
                  setSelectedFriend(null);
                }}
                className="text-muted hover:bg-hover p-2 rounded-full transition-colors"
              >
                <X size={24} />
              </button>
            </div>
            <div className="bg-hover p-3 rounded-lg mb-4 text-sm text-foreground border border-border flex gap-3 items-center transition-colors shrink-0">
              {postToShare.images?.length > 0 ? (
                <img
                  src={postToShare.images[0].url}
                  alt="thumb"
                  className="w-14 h-14 rounded-md object-cover flex-shrink-0"
                />
              ) : (
                <div className="w-14 h-14 bg-background rounded-md flex items-center justify-center flex-shrink-0 text-2xl border border-border">
                  📄
                </div>
              )}
              <div className="overflow-hidden">
                <p className="font-bold text-foreground text-sm truncate mb-0.5">
                  Bài viết của {postToShare.user?.displayName}
                </p>
                <p className="line-clamp-2 text-xs text-muted">
                  {postToShare.content || "Có đính kèm hình ảnh..."}
                </p>
              </div>
            </div>
            <input
              autoFocus
              placeholder="Viết lời nhắn gửi kèm..."
              className="w-full p-3 bg-background text-foreground placeholder:text-muted border border-border rounded-lg mb-4 focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500 transition-colors shrink-0"
              value={shareMessage}
              onChange={(e) => setShareMessage(e.target.value)}
            />
            <div className="flex-1 overflow-y-auto custom-scrollbar mb-4 border border-border rounded-lg p-2 min-h-[150px]">
              <h3 className="text-xs font-bold text-muted uppercase mb-2 px-2">
                Chọn người nhận
              </h3>
              {loadingFriends ? (
                <div className="flex justify-center py-6">
                  <Loader2
                    className="animate-spin text-primary-500"
                    size={24}
                  />
                </div>
              ) : friendsList.length === 0 ? (
                <p className="text-center text-muted text-sm py-4">
                  Bạn chưa có bạn bè nào để chia sẻ. Hãy kết bạn thêm nhé!
                </p>
              ) : (
                <div className="space-y-1">
                  {friendsList.map((friend) => (
                    <div
                      key={friend._id}
                      onClick={() => setSelectedFriend(friend)}
                      className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-all ${
                        selectedFriend?._id === friend._id
                          ? "bg-primary-50 border border-primary-500"
                          : "hover:bg-hover border border-transparent"
                      }`}
                    >
                      <img
                        src={
                          friend.avatar?.url ||
                          `https://ui-avatars.com/api/?name=${friend.displayName}`
                        }
                        className="w-10 h-10 rounded-full object-cover border border-border"
                        alt="avatar"
                      />
                      <span className="font-semibold text-foreground flex-1 truncate">
                        {friend.displayName}
                      </span>
                      {selectedFriend?._id === friend._id && (
                        <div className="bg-primary-600 text-white rounded-full p-0.5 animate-in zoom-in">
                          <Check size={16} strokeWidth={3} />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="flex justify-end gap-3 shrink-0">
              <button
                onClick={() => {
                  setPostToShare(null);
                  setSelectedFriend(null);
                }}
                className="px-4 py-2 font-bold text-foreground bg-hover rounded-lg hover:opacity-80 transition-opacity"
              >
                Hủy
              </button>
              <button
                onClick={handleConfirmShare}
                disabled={isSharing || !selectedFriend}
                className="px-4 py-2 font-bold bg-primary-600 text-on-primary rounded-lg hover:bg-primary-700 disabled:opacity-50 flex items-center justify-center gap-2 transition-colors"
              >
                {isSharing ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <>
                    <Send size={16} /> Gửi ngay
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* KHU VỰC TIMELINE CHÍNH */}
      <main className="max-w-2xl mx-auto px-4 pt-6 relative">
        {/* THANH TẠO BÀI VIẾT DÀNH CHO MỌI NGƯỜI */}
        <div className="bg-surface p-4 rounded-xl shadow-sm border border-border mb-6 flex gap-3 items-center transition-colors">
          <img
            src={
              user?.avatar?.url ||
              `https://ui-avatars.com/api/?name=${user?.displayName}`
            }
            alt="avatar"
            className="w-10 h-10 rounded-full object-cover border border-border"
          />
          <div
            onClick={() => setShowCreateModal(true)}
            className="bg-background hover:bg-hover transition-colors flex-1 rounded-full px-4 py-2.5 text-muted text-base cursor-pointer"
          >
            {user?.displayName} ơi, bạn đang nghĩ gì thế?
          </div>
        </div>

        {loading ? (
          <div className="text-center py-10 flex justify-center">
            <Loader2 className="animate-spin text-primary-500" size={36} />
          </div>
        ) : posts.length === 0 ? (
          <div className="text-center py-10 bg-surface rounded-xl shadow-sm border border-border transition-colors">
            <p className="font-semibold text-foreground text-lg mb-1">
              Chưa có bài viết nào
            </p>
            <p className="text-sm text-muted">
              Hãy là người đầu tiên cập nhật trạng thái!
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {posts.map((post) => (
              <PostCard
                key={post._id}
                post={post}
                currentUser={user}
                onSharePost={openShareModal}
                onEdit={(p) => {
                  setEditingPost(p);
                  setEditContent(p.content || "");
                }}
                onDelete={handleDeletePost}
                onClickPost={setSelectedPost}
                onToggleLike={handleToggleLike}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default Timeline;
