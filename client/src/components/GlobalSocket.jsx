// src/components/GlobalSocket.jsx
import React, { useEffect, useState, useRef } from "react";
import socket from "../utils/socket";
import { useAuthStore } from "../store/useAuthStore";
import { useLocation, useNavigate } from "react-router-dom";
import { toast } from "react-hot-toast";
import { PhoneCall, PhoneOff } from "lucide-react";
import CallModal from "./CallModal";
import api from "../utils/api";

const GlobalSocket = () => {
  const { user } = useAuthStore();
  const location = useLocation();
  const navigate = useNavigate();

  const [incomingCallData, setIncomingCallData] = useState(null);
  const [activeCall, setActiveCall] = useState(null);

  const ringtoneAudio = useRef(new Audio("/ringtone.mp3"));
  const endCallAudio = useRef(new Audio("/endcall.mp3"));
  const notificationAudio = useRef(new Audio("/notification.mp3"));

  const pendingMessagesRef = useRef([]);
  const toastTimerRef = useRef(null);

  const isManuallyHangingUp = useRef(false);

  const playEndCallSound = () => {
    endCallAudio.current.currentTime = 0;
    endCallAudio.current.play().catch((e) => console.log(e));
  };

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    };
  }, []);

  // ==========================================
  // ĐỒNG BỘ TRẠNG THÁI "MÁY BẬN" CHO TOÀN HỆ THỐNG
  // ==========================================
  useEffect(() => {
    window.isReceivingCall = !!activeCall || !!incomingCallData;
  }, [activeCall, incomingCallData]);

  // ==========================================
  // 1. BẮT TIN NHẮN & HIỂN THỊ POP-UP
  // ==========================================
  useEffect(() => {
    if (!user) return;
    socket.emit("join_user_room", user._id);

    const handleReceiveMessage = (newMsg) => {
      if (
        !location.pathname.includes("/messages") &&
        !newMsg.content?.startsWith("📞")
      ) {
        notificationAudio.current.currentTime = 0;
        notificationAudio.current.play().catch((e) => console.log(e));

        pendingMessagesRef.current.push(newMsg);
        const currentPending = [...pendingMessagesRef.current];
        const latestMsg = currentPending[currentPending.length - 1];
        const hiddenCount = currentPending.length - 1;

        if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
        toastTimerRef.current = setTimeout(() => {
          pendingMessagesRef.current = [];
        }, 5000);

        let touchStartY = 0;

        toast.custom(
          (t) => (
            <div
              onTouchStart={(e) => {
                touchStartY = e.touches[0].clientY;
              }}
              onTouchEnd={(e) => {
                if (touchStartY - e.changedTouches[0].clientY > 30) {
                  toast.dismiss(t.id);
                  pendingMessagesRef.current = [];
                }
              }}
              className={`${
                t.visible
                  ? "animate-in slide-in-from-top-5 fade-in duration-300"
                  : "animate-out slide-out-to-top-5 fade-out duration-200"
              } max-w-sm w-[90%] md:w-full bg-surface/95 backdrop-blur-xl shadow-[0_10px_40px_rgb(0,0,0,0.15)] border border-border rounded-2xl pointer-events-auto flex flex-col hover:bg-hover transition-colors overflow-hidden`}
            >
              <div
                onClick={() => {
                  toast.dismiss(t.id);
                  pendingMessagesRef.current = [];
                  navigate(
                    `/messages?userId=${latestMsg.sender._id || latestMsg.sender}`,
                  );
                }}
                className="w-full p-3 px-4 cursor-pointer"
              >
                <div className="flex items-center gap-3.5">
                  <img
                    className="h-11 w-11 rounded-full object-cover border border-border/50 shrink-0"
                    src={
                      latestMsg.sender.avatar?.url ||
                      latestMsg.sender.avatar ||
                      `https://ui-avatars.com/api/?name=${latestMsg.sender.displayName}`
                    }
                    alt="avatar"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-[15px] font-bold text-foreground truncate">
                      {latestMsg.sender.displayName}
                    </p>
                    <p className="text-[13.5px] text-muted truncate mt-0.5">
                      {latestMsg.content || "🖼️ Đã gửi một ảnh đính kèm"}
                    </p>
                  </div>
                </div>
              </div>

              {hiddenCount > 0 && (
                <div
                  onClick={(e) => {
                    e.stopPropagation();
                    toast.dismiss(t.id);
                    pendingMessagesRef.current = [];
                    navigate("/messages");
                  }}
                  className="bg-primary-50/70 border-t border-border py-2 text-center cursor-pointer hover:bg-primary-100 transition-colors w-full"
                >
                  <p className="text-[12px] font-bold text-primary-600">
                    + {hiddenCount} tin nhắn mới bị ẩn. Nhấn để xem
                  </p>
                </div>
              )}
              <div className="absolute bottom-1.5 left-1/2 -translate-x-1/2 w-8 h-1 bg-muted/30 rounded-full md:hidden pointer-events-none"></div>
            </div>
          ),
          {
            id: "GLOBAL_NEW_MESSAGE_TOAST",
            duration: 4000,
            position: "top-center",
          },
        );
      }
    };

    const handleIncomingCall = (data) => {
      // KIỂM TRA NẾU ĐANG BẬN NGHE HOẶC ĐANG BẬN GỌI -> TỪ CHỐI TỰ ĐỘNG
      if (window.isReceivingCall || window.isCalling) {
        socket.emit("end_call", { to: data.caller._id }); // Báo cúp máy lại cho người gọi

        // Gửi tự động một tin nhắn lịch sự báo máy bận
        const formData = new FormData();
        formData.append("receiverId", data.caller._id);
        formData.append("content", "📞 Máy bận");
        api.post(`/api/messages`, formData).catch((e) => console.log(e));

        return; // Dừng lập tức, không cho nhảy popup cuộc gọi lên
      }

      setIncomingCallData(data);
    };

    socket.on("receive_message", handleReceiveMessage);
    socket.on("incoming_call", handleIncomingCall);

    return () => {
      socket.off("receive_message", handleReceiveMessage);
      socket.off("incoming_call", handleIncomingCall);
    };
  }, [user, location, navigate]);

  // ==========================================
  // 2. CHUÔNG CUỘC GỌI ĐẾN
  // ==========================================
  useEffect(() => {
    let timeout;
    if (incomingCallData) {
      ringtoneAudio.current.loop = true;
      ringtoneAudio.current.play().catch((e) => console.log(e));
      timeout = setTimeout(() => {
        ringtoneAudio.current.pause();
        ringtoneAudio.current.currentTime = 0;
        playEndCallSound();
        setIncomingCallData(null);
      }, 61000);
    } else {
      ringtoneAudio.current.pause();
      ringtoneAudio.current.currentTime = 0;
    }
    return () => {
      clearTimeout(timeout);
      ringtoneAudio.current.pause();
    };
  }, [incomingCallData]);

  // ==========================================
  // 3. ĐỐI PHƯƠNG CÚP MÁY VÀ CÁC NÚT ĐIỀU KHIỂN
  // ==========================================
  useEffect(() => {
    const handleCallEnded = () => {
      if (incomingCallData) {
        if (!isManuallyHangingUp.current) playEndCallSound();
        setIncomingCallData(null);
      } else if (activeCall && activeCall.role === "receiver") {
        setActiveCall(null);
      }
    };
    socket.on("call_ended", handleCallEnded);
    return () => socket.off("call_ended", handleCallEnded);
  }, [incomingCallData, activeCall]);

  const acceptCall = () => {
    setActiveCall({
      role: "receiver",
      caller: incomingCallData.caller,
      signal: incomingCallData.signal,
      type: incomingCallData.type,
    });
    setIncomingCallData(null);
  };

  const rejectCall = () => {
    isManuallyHangingUp.current = true;
    const callerId = incomingCallData.caller._id;
    socket.emit("end_call", { to: callerId });

    const formData = new FormData();
    formData.append("receiverId", callerId);
    formData.append("content", "📞 Không trả lời");
    api.post(`/api/messages`, formData).catch((e) => console.log(e));

    setIncomingCallData(null);
    setTimeout(() => {
      isManuallyHangingUp.current = false;
    }, 1000);
  };

  const handleCloseCallModal = () => {
    isManuallyHangingUp.current = true;
    setActiveCall(null);
    setTimeout(() => {
      isManuallyHangingUp.current = false;
    }, 1000);
  };

  if (!user) return null;

  return (
    <>
      {incomingCallData && !activeCall && (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/80 backdrop-blur-sm">
          <div className="bg-surface rounded-3xl p-8 flex flex-col items-center animate-in zoom-in duration-300 shadow-2xl">
            <div className="relative">
              <img
                src={
                  incomingCallData.caller?.avatar ||
                  `https://ui-avatars.com/api/?name=Caller`
                }
                alt="caller"
                className="w-24 h-24 rounded-full mb-4 object-cover z-10 relative"
              />
              <div className="absolute inset-0 rounded-full border-4 border-primary-500 animate-ping opacity-75"></div>
            </div>
            <h2 className="text-xl font-bold text-foreground mb-1">
              {incomingCallData.caller?.displayName} đang gọi...
            </h2>
            <p className="text-muted mb-8 font-medium">
              Cuộc gọi {incomingCallData.type === "video" ? "Video" : "Thoại"}
            </p>
            <div className="flex gap-6">
              <button
                onClick={rejectCall}
                className="bg-red-500 hover:bg-red-600 text-white p-4 rounded-full transition-transform hover:scale-110 shadow-lg shadow-red-500/30"
              >
                <PhoneOff size={28} />
              </button>
              <button
                onClick={acceptCall}
                className="bg-green-500 hover:bg-green-600 text-white p-4 rounded-full transition-transform hover:scale-110 animate-bounce shadow-lg shadow-green-500/30"
              >
                <PhoneCall size={28} />
              </button>
            </div>
          </div>
        </div>
      )}

      {activeCall && activeCall.role === "receiver" && (
        <CallModal
          activeCall={activeCall}
          currentUser={user}
          onClose={handleCloseCallModal}
        />
      )}
    </>
  );
};

export default GlobalSocket;
