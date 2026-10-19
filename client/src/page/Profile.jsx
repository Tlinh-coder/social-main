import React, { useState, useRef, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuthStore } from "../store/useAuthStore";
import {
  Mail,
  Camera,
  Save,
  Loader2,
  Edit,
  X,
  Calendar,
  Heart,
  MessageSquare,
  MoreHorizontal,
  UserPlus,
  UserCheck,
  Check,
  UserMinus,
} from "lucide-react";
import api from "../utils/api";
import { toast } from "react-hot-toast";

const Profile = () => {
  const { user: currentUser } = useAuthStore();
  const { userId } = useParams();
  const navigate = useNavigate();

  const profileId = userId || currentUser?._id;
  const isOwnProfile = currentUser?._id === profileId;

  // ==========================================
  // STATE: THÔNG TIN USER & TRẠNG THÁI BẠN BÈ
  // ==========================================
  const [profileData, setProfileData] = useState(null);
  const [loading, setLoading] = useState(true);

  const [connectionStatus, setConnectionStatus] = useState("none");
  const [requestId, setRequestId] = useState(null);

  // STATE: Quản lý bật/tắt Menu Hủy kết bạn
  const [showFriendMenu, setShowFriendMenu] = useState(false);

  const isFriend =
    connectionStatus === "friend" ||
    profileData?.friends?.some(
      (f) => String(f._id || f) === String(currentUser?._id),
    );

  // ==========================================
  // CÁC STATE KHÁC
  // ==========================================
  const [posts, setPosts] = useState([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const [isEditing, setIsEditing] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);

  const [avatarFile, setAvatarFile] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState("");
  const avatarInputRef = useRef(null);

  const [coverFile, setCoverFile] = useState(null);
  const [coverPreview, setCoverPreview] = useState("");
  const coverInputRef = useRef(null);

  // ==========================================
  // 1. OBSERVER BẮT SỰ KIỆN SCROLL
  // ==========================================
  const observer = useRef();
  const lastPostElementRef = useCallback(
    (node) => {
      if (loadingMore) return;
      if (observer.current) observer.current.disconnect();
      observer.current = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting && hasMore) setPage((prev) => prev + 1);
      });
      if (node) observer.current.observe(node);
    },
    [loadingMore, hasMore],
  );

  // ==========================================
  // 2. FETCH DỮ LIỆU
  // ==========================================
  const fetchPosts = async (pageNum) => {
    setLoadingMore(true);
    try {
      const res = await api.get(
        `/api/posts?userId=${profileId}&page=${pageNum}&limit=5`,
      );
      if (res.data.success) {
        setPosts((prev) =>
          pageNum === 1 ? res.data.data : [...prev, ...res.data.data],
        );
        setHasMore(pageNum < res.data.totalPages);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    const initProfile = async () => {
      setLoading(true);
      setPosts([]);
      setPage(1);
      setHasMore(true);
      try {
        const userRes = await api.get(`/api/users/${profileId}`);
        if (userRes.data.success) {
          const userData = userRes.data.data || userRes.data.user;
          setProfileData(userData);

          setConnectionStatus(userData.connectionStatus || "none");
          setRequestId(userData.requestId || null);

          setDisplayName(userData.displayName);
          setBio(userData.bio || "");
          setAvatarPreview(
            userData.avatar?.url ||
              `https://ui-avatars.com/api/?name=${userData.displayName}`,
          );
          setCoverPreview(
            userData.cover?.url ||
              "https://images.unsplash.com/photo-1707343843437-caacff5cfa74?q=80&w=1200&auto=format&fit=crop",
          );
        }
        await fetchPosts(1);
      } catch (error) {
        if (error.response?.status === 403)
          toast.error("Bạn phải kết bạn để xem bài viết của người này.");
      } finally {
        setLoading(false);
      }
    };
    if (profileId) initProfile();
  }, [profileId]);

  useEffect(() => {
    if (page > 1) fetchPosts(page);
  }, [page]);

  // ==========================================
  // 3. CÁC HÀM HÀNH ĐỘNG KẾT BẠN
  // ==========================================
  const handleSendRequest = async () => {
    try {
      const res = await api.post(`/api/users/requests/${profileId}`);
      if (res.data.success) {
        setConnectionStatus("sent");
        toast.success("Đã gửi lời mời kết bạn");
      }
    } catch (error) {
      toast.error("Có lỗi xảy ra");
    }
  };

  const handleCancelOrRejectRequest = async () => {
    try {
      const res = await api.delete(
        `/api/users/requests/${requestId || profileId}/reject`,
      );
      if (res.data.success) {
        setConnectionStatus("none");
        setRequestId(null);
        window.dispatchEvent(new Event("friend_request_handled"));
      }
    } catch (error) {
      toast.error("Có lỗi xảy ra");
    }
  };

  const handleAcceptRequest = async () => {
    try {
      const res = await api.post(
        `/api/users/requests/${requestId || profileId}/accept`,
      );
      if (res.data.success) {
        setConnectionStatus("friend");
        toast.success("Đã thêm bạn bè");
        window.dispatchEvent(new Event("friend_request_handled"));
      }
    } catch (error) {
      toast.error("Có lỗi xảy ra");
    }
  };

  const handleUnfriend = async () => {
    if (!window.confirm("Bạn có chắc chắn muốn hủy kết bạn với người này?"))
      return;
    try {
      const res = await api.delete(`/api/users/friends/${profileId}`);
      if (res.data.success) {
        setConnectionStatus("none");
        toast.success("Đã hủy kết bạn");
        window.dispatchEvent(new Event("friend_request_handled"));
      }
    } catch (error) {
      toast.error("Không thể hủy kết bạn lúc này");
    }
  };

  // ==========================================
  // 4. CÁC HÀM CẬP NHẬT PROFILE
  // ==========================================
  const handleImageChange = (e, type) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024)
        return alert("Kích thước ảnh không được vượt quá 5MB!");
      if (type === "avatar") {
        setAvatarFile(file);
        setAvatarPreview(URL.createObjectURL(file));
      } else {
        setCoverFile(file);
        setCoverPreview(URL.createObjectURL(file));
      }
    }
  };

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    if (!displayName.trim())
      return toast.error("Tên hiển thị không được để trống!");
    setIsUpdatingProfile(true);
    try {
      const formData = new FormData();
      formData.append("displayName", displayName);
      formData.append("bio", bio);
      if (avatarFile) formData.append("avatar", avatarFile);
      if (coverFile) formData.append("cover", coverFile);
      const res = await api.put("/api/users/update", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      if (res.data.success) {
        toast.success("Cập nhật hồ sơ thành công!");
        setIsEditing(false);
        window.location.reload();
      }
    } catch (error) {
      toast.error("Lỗi cập nhật hồ sơ");
    } finally {
      setIsUpdatingProfile(false);
    }
  };

  if (loading && !profileData)
    return (
      <div className="min-h-screen bg-background flex items-center justify-center transition-colors duration-300">
        <Loader2 className="animate-spin text-primary-500" size={40} />
      </div>
    );
  if (!profileData)
    return (
      <div className="min-h-screen bg-background flex items-center justify-center text-muted font-bold text-xl transition-colors duration-300">
        Người dùng không tồn tại.
      </div>
    );

  return (
    <div className="min-h-screen bg-background pb-10 transition-colors duration-300">
      {/* HEADER TÀI KHOẢN */}
      <div className="bg-surface shadow-sm transition-colors duration-300">
        <div className="max-w-5xl mx-auto">
          <div className="relative h-48 sm:h-64 md:h-80 w-full group">
            <img
              src={
                isEditing
                  ? coverPreview
                  : profileData.cover?.url || coverPreview
              }
              alt="Cover"
              className="w-full h-full object-cover rounded-b-lg"
            />
            {isEditing && (
              <div
                onClick={() => coverInputRef.current?.click()}
                className="absolute top-4 right-4 bg-black/60 hover:bg-black/80 text-white px-3 py-1.5 rounded-lg flex items-center gap-2 cursor-pointer transition"
              >
                <Camera size={18} />{" "}
                <span className="text-sm font-medium hidden sm:block">
                  Đổi ảnh bìa
                </span>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  ref={coverInputRef}
                  onChange={(e) => handleImageChange(e, "cover")}
                />
              </div>
            )}
          </div>

          <div className="px-4 sm:px-8 pb-4 flex flex-col sm:flex-row items-center sm:items-end justify-between relative -mt-16 sm:-mt-12 mb-4">
            <div className="flex flex-col sm:flex-row items-center gap-4">
              <div className="relative group">
                <img
                  src={
                    isEditing
                      ? avatarPreview
                      : profileData.avatar?.url || avatarPreview
                  }
                  alt="Avatar"
                  // Sửa border thành border-surface để ăn khớp màu thẻ
                  className="w-32 h-32 sm:w-40 sm:h-40 rounded-full object-cover border-4 border-surface shadow-md bg-surface transition-colors"
                />
                {isEditing && (
                  <div
                    onClick={() => avatarInputRef.current?.click()}
                    className="absolute inset-0 bg-black/40 rounded-full flex items-center justify-center cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <Camera className="text-white" size={28} />
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      ref={avatarInputRef}
                      onChange={(e) => handleImageChange(e, "avatar")}
                    />
                  </div>
                )}
              </div>
              <div className="text-center sm:text-left mt-2 sm:mt-12 sm:ml-2">
                <h1 className="text-3xl font-extrabold text-foreground transition-colors">
                  {profileData.displayName}
                </h1>
                <p className="text-muted font-medium transition-colors">
                  {profileData.friends?.length || 0} Bạn bè
                </p>
              </div>
            </div>

            {/* CÁC NÚT HÀNH ĐỘNG TRÊN HEADER */}
            <div className="mt-4 sm:mt-0 flex gap-2 flex-wrap justify-center relative">
              {isOwnProfile && !isEditing && (
                <button
                  onClick={() => setIsEditing(true)}
                  className="flex items-center gap-2 bg-hover hover:opacity-80 text-foreground px-4 py-2 rounded-lg font-semibold transition"
                >
                  <Edit size={18} /> Chỉnh sửa trang cá nhân
                </button>
              )}
              {isOwnProfile && isEditing && (
                <button
                  onClick={() => setIsEditing(false)}
                  className="flex items-center gap-2 bg-red-100 hover:bg-red-200 text-red-600 px-4 py-2 rounded-lg font-semibold transition"
                >
                  Hủy chỉnh sửa
                </button>
              )}

              {!isOwnProfile && (
                <>
                  {connectionStatus === "none" && (
                    <button
                      onClick={handleSendRequest}
                      className="flex items-center gap-2 bg-primary-600 hover:bg-primary-700 text-on-primary px-4 py-2 rounded-lg font-semibold transition"
                    >
                      <UserPlus size={18} /> Thêm bạn bè
                    </button>
                  )}
                  {connectionStatus === "sent" && (
                    <button
                      onClick={handleCancelOrRejectRequest}
                      className="flex items-center gap-2 bg-hover hover:opacity-80 text-foreground px-4 py-2 rounded-lg font-semibold transition"
                    >
                      <X size={18} /> Hủy lời mời
                    </button>
                  )}
                  {connectionStatus === "received" && (
                    <>
                      <button
                        onClick={handleAcceptRequest}
                        className="flex items-center gap-2 bg-primary-600 hover:bg-primary-700 text-on-primary px-4 py-2 rounded-lg font-semibold transition"
                      >
                        <Check size={18} /> Chấp nhận
                      </button>
                      <button
                        onClick={handleCancelOrRejectRequest}
                        className="flex items-center gap-2 bg-hover hover:opacity-80 text-foreground px-4 py-2 rounded-lg font-semibold transition"
                      >
                        <X size={18} /> Xóa
                      </button>
                    </>
                  )}

                  {/* ĐÃ LÀ BẠN BÈ: Nút Dropdown */}
                  {connectionStatus === "friend" && (
                    <div className="relative">
                      {/* Nút Bạn bè */}
                      <button
                        onClick={() => setShowFriendMenu(!showFriendMenu)}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg font-semibold transition ${showFriendMenu ? "bg-primary-100 text-primary-700" : "bg-hover text-foreground hover:opacity-80"}`}
                      >
                        <UserCheck size={18} /> Bạn bè
                      </button>

                      {/* Dropdown Menu */}
                      {showFriendMenu && (
                        <>
                          <div
                            className="fixed inset-0 z-40"
                            onClick={() => setShowFriendMenu(false)}
                          ></div>

                          <div className="absolute top-full right-0 mt-2 w-48 bg-surface border border-border shadow-xl rounded-xl z-50 overflow-hidden">
                            <button
                              onClick={() => {
                                setShowFriendMenu(false);
                                handleUnfriend();
                              }}
                              className="w-full flex items-center gap-3 px-4 py-3 text-red-600 hover:bg-red-50 font-medium text-left transition-colors"
                            >
                              <UserMinus size={18} /> Hủy kết bạn
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  )}

                  {/* NÚT NHẮN TIN */}
                  {connectionStatus === "friend" && (
                    <button
                      onClick={() => navigate(`/messages?userId=${profileId}`)}
                      className="flex items-center gap-2 bg-primary-50 hover:bg-primary-100 text-primary-600 px-4 py-2 rounded-lg font-semibold transition"
                    >
                      <MessageSquare size={18} /> Nhắn tin
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* BODY CHIA CỘT */}
      <div className="max-w-5xl mx-auto px-4 mt-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* CỘT TRÁI: THÔNG TIN */}
          <div className="lg:col-span-1 space-y-4">
            <div className="bg-surface rounded-xl p-5 border border-border shadow-sm sticky top-20 transition-colors duration-300">
              <h3 className="font-bold text-xl text-foreground mb-4">
                Giới thiệu
              </h3>
              <div className="text-center mb-4">
                <p className="text-muted italic">
                  {profileData.bio || "Người dùng này chưa cập nhật tiểu sử."}
                </p>
              </div>
              <hr className="mb-4 border-border" />
              <div className="space-y-3">
                <div className="flex items-center gap-3 text-muted">
                  <Mail size={20} />
                  <span className="text-sm truncate">{profileData.email}</span>
                </div>
                <div className="flex items-center gap-3 text-muted">
                  <Calendar size={20} />
                  <span className="text-sm">
                    Đã tham gia{" "}
                    {new Date(profileData.createdAt).toLocaleDateString(
                      "vi-VN",
                    )}
                  </span>
                </div>
              </div>
            </div>

            {isOwnProfile && isEditing && (
              <form
                onSubmit={handleUpdateProfile}
                className="bg-surface rounded-xl p-5 border border-border shadow-sm mt-4 transition-colors"
              >
                <div className="flex justify-between items-center mb-4">
                  <h3 className="font-bold text-foreground">
                    Chỉnh sửa chi tiết
                  </h3>
                  <button
                    type="button"
                    onClick={() => setIsEditing(false)}
                    className="text-muted hover:bg-hover p-1 rounded-full"
                  >
                    <X size={20} />
                  </button>
                </div>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-semibold text-foreground mb-1">
                      Tên hiển thị
                    </label>
                    <input
                      type="text"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      className="w-full bg-background border border-border focus:border-primary-500 text-foreground rounded-lg px-3 py-2 outline-none transition-colors"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-foreground mb-1">
                      Tiểu sử (Bio)
                    </label>
                    <textarea
                      value={bio}
                      onChange={(e) => setBio(e.target.value)}
                      placeholder="Mô tả ngắn gọn về bản thân..."
                      rows={3}
                      className="w-full bg-background border border-border focus:border-primary-500 text-foreground placeholder:text-muted rounded-lg px-3 py-2 outline-none resize-none transition-colors"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={isUpdatingProfile}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-on-primary font-medium rounded-lg transition-colors"
                  >
                    {isUpdatingProfile ? (
                      <Loader2 size={18} className="animate-spin" />
                    ) : (
                      <Save size={18} />
                    )}{" "}
                    Lưu thay đổi
                  </button>
                </div>
              </form>
            )}
          </div>

          {/* CỘT PHẢI: BÀI VIẾT */}
          <div className="lg:col-span-2 space-y-4">
            {/* THẺ DUMMY: BẠN ĐANG NGHĨ GÌ */}
            {isOwnProfile && (
              <div className="bg-surface rounded-xl p-4 border border-border shadow-sm flex gap-3 items-center transition-colors duration-300">
                <img
                  src={profileData.avatar?.url || avatarPreview}
                  className="w-10 h-10 rounded-full object-cover border border-border"
                  alt="avatar"
                />
                <div className="flex-1 bg-hover hover:opacity-80 cursor-pointer rounded-full px-4 py-2.5 text-muted transition-colors">
                  Bạn đang nghĩ gì thế?
                </div>
              </div>
            )}

            {/* DANH SÁCH BÀI VIẾT */}
            {posts.length > 0 ? (
              <>
                {posts.map((post, index) => {
                  const isLastPost = posts.length === index + 1;
                  return (
                    <div
                      key={post._id}
                      ref={isLastPost ? lastPostElementRef : null}
                      className="bg-surface rounded-xl border border-border shadow-sm transition-colors duration-300"
                    >
                      <div className="p-4 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <img
                            src={profileData.avatar?.url || avatarPreview}
                            className="w-10 h-10 rounded-full object-cover border border-border"
                            alt="author"
                          />
                          <div>
                            <h4 className="font-bold text-foreground">
                              {profileData.displayName}
                            </h4>
                            <span className="text-xs text-muted">
                              {new Date(post.createdAt).toLocaleDateString(
                                "vi-VN",
                                { hour: "2-digit", minute: "2-digit" },
                              )}
                            </span>
                          </div>
                        </div>
                        {isOwnProfile && (
                          <button className="text-muted hover:bg-hover hover:text-foreground p-2 rounded-full transition-colors">
                            <MoreHorizontal size={20} />
                          </button>
                        )}
                      </div>
                      <div className="px-4 pb-2 text-foreground whitespace-pre-wrap">
                        {post.content}
                      </div>
                      {post.images && post.images.length > 0 && (
                        <img
                          src={post.images[0].url || post.images[0]}
                          alt="Post img"
                          className="w-full max-h-[500px] object-cover border-y border-border"
                        />
                      )}
                      <div className="p-4 pt-2">
                        <div className="flex items-center justify-between text-muted text-sm mb-3 border-b border-border pb-2">
                          <span>{post.likes?.length || 0} lượt thích</span>
                          <span>{post.comments?.length || 0} bình luận</span>
                        </div>
                        <div className="flex justify-between">
                          <button className="flex-1 flex items-center justify-center gap-2 py-1.5 text-muted hover:text-primary-600 hover:bg-hover rounded-lg font-medium transition-colors">
                            <Heart size={20} /> Thích
                          </button>
                          <button className="flex-1 flex items-center justify-center gap-2 py-1.5 text-muted hover:text-primary-600 hover:bg-hover rounded-lg font-medium transition-colors">
                            <MessageSquare size={20} /> Bình luận
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
                {loadingMore && (
                  <div className="flex justify-center py-4">
                    <Loader2
                      className="animate-spin text-primary-500"
                      size={32}
                    />
                  </div>
                )}
                {!hasMore && (
                  <div className="text-center py-4 text-muted font-medium">
                    Đã hiển thị hết bài viết
                  </div>
                )}
              </>
            ) : (
              !loading && (
                <div className="bg-surface rounded-xl p-10 text-center border border-border transition-colors duration-300">
                  <p className="text-muted font-medium">
                    {isOwnProfile
                      ? "Bạn chưa có bài viết nào."
                      : isFriend
                        ? "Người dùng này chưa có bài viết nào."
                        : "Bạn chưa kết bạn với người này, hoặc họ không có bài viết công khai nào."}
                  </p>
                </div>
              )
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Profile;
