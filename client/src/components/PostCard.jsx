// src/components/PostCard.jsx
import React, { useState, useRef, useEffect } from "react";
import {
  ThumbsUp,
  MessageCircle,
  Share2,
  MoreHorizontal,
  ChevronLeft,
  ChevronRight,
  X,
} from "lucide-react";
import { useAuthStore } from "../store/useAuthStore";

const REACTION_TYPES = [
  { type: "like", icon: "👍", color: "text-primary-600", label: "Thích" },
  { type: "love", icon: "❤️", color: "text-rose-500", label: "Yêu thích" },
  { type: "haha", icon: "😆", color: "text-yellow-500", label: "Haha" },
  { type: "wow", icon: "😮", color: "text-yellow-500", label: "Wow" },
  { type: "sad", icon: "😢", color: "text-yellow-500", label: "Buồn" },
  { type: "angry", icon: "😡", color: "text-red-500", label: "Phẫn nộ" },
];

const PostCard = ({
  post,
  currentUser,
  onEdit,
  onDelete,
  onClickPost,
  onToggleLike,
  onSharePost,
}) => {
  const [activeMenu, setActiveMenu] = useState(false);
  const [showReactions, setShowReactions] = useState(false);

  const hideTimeout = useRef(null);
  const holdTimeout = useRef(null);
  const [isLongPress, setIsLongPress] = useState(false);

  // STATE MỚI: Quản lý trình xem ảnh Fullscreen (Lightbox) ngay tại Feed
  const [viewerIndex, setViewerIndex] = useState(null);

  const { user } = useAuthStore();

  const isAuthor = user?._id === (post.user?._id || post.user);
  const isAdmin = user?.role === "admin";
  const canEditDelete = isAuthor || isAdmin;

  // Lắng nghe phím bấm cho Trình xem ảnh
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

  const myReaction = post.reactions?.find((r) => {
    const reactionUserId = String(r.user?._id || r.user);
    const currentUserId = String(currentUser?._id || currentUser);
    return reactionUserId === currentUserId;
  });

  const currentReactionConfig = myReaction
    ? REACTION_TYPES.find((r) => r.type === myReaction.type)
    : null;

  const renderContent = (text) => {
    if (!text) return null;
    const MAX_LENGTH = 150;
    const isLongText = text.length > MAX_LENGTH;
    return (
      <p className="px-4 pb-3 text-foreground text-sm whitespace-pre-wrap leading-relaxed">
        {isLongText ? text.substring(0, MAX_LENGTH) + "..." : text}
        {isLongText && (
          <button
            onPointerDown={(e) => {
              e.stopPropagation();
              e.preventDefault();
              onClickPost(post);
            }}
            className="text-primary-600 font-bold ml-1 hover:underline"
          >
            Xem thêm
          </button>
        )}
      </p>
    );
  };

  // HÀM RENDER HÌNH ẢNH: Xử lý Click mở thẳng ảnh thay vì mở bài viết
  const renderImages = () => {
    const images = post.images;
    if (!images || images.length === 0) return null;

    const len = images.length;

    return (
      <div className="w-full overflow-hidden bg-border border-t border-border">
        {len === 1 && (
          <img
            src={images[0].url}
            onClick={(e) => {
              e.stopPropagation();
              setViewerIndex(0);
            }}
            className="w-full max-h-[500px] object-cover cursor-pointer hover:opacity-95 transition-opacity"
            alt="post-img"
          />
        )}

        {len === 2 && (
          <div className="grid grid-cols-2 gap-0.5 h-[350px] sm:h-[450px]">
            <img
              src={images[0].url}
              onClick={(e) => {
                e.stopPropagation();
                setViewerIndex(0);
              }}
              className="w-full h-full object-cover cursor-pointer hover:opacity-95 transition-opacity"
              alt="post-img"
            />
            <img
              src={images[1].url}
              onClick={(e) => {
                e.stopPropagation();
                setViewerIndex(1);
              }}
              className="w-full h-full object-cover cursor-pointer hover:opacity-95 transition-opacity"
              alt="post-img"
            />
          </div>
        )}

        {len === 3 && (
          <div className="grid grid-cols-2 grid-rows-2 gap-0.5 h-[350px] sm:h-[450px]">
            <img
              src={images[0].url}
              onClick={(e) => {
                e.stopPropagation();
                setViewerIndex(0);
              }}
              className="w-full h-full object-cover row-span-2 cursor-pointer hover:opacity-95 transition-opacity"
              alt="post-img"
            />
            <img
              src={images[1].url}
              onClick={(e) => {
                e.stopPropagation();
                setViewerIndex(1);
              }}
              className="w-full h-full object-cover cursor-pointer hover:opacity-95 transition-opacity"
              alt="post-img"
            />
            <img
              src={images[2].url}
              onClick={(e) => {
                e.stopPropagation();
                setViewerIndex(2);
              }}
              className="w-full h-full object-cover cursor-pointer hover:opacity-95 transition-opacity"
              alt="post-img"
            />
          </div>
        )}

        {len >= 4 && (
          <div className="grid grid-cols-2 grid-rows-2 gap-0.5 h-[350px] sm:h-[450px]">
            <img
              src={images[0].url}
              onClick={(e) => {
                e.stopPropagation();
                setViewerIndex(0);
              }}
              className="w-full h-full object-cover cursor-pointer hover:opacity-95 transition-opacity"
              alt="post-img"
            />
            <img
              src={images[1].url}
              onClick={(e) => {
                e.stopPropagation();
                setViewerIndex(1);
              }}
              className="w-full h-full object-cover cursor-pointer hover:opacity-95 transition-opacity"
              alt="post-img"
            />
            <img
              src={images[2].url}
              onClick={(e) => {
                e.stopPropagation();
                setViewerIndex(2);
              }}
              className="w-full h-full object-cover cursor-pointer hover:opacity-95 transition-opacity"
              alt="post-img"
            />
            <div
              className="relative w-full h-full cursor-pointer group"
              onClick={(e) => {
                e.stopPropagation();
                setViewerIndex(3);
              }}
            >
              <img
                src={images[3].url}
                className="w-full h-full object-cover group-hover:opacity-95 transition-opacity"
                alt="post-img"
              />
              {len > 4 && (
                <div className="absolute inset-0 bg-black/50 flex items-center justify-center transition-colors group-hover:bg-black/40">
                  <span className="text-white text-2xl sm:text-3xl font-bold">
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
      <article className="bg-surface rounded-xl shadow-sm border border-border relative transition-colors duration-300">
        {/* HEADER BÀI VIẾT */}
        <div className="p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img
              src={
                post.user?.avatar?.url ||
                `https://ui-avatars.com/api/?name=${post.user?.displayName}`
              }
              className="w-10 h-10 rounded-full object-cover border border-border"
              alt="avatar"
            />
            <div>
              <h3 className="font-bold text-foreground text-sm hover:underline cursor-pointer">
                {post.user?.displayName}
              </h3>
              <p className="text-xs text-muted font-medium">
                {new Date(post.createdAt).toLocaleDateString("vi-VN")} lúc{" "}
                {new Date(post.createdAt).toLocaleTimeString("vi-VN", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>
            </div>
          </div>

          {/* MENU 3 CHẤM */}
          {canEditDelete && (
            <div className="relative">
              <button
                onClick={() => setActiveMenu(true)}
                className="p-2 text-muted hover:bg-hover hover:text-foreground rounded-full transition-colors"
              >
                <MoreHorizontal size={20} />
              </button>

              {activeMenu && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onPointerDown={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      setActiveMenu(false);
                    }}
                  />
                  <div className="absolute right-0 mt-1 w-36 bg-surface border border-border rounded-lg shadow-lg z-50 py-1 overflow-hidden">
                    <button
                      onPointerDown={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        setActiveMenu(false);
                        onEdit(post);
                      }}
                      className="w-full text-left px-4 py-2.5 text-sm font-semibold text-foreground hover:bg-hover transition-colors"
                    >
                      Chỉnh sửa
                    </button>
                    <button
                      onPointerDown={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        setActiveMenu(false);
                        onDelete(post._id);
                      }}
                      className="w-full text-left px-4 py-2.5 text-sm font-semibold text-red-600 hover:bg-red-50 transition-colors"
                    >
                      Xóa bài viết
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* NỘI DUNG VÀ HÌNH ẢNH */}
        {renderContent(post.content)}
        {renderImages()}

        {/* NÚT TƯƠNG TÁC */}
        <div className="px-2 py-1.5 flex items-center justify-between border-t border-border">
          {/* NÚT LIKE */}
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
            onTouchStart={() => {
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
            {showReactions && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    setShowReactions(false);
                  }}
                />
                <div className="absolute bottom-full left-0 mb-2 bg-surface rounded-full shadow-[0_4px_15px_rgba(0,0,0,0.15)] border border-border flex items-center gap-1.5 px-3 py-2 animate-in slide-in-from-bottom-2 fade-in duration-200 z-50">
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
              </>
            )}

            <button
              onClick={(e) => {
                e.stopPropagation();
                if (isLongPress) return;
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
              <span className="text-sm">
                {post.reactions?.length > 0 ? post.reactions.length : "Thích"}
              </span>
            </button>
          </div>

          {/* NÚT BÌNH LUẬN -> Nhấn vào đây MỚI gọi onClickPost (mở modal chi tiết) */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onClickPost(post);
            }}
            className="flex-1 flex items-center justify-center gap-2 py-2 text-muted hover:bg-hover hover:text-primary-600 rounded-lg font-bold transition-colors"
          >
            <MessageCircle size={20} />
            <span className="text-sm">
              {post.commentCount > 0 ? post.commentCount : "Bình luận"}
            </span>
          </button>

          {/* NÚT CHIA SẺ */}
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
      </article>

      {/* POPUP FULLSCREEN - XEM ẢNH TRỰC TIẾP TỪ FEED */}
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

          {/* Hiển thị số đếm */}
          {post.images.length > 1 && (
            <div className="absolute top-6 left-6 z-50 text-white/70 font-medium tracking-wide">
              {viewerIndex + 1} / {post.images.length}
            </div>
          )}

          {/* Nút chuyển ảnh TRÁI */}
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

          {/* Hình ảnh */}
          <div className="relative z-30 w-full h-full flex items-center justify-center p-4 sm:p-12">
            <img
              src={post.images[viewerIndex].url}
              className="max-w-full max-h-[90vh] w-auto h-auto object-contain select-none shadow-2xl animate-in zoom-in-95 duration-200"
              alt="fullscreen-img"
              onClick={(e) => e.stopPropagation()} // Click ảnh không bị tắt
            />
          </div>

          {/* Nút chuyển ảnh PHẢI */}
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

export default PostCard;
