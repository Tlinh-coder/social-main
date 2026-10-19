// src/pages/Login.jsx
import React, { useState } from "react";
import api from "../utils/api";
import { useAuthStore } from "../store/useAuthStore";

const Login = () => {
  const login = useAuthStore((state) => state.login);

  const [mode, setMode] = useState("login");
  const [step, setStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);

  // Form States
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [otp, setOtp] = useState("");
  const [message, setMessage] = useState({ type: "", text: "" });

  const switchMode = (newMode) => {
    setMode(newMode);
    setStep(1);
    setMessage({ type: "", text: "" });
    setPassword("");
    setOtp("");
  };

  // ==========================================
  // LUỒNG 1: ĐĂNG NHẬP
  // ==========================================
  const handleLogin = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      setMessage({ type: "success", text: "Đang kết nối..." });
      const response = await api.post("/api/auth/login", { email, password });

      if (response.data.accessToken) {
        const { accessToken, ...userData } = response.data;
        login(userData, accessToken);
      }
    } catch (error) {
      setMessage({
        type: "error",
        text: error.response?.data?.message || "Đăng nhập thất bại!",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // ==========================================
  // LUỒNG 2: ĐĂNG KÝ
  // ==========================================
  const handleSendOtp = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      setMessage({ type: "success", text: "Đang gửi mã xác nhận..." });
      await api.post("/api/auth/send-otp", { email });
      setStep(2);
      setMessage({
        type: "success",
        text: "Mã OTP đã được gửi! Hãy kiểm tra hòm thư của bạn.",
      });
    } catch (error) {
      setMessage({
        type: "error",
        text: error.response?.data?.message || "Không thể gửi OTP!",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyAndRegister = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const response = await api.post("/api/auth/register", {
        email,
        otp,
        password,
        displayName,
      });
      if (response.data.success) {
        setMessage({
          type: "success",
          text: "Đăng ký thành công! Vui lòng đăng nhập ngay.",
        });
        setMode("login");
        setStep(1);
      }
    } catch (error) {
      setMessage({
        type: "error",
        text: error.response?.data?.message || "Mã OTP không chính xác!",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // ==========================================
  // LUỒNG 3: QUÊN MẬT KHẨU
  // ==========================================
  const handleForgotSendOtp = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      setMessage({
        type: "success",
        text: "Đang gửi mã khôi phục...",
      });
      const res = await api.post("/api/auth/forgot-password", { email });
      if (res.data.success || res.status === 200) {
        setStep(2);
        setMessage({
          type: "success",
          text: "Mã OTP khôi phục đã được gửi vào email của bạn!",
        });
      }
    } catch (error) {
      setMessage({
        type: "error",
        text: error.response?.data?.message || "Tài khoản không tồn tại!",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      setMessage({ type: "success", text: "Đang cập nhật mật khẩu..." });
      const res = await api.post("/api/auth/reset-password", {
        email,
        otpCode: otp,
        newPassword: password,
      });
      if (res.data.success || res.status === 200) {
        alert("Khôi phục mật khẩu thành công! Vui lòng đăng nhập lại.");
        switchMode("login");
      }
    } catch (error) {
      setMessage({
        type: "error",
        text:
          error.response?.data?.message ||
          "Mã OTP không hợp lệ hoặc đã hết hạn!",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-background px-4 transition-colors duration-300">
      <div className="bg-surface p-8 rounded-2xl shadow-xl w-full max-w-md border border-border transition-colors duration-300">
        {/* Branding Mạng Xã Hội */}
        <h2 className="text-3xl font-extrabold text-center text-primary-600 mb-2 tracking-tight">
          HLSocial
        </h2>

        <p className="text-center text-muted text-sm mb-8 font-medium">
          {mode === "register"
            ? "Tham gia cộng đồng cùng hàng triệu người dùng"
            : mode === "forgot"
              ? "Khôi phục quyền truy cập tài khoản"
              : "Kết nối, chia sẻ và lan tỏa khoảnh khắc"}
        </p>

        {/* Khối thông báo giữ nguyên màu sắc đặc trưng của Error/Success */}
        {message.text && (
          <div
            className={`p-3 rounded-lg text-sm mb-5 text-center font-semibold border ${
              message.type === "success"
                ? "bg-green-50 text-green-700 border-green-200"
                : "bg-red-50 text-red-700 border-red-200"
            }`}
          >
            {message.text}
          </div>
        )}

        {/* ========================================== */}
        {/* FORM ĐĂNG NHẬP                               */}
        {/* ========================================== */}
        {mode === "login" && (
          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label className="block text-xs font-bold text-foreground uppercase mb-1.5">
                Email
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-2.5 bg-background text-foreground border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:bg-surface transition-colors"
                placeholder="name@example.com"
              />
            </div>
            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label className="block text-xs font-bold text-foreground uppercase">
                  Mật khẩu
                </label>
                <button
                  type="button"
                  onClick={() => switchMode("forgot")}
                  className="text-xs font-semibold text-primary-600 hover:text-primary-700 hover:underline"
                >
                  Quên mật khẩu?
                </button>
              </div>
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-2.5 bg-background text-foreground border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:bg-surface transition-colors"
                placeholder="••••••••"
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className={`w-full bg-primary-600 text-on-primary py-3 rounded-lg font-bold text-sm shadow-md transition-all ${
                isLoading
                  ? "opacity-70 cursor-not-allowed"
                  : "hover:bg-primary-700 hover:shadow-lg"
              }`}
            >
              {isLoading ? "Đang xử lý..." : "Đăng Nhập"}
            </button>
          </form>
        )}

        {/* ========================================== */}
        {/* FORM ĐĂNG KÝ                                 */}
        {/* ========================================== */}
        {mode === "register" && step === 1 && (
          <form onSubmit={handleSendOtp} className="space-y-5">
            <div>
              <label className="block text-xs font-bold text-foreground uppercase mb-1.5">
                Nhập Email Đăng Ký
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-2.5 bg-background text-foreground border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:bg-surface transition-colors"
                placeholder="name@example.com"
              />
            </div>
            <button
              type="submit"
              disabled={isLoading}
              className={`w-full bg-primary-600 text-on-primary py-3 rounded-lg font-bold text-sm shadow-md transition-all ${
                isLoading
                  ? "opacity-70 cursor-not-allowed"
                  : "hover:bg-primary-700 hover:shadow-lg"
              }`}
            >
              {isLoading ? "Đang xử lý..." : "Tiếp Tục"}
            </button>
          </form>
        )}

        {mode === "register" && step === 2 && (
          <form onSubmit={handleVerifyAndRegister} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-foreground uppercase mb-1.5">
                Mã OTP (Gửi về mail)
              </label>
              <input
                type="text"
                required
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                className="w-full px-4 py-2.5 bg-background text-foreground border border-border rounded-lg text-center font-bold tracking-[0.3em] text-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:bg-surface transition-colors"
                placeholder="123456"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-foreground uppercase mb-1.5">
                Tên Hiển Thị
              </label>
              <input
                type="text"
                required
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-full px-4 py-2.5 bg-background text-foreground border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:bg-surface transition-colors"
                placeholder="Ví dụ: John Doe"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-foreground uppercase mb-1.5">
                Mật khẩu mới
              </label>
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-2.5 bg-background text-foreground border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:bg-surface transition-colors"
                placeholder="••••••••"
              />
            </div>
            <button
              type="submit"
              disabled={isLoading}
              className={`w-full bg-primary-600 text-on-primary py-3 rounded-lg font-bold text-sm shadow-md transition-all ${
                isLoading
                  ? "opacity-70 cursor-not-allowed"
                  : "hover:bg-primary-700 hover:shadow-lg"
              }`}
            >
              {isLoading ? "Đang xử lý..." : "Hoàn Tất Đăng Ký"}
            </button>
          </form>
        )}

        {/* ========================================== */}
        {/* FORM QUÊN MẬT KHẨU                           */}
        {/* ========================================== */}
        {mode === "forgot" && step === 1 && (
          <form onSubmit={handleForgotSendOtp} className="space-y-5">
            <div>
              <label className="block text-xs font-bold text-foreground uppercase mb-1.5">
                Nhập Email Của Bạn
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-2.5 bg-background text-foreground border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:bg-surface transition-colors"
                placeholder="name@example.com"
              />
            </div>
            <button
              type="submit"
              disabled={isLoading}
              className={`w-full bg-primary-600 text-on-primary py-3 rounded-lg font-bold text-sm shadow-md transition-all ${
                isLoading
                  ? "opacity-70 cursor-not-allowed"
                  : "hover:bg-primary-700 hover:shadow-lg"
              }`}
            >
              {isLoading ? "Đang xử lý..." : "Gửi Mã Khôi Phục"}
            </button>
          </form>
        )}

        {mode === "forgot" && step === 2 && (
          <form onSubmit={handleResetPassword} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-foreground uppercase mb-1.5">
                Mã OTP (Gửi về mail)
              </label>
              <input
                type="text"
                required
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                maxLength={6}
                className="w-full px-4 py-2.5 bg-background text-foreground border border-border rounded-lg text-center font-bold tracking-[0.3em] text-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:bg-surface transition-colors"
                placeholder="123456"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-foreground uppercase mb-1.5">
                Mật Khẩu Mới
              </label>
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-2.5 bg-background text-foreground border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:bg-surface transition-colors"
                placeholder="••••••••"
              />
            </div>
            <button
              type="submit"
              disabled={isLoading}
              className={`w-full bg-primary-600 text-on-primary py-3 rounded-lg font-bold text-sm shadow-md transition-all ${
                isLoading
                  ? "opacity-70 cursor-not-allowed"
                  : "hover:bg-primary-700 hover:shadow-lg"
              }`}
            >
              {isLoading ? "Đang xử lý..." : "Xác Nhận Đổi Mật Khẩu"}
            </button>
          </form>
        )}

        {/* ========================================== */}
        {/* NÚT ĐIỀU HƯỚNG BÊN DƯỚI                      */}
        {/* ========================================== */}
        <div className="mt-8 pt-6 border-t border-border flex flex-col items-center gap-3 text-sm">
          {mode === "login" ? (
            <div className="text-muted">
              Chưa có tài khoản?{" "}
              <button
                type="button"
                onClick={() => switchMode("register")}
                className="text-primary-600 hover:text-primary-700 font-bold hover:underline transition-colors"
              >
                Đăng ký ngay
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => switchMode("login")}
              className="text-muted hover:text-primary-600 font-bold transition-colors flex items-center gap-1"
            >
              &larr; Quay lại đăng nhập
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default Login;
