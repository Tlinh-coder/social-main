// src/components/CallModal.jsx
import React, { useEffect, useRef, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import {
  PhoneOff,
  Mic,
  MicOff,
  Video as VideoIcon,
  VideoOff,
  AlertTriangle,
  Minimize2,
  Maximize2,
  ChevronLeft,
} from "lucide-react";
import socket from "../utils/socket";
import { toast } from "react-hot-toast";

const ICE_SERVERS = {
  iceServers: [
    {
      urls: "stun:stun.relay.metered.ca:80",
    },
    {
      urls: "turn:global.relay.metered.ca:80",
      username: "777ef696a38c25a19ee348c8",
      credential: "TFhXnNBmP317gxZK",
    },
    {
      urls: "turn:global.relay.metered.ca:80?transport=tcp",
      username: "777ef696a38c25a19ee348c8",
      credential: "TFhXnNBmP317gxZK",
    },
    {
      urls: "turn:global.relay.metered.ca:443",
      username: "777ef696a38c25a19ee348c8",
      credential: "TFhXnNBmP317gxZK",
    },
    {
      urls: "turns:global.relay.metered.ca:443?transport=tcp",
      username: "777ef696a38c25a19ee348c8",
      credential: "TFhXnNBmP317gxZK",
    },
  ],
};

const CallModal = ({ activeCall, currentUser, onClose }) => {
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [mediaError, setMediaError] = useState(null);
  const [isMinimized, setIsMinimized] = useState(false);

  const pcRef = useRef(null);
  const localStreamRef = useRef(null);
  const dataChannelRef = useRef(null);
  const pendingCandidates = useRef([]);
  const localIceCandidatesQueue = useRef([]);
  const callAcceptedRef = useRef(false);

  const [callAccepted, setCallAccepted] = useState(false);

  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(activeCall.type === "audio");

  const [isRemoteVideoOff, setIsRemoteVideoOff] = useState(
    activeCall.type === "audio",
  );
  const [isRemoteMuted, setIsRemoteMuted] = useState(false);

  const [isSwapped, setIsSwapped] = useState(false);
  const [pipSnap, setPipSnap] = useState("bottom-right");
  const [isPipHidden, setIsPipHidden] = useState(false);

  const isInitiator = activeCall.role === "initiator";
  const targetUser = activeCall.target;
  const callerInfo = activeCall.caller;

  // ==========================================
  // LOGIC KÉO THẢ, VUỐT ẨN, CHẠM HOÁN ĐỔI
  // ==========================================
  const pipContainerRef = useRef(null);
  const dragStart = useRef({ x: 0, y: 0 });
  const dragMoved = useRef(false);
  const isDragging = useRef(false);
  const pos = useRef({ x: 0, y: 0 });

  const onDragStart = (e) => {
    isDragging.current = true;
    dragMoved.current = false;
    const clientX = e.type.includes("mouse") ? e.clientX : e.touches[0].clientX;
    const clientY = e.type.includes("mouse") ? e.clientY : e.touches[0].clientY;
    dragStart.current = { x: clientX, y: clientY };

    if (pipContainerRef.current) {
      pipContainerRef.current.style.transition = "none";
    }
  };

  const onDragMove = (e) => {
    if (!isDragging.current || !pipContainerRef.current) return;
    const clientX = e.type.includes("mouse") ? e.clientX : e.touches[0].clientX;
    const clientY = e.type.includes("mouse") ? e.clientY : e.touches[0].clientY;

    const deltaX = clientX - dragStart.current.x;
    const deltaY = clientY - dragStart.current.y;

    if (Math.abs(deltaX) > 5 || Math.abs(deltaY) > 5) {
      dragMoved.current = true;
    }

    pos.current = { x: deltaX, y: deltaY };
    pipContainerRef.current.style.transform = `translate(${deltaX}px, ${deltaY}px)`;
  };

  const onDragEnd = () => {
    if (!isDragging.current) return;
    isDragging.current = false;

    if (!dragMoved.current) {
      setIsSwapped((prev) => !prev);
    } else {
      const deltaX = pos.current.x;

      if (deltaX > 80) {
        setIsPipHidden(true);
      } else {
        const rect = pipContainerRef.current?.getBoundingClientRect();
        if (rect) {
          const centerY = rect.top + rect.height / 2;
          if (centerY < window.innerHeight / 2) {
            setPipSnap("top-right");
          } else {
            setPipSnap("bottom-right");
          }
        }
      }
    }

    if (pipContainerRef.current) {
      pipContainerRef.current.style.transition =
        "all 0.3s cubic-bezier(0.25, 1, 0.5, 1)";
      pipContainerRef.current.style.transform = `translate(0px, 0px)`;
    }
    pos.current = { x: 0, y: 0 };
  };

  useEffect(() => {
    if (isMinimized && pipContainerRef.current) {
      pipContainerRef.current.style.transform = `translate(0px, 0px)`;
    }
  }, [isMinimized]);

  // ==========================================
  // KHỞI TẠO WEBRTC VÀ GÁN LUỒNG VIDEO
  // ==========================================
  const localVideoRef = useCallback(
    (node) => {
      if (node && localStream) node.srcObject = localStream;
    },
    [localStream, isSwapped],
  );

  const remoteVideoRef = useCallback(
    (node) => {
      if (node && remoteStream) node.srcObject = remoteStream;
    },
    [remoteStream, isSwapped],
  );

  useEffect(() => {
    let isMounted = true;

    const handleDataMessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        if (data.type === "media") {
          if (data.videoOff !== undefined) setIsRemoteVideoOff(data.videoOff);
          if (data.muted !== undefined) setIsRemoteMuted(data.muted);
        }
      } catch (err) {}
    };

    // HÀM XIN QUYỀN CAMERA ÉP TỈ LỆ
    const getMediaStream = async () => {
      const isPortrait = window.innerHeight > window.innerWidth;
      // Mobile: 2/3 (Khớp với 4:6) | Desktop: 4/3 (Vuông vắn hơn)
      const targetRatio = isPortrait ? 2 / 3 : 4 / 3;

      try {
        // Mức 1: Xin cam ép đúng tỉ lệ khung hình (Crop thẳng từ Source phần cứng)
        return await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user", aspectRatio: { ideal: targetRatio } },
          audio: true,
        });
      } catch (e1) {
        try {
          // Mức 2: Nếu Cam cũ không hỗ trợ ép tỉ lệ thì lấy Cam bình thường
          return await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: true,
          });
        } catch (e2) {
          // Mức 3: Lỗi hoàn toàn -> Chuyển sang xin riêng Mic
          const audioStream = await navigator.mediaDevices.getUserMedia({
            video: false,
            audio: true,
          });
          if (activeCall.type === "video")
            toast.error("Không tìm thấy Camera, chuyển sang gọi thoại.");
          return audioStream;
        }
      }
    };

    const initWebRTC = async () => {
      let stream;
      try {
        stream = await getMediaStream();

        // Ẩn video luôn nếu đang chọn Gọi Thoại
        if (activeCall.type === "audio") {
          stream.getVideoTracks().forEach((track) => (track.enabled = false));
        }
      } catch (err) {
        setMediaError(err.message || "Không thể truy cập Mic/Camera.");
        return;
      }

      if (!isMounted) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }

      localStreamRef.current = stream;
      setLocalStream(stream);

      const pc = new RTCPeerConnection(ICE_SERVERS);
      pcRef.current = pc;

      if (isInitiator) {
        const dc = pc.createDataChannel("mediaStatus");
        dataChannelRef.current = dc;
        dc.onopen = () =>
          dc.send(
            JSON.stringify({
              type: "media",
              videoOff: isVideoOff,
              muted: isMuted,
            }),
          );
        dc.onmessage = handleDataMessage;
      } else {
        pc.ondatachannel = (e) => {
          const dc = e.channel;
          dataChannelRef.current = dc;
          dc.onopen = () =>
            dc.send(
              JSON.stringify({
                type: "media",
                videoOff: isVideoOff,
                muted: isMuted,
              }),
            );
          dc.onmessage = handleDataMessage;
        };
      }

      stream.getTracks().forEach((track) => pc.addTrack(track, stream));

      pc.ontrack = (event) => setRemoteStream(event.streams[0]);

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          const targetId = isInitiator ? targetUser?._id : callerInfo?._id;

          if (callAcceptedRef.current || !isInitiator) {
            socket.emit("ice_candidate", {
              to: targetId,
              candidate: event.candidate,
            });
          } else {
            // Người gọi phải "nín" lại, cất tín hiệu vào kho chờ người kia nhấc máy
            localIceCandidatesQueue.current.push(event.candidate);
          }
        }
      };

      if (isInitiator) {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        socket.emit("call_user", {
          userToCall: targetUser._id,
          signalData: offer,
          from: currentUser._id,
          callerInfo: {
            displayName: currentUser.displayName,
            avatar: currentUser.avatar?.url || currentUser.avatar,
          },
          type: activeCall.type,
        });
      } else {
        if (activeCall.signal) {
          await pc.setRemoteDescription(
            new RTCSessionDescription(activeCall.signal),
          );
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          socket.emit("answer_call", { to: callerInfo?._id, signal: answer });

          setCallAccepted(true);
          callAcceptedRef.current = true; // 👉 Thêm dòng cắm cờ nhấc máy này

          // 👉 Thêm khối xả kho này để hứng tín hiệu từ điện thoại ném sang quá nhanh
          pendingCandidates.current.forEach((c) =>
            pc.addIceCandidate(new RTCIceCandidate(c)),
          );
          pendingCandidates.current = [];
        }
      }
    };

    initWebRTC();

    const handleCallAccepted = async (signal) => {
      setCallAccepted(true);
      callAcceptedRef.current = true;
      try {
        if (pcRef.current) {
          await pcRef.current.setRemoteDescription(
            new RTCSessionDescription(signal),
          );

          // 1. Xử lý tín hiệu đối phương bị kẹt
          pendingCandidates.current.forEach((c) =>
            pcRef.current.addIceCandidate(new RTCIceCandidate(c)),
          );
          pendingCandidates.current = [];

          // 2. Bung toàn bộ tín hiệu của mình gửi đi
          const targetId = isInitiator ? targetUser?._id : callerInfo?._id;
          localIceCandidatesQueue.current.forEach((c) => {
            socket.emit("ice_candidate", {
              to: targetId,
              candidate: c,
            });
          });
          localIceCandidatesQueue.current = [];
        }
      } catch (error) {
        console.error("Lỗi Call Accepted:", error);
      }
    };

    const handleIceCandidate = async (candidate) => {
      try {
        if (pcRef.current && pcRef.current.remoteDescription) {
          await pcRef.current.addIceCandidate(new RTCIceCandidate(candidate));
        } else {
          // Nếu chưa sẵn sàng -> Tạm cất vào kho
          pendingCandidates.current.push(candidate);
        }
      } catch (error) {
        console.error("Lỗi thêm ICE:", error);
      }
    };

    socket.on("call_accepted", handleCallAccepted);
    socket.on("ice_candidate", handleIceCandidate);

    socket.on("call_ended", () => {
      onClose(); // Đóng ngay cửa sổ của mình
    });

    return () => {
      isMounted = false;
      socket.off("call_accepted", handleCallAccepted);
      socket.off("ice_candidate", handleIceCandidate);

      // 2. THÊM DÒNG NÀY: Dọn dẹp bộ nhớ khi tắt modal
      socket.off("call_ended");

      if (localStreamRef.current)
        localStreamRef.current.getTracks().forEach((track) => track.stop());
      if (pcRef.current) pcRef.current.close();
    };
  }, []);

  const endCall = () => {
    const endTarget = isInitiator ? targetUser?._id : callerInfo?._id;
    if (endTarget) socket.emit("end_call", { to: endTarget });
    onClose();
  };

  const toggleMic = () => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        const newEnabledState = !audioTrack.enabled;
        audioTrack.enabled = newEnabledState;
        setIsMuted(!newEnabledState);
        if (dataChannelRef.current?.readyState === "open") {
          dataChannelRef.current.send(
            JSON.stringify({ type: "media", muted: !newEnabledState }),
          );
        }
      }
    }
  };

  const toggleVideo = () => {
    if (localStreamRef.current) {
      const videoTrack = localStreamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        const newEnabledState = !videoTrack.enabled;
        videoTrack.enabled = newEnabledState;
        setIsVideoOff(!newEnabledState);
        if (dataChannelRef.current?.readyState === "open") {
          dataChannelRef.current.send(
            JSON.stringify({ type: "media", videoOff: !newEnabledState }),
          );
        }
      } else {
        toast.error("Thiết bị của bạn không có Camera hoặc chưa cấp quyền!");
      }
    }
  };

  const displayAvatar = isInitiator
    ? targetUser?.userDetail?.avatar?.url ||
      targetUser?.avatar?.url ||
      `https://ui-avatars.com/api/?name=${targetUser?.userDetail?.displayName}`
    : callerInfo?.avatar?.url ||
      callerInfo?.avatar ||
      `https://ui-avatars.com/api/?name=${callerInfo?.displayName}`;
  const displayName = isInitiator
    ? targetUser?.userDetail?.displayName
    : callerInfo?.displayName;
  const myAvatar =
    currentUser.avatar?.url ||
    currentUser.avatar ||
    `https://ui-avatars.com/api/?name=${currentUser.displayName}`;

  const showPip =
    callAccepted && (!isVideoOff || activeCall.type === "video" || isSwapped);

  const modalContent = (
    <div
      className={`fixed z-[99999] bg-gray-900 overflow-hidden font-sans transition-all duration-500 ease-in-out ${
        isMinimized
          ? "bottom-6 right-6 w-36 h-56 md:w-64 md:h-48 rounded-2xl shadow-[0_10px_50px_rgba(0,0,0,0.5)] border border-white/10"
          : "inset-0 flex items-center justify-center"
      }`}
    >
      {!isMinimized && (
        <button
          onClick={() => setIsMinimized(true)}
          className="absolute top-6 right-6 z-[1000] p-3 bg-black/40 hover:bg-black/60 text-white rounded-full backdrop-blur-md transition-all shadow-lg"
          title="Thu nhỏ"
        >
          <Minimize2 size={24} />
        </button>
      )}

      {isMinimized && (
        <div
          onClick={() => setIsMinimized(false)}
          className="absolute inset-0 z-[1000] flex items-center justify-center bg-black/0 hover:bg-black/40 group cursor-pointer transition-all"
          title="Phóng to"
        >
          <Maximize2
            size={32}
            className="text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow-lg"
          />
        </div>
      )}

      {isMinimized && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            endCall();
          }}
          className="absolute top-3 right-3 z-[1001] p-2 bg-red-600 hover:bg-red-700 text-white rounded-full shadow-lg transition-transform hover:scale-110"
          title="Kết thúc"
        >
          <PhoneOff size={16} />
        </button>
      )}

      {mediaError && (
        <div className="absolute top-10 left-1/2 -translate-x-1/2 z-[100000] bg-red-500 text-white px-6 py-4 rounded-2xl flex items-center gap-3 shadow-2xl">
          <AlertTriangle size={24} />
          <div>
            <p className="font-bold">Lỗi phần cứng/Trình duyệt:</p>
            <p className="text-sm">{mediaError}</p>
          </div>
        </div>
      )}

      {/* ======================================= */}
      {/* 1. KHUNG CAMERA LỚN (NỀN CHÍNH) */}
      {/* ======================================= */}
      <div
        className={`absolute inset-0 w-full h-full z-0 bg-gray-900 ${callAccepted ? "block animate-in fade-in duration-500" : "hidden"}`}
      >
        {isSwapped ? (
          <>
            <video
              ref={localVideoRef}
              autoPlay
              playsInline
              muted
              className={`w-full h-full object-contain scale-x-[-1] pointer-events-none bg-black ${isVideoOff ? "hidden" : "block"}`}
            />
            {isVideoOff && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-800">
                <img
                  src={myAvatar}
                  className={`${isMinimized ? "w-20 h-20" : "w-32 h-32 md:w-48 md:h-48"} rounded-full border-4 border-gray-600 object-cover shadow-2xl transition-all`}
                />
                <h2
                  className={`${isMinimized ? "text-lg mt-3" : "text-2xl mt-6"} font-bold text-white text-center px-4 truncate w-full`}
                >
                  {currentUser.displayName}
                </h2>
                <p
                  className={`${isMinimized ? "text-[10px]" : "text-sm"} text-gray-400 mt-1`}
                >
                  Đang tắt Camera
                </p>
              </div>
            )}
            {isMuted && (
              <div
                className={`absolute ${isMinimized ? "top-3 left-3 p-1.5" : "top-6 left-6 p-2.5"} z-50 bg-black/60 rounded-full backdrop-blur-md flex items-center gap-2 shadow-lg`}
              >
                <MicOff size={isMinimized ? 14 : 20} className="text-red-500" />
                {!isMinimized && (
                  <span className="text-white text-xs font-semibold pr-1">
                    Đã tắt mic
                  </span>
                )}
              </div>
            )}
          </>
        ) : (
          <>
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              className={`w-full h-full object-contain bg-black ${isRemoteVideoOff ? "hidden" : "block"}`}
            />
            {isRemoteVideoOff && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-800">
                <img
                  src={displayAvatar}
                  className={`${isMinimized ? "w-20 h-20" : "w-32 h-32 md:w-48 md:h-48"} rounded-full border-4 border-gray-600 object-cover shadow-2xl transition-all`}
                />
                <h2
                  className={`${isMinimized ? "text-lg mt-3" : "text-2xl mt-6"} font-bold text-white text-center px-4 truncate w-full`}
                >
                  {displayName}
                </h2>
                <p
                  className={`${isMinimized ? "text-[10px]" : "text-sm"} text-gray-400 mt-1`}
                >
                  {activeCall.type === "video"
                    ? "Camera đang tắt"
                    : "Đang gọi thoại"}
                </p>
              </div>
            )}
            {isRemoteMuted && (
              <div
                className={`absolute ${isMinimized ? "top-3 left-3 p-1.5" : "top-6 left-6 p-2.5"} z-50 bg-black/60 rounded-full backdrop-blur-md flex items-center gap-2 shadow-lg`}
              >
                <MicOff size={isMinimized ? 14 : 20} className="text-red-500" />
                {!isMinimized && (
                  <span className="text-white text-xs font-semibold pr-1">
                    Đã tắt mic
                  </span>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* ======================================= */}
      {/* 2. MÀN HÌNH CHỜ CUỘC GỌI */}
      {/* ======================================= */}
      {!callAccepted && (
        <div className="absolute inset-0 z-20 bg-gray-900 flex flex-col items-center justify-center pointer-events-none p-4 text-center">
          <img
            src={displayAvatar}
            className={`${isMinimized ? "w-16 h-16 border-2" : "w-32 h-32 md:w-40 md:h-40 border-4"} rounded-full mb-4 border-primary-500 animate-pulse object-cover shadow-[0_0_30px_rgba(59,130,246,0.5)] transition-all duration-500`}
            alt="avatar"
          />
          <h2
            className={`${isMinimized ? "text-lg" : "text-3xl md:text-4xl"} font-bold text-white mb-2 drop-shadow-lg truncate w-full transition-all duration-500`}
          >
            {displayName}
          </h2>
          <p
            className={`${isMinimized ? "text-xs" : "text-lg"} text-white/90 animate-pulse drop-shadow-md transition-all duration-500`}
          >
            {isInitiator ? "Đang đổ chuông..." : "Đang kết nối..."}
          </p>
        </div>
      )}

      {/* ======================================= */}
      {/* 3. KHUNG CAMERA NHỎ (PiP) */}
      {/* ======================================= */}
      <div
        ref={pipContainerRef}
        onMouseDown={onDragStart}
        onTouchStart={onDragStart}
        onMouseMove={onDragMove}
        onTouchMove={onDragMove}
        onMouseUp={onDragEnd}
        onMouseLeave={onDragEnd}
        onTouchEnd={onDragEnd}
        style={{ touchAction: "none" }}
        className={`cursor-move transition-all duration-300 ease-in-out bg-gray-800 z-[60] overflow-hidden ${
          !showPip || isPipHidden
            ? "hidden"
            : isMinimized
              ? "absolute bottom-3 right-3 w-10 h-16 md:w-20 md:h-16 rounded-lg shadow-lg border border-white/20"
              : pipSnap === "top-right"
                ? "absolute top-6 right-6 w-32 h-48 md:w-64 md:h-48 rounded-2xl shadow-[0_10px_40px_rgba(0,0,0,0.5)] border-2 border-white/20"
                : "absolute bottom-28 right-6 w-32 h-48 md:w-64 md:h-48 rounded-2xl shadow-[0_10px_40px_rgba(0,0,0,0.5)] border-2 border-white/20"
        }`}
      >
        {isSwapped ? (
          <>
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              className={`w-full h-full object-cover pointer-events-none bg-black ${isRemoteVideoOff ? "hidden" : "block"}`}
            />
            {isRemoteVideoOff && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-700 pointer-events-none">
                <img
                  src={displayAvatar}
                  className={`${isMinimized ? "w-6 h-6 border" : "w-16 h-16 md:w-20 md:h-20 border-2"} rounded-full object-cover border-gray-400`}
                />
              </div>
            )}
            {isRemoteMuted && (
              <div className="absolute bottom-2 right-2 bg-black/60 p-1.5 rounded-full z-[70]">
                <MicOff size={isMinimized ? 10 : 16} className="text-red-500" />
              </div>
            )}
          </>
        ) : (
          <>
            <video
              ref={localVideoRef}
              autoPlay
              playsInline
              muted
              className={`w-full h-full object-cover scale-x-[-1] pointer-events-none bg-gray-900 ${isVideoOff ? "hidden" : "block"}`}
            />
            {isVideoOff && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-700 pointer-events-none">
                <img
                  src={myAvatar}
                  className={`${isMinimized ? "w-6 h-6 border" : "w-16 h-16 md:w-20 md:h-20 border-2"} rounded-full object-cover border-gray-400`}
                />
              </div>
            )}
            {isMuted && (
              <div className="absolute bottom-2 right-2 bg-black/60 p-1.5 rounded-full z-[70]">
                <MicOff size={isMinimized ? 10 : 16} className="text-red-500" />
              </div>
            )}
          </>
        )}
      </div>

      {/* DẤU MŨI TÊN ĐỂ GỌI CAM NHỎ QUAY LẠI */}
      {isPipHidden && showPip && !isMinimized && (
        <div
          onClick={() => setIsPipHidden(false)}
          className="absolute top-1/2 right-0 -translate-y-1/2 bg-gray-800 p-3 rounded-l-xl cursor-pointer shadow-lg z-[60] border border-white/20 border-r-0 hover:bg-gray-700 transition-colors animate-in slide-in-from-right-5"
        >
          <ChevronLeft className="text-white" size={28} />
        </div>
      )}

      {/* ======================================= */}
      {/* 4. THANH ĐIỀU KHIỂN CHUNG */}
      {/* ======================================= */}
      <div
        className={`absolute bottom-8 z-[80] flex items-center gap-6 bg-black/50 backdrop-blur-md px-8 py-4 rounded-full border border-white/10 shadow-2xl transition-all duration-500 ${
          isMinimized
            ? "translate-y-32 opacity-0 pointer-events-none"
            : "translate-y-0 opacity-100"
        } left-1/2 -translate-x-1/2`}
      >
        <button
          onClick={toggleMic}
          className={`p-4 rounded-full transition-all duration-300 pointer-events-auto ${
            isMuted
              ? "bg-red-500 text-white"
              : "bg-white/10 hover:bg-white/20 text-white"
          }`}
        >
          {isMuted ? <MicOff size={24} /> : <Mic size={24} />}
        </button>

        <button
          onClick={toggleVideo}
          className={`p-4 rounded-full transition-all duration-300 pointer-events-auto ${
            isVideoOff
              ? "bg-red-500 text-white"
              : "bg-white/10 hover:bg-white/20 text-white"
          }`}
        >
          {isVideoOff ? <VideoOff size={24} /> : <VideoIcon size={24} />}
        </button>

        <button
          onClick={endCall}
          className="p-4 bg-red-600 hover:bg-red-700 text-white rounded-full transition-all hover:scale-110 shadow-lg shadow-red-600/40 ml-2 pointer-events-auto"
        >
          <PhoneOff size={28} />
        </button>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
};

export default CallModal;
