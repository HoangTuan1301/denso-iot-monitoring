/**
 * @file Header.tsx
 * Chuẩn ảnh mẫu: Breadcrumb | Nút Giả lập Sự cố | Pill "Làm mới" | Pill "Quyền sửa" | Giờ | Nút Theme
 * Tương thích hoàn hảo Dark & Light Mode với độ tương phản cao
 */

import { useState, useEffect, useRef } from "react";
import { Sun, Moon, RefreshCw, Flame, AlertOctagon, LogOut, Radio, Camera } from "lucide-react";
import { useMonitoringStore } from "../../stores/useMonitoringStore";
import { useAuthStore }       from "../../stores/useAuthStore";
import { useThemeStore }      from "../../stores/useThemeStore";
import { socketClient }       from "../../services/socket";

/* ------------------------------------------------------------------ */
/* Bản đồ tiêu đề breadcrumb theo tab                                  */
/* ------------------------------------------------------------------ */
const BREADCRUMBS: Record<string, { group: string; page: string }> = {
  dashboard:  { group: "Giám sát",  page: "Dashboard Tổng quan" },
  lines:      { group: "Cấu hình",  page: "Luồng & Thành phần" },
  thresholds: { group: "Cấu hình",  page: "Cấu hình Ngưỡng & Trạm PLC" },
  alarms:     { group: "Giám sát",  page: "Nhật Ký Cảnh Báo & Sự Cố" },
  users:      { group: "Quản trị",  page: "Quản Lý Người Dùng & Phân Quyền" },
  audit:      { group: "Kiểm toán", page: "Nhật Ký Kiểm Toán (Audit Logs)" },
  qr:         { group: "Tiện ích",  page: "Quét mã QR" },
  settings:   { group: "Cấu hình",  page: "Danh mục Metric & Hệ thống" },
};

