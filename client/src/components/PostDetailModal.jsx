// src/components/PostDetailModal.jsx
import React, { useState, useEffect, useRef } from "react";
import {
  X,
  Send,
  Loader2,
  MessageSquareDashed,
  Heart,
  ThumbsUp,
  MessageCircle,
  Share2,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import api from "../utils/api";
import { useAuthStore } from "../store/useAuthStore";

// Danh sách các loại cảm xúc
const REACTION_TYPES = [
  { type: "like", icon: "👍", color: "text-primary-600", label: "Thích" },
  { type: "love", icon: "❤️", color: "text-rose-500", label: "Yêu thích" },
  { type: "haha", icon: "😆", color: "text-yellow-500", label: "Haha" },
  { type: "wow", icon: "😮", color: "text-yellow-500", label: "Wow" },
  { type: "sad", icon: "😢", color: "text-yellow-500", label: "Buồn" },
  { type: "angry", icon: "😡", color: "text-red-500", label: "Phẫn nộ" },
];

const PostDetailModal = ({
  post,
  onClose,
  currentUser,
  targetCommentId,
  onToggleLike,
  onSharePost,
}) => {
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [replyingTo, setReplyingTo] = useState(null);

  // State quản lý thả tim bài viết
  const [showReactions, setShowReactions] = useState(false);
  const [showReactionList, setShowReactionList] = useState(false);

  // State quản lý thả cảm xúc cho BÌNH LUẬN
  const [activeCommentReactions, setActiveCommentReactions] = useState(null);
  const commentHideTimeout = useRef(null);

  const holdTimeout = useRef(null);
  const hideTimeout = useRef(null);
  const [isLongPress, setIsLongPress] = useState(false);

  // STATE MỚI: Quản lý trình xem ảnh Fullscreen (Lightbox)
  const [viewerIndex, setViewerIndex] = useState(null);

  const { user } = useAuthStore();

  useEffect(() => {
    const fetchComments = async () => {
      try {
        const res = await api.get(`/api/comments/${post._id}`);
        if (res.data.success) {
          setComments(res.data.data);
        }
      } catch (error) {
        console.error("Lỗi lấy bình luận:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchComments();
  }, [post._id]);

  useEffect(() => {
    if (!loading && targetCommentId && comments.length > 0) {
      const scrollTimer = setTimeout(() => {
        const safeTargetId = String(targetCommentId);
        const targetElement = document.getElementById(
          `comment-${safeTargetId}`,
        );

        if (targetElement) {
          targetElement.scrollIntoView({ behavior: "smooth", block: "center" });
        } else {
          const commentsSection = document.getElementById("comments-section");
          if (commentsSection) {
            commentsSection.scrollIntoView({ behavior: "smooth" });
          }
        }
      }, 500);
      return () => clearTimeout(scrollTimer);
    }
  }, [loading, targetCommentId, comments]);

  // LẮNG NGHE PHÍM BẤM CHO TRÌNH XEM ẢNH (Bấm trái phải để lướt, ESC để thoát)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (viewerIndex === null) return;
      if (e.key === "ArrowRight") nextImage(e);
      if (e.key === "ArrowLeft") prevImage(e);
      if (e.key === "Escape") setViewerIndex(null);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [viewerIndex, post.images]);

  // Các hàm điều hướng ảnh
  const nextImage = (e) => {
    e?.stopPropagation();
    if (!post.images) return;
    setViewerIndex((prev) => (prev < post.images.length - 1 ? prev + 1 : 0));
  };

  const prevImage = (e) => {
    e?.stopPropagation();
    if (!post.images) return;
    setViewerIndex((prev) => (prev > 0 ? prev - 1 : post.images.length - 1));
  };

  // HÀM ĐỆ QUY: Thêm bình luận con
  const addReplyRecursively = (commentsArray, parentId, newCmt) => {
    return commentsArray.map((c) => {
      if (String(c._id) === String(parentId)) {
        return { ...c, replies: [...(c.replies || []), newCmt] };
      }
      if (c.replies && c.replies.length > 0) {
        return {
          ...c,
          replies: addReplyRecursively(c.replies, parentId, newCmt),
        };
      }
      return c;
    });
  };

  // HÀM ĐỆ QUY: Cập nhật Cảm xúc bình luận
  const updateCommentReactionsRecursively = (
    commentsArray,
    targetId,
    newReactions,
  ) => {
    return commentsArray.map((c) => {
      if (String(c._id) === String(targetId)) {
        return { ...c, reactions: newReactions };
      }
      if (c.replies && c.replies.length > 0) {
        return {
          ...c,
          replies: updateCommentReactionsRecursively(
            c.replies,
            targetId,
            newReactions,
          ),
        };
      }
      return c;
    });
  };

  const handleSubmitComment = async (e) => {
    e.preventDefault();
    if (!newComment.trim()) return;

    setSubmitting(true);
    try {
      const payload = { content: newComment };
      if (replyingTo) {
        payload.parentComment = replyingTo._id;
      }

      const res = await api.post(`/api/comments/${post._id}`, payload);

      if (res.data.success) {
        const createdCmt = res.data.data;
        setComments((prev) => {
          if (!payload.parentComment) {
            return [createdCmt, ...prev];
          }
          return addReplyRecursively(prev, payload.parentComment, createdCmt);
        });
        setNewComment("");
        setReplyingTo(null);
      }
    } catch (error) {
      alert("Lỗi khi gửi bình luận!");
    } finally {
      setSubmitting(false);
    }
  };

  const handleReactToComment = async (commentId, reactionType = "like") => {
    try {
      const res = await api.put(`/api/comments/${commentId}/react`, {
        reactionType,
      });
      if (res.data.success) {
        const updatedReactions = res.data.data.reactions;
        setComments((prev) =>
          updateCommentReactionsRecursively(prev, commentId, updatedReactions),
        );
      }
    } catch (error) {
      console.error("Lỗi thả cảm xúc bình luận:", error);
    }
  };

  const renderSingleComment = (cmt, isChild = false) => {
    const hasReplies = cmt.replies && cmt.replies.length > 0;
    const isTarget =
      targetCommentId && String(targetCommentId) === String(cmt._id);

    const myCommentReaction = cmt.reactions?.find(
      (r) => String(r.user?._id || r.user) === String(user?._id),
    );
    const commentReactionConfig = myCommentReaction
      ? REACTION_TYPES.find((rt) => rt.type === myCommentReaction.type)
      : null;

    return (
      <div
        key={cmt._id}
        id={`comment-${cmt._id}`}
        className={`relative flex gap-3 ${isChild ? "mt-4" : "mt-6"} ${
          isTarget ? "animate-flash-target" : ""
        }`}
      >
        {!isChild && hasReplies && (
          <div className="absolute left-4 top-10 bottom-[-16px] w-[2px] bg-border rounded-full z-0 transition-colors" />
        )}
        <div className="relative z-10 flex flex-col items-center shrink-0">
          <img
            src={
              cmt.user?.avatar?.url ||
              `https://ui-avatars.com/api/?name=${cmt.user?.displayName}`
            }
            className={`${isChild ? "w-6 h-6 mt-1" : "w-8 h-8"} rounded-full object-cover ring-2 ring-surface transition-colors`}
            alt="avatar"
          />
        </div>
        <div className="flex flex-col items-start min-w-0 flex-1">
          <div className="relative inline-block max-w-full">
            <div className="bg-hover px-4 py-2.5 rounded-2xl rounded-tl-sm transition-colors relative z-10">
              <span className="font-semibold text-sm text-foreground block mb-0.5">
                {cmt.user?.displayName}
              </span>
              <span className="text-[14px] text-foreground/90 whitespace-pre-wrap break-words leading-relaxed">
                {cmt.content}
              </span>
            </div>

            {cmt.reactions && cmt.reactions.length > 0 && (
              <div className="absolute -bottom-2 -right-3 z-20 bg-surface shadow-sm border border-border rounded-full px-1.5 py-0.5 flex items-center gap-1 text-[11px] font-semibold text-muted transition-colors">
                <span className="text-[10px]">
                  {REACTION_TYPES.find(
                    (rt) => rt.type === cmt.reactions[0].type,
                  )?.icon || "👍"}
                </span>
                {cmt.reactions.length}
              </div>
            )}
          </div>

          <div className="flex items-center gap-4 mt-1.5 pl-2 relative z-10">
            <span className="text-[11px] text-muted font-medium transition-colors">
              {new Date(cmt.createdAt).toLocaleTimeString("vi-VN", {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>

            <div
              className="relative flex items-center"
              onMouseEnter={() => {
                clearTimeout(commentHideTimeout.current);
                setActiveCommentReactions(cmt._id);
              }}
              onMouseLeave={() => {
                commentHideTimeout.current = setTimeout(
                  () => setActiveCommentReactions(null),
                  300,
                );
              }}
            >
              {activeCommentReactions === cmt._id && (
                <div className="absolute bottom-full left-0 mb-1 bg-surface rounded-full shadow-lg border border-border flex items-center gap-1 px-2 py-1 animate-in zoom-in-95 duration-200 z-50">
                  {REACTION_TYPES.map((reaction) => (
                    <button
                      key={reaction.type}
                      onPointerDown={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        handleReactToComment(cmt._id, reaction.type);
                        setActiveCommentReactions(null);
                      }}
                      className="text-lg hover:scale-125 hover:-translate-y-1 transition-transform origin-bottom touch-manipulation px-1"
                      title={reaction.label}
                    >
                      {reaction.icon}
                    </button>
                  ))}
                </div>
              )}

              <button
                onClick={() => {
                  const typeToSend = myCommentReaction
                    ? myCommentReaction.type
                    : "like";
                  handleReactToComment(cmt._id, typeToSend);
                  setActiveCommentReactions(null);
                }}
                className={`text-[11px] font-bold transition-colors ${
                  commentReactionConfig
                    ? commentReactionConfig.color
                    : "text-muted hover:text-primary-600"
                }`}
              >
                {commentReactionConfig ? commentReactionConfig.label : "Thích"}
              </button>
            </div>

            <button
              onClick={() => setReplyingTo(cmt)}
              className="text-[11px] font-bold text-muted hover:text-primary-600 transition-colors"
            >
              Trả lời
            </button>
          </div>

          {hasReplies && (
            <div className="w-full">
              {cmt.replies.map((reply) => renderSingleComment(reply, true))}
            </div>
          )}
        </div>
      </div>
    );
  };

  const myReaction = post.reactions?.find((r) => {
    const reactionUserId = String(r.user?._id || r.user);
    const currentUserId = String(currentUser?._id || currentUser);
    return reactionUserId === currentUserId;
  });

  const currentReactionConfig = myReaction
    ? REACTION_TYPES.find((r) => r.type === myReaction.type)
    : null;

  // RENDER HÌNH ẢNH TRONG MODAL VỚI BỐ CỤC ĐẸP
  const renderPostImages = () => {
    const images = post.images;
    if (!images || images.length === 0) return null;
    const len = images.length;

    return (
      <div className="rounded-2xl overflow-hidden border border-border">
        {len === 1 && (
          <img
            src={images[0].url}
            onClick={() => setViewerIndex(0)}
            className="w-full max-h-[500px] object-cover cursor-pointer hover:opacity-95 transition-opacity"
            alt="post"
          />
        )}

        {len === 2 && (
          <div className="grid grid-cols-2 gap-1 h-64 sm:h-80">
            {images.map((img, idx) => (
              <img
                key={idx}
                src={img.url}
                onClick={() => setViewerIndex(idx)}
                className="w-full h-full object-cover cursor-pointer hover:opacity-95 transition-opacity"
                alt="post"
              />
            ))}
          </div>
        )}

        {len === 3 && (
          <div className="grid grid-cols-2 gap-1 h-64 sm:h-96">
            <img
              src={images[0].url}
              onClick={() => setViewerIndex(0)}
              className="w-full h-full object-cover col-span-2 sm:col-span-1 sm:row-span-2 cursor-pointer hover:opacity-95 transition-opacity"
              alt="post"
            />
            <img
              src={images[1].url}
              onClick={() => setViewerIndex(1)}
              className="w-full h-full object-cover cursor-pointer hover:opacity-95 transition-opacity"
              alt="post"
            />
            <img
              src={images[2].url}
              onClick={() => setViewerIndex(2)}
              className="w-full h-full object-cover cursor-pointer hover:opacity-95 transition-opacity hidden sm:block"
              alt="post"
            />
          </div>
        )}

        {len >= 4 && (
          <div className="grid grid-cols-2 gap-1 h-64 sm:h-96">
            <img
              src={images[0].url}
              onClick={() => setViewerIndex(0)}
              className="w-full h-full object-cover cursor-pointer hover:opacity-95 transition-opacity"
              alt="post"
            />
            <img
              src={images[1].url}
              onClick={() => setViewerIndex(1)}
              className="w-full h-full object-cover cursor-pointer hover:opacity-95 transition-opacity"
              alt="post"
            />
            <img
              src={images[2].url}
              onClick={() => setViewerIndex(2)}
              className="w-full h-full object-cover cursor-pointer hover:opacity-95 transition-opacity"
              alt="post"
            />
            <div
              className="relative w-full h-full cursor-pointer group"
              onClick={() => setViewerIndex(3)}
            >
              <img
                src={images[3].url}
                className="w-full h-full object-cover group-hover:opacity-95 transition-opacity"
                alt="post"
              />
              {len > 4 && (
                <div className="absolute inset-0 bg-black/50 flex items-center justify-center transition-colors group-hover:bg-black/40">
                  <span className="text-white text-2xl font-bold">
                    +{len - 4}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <>
      {/* MODAL CHÍNH - XEM BÀI VIẾT */}
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm sm:p-6 p-0">
        <style>{`
          @keyframes flash-highlight {
            0%, 100% { background-color: transparent; box-shadow: 0 0 0 0 transparent; }
            50% { background-color: rgba(59, 130, 246, 0.15); box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.1); }
          }
          .animate-flash-target {
            animation: flash-highlight 1.5s ease-in-out 3; 
            border-radius: 1rem; padding: 8px; margin: -8px; 
          }
        `}</style>

        <div className="bg-surface sm:rounded-[2rem] w-full max-w-2xl h-full sm:h-[90vh] flex flex-col overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-300 relative transition-colors">
          {/* HEADER */}
          <div className="px-6 py-4 flex justify-between items-center bg-surface border-b border-border z-10 shrink-0 transition-colors">
            <div className="flex items-center gap-3">
              <img
                src={
                  post.user?.avatar?.url ||
                  `https://ui-avatars.com/api/?name=${post.user?.displayName}`
                }
                className="w-10 h-10 rounded-full object-cover shadow-sm border border-border"
                alt="avatar"
              />
              <div>
                <h3 className="font-bold text-foreground text-sm tracking-tight transition-colors">
                  {post.user?.displayName}
                </h3>
                <p className="text-[11px] font-medium text-muted transition-colors">
                  {new Date(post.createdAt).toLocaleDateString("vi-VN", {
                    weekday: "long",
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2.5 bg-hover text-muted rounded-full hover:opacity-80 transition-opacity"
            >
              <X size={18} />
            </button>
          </div>

          {/* BODY */}
          <div className="flex-1 overflow-y-auto flex flex-col custom-scrollbar bg-surface transition-colors">
            <div className="px-6 py-5">
              <p className="whitespace-pre-wrap mb-4 text-[15px] leading-relaxed text-foreground transition-colors">
                {post.content}
              </p>
              {/* KHU VỰC RENDER ẢNH MỚI */}
              {renderPostImages()}
            </div>

            {/* THỐNG KÊ (LƯỢT THÍCH & BÌNH LUẬN) */}
            <div className="px-6 py-2 flex items-center justify-between text-muted text-sm border-t border-border transition-colors">
              <div
                onClick={() => {
                  if (post.reactions?.length > 0) setShowReactionList(true);
                }}
                className={`flex items-center gap-1.5 ${post.reactions?.length > 0 ? "cursor-pointer hover:underline text-foreground" : ""}`}
              >
                <div className="bg-primary-600 rounded-full p-1 shadow-sm">
                  <ThumbsUp size={10} className="text-white fill-white" />
                </div>
                <span>{post.reactions?.length || 0}</span>
              </div>
              <span className="hover:underline cursor-pointer">
                {post.commentCount || 0} bình luận
              </span>
            </div>

            {/* THANH TƯƠNG TÁC */}
            <div className="px-4 py-1.5 flex items-center justify-between border-t border-b border-border mb-3 mx-2 transition-colors">
              {/* NÚT LIKE BÀI VIẾT */}
              <div
                className="relative flex-1 select-none"
                onMouseEnter={() => {
                  clearTimeout(hideTimeout.current);
                  setShowReactions(true);
                }}
                onMouseLeave={() => {
                  hideTimeout.current = setTimeout(
                    () => setShowReactions(false),
                    300,
                  );
                }}
                onTouchStart={(e) => {
                  e.stopPropagation();
                  setIsLongPress(false);
                  holdTimeout.current = setTimeout(() => {
                    setIsLongPress(true);
                    setShowReactions(true);
                    if (navigator.vibrate) navigator.vibrate(50);
                  }, 400);
                }}
                onTouchEnd={() => clearTimeout(holdTimeout.current)}
                onTouchMove={() => clearTimeout(holdTimeout.current)}
              >
                {showReactions && onToggleLike && (
                  <div className="absolute bottom-full left-0 mb-2 bg-surface rounded-full shadow-[0_4px_15px_rgba(0,0,0,0.15)] border border-border flex items-center gap-1.5 px-3 py-2 animate-in slide-in-from-bottom-2 fade-in duration-200 z-20">
                    {REACTION_TYPES.map((reaction) => (
                      <button
                        key={reaction.type}
                        onPointerDown={(e) => {
                          e.stopPropagation();
                          e.preventDefault();
                          onToggleLike(post._id, reaction.type);
                          setShowReactions(false);
                        }}
                        className="text-2xl hover:scale-125 hover:-translate-y-1 transition-transform origin-bottom touch-manipulation"
                        title={reaction.label}
                      >
                        {reaction.icon}
                      </button>
                    ))}
                  </div>
                )}

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (isLongPress || !onToggleLike) return;
                    const typeToSend = myReaction ? myReaction.type : "like";
                    onToggleLike(post._id, typeToSend);
                    setShowReactions(false);
                  }}
                  className={`w-full flex items-center justify-center gap-2 py-2 rounded-lg transition-colors font-bold ${
                    currentReactionConfig
                      ? currentReactionConfig.color
                      : "text-muted hover:bg-hover hover:text-primary-600"
                  }`}
                >
                  {currentReactionConfig ? (
                    <span className="text-xl -mt-1 animate-in zoom-in duration-200">
                      {currentReactionConfig.icon}
                    </span>
                  ) : (
                    <ThumbsUp size={20} />
                  )}
                  <span className="text-sm">Thích</span>
                </button>
              </div>

              <button
                onClick={() =>
                  document.getElementById("comment-input")?.focus()
                }
                className="flex-1 flex items-center justify-center gap-2 py-2 text-muted hover:bg-hover hover:text-primary-600 rounded-lg font-bold transition-colors"
              >
                <MessageCircle size={20} />
                <span className="text-sm">Bình luận</span>
              </button>

              <button
                onPointerDown={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  if (onSharePost) onSharePost(post);
                }}
                className="flex-1 flex items-center justify-center gap-2 py-2 text-muted hover:bg-hover hover:text-primary-600 rounded-lg font-bold transition-colors"
              >
                <Share2 size={20} />
                <span className="text-sm">Chia sẻ</span>
              </button>
            </div>

            {/* KHU VỰC BÌNH LUẬN */}
            <div id="comments-section" className="px-6 py-2 flex-1">
              {loading ? (
                <div className="flex flex-col items-center justify-center py-10 opacity-60">
                  <Loader2 className="animate-spin text-muted mb-2" size={28} />
                  <span className="text-sm text-muted font-medium transition-colors">
                    Đang tải bình luận...
                  </span>
                </div>
              ) : comments.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-muted transition-colors">
                  <div className="bg-hover p-4 rounded-full mb-3 border border-border">
                    <MessageSquareDashed size={32} className="text-muted/50" />
                  </div>
                  <p className="text-sm font-medium">Chưa có bình luận nào</p>
                  <p className="text-xs mt-1">
                    Hãy là người đầu tiên chia sẻ cảm nghĩ!
                  </p>
                </div>
              ) : (
                <div className="space-y-2 pb-6">
                  {comments.map((cmt) => renderSingleComment(cmt, false))}
                </div>
              )}
            </div>
          </div>

          {/* FOOTER */}
          <div className="px-4 py-3 sm:px-6 sm:py-4 bg-surface border-t border-border shrink-0 z-10 rounded-b-[2rem] transition-colors">
            {replyingTo && (
              <div className="flex items-center justify-between bg-hover text-foreground border border-border text-xs px-4 py-2 rounded-xl mb-3 animate-in slide-in-from-bottom-2 duration-200 shadow-sm transition-colors">
                <span>
                  Đang trả lời{" "}
                  <strong className="font-semibold text-primary-600">
                    {replyingTo.user?.displayName}
                  </strong>
                </span>
                <button
                  onClick={() => setReplyingTo(null)}
                  className="text-muted hover:text-red-500 transition-colors"
                >
                  <X size={14} />
                </button>
              </div>
            )}

            <form
              onSubmit={handleSubmitComment}
              className="flex items-end gap-3"
            >
              <img
                src={
                  currentUser?.avatar?.url ||
                  `https://ui-avatars.com/api/?name=${currentUser?.displayName}`
                }
                className="w-10 h-10 rounded-full object-cover shrink-0 ring-2 ring-border mb-1 transition-colors"
                alt="my avatar"
              />
              <div className="flex-1 relative group">
                <textarea
                  id="comment-input"
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  placeholder={
                    replyingTo ? "Viết câu trả lời..." : "Thêm bình luận..."
                  }
                  className="w-full bg-background border border-border focus:bg-surface focus:border-primary-500 focus:ring-4 focus:ring-primary-50 rounded-3xl px-5 py-3.5 min-h-[50px] max-h-32 resize-none outline-none text-[15px] transition-all pr-12 scrollbar-hide text-foreground placeholder:text-muted"
                  rows="1"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSubmitComment(e);
                    }
                  }}
                />
                <button
                  type="submit"
                  disabled={submitting || !newComment.trim()}
                  className="absolute right-2 bottom-2 p-2 bg-primary-600 text-on-primary rounded-full transition-transform hover:bg-primary-700 active:scale-95 disabled:opacity-0 disabled:scale-75 duration-200"
                >
                  {submitting ? (
                    <Loader2 size={18} className="animate-spin" />
                  ) : (
                    <Send size={18} className="ml-0.5" />
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>

      {/* POPUP PHỤ - XEM DANH SÁCH NGƯỜI THẢ TIM */}
      {showReactionList && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm px-4">
          <div className="bg-surface border border-border rounded-3xl w-full max-w-sm shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 transition-colors">
            {/* ... (Giữ nguyên phần popup thả tim) ... */}
            <div className="px-5 py-4 border-b border-border flex justify-between items-center bg-background transition-colors">
              <h3 className="font-bold text-foreground text-sm flex items-center gap-2 transition-colors">
                <Heart
                  className="text-primary-500 fill-primary-500"
                  size={16}
                />
                Người đã bày tỏ cảm xúc
              </h3>
              <button
                onClick={() => setShowReactionList(false)}
                className="p-1.5 bg-hover text-muted rounded-full hover:opacity-80 transition-colors"
              >
                <X size={16} />
              </button>
            </div>
            <div className="max-h-[60vh] overflow-y-auto p-3 custom-scrollbar bg-surface transition-colors">
              {post.reactions?.length === 0 ? (
                <p className="text-center text-muted py-6 text-sm transition-colors">
                  Chưa có ai thả cảm xúc.
                </p>
              ) : (
                <div className="space-y-1">
                  {post.reactions?.map((r, i) => {
                    const reactionDef = REACTION_TYPES.find(
                      (rt) => rt.type === r.type,
                    );
                    return (
                      <div
                        key={i}
                        className="flex items-center justify-between p-2 hover:bg-hover rounded-2xl transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <img
                            src={
                              r.user?.avatar?.url ||
                              `https://ui-avatars.com/api/?name=${r.user?.displayName || "User"}`
                            }
                            className="w-10 h-10 rounded-full object-cover border border-border transition-colors"
                            alt="avatar"
                          />
                          <span className="font-semibold text-sm text-foreground transition-colors">
                            {r.user?.displayName || "Người dùng"}
                          </span>
                        </div>
                        <div className="bg-surface shadow-sm border border-border w-8 h-8 rounded-full flex items-center justify-center text-lg transition-colors">
                          {reactionDef?.icon || "👍"}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* POPUP FULLSCREEN - TRÌNH XEM ẢNH KHÔNG BỊ CẮT (LIGHTBOX) */}
      {viewerIndex !== null && post.images && post.images.length > 0 && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95 animate-in fade-in duration-200"
          onClick={() => setViewerIndex(null)}
        >
          {/* Nút Đóng */}
          <button
            className="absolute top-4 right-4 z-50 p-2 text-white/70 hover:text-white bg-black/20 hover:bg-black/50 rounded-full transition-all"
            onClick={(e) => {
              e.stopPropagation();
              setViewerIndex(null);
            }}
          >
            <X size={28} />
          </button>

          {/* Hiển thị số đếm ảnh */}
          {post.images.length > 1 && (
            <div className="absolute top-6 left-6 z-50 text-white/70 font-medium tracking-wide">
              {viewerIndex + 1} / {post.images.length}
            </div>
          )}

          {/* Vùng nhấn chuyển ảnh bên TRÁI */}
          {post.images.length > 1 && (
            <div
              className="absolute left-0 inset-y-0 w-1/3 md:w-1/4 z-40 flex items-center justify-start sm:px-6 px-2 cursor-pointer group"
              onClick={prevImage}
            >
              <button className="p-3 rounded-full bg-black/20 text-white/50 group-hover:bg-black/60 group-hover:text-white transition-all transform group-hover:scale-110">
                <ChevronLeft size={36} />
              </button>
            </div>
          )}

          {/* Hình ảnh hiển thị nguyên bản */}
          <div className="relative z-30 w-full h-full flex items-center justify-center p-4 sm:p-12">
            <img
              src={post.images[viewerIndex].url}
              className="max-w-full max-h-[90vh] w-auto h-auto object-contain select-none shadow-2xl animate-in zoom-in-95 duration-200"
              alt="fullscreen-post-img"
              onClick={(e) => e.stopPropagation()} // Chặn click vào ảnh bị đóng
            />
          </div>

          {/* Vùng nhấn chuyển ảnh bên PHẢI */}
          {post.images.length > 1 && (
            <div
              className="absolute right-0 inset-y-0 w-1/3 md:w-1/4 z-40 flex items-center justify-end sm:px-6 px-2 cursor-pointer group"
              onClick={nextImage}
            >
              <button className="p-3 rounded-full bg-black/20 text-white/50 group-hover:bg-black/60 group-hover:text-white transition-all transform group-hover:scale-110">
                <ChevronRight size={36} />
              </button>
            </div>
          )}
        </div>
      )}
    </>
  );
};

export default PostDetailModal;
