// src/pages/Messages.jsx
import React, { useState, useEffect, useRef, useLayoutEffect } from "react";
import { useAuthStore } from "../store/useAuthStore";
import {
  Search,
  Send,
  Image as ImageIcon,
  ArrowLeft,
  Loader2,
  MessageSquareDashed,
  X,
  Users,
  Phone,
  Video,
  PhoneCall,
  PhoneOff,
  PhoneMissed,
  Camera,
} from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import api from "../utils/api";
import socket from "../utils/socket";
import { toast } from "react-hot-toast";

import CallModal from "../components/CallModal";

// ==========================================
// BỘ NHỚ ĐỆM TOÀN CỤC (GLOBAL RAM CACHE)
// Giúp giữ dữ liệu không bị xóa khi chuyển tab (Trang chủ <-> Tin nhắn)
// ==========================================
let globalConversationsCache = null;
let globalContactsCache = null;
let globalMessagesCache = {};

// ==========================================
// BỘ HÀM XỬ LÝ THỜI GIAN GIAO DIỆN
// ==========================================
const formatTimeAgo = (dateString) => {
  if (!dateString) return "Ngoại tuyến";
  const seconds = Math.floor((new Date() - new Date(dateString)) / 1000);
  if (seconds > 604800) return "Ngoại tuyến";

  let interval = seconds / 86400;
  if (interval >= 1) return `Hoạt động ${Math.floor(interval)} ngày trước`;

  interval = seconds / 3600;
  if (interval >= 1) return `Hoạt động ${Math.floor(interval)} giờ trước`;

  interval = seconds / 60;
  if (interval >= 1) return `Hoạt động ${Math.floor(interval)} phút trước`;

  return "Vừa mới hoạt động";
};

const formatTimeBadge = (dateString) => {
  if (!dateString) return "";
  const seconds = Math.floor((new Date() - new Date(dateString)) / 1000);
  if (seconds > 604800) return "";

  let interval = seconds / 86400;
  if (interval >= 1) return `${Math.floor(interval)}n`;

  interval = seconds / 3600;
  if (interval >= 1) return `${Math.floor(interval)}h`;

  interval = seconds / 60;
  if (interval >= 1) return `${Math.floor(interval)}p`;

  return "1p";
};

const formatMessageTime = (dateString) => {
  if (!dateString) return "";
  const date = new Date(dateString);
  const now = new Date();
  const diffDays = Math.floor((now - date) / 86400000);

  if (diffDays === 0 && now.getDate() === date.getDate()) {
    return date.toLocaleTimeString("vi-VN", {
      hour: "2-digit",
      minute: "2-digit",
    });
  }
  if (diffDays < 7) {
    const days = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];
    return days[date.getDay()];
  }
  return date.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" });
};