/* ------------------------------------------------------------------ */
/* Header Component                                                     */
/* ------------------------------------------------------------------ */
export function Header() {
  const {
    activeTab,
    isRealtimeActive,
    toggleRealtime,
    simulateTick,
    triggerEmergencyDemo,
    setActiveTab,
  } = useMonitoringStore();
  const { currentUser, logout, uploadAvatar, setAvatarUrl } = useAuthStore();
  const { theme, toggleTheme }  = useThemeStore();

  const [timeStr, setTimeStr]       = useState("");
  const [demoNotice, setDemoNotice] = useState<string | null>(null);
  const [isWsConnected, setIsWsConnected] = useState(false);
  const fileInputRef                = useRef<HTMLInputElement>(null);

  /* Lắng nghe trạng thái kết nối WebSocket Realtime */
  useEffect(() => {
    const unsub = socketClient.onStatusChange((connected) => {
      setIsWsConnected(connected);
    });
    return () => {
      unsub();
    };
  }, []);

  /* Lắng nghe sự kiện đổi avatar từ WebSocket */
  useEffect(() => {
    const unsubAvatar = socketClient.on("user_avatar_updated", (data: any) => {
      if (data.userId === currentUser.id && data.avatarUrl) {
        setAvatarUrl(data.avatarUrl);
      }
    });
    return () => {
      unsubAvatar();
    };
  }, [currentUser.id, setAvatarUrl]);

  /* Đồng hồ cập nhật mỗi giây */
  useEffect(() => {
    const tick = () =>
      setTimeStr(
        new Date().toLocaleTimeString("vi-VN", {
          hour12:  false,
          hour:    "2-digit",
          minute:  "2-digit",
          second:  "2-digit",
        })
      );
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  const { group, page } = BREADCRUMBS[activeTab] ?? BREADCRUMBS.dashboard;
  const userRole        = (currentUser?.role || "OPERATOR").toUpperCase();
  const isAdmin         = userRole === "ADMIN";

  const displayName     = currentUser?.fullName || currentUser?.name || "Người dùng";
  const initials        = displayName
    .split(" ")
    .filter(Boolean)
    .slice(-2)
    .map((w) => w[0])
    .join("")
    .toUpperCase() || "DN";

  /* Xử lý kích hoạt sự cố giả lập demo */
  const handleTriggerEmergency = () => {
    const triggered = triggerEmergencyDemo();
    if (triggered) {
      setDemoNotice(
        `Đã kích hoạt sự cố tại ${triggered.machineName}: ${triggered.metricName} tăng vọt ${triggered.value} ${triggered.unit}!`
      );
      setTimeout(() => setDemoNotice(null), 5000);
    }
  };

  return (
    <header className="relative flex h-[60px] shrink-0 items-center justify-between border-b border-factory-border bg-factory-card px-6 z-20">

      {/* ---- Thông báo Toast khi bấm Giả lập sự cố ---- */}
      {demoNotice && (
        <div 
          onClick={() => setActiveTab('alarms')}
          className="absolute top-[66px] right-6 z-50 flex items-center gap-2.5 rounded-xl bg-gradient-to-r from-rose-600 to-red-600 text-white px-4 py-2.5 shadow-2xl shadow-rose-950/40 text-xs font-semibold cursor-pointer transition-all hover:scale-102"
        >
          <AlertOctagon className="w-4.5 h-4.5 shrink-0 animate-bounce" />
          <span>{demoNotice}</span>
          <span className="underline ml-1">Xem chi tiết &rarr;</span>
        </div>
      )}

      {/* ---- Góc trái: Breadcrumb ---- */}
      <div className="flex items-center gap-1.5 text-sm select-none">
        <span className="text-slate-500 dark:text-slate-400 font-medium">{group}</span>
        <span className="text-slate-400 dark:text-slate-500 font-normal">/</span>
        <span className="font-bold text-slate-900 dark:text-white">{page}</span>
      </div>

      {/* ---- Góc phải: các pill & nút ---- */}
      <div className="flex items-center gap-2">

        {/* Nút Giả Lập Sự Cố Khẩn Cấp (Chỉ hiển thị cho ADMIN) */}
        {isAdmin && (
          <button
            onClick={handleTriggerEmergency}
            title="Kích hoạt sự cố vượt ngưỡng khẩn cấp ngẫu nhiên ở một máy (Dành riêng cho Admin demo)"
            className="flex items-center gap-1.5 rounded-full border border-rose-500/40 bg-rose-500/10 px-3 py-1 text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-500/20 active:scale-95 transition-all cursor-pointer shadow-xs"
          >
            <Flame className="h-3.5 w-3.5 text-rose-500 animate-pulse" />
            <span className="hidden sm:inline">Giả lập Sự cố</span>
            <span className="sm:hidden">Sự cố</span>
          </button>
        )}

        {/* Pill Stream — Bật / Tắt cập nhật tự động */}
        <button
          onClick={() => toggleRealtime()}
          title="Bật / Tắt cập nhật số liệu thời gian thực"
          className={[
            "flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-mono transition-colors cursor-pointer",
            isRealtimeActive
              ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-semibold hover:bg-emerald-500/20"
              : "border-slate-300 dark:border-factory-border bg-slate-100 dark:bg-factory-surface text-slate-600 dark:text-slate-400 hover:border-slate-400",
          ].join(" ")}
        >
          <span
            className={[
              "h-1.5 w-1.5 rounded-full",
              isRealtimeActive ? "bg-emerald-500 animate-pulse" : "bg-slate-400",
            ].join(" ")}
          />
          {isRealtimeActive ? "Stream: ON" : "Stream: OFF"}
        </button>

        {/* Trạng thái kết nối WebSocket IoT */}
        <div
          title={
            isWsConnected
              ? "WebSocket Real-time IoT đang trực tuyến (port 5000 /ws)"
              : "WebSocket đang ngắt kết nối hoặc đang kết nối lại..."
          }
          className={[
            "flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-mono transition-colors select-none",
            isWsConnected
              ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-medium"
              : "border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400 font-medium",
          ].join(" ")}
        >
          <span
            className={[
              "h-1.5 w-1.5 rounded-full",
              isWsConnected ? "bg-emerald-500 animate-pulse" : "bg-amber-500",
            ].join(" ")}
          />
          <Radio className="h-3 w-3 shrink-0" />
          <span className="hidden md:inline">
            {isWsConnected ? "WS: Live" : "WS: Reconnecting"}
          </span>
        </div>

        {/* User Profile Pill with Avatar (Click để đổi ảnh nhanh) */}
        <div
          onClick={() => fileInputRef.current?.click()}
          title="Bấm để tải ảnh đại diện mới lên MySQL"
          className="flex items-center gap-2 rounded-full border border-slate-200 dark:border-factory-border bg-slate-100 dark:bg-factory-surface py-0.5 pl-1 pr-2.5 text-xs font-medium cursor-pointer hover:bg-slate-200/70 dark:hover:bg-white/10 transition-colors select-none"
        >
          <div className="relative h-7 w-7 rounded-full overflow-hidden bg-emerald-500 text-white font-bold flex items-center justify-center shrink-0 shadow-xs border border-white/30">
            {currentUser?.avatarUrl ? (
              <img
                src={currentUser.avatarUrl}
                alt={displayName}
                className="h-full w-full object-cover"
                onError={(e) => {
                  (e.currentTarget as HTMLElement).style.display = "none";
                }}
              />
            ) : (
              <span className="text-[10px]">{initials}</span>
            )}
            <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity rounded-full">
              <Camera className="w-3 h-3 text-white" />
            </div>
          </div>
          <span className="hidden sm:inline font-semibold text-slate-800 dark:text-slate-200 truncate max-w-[100px]">
            {displayName}
          </span>
          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-bold uppercase">
            {userRole}
          </span>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/svg+xml"
          className="hidden"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            if (file) {
              await uploadAvatar(file);
            }
          }}
        />

        {/* Đồng hồ */}
        <span className="hidden lg:block text-xs font-mono text-slate-600 dark:text-slate-400 tabular-nums min-w-[60px] text-right font-medium">
          {timeStr}
        </span>

        {/* Divider */}
        <div className="h-5 w-px bg-slate-200 dark:bg-factory-border" />

        {/* Refresh thủ công */}
        <button
          onClick={() => simulateTick()}
          title="Lấy dữ liệu cảm biến ngay lập tức"
          className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 dark:border-factory-border bg-slate-100 dark:bg-factory-surface text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:border-slate-400 transition-colors cursor-pointer"
        >
          <RefreshCw className="h-3.5 w-3.5" />
        </button>

        {/* Nút Theme — Mặt trời / Mặt trăng */}
        <button
          onClick={toggleTheme}
          title={theme === "dark" ? "Chuyển sang giao diện Sáng" : "Chuyển sang giao diện Tối"}
          className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 dark:border-factory-border bg-slate-100 dark:bg-factory-surface text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:border-slate-400 transition-colors cursor-pointer"
        >
          {theme === "dark" ? (
            <Moon className="h-3.5 w-3.5" />
          ) : (
            <Sun className="h-3.5 w-3.5 text-amber-500" />
          )}
        </button>

        {/* Nút Đăng xuất */}
        <button
          onClick={() => logout()}
          title="Đăng xuất khỏi phiên làm việc"
          className="flex h-8 w-8 items-center justify-center rounded-full border border-rose-200 dark:border-rose-900/40 bg-rose-50 dark:bg-rose-950/20 text-rose-600 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-900/30 transition-colors cursor-pointer"
        >
          <LogOut className="h-3.5 w-3.5" />
        </button>
      </div>
    </header>
  );
}
