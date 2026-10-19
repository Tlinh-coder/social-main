// src/pages/Settings.jsx
import React, { useState } from "react";
import { useAuthStore } from "../store/useAuthStore";
import { useThemeStore } from "../store/useThemeStore"; // IMPORT THEME STORE
import {
  Settings as SettingsIcon,
  Shield,
  Bell,
  Palette,
  Lock,
  Trash2,
  Save,
  Loader2,
  ChevronRight,
  LogOut,
} from "lucide-react";
import api from "../utils/api";
import { toast } from "react-hot-toast";

const Settings = () => {
  const { user, logout } = useAuthStore();
  const { theme, setTheme } = useThemeStore(); // LẤY THEME VÀ HÀM ĐỔI THEME
  const [activeTab, setActiveTab] = useState("security");

  // ==========================================
  // STATE: ĐỔI MẬT KHẨU
  // ==========================================
  const [passwords, setPasswords] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);

  // ==========================================
  // STATE: TÙY CHỌN (GIAO DIỆN)
  // ==========================================
  const [preferences, setPreferences] = useState({
    emailNotifications: true,
    pushNotifications: true,
    privateProfile: false,
  });

  // ==========================================
  // HÀM XỬ LÝ ĐỔI MẬT KHẨU
  // ==========================================
  const handleUpdatePassword = async (e) => {
    e.preventDefault();
    if (passwords.newPassword !== passwords.confirmPassword) {
      return toast.error("Mật khẩu mới không khớp!");
    }
    if (passwords.newPassword.length < 6) {
      return toast.error("Mật khẩu mới phải có ít nhất 6 ký tự!");
    }

    setIsUpdatingPassword(true);
    try {
      const res = await api.put("/api/users/change-password", {
        currentPassword: passwords.currentPassword,
        newPassword: passwords.newPassword,
      });

      if (res.data.success) {
        toast.success("Đổi mật khẩu thành công!");
        setPasswords({
          currentPassword: "",
          newPassword: "",
          confirmPassword: "",
        });
      }
    } catch (error) {
      toast.error(error.response?.data?.message || "Lỗi khi đổi mật khẩu");
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  // ==========================================
  // HÀM XÓA TÀI KHOẢN
  // ==========================================
  const handleDeleteAccount = async () => {
    if (
      !window.confirm(
        "CẢNH BÁO: Bạn có chắc chắn muốn xóa vĩnh viễn tài khoản này không? Hành động này không thể hoàn tác!",
      )
    ) {
      return;
    }

    try {
      const res = await api.delete("/api/users/delete-account");
      if (res.data.success) {
        toast.success("Đã xóa tài khoản. Đang đăng xuất...");
        setTimeout(() => logout(), 1500);
      }
    } catch (error) {
      toast.error("Không thể xóa tài khoản lúc này.");
    }
  };

  // COMPONENT CON: NÚT BẬT TẮT (TOGGLE SWITCH) - Đã tối ưu Theme
  const ToggleSwitch = ({ label, description, checked, onChange }) => (
    <div className="flex items-center justify-between py-3">
      <div className="pr-4">
        <h4 className="text-foreground font-semibold transition-colors">
          {label}
        </h4>
        {description && (
          <p className="text-xs text-muted mt-0.5 transition-colors">
            {description}
          </p>
        )}
      </div>
      <button
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
          checked ? "bg-primary-600" : "bg-border"
        }`}
      >
        <span
          className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
            checked ? "translate-x-5" : "translate-x-0"
          }`}
        />
      </button>
    </div>
  );

  return (
    <main className="max-w-5xl mx-auto md:px-4 py-6 md:py-8 mb-10 select-none transition-colors duration-300">
      {/* HEADER */}
      <div className="px-4 md:px-0 mb-6 sm:mb-8">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-foreground flex items-center gap-3 transition-colors">
          <SettingsIcon className="text-primary-600" size={32} />
          Cài đặt
        </h1>
        <p className="text-muted mt-1.5 text-sm sm:text-base font-medium transition-colors">
          Quản lý tài khoản, quyền riêng tư và các tùy chọn cá nhân của bạn.
        </p>
      </div>

      <div className="flex flex-col md:flex-row gap-6">
        {/* ========================================== */}
        {/* CỘT TRÁI: MENU ĐIỀU HƯỚNG */}
        {/* ========================================== */}
        <div className="w-full md:w-64 shrink-0 px-4 md:px-0">
          <div className="bg-surface rounded-2xl shadow-sm border border-border overflow-hidden sticky top-20 transition-colors duration-300">
            <nav className="flex flex-col p-2">
              <button
                onClick={() => setActiveTab("security")}
                className={`flex items-center justify-between p-3 rounded-xl transition-colors ${
                  activeTab === "security"
                    ? "bg-primary-50 text-primary-700 font-bold"
                    : "text-muted hover:bg-hover hover:text-primary-600 font-semibold"
                }`}
              >
                <div className="flex items-center gap-3">
                  <Shield
                    size={18}
                    className={
                      activeTab === "security"
                        ? "text-primary-600"
                        : "text-muted"
                    }
                  />{" "}
                  Bảo mật
                </div>
                <ChevronRight
                  size={16}
                  className={
                    activeTab === "security"
                      ? "text-primary-600 opacity-100"
                      : "opacity-0"
                  }
                />
              </button>

              <button
                onClick={() => setActiveTab("notifications")}
                className={`flex items-center justify-between p-3 rounded-xl transition-colors mt-1 ${
                  activeTab === "notifications"
                    ? "bg-primary-50 text-primary-700 font-bold"
                    : "text-muted hover:bg-hover hover:text-primary-600 font-semibold"
                }`}
              >
                <div className="flex items-center gap-3">
                  <Bell
                    size={18}
                    className={
                      activeTab === "notifications"
                        ? "text-primary-600"
                        : "text-muted"
                    }
                  />{" "}
                  Thông báo
                </div>
                <ChevronRight
                  size={16}
                  className={
                    activeTab === "notifications"
                      ? "text-primary-600 opacity-100"
                      : "opacity-0"
                  }
                />
              </button>

              <button
                onClick={() => setActiveTab("preferences")}
                className={`flex items-center justify-between p-3 rounded-xl transition-colors mt-1 ${
                  activeTab === "preferences"
                    ? "bg-primary-50 text-primary-700 font-bold"
                    : "text-muted hover:bg-hover hover:text-primary-600 font-semibold"
                }`}
              >
                <div className="flex items-center gap-3">
                  <Palette
                    size={18}
                    className={
                      activeTab === "preferences"
                        ? "text-primary-600"
                        : "text-muted"
                    }
                  />{" "}
                  Giao diện
                </div>
                <ChevronRight
                  size={16}
                  className={
                    activeTab === "preferences"
                      ? "text-primary-600 opacity-100"
                      : "opacity-0"
                  }
                />
              </button>

              <div className="h-px bg-border my-2 mx-2"></div>

              <button
                onClick={() => setActiveTab("danger")}
                className={`flex items-center justify-between p-3 rounded-xl transition-colors ${
                  activeTab === "danger"
                    ? "bg-red-50 text-red-700 font-bold"
                    : "text-muted hover:bg-red-50 hover:text-red-600 font-semibold"
                }`}
              >
                <div className="flex items-center gap-3">
                  <Trash2
                    size={18}
                    className={
                      activeTab === "danger" ? "text-red-600" : "text-muted"
                    }
                  />{" "}
                  Xóa tài khoản
                </div>
                <ChevronRight
                  size={16}
                  className={
                    activeTab === "danger"
                      ? "text-red-600 opacity-100"
                      : "opacity-0"
                  }
                />
              </button>

              {/* NÚT ĐĂNG XUẤT */}
              <div className="h-px bg-border my-2 mx-2"></div>

              <button
                onClick={logout}
                className="flex items-center gap-3 p-3 rounded-xl transition-colors text-muted hover:text-red-600 hover:bg-hover font-semibold w-full text-left"
              >
                <LogOut size={18} />
                Đăng xuất
              </button>
            </nav>
          </div>
        </div>

        {/* ========================================== */}
        {/* CỘT PHẢI: NỘI DUNG CHI TIẾT */}
        {/* ========================================== */}
        <div className="flex-1 px-4 md:px-0">
          {/* TAB 1: BẢO MẬT & MẬT KHẨU */}
          {activeTab === "security" && (
            <section className="bg-surface rounded-2xl p-6 border border-border shadow-sm animate-in fade-in duration-300 transition-colors">
              <h2 className="text-xl font-bold text-foreground mb-6 flex items-center gap-2 border-b border-border pb-4 transition-colors">
                <Lock className="text-primary-500" size={20} />
                Đổi mật khẩu
              </h2>

              <form
                onSubmit={handleUpdatePassword}
                className="space-y-4 max-w-md"
              >
                <div>
                  <label className="block text-sm font-semibold text-foreground mb-1.5 ml-1 transition-colors">
                    Mật khẩu hiện tại
                  </label>
                  <input
                    type="password"
                    value={passwords.currentPassword}
                    onChange={(e) =>
                      setPasswords({
                        ...passwords,
                        currentPassword: e.target.value,
                      })
                    }
                    className="w-full bg-background text-foreground border border-border focus:bg-surface focus:border-primary-400 focus:ring-4 focus:ring-primary-50 rounded-xl px-4 py-2.5 outline-none transition-all"
                    placeholder="Nhập mật khẩu cũ..."
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-foreground mb-1.5 ml-1 transition-colors">
                    Mật khẩu mới
                  </label>
                  <input
                    type="password"
                    value={passwords.newPassword}
                    onChange={(e) =>
                      setPasswords({
                        ...passwords,
                        newPassword: e.target.value,
                      })
                    }
                    className="w-full bg-background text-foreground border border-border focus:bg-surface focus:border-primary-400 focus:ring-4 focus:ring-primary-50 rounded-xl px-4 py-2.5 outline-none transition-all"
                    placeholder="Mật khẩu mới (ít nhất 6 ký tự)"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-foreground mb-1.5 ml-1 transition-colors">
                    Xác nhận mật khẩu mới
                  </label>
                  <input
                    type="password"
                    value={passwords.confirmPassword}
                    onChange={(e) =>
                      setPasswords({
                        ...passwords,
                        confirmPassword: e.target.value,
                      })
                    }
                    className="w-full bg-background text-foreground border border-border focus:bg-surface focus:border-primary-400 focus:ring-4 focus:ring-primary-50 rounded-xl px-4 py-2.5 outline-none transition-all"
                    placeholder="Nhập lại mật khẩu mới..."
                  />
                </div>
                <div className="pt-4">
                  <button
                    type="submit"
                    disabled={
                      isUpdatingPassword ||
                      !passwords.currentPassword ||
                      !passwords.newPassword ||
                      !passwords.confirmPassword
                    }
                    className="flex items-center justify-center gap-2 w-full px-6 py-2.5 bg-primary-600 hover:bg-primary-700 text-on-primary font-semibold rounded-xl transition-all disabled:opacity-50"
                  >
                    {isUpdatingPassword ? (
                      <Loader2 size={18} className="animate-spin" />
                    ) : (
                      <Save size={18} />
                    )}
                    Cập nhật mật khẩu
                  </button>
                </div>
              </form>
            </section>
          )}

          {/* TAB 2: THÔNG BÁO */}
          {activeTab === "notifications" && (
            <section className="bg-surface rounded-2xl p-6 border border-border shadow-sm animate-in fade-in duration-300 transition-colors">
              <h2 className="text-xl font-bold text-foreground mb-2 flex items-center gap-2 border-b border-border pb-4 transition-colors">
                <Bell className="text-primary-500" size={20} />
                Cài đặt thông báo
              </h2>

              <div className="divide-y divide-border">
                <ToggleSwitch
                  label="Thông báo đẩy (Push Notifications)"
                  description="Nhận thông báo trực tiếp trên trình duyệt khi có tin nhắn hoặc lượt thích mới."
                  checked={preferences.pushNotifications}
                  onChange={(val) =>
                    setPreferences({ ...preferences, pushNotifications: val })
                  }
                />
                <ToggleSwitch
                  label="Email thông báo"
                  description="Gửi email cho tôi khi có lời mời kết bạn mới hoặc thông báo quan trọng."
                  checked={preferences.emailNotifications}
                  onChange={(val) =>
                    setPreferences({ ...preferences, emailNotifications: val })
                  }
                />
              </div>
            </section>
          )}

          {/* TAB 3: GIAO DIỆN (ĐÃ HOOK THEME VÀO ZUSTAND) */}
          {activeTab === "preferences" && (
            <section className="bg-surface rounded-2xl p-6 border border-border shadow-sm animate-in fade-in duration-300 transition-colors">
              <h2 className="text-xl font-bold text-foreground mb-2 flex items-center gap-2 border-b border-border pb-4 transition-colors">
                <Palette className="text-primary-500" size={20} />
                Tùy chọn giao diện & Quyền riêng tư
              </h2>

              <div className="divide-y divide-border">
                <ToggleSwitch
                  label="Chế độ tối (Dark Mode)"
                  description="Chuyển đổi giao diện sang nền tối để bảo vệ mắt."
                  checked={theme === "dark"} // Đọc từ Zustand
                  onChange={(isChecked) => {
                    // Cập nhật Theme thông qua Zustand
                    setTheme(isChecked ? "dark" : "light");
                  }}
                />
                <ToggleSwitch
                  label="Tài khoản riêng tư"
                  description="Chỉ bạn bè mới có thể xem bài viết và thông tin chi tiết của bạn."
                  checked={preferences.privateProfile}
                  onChange={(val) =>
                    setPreferences({ ...preferences, privateProfile: val })
                  }
                />
              </div>
            </section>
          )}

          {/* TAB 4: VÙNG NGUY HIỂM */}
          {activeTab === "danger" && (
            <section className="bg-surface rounded-2xl p-6 border border-red-200 shadow-sm animate-in fade-in duration-300 relative overflow-hidden transition-colors">
              <div className="absolute top-0 left-0 w-1 h-full bg-red-500"></div>
              <h2 className="text-xl font-bold text-red-600 mb-2 flex items-center gap-2 border-b border-red-100 pb-4">
                <Trash2 size={20} />
                Vùng nguy hiểm
              </h2>
              <p className="text-muted text-sm mb-6 mt-4 transition-colors">
                Khi bạn xóa tài khoản, toàn bộ dữ liệu bao gồm bài viết, tin
                nhắn, hình ảnh và danh sách bạn bè sẽ bị xóa vĩnh viễn. Hành
                động này không thể hoàn tác.
              </p>

              <button
                onClick={handleDeleteAccount}
                className="flex items-center justify-center gap-2 px-6 py-2.5 bg-red-50 hover:bg-red-600 text-red-600 hover:text-white font-bold rounded-xl transition-colors border border-red-100 hover:border-red-600"
              >
                <Trash2 size={18} />
                Xóa vĩnh viễn tài khoản
              </button>
            </section>
          )}
        </div>
      </div>
    </main>
  );
};

export default Settings;