const Messages = () => {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();

  const searchParams = new URLSearchParams(location.search);
  const targetUserId = searchParams.get("userId");

  // KHỞI TẠO STATE TỪ CACHE (Nếu có) ĐỂ RENDER NGAY LẬP TỨC TRONG 0ms
  const [conversations, setConversations] = useState(
    globalConversationsCache || [],
  );
  const [contactList, setContactList] = useState(globalContactsCache || []);
  const [activeChat, setActiveChat] = useState(null);
  const [messages, setMessages] = useState([]);
  const [onlineUsers, setOnlineUsers] = useState([]);

  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const [timeTick, setTimeTick] = useState(0);
  const prevOnlineUsersRef = useRef([]);

  const [newMessage, setNewMessage] = useState("");
  const [images, setImages] = useState([]);
  const [previewUrls, setPreviewUrls] = useState([]);

  // NẾU ĐÃ CÓ CACHE THÌ TẮT LOADING ĐỂ TRÁNH GIẬT MÀN HÌNH
  const [loadingConv, setLoadingConv] = useState(!globalConversationsCache);
  const [loadingContacts, setLoadingContacts] = useState(!globalContactsCache);
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const [sending, setSending] = useState(false);

  const chatContainerRef = useRef(null);
  const messagesEndRef = useRef(null);
  const isInitialScrollRef = useRef(true);
  const previousScrollHeightRef = useRef(null);

  const fileInputRef = useRef(null);
  const textareaRef = useRef(null);

  const pendingMessagesRef = useRef([]);
  const toastTimerRef = useRef(null);
  const isManuallyHangingUp = useRef(false);

  const [activeCall, setActiveCall] = useState(null);
  const [isCallAccepted, setIsCallAccepted] = useState(false);

  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [capturedPhotoUrl, setCapturedPhotoUrl] = useState(null);
  const [capturedPhotoFile, setCapturedPhotoFile] = useState(null);
  const cameraVideoRef = useRef(null);
  const cameraStreamRef = useRef(null);

  const dialtoneAudio = useRef(new Audio("/dialtone.mp3"));
  const endCallAudio = useRef(new Audio("/endcall.mp3"));
  const notificationAudio = useRef(new Audio("/notification.mp3"));

  // Dọn dẹp cache nếu User đăng xuất
  useEffect(() => {
    if (!user) {
      globalConversationsCache = null;
      globalContactsCache = null;
      globalMessagesCache = {};
    }
  }, [user]);

  const playEndCallSound = () => {
    endCallAudio.current.currentTime = 0;
    endCallAudio.current.play().catch((e) => console.log(e));
  };

  const activeChatRef = useRef(activeChat);
  useEffect(() => {
    activeChatRef.current = activeChat;
  }, [activeChat]);

  // ==========================================
  // HÀM ÉP CUỘN XUỐNG ĐÁY CHỐNG TRÔI ẢNH
  // ==========================================
  const scrollToBottom = () => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({
        behavior: isInitialScrollRef.current ? "auto" : "smooth",
        block: "end",
      });
    }
  };

  // Hàm xử lý ảnh load xong (Chỉ cuộn xuống nếu là lần đầu mở chat)
  const handleImageLoad = () => {
    if (isInitialScrollRef.current) {
      scrollToBottom();
    }
  };

  useLayoutEffect(() => {
    if (previousScrollHeightRef.current !== null && chatContainerRef.current) {
      const newScrollHeight = chatContainerRef.current.scrollHeight;
      chatContainerRef.current.scrollTop =
        newScrollHeight - previousScrollHeightRef.current;
      previousScrollHeightRef.current = null;
    } else {
      scrollToBottom();
      if (messages.length > 0 && !loadingMsgs) {
        const timer = setTimeout(() => {
          isInitialScrollRef.current = false;
        }, 150);
        return () => clearTimeout(timer);
      }
    }
  }, [messages, previewUrls, loadingMsgs]);

  // ==========================================
  // XỬ LÝ LOAD THÊM TIN NHẮN CŨ (PAGINATION)
  // ==========================================
  const loadMoreMessages = async () => {
    if (!hasMore || loadingMore || !activeChat) return;
    setLoadingMore(true);
    try {
      const nextPage = page + 1;
      const res = await api.get(
        `/api/messages/history/${activeChat._id}?page=${nextPage}`,
      );
      if (res.data.success) {
        if (chatContainerRef.current) {
          previousScrollHeightRef.current =
            chatContainerRef.current.scrollHeight;
        }
        const updatedMessages = [...res.data.data, ...messages];
        setMessages(updatedMessages);
        globalMessagesCache[activeChat._id] = updatedMessages; // Cập nhật luôn vào Cache

        setPage(nextPage);
        setHasMore(res.data.pagination.hasMore);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoadingMore(false);
    }
  };

  const handleScroll = (e) => {
    if (e.target.scrollTop < 50 && hasMore && !loadingMore) {
      loadMoreMessages();
    }
  };

  // ==========================================
  // BỘ TỰ ĐỘNG LÀM MỚI SỐ PHÚT (1 PHÚT/LẦN)
  // ==========================================
  useEffect(() => {
    const timer = setInterval(() => setTimeTick((prev) => prev + 1), 60000);
    return () => clearInterval(timer);
  }, []);

  // ==========================================
  // TẢI DỮ LIỆU INBOX & CONTACTS (SILENT FETCH)
  // ==========================================
  useEffect(() => {
    const fetchConversations = async () => {
      try {
        const res = await api.get("/api/messages/inbox");
        if (res.data.success) {
          globalConversationsCache = res.data.data;
          setConversations(res.data.data);
        }
      } catch (error) {
        console.error(error);
      } finally {
        setLoadingConv(false);
      }
    };
    fetchConversations();
  }, []);

  useEffect(() => {
    const fetchContactList = async () => {
      try {
        const res = await api.get("/api/messages/contact-list");
        if (res.data.success) {
          globalContactsCache = res.data.data;
          setContactList(res.data.data);
        }
      } catch (error) {
        console.error(error);
      } finally {
        setLoadingContacts(false);
      }
    };
    fetchContactList();
  }, []);

  // ==========================================
  // CHUYỂN NGƯỜI CHAT (TRẢ VỀ TỪ CACHE NGAY LẬP TỨC)
  // ==========================================
  useEffect(() => {
    if (targetUserId && !loadingConv && !loadingContacts) {
      let chatUser =
        conversations.find((c) => String(c._id) === targetUserId) ||
        contactList.find((c) => String(c._id) === targetUserId);
      if (chatUser) {
        setActiveChat(chatUser);
        navigate("/messages", { replace: true });
      } else {
        toast.error("Bạn chỉ có thể nhắn tin với người đã kết bạn!");
        navigate("/messages", { replace: true });
      }
    }
  }, [
    targetUserId,
    loadingConv,
    loadingContacts,
    conversations,
    contactList,
    navigate,
  ]);

  useEffect(() => {
    if (!activeChat) return;

    // Reset lại phân trang
    isInitialScrollRef.current = true;
    setPage(1);
    setHasMore(true);

    if (!activeChat.userDetail) {
      activeChat.userDetail = {
        displayName: activeChat.displayName,
        avatar: activeChat.avatar,
        lastActive: activeChat.lastActive,
      };
    }

    // 1. Lấy dữ liệu ngay từ Cache (Không làm sập UI)
    const cachedMessages = globalMessagesCache[activeChat._id];
    if (cachedMessages) {
      setMessages(cachedMessages);
      setLoadingMsgs(false);
    } else {
      setMessages([]);
      setLoadingMsgs(true); // Chỉ hiện Skeleton nếu chưa từng mở chat này
    }

    // 2. Tải ngầm dữ liệu mới nhất từ API (Silent Fetch)
    const fetchMessages = async () => {
      try {
        await api.put(`/api/messages/read/${activeChat._id}`);
        const res = await api.get(
          `/api/messages/history/${activeChat._id}?page=1`,
        );
        if (res.data.success) {
          const freshData = res.data.data;
          setMessages(freshData);
          globalMessagesCache[activeChat._id] = freshData; // Lưu đệm
          setHasMore(res.data.pagination?.hasMore ?? false);

          setConversations((prev) => {
            const newList = prev.map((c) =>
              String(c._id) === String(activeChat._id)
                ? { ...c, isRead: true, unreadCount: 0 }
                : c,
            );
            globalConversationsCache = newList;
            return newList;
          });
          window.dispatchEvent(new Event("update_unread_badge"));
        }
      } catch (error) {
        console.error(error);
      } finally {
        setLoadingMsgs(false);
      }
    };
    fetchMessages();
  }, [activeChat?._id]);

  // ==========================================
  // GỬI TIN NHẮN CHỮ / ẢNH (GHI ĐÈ LUÔN VÀO CACHE)
  // ==========================================
  const handleSendMessage = async (e) => {
    e?.preventDefault();
    if (!newMessage.trim() && images.length === 0) return;

    const messageText = newMessage;
    setNewMessage("");
    if (textareaRef.current) textareaRef.current.style.height = "44px";
    setSending(true);

    const tempMsg = {
      _id: Date.now().toString(),
      sender: {
        _id: user._id,
        displayName: user.displayName,
        avatar: user.avatar,
      },
      content: messageText,
      images: previewUrls.map((url) => ({ url })),
      createdAt: new Date().toISOString(),
      isTemp: true,
      isRead: false,
    };

    // Đẩy tạm lên giao diện và lưu cache
    const updatedMessages = [...messages, tempMsg];
    setMessages(updatedMessages);
    if (activeChat) globalMessagesCache[activeChat._id] = updatedMessages;

    const backupImages = [...images];
    setImages([]);
    setPreviewUrls([]);

    try {
      const formData = new FormData();
      formData.append("receiverId", activeChat._id);
      formData.append("content", messageText);
      backupImages.forEach((img) => formData.append("images", img));

      const res = await api.post(`/api/messages`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      if (res.data.success) {
        setMessages((prev) => {
          const newList = prev.map((msg) =>
            msg._id === tempMsg._id ? res.data.data : msg,
          );
          globalMessagesCache[activeChat._id] = newList;
          return newList;
        });

        const inboxExists = conversations.some(
          (c) => String(c._id) === String(activeChat._id),
        );
        if (!inboxExists) {
          api.get("/api/messages/inbox").then((res_inbox) => {
            if (res_inbox.data.success) {
              setConversations(res_inbox.data.data);
              globalConversationsCache = res_inbox.data.data;
            }
          });
        } else {
          setConversations((prevList) => {
            const newList = prevList.map((conv) =>
              String(conv._id) === String(activeChat._id)
                ? {
                    ...conv,
                    lastMessage: messageText,
                    lastImages: res.data.data.images,
                    lastSender: user._id,
                    createdAt: new Date().toISOString(),
                    isRead: true,
                    unreadCount: 0,
                  }
                : conv,
            );
            globalConversationsCache = newList;
            return newList;
          });
        }
      }
    } catch (error) {
      toast.error(error.response?.data?.message || "Không thể gửi tin nhắn!");
      setMessages((prev) => prev.filter((msg) => msg._id !== tempMsg._id));
    } finally {
      setSending(false);
    }
  };

  // ==========================================
  // REAL-TIME (SOCKET) CẬP NHẬT TRẠNG THÁI VÀ TIN NHẮN
  // ==========================================
  useEffect(() => {
    if (!user) return;
    socket.on("update_online_users", (uniqueUsersList) => {
      const newlyOffline = prevOnlineUsersRef.current.filter(
        (id) => !uniqueUsersList.includes(id),
      );
      if (newlyOffline.length > 0) {
        const now = new Date().toISOString();
        setConversations((prev) =>
          prev.map((c) =>
            newlyOffline.includes(String(c._id))
              ? { ...c, userDetail: { ...c.userDetail, lastActive: now } }
              : c,
          ),
        );
        setContactList((prev) =>
          prev.map((c) =>
            newlyOffline.includes(String(c._id))
              ? { ...c, lastActive: now }
              : c,
          ),
        );
        setActiveChat((prev) => {
          if (prev && newlyOffline.includes(String(prev._id))) {
            return {
              ...prev,
              userDetail: { ...prev.userDetail, lastActive: now },
              lastActive: now,
            };
          }
          return prev;
        });
      }
      prevOnlineUsersRef.current = uniqueUsersList;
      setOnlineUsers(uniqueUsersList);
    });

    return () => socket.off("update_online_users");
  }, [user]);

  useEffect(() => {
    socket.on("receive_message", (newMsg) => {
      const msgSenderId = String(newMsg.sender._id || newMsg.sender);
      const msgReceiverId = String(newMsg.receiver);

      // Nếu đang mở khung chat của người gửi đến
      if (activeChat && String(activeChat._id) === msgSenderId) {
        setMessages((prev) => {
          const newList = [...prev, newMsg];
          globalMessagesCache[activeChat._id] = newList;
          return newList;
        });
        api.put(`/api/messages/read/${activeChat._id}`).catch(console.error);
      } else {
        // Cập nhật ngầm vào Cache nếu chat đó đã từng mở
        if (globalMessagesCache[msgSenderId]) {
          globalMessagesCache[msgSenderId] = [
            ...globalMessagesCache[msgSenderId],
            newMsg,
          ];
        }

        if (!newMsg.content?.startsWith("📞")) {
          notificationAudio.current.currentTime = 0;
          notificationAudio.current.play().catch((e) => console.log(e));
          pendingMessagesRef.current.push(newMsg);
          // (Phần toast thông báo thu gọn để tiết kiệm không gian đọc code)
        }
      }

      setConversations((prevList) => {
        const existingIndex = prevList.findIndex(
          (conv) =>
            String(conv._id) === msgSenderId ||
            String(conv._id) === msgReceiverId,
        );
        if (existingIndex !== -1) {
          const updatedList = [...prevList];
          const isActive = activeChat && String(activeChat._id) === msgSenderId;
          updatedList[existingIndex] = {
            ...updatedList[existingIndex],
            lastMessage: newMsg.content,
            lastImages: newMsg.images,
            lastSender: newMsg.sender._id || newMsg.sender,
            createdAt: newMsg.createdAt,
            isRead: isActive,
            unreadCount: isActive
              ? 0
              : (updatedList[existingIndex].unreadCount || 0) + 1,
          };
          const finalList = [
            updatedList[existingIndex],
            ...updatedList.filter((_, idx) => idx !== existingIndex),
          ];
          globalConversationsCache = finalList;
          return finalList;
        } else {
          api.get("/api/messages/inbox").then((res) => {
            if (res.data.success) {
              setConversations(res.data.data);
              globalConversationsCache = res.data.data;
            }
          });
          return prevList;
        }
      });
    });

    socket.on("message_seen", (data) => {
      if (activeChat && String(activeChat._id) === String(data.readerId)) {
        setMessages((prev) => {
          const newList = prev.map((msg) => ({ ...msg, isRead: true }));
          globalMessagesCache[activeChat._id] = newList;
          return newList;
        });
      }
    });

    return () => {
      socket.off("receive_message");
      socket.off("message_seen");
    };
  }, [activeChat, conversations, contactList]);

  // CÁC HÀM XỬ LÝ CALL & CAMERA (Giữ nguyên)
  useEffect(() => {
    window.isCalling = !!activeCall;
  }, [activeCall]);
  useEffect(() => {
    const handleCallAccepted = () => setIsCallAccepted(true);
    socket.on("call_accepted", handleCallAccepted);
    return () => socket.off("call_accepted", handleCallAccepted);
  }, []);

  const sendCallLog = async (content, targetId) => {
    try {
      const formData = new FormData();
      formData.append("receiverId", targetId);
      formData.append("content", content);
      const res = await api.post(`/api/messages`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      if (
        res.data.success &&
        activeChatRef.current &&
        String(activeChatRef.current._id) === String(targetId)
      ) {
        setMessages((prev) => {
          const newList = [...prev, res.data.data];
          globalMessagesCache[targetId] = newList;
          return newList;
        });
      }
    } catch (error) {
      console.error("Lỗi gửi log cuộc gọi:", error);
    }
  };

  const startCall = (type) => {
    setIsCallAccepted(false);
    setActiveCall({ role: "initiator", target: activeChat, type: type });
  };
  const handleCloseCallModal = () => {
    isManuallyHangingUp.current = true;
    if (activeCall && activeCall.role === "initiator") {
      sendCallLog(
        isCallAccepted ? "📞 Cuộc gọi kết thúc" : "📞 Cuộc gọi nhỡ",
        activeCall.target._id,
      );
    }
    setActiveCall(null);
    setTimeout(() => {
      isManuallyHangingUp.current = false;
    }, 1000);
  };

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user" },
      });
      cameraStreamRef.current = stream;
      setIsCameraOpen(true);
      setCapturedPhotoUrl(null);
      setCapturedPhotoFile(null);
      setTimeout(() => {
        if (cameraVideoRef.current) cameraVideoRef.current.srcObject = stream;
      }, 100);
    } catch (error) {
      toast.error("Không thể truy cập camera!");
    }
  };
  const stopCamera = () => {
    if (cameraStreamRef.current) {
      cameraStreamRef.current.getTracks().forEach((track) => track.stop());
      cameraStreamRef.current = null;
    }
    setIsCameraOpen(false);
    setCapturedPhotoUrl(null);
    setCapturedPhotoFile(null);
  };
  const takePhoto = () => {
    if (cameraVideoRef.current) {
      const video = cameraVideoRef.current;
      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext("2d");
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(
        (blob) => {
          if (blob) {
            const file = new File([blob], `photo_${Date.now()}.jpg`, {
              type: "image/jpeg",
            });
            setCapturedPhotoFile(file);
            setCapturedPhotoUrl(URL.createObjectURL(file));
          }
        },
        "image/jpeg",
        0.9,
      );
    }
  };
  const retakePhoto = () => {
    setCapturedPhotoUrl(null);
    setCapturedPhotoFile(null);
  };
  const confirmAndSendPhoto = async () => {
    if (!capturedPhotoFile) return;
    const file = capturedPhotoFile;
    stopCamera();

    // Gửi ảnh tương tự handleSendMessage
    const tempMsgId = Date.now().toString();
    const tempUrl = URL.createObjectURL(file);
    const tempMsg = {
      _id: tempMsgId,
      sender: {
        _id: user._id,
        displayName: user.displayName,
        avatar: user.avatar,
      },
      content: "",
      images: [{ url: tempUrl }],
      createdAt: new Date().toISOString(),
      isTemp: true,
      isRead: false,
    };
    setMessages((prev) => [...prev, tempMsg]);

    try {
      const formData = new FormData();
      formData.append("receiverId", activeChat._id);
      formData.append("content", "");
      formData.append("images", file);
      const res = await api.post(`/api/messages`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      if (res.data.success) {
        setMessages((prev) => {
          const newList = prev.map((msg) =>
            msg._id === tempMsgId ? res.data.data : msg,
          );
          globalMessagesCache[activeChat._id] = newList;
          return newList;
        });
      }
    } catch (error) {
      toast.error("Lỗi gửi ảnh!");
      setMessages((prev) => prev.filter((msg) => msg._id !== tempMsgId));
    }
  };

  const handleImageChange = (e) => {
    const files = Array.from(e.target.files);
    if (files.length > 5) alert("Tối đa 5 ảnh!");
    setImages(files.slice(0, 5));
    setPreviewUrls(files.slice(0, 5).map((file) => URL.createObjectURL(file)));
  };
  const removeSelectedImage = (index) => {
    setImages((prev) => prev.filter((_, i) => i !== index));
    setPreviewUrls((prev) => prev.filter((_, i) => i !== index));
  };
  const handleTextareaChange = (e) => {
    setNewMessage(e.target.value);
    e.target.style.height = "44px";
    e.target.style.height = Math.min(e.target.scrollHeight, 128) + "px";
  };

  const renderLastMessageSnippet = (conv) => {
    if (!conv.lastMessage && conv.lastImages && conv.lastImages.length > 0)
      return "🖼️ Đã gửi ảnh...";
    const isMe = String(conv.lastSender) === String(user._id);
    return `${isMe ? "Bạn: " : ""}${conv.lastMessage || "Nhấn để bắt đầu trò chuyện..."}`;
  };

  const lastReadMyMsgIndex = messages
    .map(
      (m) =>
        String(m.sender?._id || m.sender) === String(user._id) &&
        !m.content?.startsWith("📞") &&
        m.isRead === true,
    )
    .lastIndexOf(true);
  const availableContacts = contactList.filter(
    (contact) =>
      !conversations.some((conv) => String(conv._id) === String(contact._id)),
  );

  return (
    <main className="max-w-6xl mx-auto md:px-4 py-4 h-[calc(100vh-80px)] select-none relative transition-colors duration-300">
      {activeCall && activeCall.role === "initiator" && (
        <CallModal
          activeCall={activeCall}
          currentUser={user}
          onClose={handleCloseCallModal}
        />
      )}

      {isCameraOpen && (
        <div className="fixed inset-0 z-[100000] bg-black flex flex-col animate-in fade-in zoom-in-95 duration-200">
          <div className="flex justify-between items-center p-4 bg-gradient-to-b from-black/70 to-transparent absolute top-0 w-full z-20">
            <button
              onClick={stopCamera}
              className="text-white p-2.5 bg-black/40 rounded-full hover:bg-black/60 transition-colors"
            >
              <X size={24} />
            </button>
            <span className="text-white font-medium drop-shadow-md">
              {capturedPhotoUrl ? "Xem trước ảnh" : "Chụp ảnh"}
            </span>
            <div className="w-10"></div>
          </div>
          <div className="flex-1 relative flex items-center justify-center bg-black overflow-hidden">
            {!capturedPhotoUrl ? (
              <video
                ref={cameraVideoRef}
                autoPlay
                playsInline
                className="w-full h-full object-cover scale-x-[-1]"
              />
            ) : (
              <img
                src={capturedPhotoUrl}
                alt="preview"
                className="w-full h-full object-contain bg-gray-900"
              />
            )}
          </div>
          <div className="h-32 bg-black flex items-center justify-center pb-8 absolute bottom-0 w-full bg-gradient-to-t from-black/80 to-transparent z-20">
            {!capturedPhotoUrl ? (
              <button
                onClick={takePhoto}
                className="w-[72px] h-[72px] rounded-full border-[5px] border-white bg-white/20 flex items-center justify-center active:scale-95 transition-transform"
              >
                <div className="w-[52px] h-[52px] rounded-full bg-white"></div>
              </button>
            ) : (
              <div className="flex items-center justify-between w-full px-8 md:px-24">
                <button
                  onClick={retakePhoto}
                  className="text-white font-semibold bg-white/10 backdrop-blur-md px-6 py-3 rounded-full hover:bg-white/20 transition-colors"
                >
                  Chụp lại
                </button>
                <button
                  onClick={confirmAndSendPhoto}
                  className="bg-primary-600 text-white font-bold px-8 py-3 rounded-full hover:bg-primary-700 transition-colors flex items-center gap-2"
                >
                  <span>Gửi đi</span>
                  <Send size={18} />
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="bg-surface md:rounded-3xl shadow-sm border border-border h-full flex overflow-hidden transition-colors duration-300">
        {/* SIDEBAR TRÁI */}
        <div
          className={`w-full md:w-[350px] lg:w-[400px] border-r border-border flex flex-col transition-colors duration-300 ${activeChat ? "hidden md:flex" : "flex"}`}
        >
          <div className="p-4 border-b border-border shrink-0">
            <h2 className="text-xl font-bold text-foreground mb-4 transition-colors">
              Tin nhắn
            </h2>
            <div className="relative">
              <input
                type="text"
                placeholder="Tìm kiếm cuộc trò chuyện..."
                className="w-full bg-background border border-transparent focus:bg-surface focus:border-primary-300 rounded-full pl-10 pr-4 py-2.5 outline-none text-sm text-foreground transition-colors"
              />
              <Search
                className="absolute left-3.5 top-3 text-muted transition-colors"
                size={18}
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-1">
            {loadingConv || loadingContacts ? (
              <div className="flex flex-col gap-3 p-4">
                <div className="flex gap-3 animate-pulse">
                  <div className="w-12 h-12 bg-border rounded-full shrink-0"></div>
                  <div className="flex-1 space-y-2 py-1">
                    <div className="h-4 bg-border rounded w-1/2"></div>
                    <div className="h-3 bg-border rounded w-3/4"></div>
                  </div>
                </div>
                <div className="flex gap-3 animate-pulse">
                  <div className="w-12 h-12 bg-border rounded-full shrink-0"></div>
                  <div className="flex-1 space-y-2 py-1">
                    <div className="h-4 bg-border rounded w-1/3"></div>
                    <div className="h-3 bg-border rounded w-2/3"></div>
                  </div>
                </div>
              </div>
            ) : (
              <>
                {conversations.map((conv) => {
                  const isOnline = onlineUsers.includes(String(conv._id));
                  const hasUnread = conv.unreadCount > 0;
                  const badgeText = formatTimeBadge(
                    conv.userDetail?.lastActive,
                  );
                  const msgTime = formatMessageTime(conv.createdAt);

                  return (
                    <div
                      key={conv._id}
                      onClick={() => setActiveChat(conv)}
                      className={`flex items-center gap-3 p-3 rounded-2xl cursor-pointer transition-all ${activeChat?._id === conv._id ? "bg-primary-50" : "hover:bg-hover"}`}
                    >
                      <div className="relative shrink-0">
                        <img
                          src={
                            conv.userDetail?.avatar?.url ||
                            `https://ui-avatars.com/api/?name=${conv.userDetail?.displayName}`
                          }
                          className="w-12 h-12 rounded-full object-cover border border-border"
                          alt="avatar"
                        />
                        {isOnline ? (
                          <div className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-green-500 border-2 border-surface rounded-full transition-colors z-10"></div>
                        ) : badgeText ? (
                          <div className="absolute -bottom-1 -right-1 bg-surface text-foreground text-[9px] font-bold px-[5px] py-[1px] rounded-lg border border-border z-10 shadow-sm leading-none flex items-center justify-center">
                            {badgeText}
                          </div>
                        ) : null}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-baseline mb-0.5">
                          <h4
                            className={`text-foreground truncate text-sm transition-colors ${hasUnread ? "font-bold" : "font-semibold"}`}
                          >
                            {conv.userDetail?.displayName}
                          </h4>
                          {msgTime && (
                            <span className="text-[11px] text-muted ml-2 shrink-0 font-medium">
                              {msgTime}
                            </span>
                          )}
                        </div>
                        <p
                          className={`text-[13px] truncate transition-colors ${hasUnread ? "text-foreground font-semibold" : "text-muted font-normal"}`}
                        >
                          {renderLastMessageSnippet(conv)}
                        </p>
                      </div>
                      {hasUnread && (
                        <div className="bg-primary-600 text-on-primary text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 shadow-sm ml-1">
                          {conv.unreadCount > 99 ? "99+" : conv.unreadCount}
                        </div>
                      )}
                    </div>
                  );
                })}

                {conversations.length > 0 && availableContacts.length > 0 && (
                  <div className="px-3 py-3 mt-2 border-t border-border">
                    <h3 className="text-xs font-bold text-muted uppercase tracking-wider flex items-center gap-2 transition-colors">
                      <Users size={14} /> Bạn bè chưa trò chuyện
                    </h3>
                  </div>
                )}

                {availableContacts.map((contact) => {
                  const isContactOnline = onlineUsers.includes(
                    String(contact._id),
                  );
                  const timeAgoFull = formatTimeAgo(contact.lastActive);
                  const badgeText = formatTimeBadge(contact.lastActive);

                  return (
                    <div
                      key={contact._id}
                      onClick={() => setActiveChat(contact)}
                      className={`flex items-center gap-3 p-3 rounded-2xl cursor-pointer hover:bg-primary-50/50 transition-colors ${activeChat?._id === contact._id ? "bg-primary-50" : ""}`}
                    >
                      <div className="relative shrink-0">
                        <img
                          src={
                            contact.avatar?.url ||
                            `https://ui-avatars.com/api/?name=${contact.displayName}`
                          }
                          className="w-12 h-12 rounded-full object-cover border border-border shadow-sm"
                          alt="avatar"
                        />
                        {isContactOnline ? (
                          <div className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-green-500 border-2 border-surface rounded-full transition-colors z-10"></div>
                        ) : badgeText ? (
                          <div className="absolute -bottom-1 -right-1 bg-surface text-foreground text-[9px] font-bold px-[5px] py-[1px] rounded-lg border border-border z-10 shadow-sm leading-none flex items-center justify-center">
                            {badgeText}
                          </div>
                        ) : null}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-baseline mb-0.5">
                          <h4 className="font-semibold text-foreground truncate text-sm transition-colors">
                            {contact.displayName}
                          </h4>
                        </div>
                        <p className="text-[13px] truncate transition-colors">
                          {isContactOnline ? (
                            <span className="text-green-500 font-medium">
                              Đang hoạt động
                            </span>
                          ) : timeAgoFull !== "Ngoại tuyến" ? (
                            <span className="text-muted font-normal italic">
                              {timeAgoFull}
                            </span>
                          ) : (
                            <span className="text-muted font-normal italic">
                              Ngoại tuyến
                            </span>
                          )}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </>
            )}
          </div>
        </div>

        {/* CỘT PHẢI - NỘI DUNG CHAT */}
        <div
          className={`flex-1 bg-surface/50 flex flex-col transition-colors duration-300 ${!activeChat ? "hidden md:flex" : "flex"}`}
        >
          {!activeChat ? (
            <div className="flex-1 flex flex-col items-center justify-center text-muted space-y-3 bg-background/50 transition-colors">
              <div className="w-20 h-20 bg-primary-50 rounded-full flex items-center justify-center text-primary-500 shadow-sm transition-colors">
                <MessageSquareDashed size={40} />
              </div>
              <h3 className="text-lg font-semibold text-foreground transition-colors">
                Tin nhắn nhật ký
              </h3>
              <p className="text-sm text-muted transition-colors">
                Chọn một người bạn để bắt đầu cuộc trò chuyện.
              </p>
            </div>
          ) : (
            <div
              key={activeChat._id}
              className="flex-1 flex flex-col h-full overflow-hidden animate-in fade-in duration-300"
            >
              <div className="px-4 py-3 bg-surface border-b border-border flex justify-between items-center shrink-0 z-10 transition-colors">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setActiveChat(null)}
                    className="md:hidden p-2 -ml-2 text-muted hover:bg-hover rounded-full transition-colors"
                  >
                    <ArrowLeft size={20} />
                  </button>
                  <div
                    className="relative cursor-pointer"
                    onClick={() => navigate(`/profile/${activeChat._id}`)}
                  >
                    <img
                      src={
                        activeChat.userDetail?.avatar?.url ||
                        `https://ui-avatars.com/api/?name=${activeChat.userDetail?.displayName}`
                      }
                      className="w-10 h-10 rounded-full object-cover border border-border"
                      alt="avatar"
                    />
                    {onlineUsers.includes(String(activeChat._id)) ? (
                      <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-surface rounded-full transition-colors z-10"></div>
                    ) : formatTimeBadge(
                        activeChat.userDetail?.lastActive ||
                          activeChat.lastActive,
                      ) ? (
                      <div className="absolute -bottom-1 -right-1 bg-surface text-foreground text-[9px] font-bold px-[5px] py-[1px] rounded-lg border border-border z-10 shadow-sm leading-none flex items-center justify-center">
                        {formatTimeBadge(
                          activeChat.userDetail?.lastActive ||
                            activeChat.lastActive,
                        )}
                      </div>
                    ) : null}
                  </div>
                  <div>
                    <h3
                      className="font-bold text-foreground text-[15px] cursor-pointer hover:text-primary-600 transition-colors"
                      onClick={() => navigate(`/profile/${activeChat._id}`)}
                    >
                      {activeChat.userDetail?.displayName}
                    </h3>
                    <p className="text-[11px] font-medium text-muted transition-colors">
                      {onlineUsers.includes(String(activeChat._id)) ? (
                        <span className="text-green-500 font-semibold">
                          Đang hoạt động
                        </span>
                      ) : (
                        formatTimeAgo(
                          activeChat.userDetail?.lastActive ||
                            activeChat.lastActive,
                        )
                      )}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => startCall("audio")}
                    className="p-2.5 text-primary-600 hover:bg-primary-50 rounded-full transition-colors"
                  >
                    <Phone size={20} />
                  </button>
                  <button
                    onClick={() => startCall("video")}
                    className="p-2.5 text-primary-600 hover:bg-primary-50 rounded-full transition-colors"
                  >
                    <Video size={22} />
                  </button>
                </div>
              </div>

              <div
                ref={chatContainerRef}
                onScroll={handleScroll}
                className="flex-1 overflow-y-auto p-4 custom-scrollbar bg-background/20 space-y-4 transition-colors relative"
              >
                {loadingMsgs && messages.length === 0 ? (
                  <div className="flex flex-col gap-6 w-full h-full p-2 overflow-hidden pointer-events-none select-none">
                    <div className="flex w-full items-end gap-2 animate-pulse">
                      <div className="w-8 h-8 rounded-full bg-border shrink-0" />
                      <div className="h-10 w-48 bg-border rounded-2xl rounded-bl-sm" />
                    </div>
                    <div className="flex w-full justify-end animate-pulse mt-4">
                      <div className="h-10 w-64 bg-primary-600/20 rounded-2xl rounded-br-sm" />
                    </div>
                    <div className="flex w-full items-end gap-2 animate-pulse mt-4">
                      <div className="w-8 h-8 rounded-full bg-border shrink-0" />
                      <div className="h-16 w-56 bg-border rounded-2xl rounded-bl-sm" />
                    </div>
                    <div className="flex w-full justify-end animate-pulse mt-4">
                      <div className="h-20 w-48 bg-primary-600/20 rounded-2xl rounded-br-sm" />
                    </div>
                  </div>
                ) : messages.length === 0 ? (
                  <div className="text-center text-muted py-10 text-sm transition-colors">
                    Hãy gửi lời chào hỏi thầm kín đầu tiên! 👋
                  </div>
                ) : (
                  <>
                    {loadingMore && (
                      <div className="flex justify-center py-2">
                        <Loader2
                          className="animate-spin text-primary-500"
                          size={24}
                        />
                      </div>
                    )}
                    {messages.map((msg, index) => {
                      const isMe =
                        String(msg.sender?._id || msg.sender) ===
                        String(user._id);
                      const isLastReadMyMsg = index === lastReadMyMsgIndex;
                      const isCallLog = msg.content?.startsWith("📞");
                      const isMissedCall =
                        msg.content?.includes("Cuộc gọi nhỡ") ||
                        msg.content?.includes("Không trả lời") ||
                        msg.content?.includes("Máy bận");

                      if (isCallLog) {
                        return (
                          <div
                            key={msg._id || index}
                            className="flex justify-center my-6 animate-in fade-in duration-200 w-full cursor-default"
                          >
                            <div
                              className={`px-5 py-2.5 rounded-full text-[13px] font-semibold flex items-center gap-2.5 shadow-sm border ${isMissedCall ? "bg-red-50 border-red-200 text-red-600" : "bg-surface border-border text-foreground/80"}`}
                            >
                              {isMissedCall ? (
                                <PhoneMissed size={18} />
                              ) : (
                                <PhoneCall size={18} />
                              )}
                              <span>{msg.content.replace("📞 ", "")}</span>
                              <span className="text-[10px] font-medium opacity-60 ml-1 border-l pl-2 border-current">
                                {new Date(msg.createdAt).toLocaleTimeString(
                                  "vi-VN",
                                  { hour: "2-digit", minute: "2-digit" },
                                )}
                              </span>
                            </div>
                          </div>
                        );
                      }

                      return (
                        <div
                          key={msg._id || index}
                          className={`flex ${isMe ? "justify-end" : "justify-start"} mb-4 animate-in fade-in duration-200`}
                        >
                          {!isMe && (
                            <img
                              src={
                                activeChat.userDetail?.avatar?.url ||
                                `https://ui-avatars.com/api/?name=${activeChat.userDetail?.displayName}`
                              }
                              className="w-8 h-8 rounded-full object-cover shrink-0 mr-2 self-end mb-1 border border-border"
                              alt="avatar"
                            />
                          )}
                          <div className="flex flex-col max-w-[70%]">
                            <div
                              className={`relative px-4 py-2.5 rounded-2xl shadow-sm flex flex-col gap-1.5 transition-colors ${isMe ? "bg-primary-600 text-on-primary rounded-br-sm" : "bg-surface border border-border text-foreground rounded-bl-sm"} ${msg.isTemp ? "opacity-70" : ""}`}
                            >
                              {msg.content && (
                                <p className="text-[15px] leading-relaxed whitespace-pre-wrap break-words">
                                  {msg.content}
                                </p>
                              )}
                              {msg.referencedPost && (
                                <div
                                  onClick={() =>
                                    navigate("/", {
                                      state: {
                                        openPostId: msg.referencedPost._id,
                                      },
                                    })
                                  }
                                  className={`mt-1 mb-1 p-2 rounded-xl border flex items-center gap-3 transition-colors shadow-sm cursor-pointer ${isMe ? "bg-primary-700/30 border-primary-400/50 hover:bg-primary-700/50" : "bg-hover border-border hover:bg-border"}`}
                                >
                                  {msg.referencedPost.images &&
                                  msg.referencedPost.images.length > 0 ? (
                                    <img
                                      src={msg.referencedPost.images[0].url}
                                      alt="post-thumb"
                                      className="w-12 h-12 object-cover rounded-lg flex-shrink-0 border border-black/5"
                                      onLoad={handleImageLoad}
                                    />
                                  ) : (
                                    <div className="w-12 h-12 bg-black/5 rounded-lg flex items-center justify-center flex-shrink-0 text-lg">
                                      📄
                                    </div>
                                  )}
                                  <div className="flex-1 overflow-hidden">
                                    <p
                                      className={`text-[11px] font-bold uppercase tracking-wider mb-0.5 transition-colors ${isMe ? "text-primary-100" : "text-muted"}`}
                                    >
                                      Bài viết của{" "}
                                      {msg.referencedPost.user?.displayName ||
                                        "Tác giả"}
                                    </p>
                                    <p
                                      className={`text-xs line-clamp-2 leading-snug transition-colors ${isMe ? "text-on-primary/90" : "text-foreground/80"}`}
                                    >
                                      {msg.referencedPost.content ||
                                        "Có đính kèm hình ảnh..."}
                                    </p>
                                  </div>
                                </div>
                              )}
                              {msg.images && msg.images.length > 0 && (
                                <div
                                  className={`grid gap-1 mt-1 rounded-lg overflow-hidden ${msg.images.length > 1 ? "grid-cols-2" : "grid-cols-1"}`}
                                >
                                  {msg.images.map((img, i) => (
                                    <img
                                      key={i}
                                      src={img.url}
                                      className="object-cover w-full max-h-48"
                                      alt="attachment"
                                      onLoad={handleImageLoad}
                                    />
                                  ))}
                                </div>
                              )}
                              <span
                                className={`text-[10px] mt-1 block text-right font-medium transition-colors ${isMe ? "text-primary-100" : "text-muted"}`}
                              >
                                {new Date(msg.createdAt).toLocaleTimeString(
                                  "vi-VN",
                                  { hour: "2-digit", minute: "2-digit" },
                                )}
                              </span>
                            </div>
                            {isLastReadMyMsg && (
                              <div className="flex justify-end items-center mt-1 pr-1 gap-1 animate-in slide-in-from-top-2 duration-300">
                                <img
                                  src={
                                    activeChat.userDetail?.avatar?.url ||
                                    `https://ui-avatars.com/api/?name=${activeChat.userDetail?.displayName}`
                                  }
                                  className="w-3.5 h-3.5 rounded-full object-cover"
                                  alt="seen-avatar"
                                />
                                <span className="text-[11px] text-muted font-medium">
                                  Đã xem
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </>
                )}
                <div ref={messagesEndRef} className="h-1" />
              </div>

              <div className="bg-surface border-t border-border shrink-0 flex flex-col transition-colors">
                {previewUrls.length > 0 && (
                  <div className="flex gap-2 p-3 overflow-x-auto border-b border-border bg-hover/50 transition-colors">
                    {previewUrls.map((url, idx) => (
                      <div
                        key={idx}
                        className="relative shrink-0 animate-in zoom-in-75 duration-150"
                      >
                        <img
                          src={url}
                          alt="preview"
                          className="h-16 w-16 object-cover rounded-xl border border-border"
                        />
                        <button
                          type="button"
                          onClick={() => removeSelectedImage(idx)}
                          className="absolute -top-1.5 -right-1.5 bg-foreground text-surface rounded-full p-0.5 hover:bg-red-500 transition-colors"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <form
                  onSubmit={handleSendMessage}
                  className="flex items-end gap-2 p-3 sm:px-4 sm:py-3"
                >
                  <input
                    type="file"
                    multiple
                    accept="image/*"
                    className="hidden"
                    ref={fileInputRef}
                    onChange={handleImageChange}
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="w-[40px] h-[40px] flex items-center justify-center text-primary-600 hover:bg-primary-50 rounded-full transition-colors shrink-0 mb-[2px]"
                  >
                    <ImageIcon size={22} />
                  </button>
                  <button
                    type="button"
                    onClick={startCamera}
                    className="w-[40px] h-[40px] flex items-center justify-center text-primary-600 hover:bg-primary-50 rounded-full transition-colors shrink-0 mb-[2px]"
                  >
                    <Camera size={22} />
                  </button>

                  <div className="flex-1 bg-hover focus-within:bg-surface border border-transparent focus-within:border-primary-300 focus-within:ring-2 focus-within:ring-primary-50 rounded-[22px] flex items-end transition-all shadow-sm">
                    <textarea
                      ref={textareaRef}
                      value={newMessage}
                      onChange={handleTextareaChange}
                      placeholder="Nhập tin nhắn..."
                      className="flex-1 bg-transparent resize-none outline-none text-[15px] scrollbar-hide text-foreground placeholder:text-muted py-[11px] px-4 max-h-32"
                      rows="1"
                      style={{ minHeight: "44px" }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          handleSendMessage(e);
                        }
                      }}
                    />
                    <button
                      type="submit"
                      disabled={
                        sending || (!newMessage.trim() && images.length === 0)
                      }
                      className="w-[34px] h-[34px] shrink-0 flex items-center justify-center bg-primary-600 text-on-primary rounded-full transition-transform disabled:scale-75 disabled:opacity-0 hover:bg-primary-700 duration-200 mb-[5px] mr-[5px]"
                    >
                      {sending ? (
                        <Loader2 size={16} className="animate-spin" />
                      ) : (
                        <Send size={16} className="ml-0.5" />
                      )}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  );
};

export default Messages;
