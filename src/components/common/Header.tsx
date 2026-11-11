/**
 * @file Header.tsx
 * Chuẩn ảnh mẫu: Breadcrumb | Nút Giả lập Sự cố | Pill "Làm mới" | Pill "Quyền sửa" | Giờ | Nút Theme
 * Tương thích hoàn hảo Dark & Light Mode với độ tương phản cao
 */

import { useState, useEffect } from "react";
import { Sun, Moon, RefreshCw, Flame, AlertOctagon, LogOut, Radio, RotateCcw } from "lucide-react";
import { useMonitoringStore } from "../../stores/useMonitoringStore";
import { useAuthStore }       from "../../stores/useAuthStore";
import { useThemeStore }      from "../../stores/useThemeStore";
import { socketClient }       from "../../services/socket";

/* ------------------------------------------------------------------ */
/* Bản đồ tiêu đề breadcrumb theo tab                                  */
/* ------------------------------------------------------------------ */
const BREADCRUMBS: Record<string, { group: string; page: string }> = {
  dashboard:  { group: "Giám sát",  page: "Dashboard Tổng quan" },
  devices:    { group: "Giám sát",  page: "Giám sát Thiết bị" },
  lines:      { group: "Cấu hình",  page: "Dây chuyền & Thiết bị" },
  metrics:    { group: "Cấu hình",  page: "Danh mục Thông số" },
  thresholds: { group: "Cấu hình",  page: "Mapping & Ngưỡng cảnh báo" },
  users:      { group: "Cấu hình",  page: "Quản lý Tài khoản" },
  audit:      { group: "Cấu hình",  page: "Nhật ký Hệ thống" },
  alarms:     { group: "Giám sát",  page: "Cảnh báo & Sự cố" },
  history:    { group: "Giám sát",  page: "Lịch sử Dữ liệu" },
  ai:         { group: "Giám sát",  page: "AI Giám sát & Dự đoán" },
  qr:         { group: "Tiện ích",  page: "Quét mã QR" },
  settings:   { group: "Cấu hình",  page: "Danh mục Thông số & Hệ thống" },
};

/* ------------------------------------------------------------------ */
/* Header Component                                                     */
/* ------------------------------------------------------------------ */
export function Header() {
  const {
    activeTab,
    activeNavGroup,
    isRealtimeActive,
    toggleRealtime,
    simulateTick,
    triggerEmergencyDemo,
    resetEmergencyDemo,
    setActiveTab,
    dashboardViewLevel,
    selectedLineId,
    selectedMachineId,
    lines,
    setDashboardViewLevel,
    setSelectedLineId,
    activeEmergencyMetricId,
  } = useMonitoringStore();
  const { currentUser, logout, setAvatarUrl } = useAuthStore();
  const { theme, toggleTheme }  = useThemeStore();

  const [timeStr, setTimeStr]       = useState("");
  const [demoNotice, setDemoNotice] = useState<string | null>(null);
  const [isWsConnected, setIsWsConnected] = useState(false);

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

  const currentBreadcrumb =
    activeTab === "devices" || (activeTab === "lines" && activeNavGroup === "monitoring")
      ? { group: "Giám sát", page: "Giám sát Thiết bị" }
      : BREADCRUMBS[activeTab] ?? BREADCRUMBS.dashboard;
  const { group, page } = currentBreadcrumb;
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

  const [hasActiveEmergency, setHasActiveEmergency] = useState(false);
  const isEmergencyActive = hasActiveEmergency || !!activeEmergencyMetricId;

  /* Xử lý kích hoạt sự cố giả lập demo */
  const handleTriggerEmergency = () => {
    const triggered = triggerEmergencyDemo();
    if (triggered) {
      setHasActiveEmergency(true);
      setDemoNotice(
        `Đã kích hoạt sự cố tại ${triggered.machineName}: ${triggered.metricName} tăng vọt ${triggered.value} ${triggered.unit}!`
      );
      setTimeout(() => setDemoNotice(null), 8000);
    }
  };

  /* Xử lý khôi phục trạng thái chuẩn sau diễn tập */
  const handleRestoreEmergency = () => {
    resetEmergencyDemo();
    setHasActiveEmergency(false);
    setDemoNotice("Đã khôi phục toàn bộ hệ thống về trạng thái chuẩn.");
    setTimeout(() => setDemoNotice(null), 3000);
  };

  return (
    <header className="relative flex h-[60px] shrink-0 items-center justify-between border-b border-factory-border bg-factory-card px-6 z-20">

      {/* ---- Thông báo Toast khi bấm Giả lập sự cố ---- */}
      {demoNotice && (
        <div 
          className="absolute top-[66px] right-6 z-50 flex items-center gap-2.5 rounded-xl bg-gradient-to-r from-rose-600 to-red-600 text-white px-4 py-2.5 shadow-2xl shadow-rose-950/40 text-xs font-semibold select-none transition-all"
        >
          <AlertOctagon className="w-4.5 h-4.5 shrink-0 animate-bounce" />
          <span onClick={() => setActiveTab('alarms')} className="cursor-pointer hover:underline">{demoNotice}</span>
          <button
            type="button"
            onClick={handleRestoreEmergency}
            className="ml-2 px-2.5 py-1 rounded-lg bg-white/20 hover:bg-white/30 text-white text-[11px] font-bold cursor-pointer transition-colors"
          >
            Khôi phục ngay
          </button>
        </div>
      )}

      {/* ---- Góc trái: Breadcrumb phân tầng thông minh ---- */}
      <div className="flex items-center gap-1.5 text-xs sm:text-sm select-none">
        {activeTab === 'dashboard' && dashboardViewLevel !== 'factory_layout' ? (
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => {
                setDashboardViewLevel('factory_layout');
                setSelectedLineId(null);
              }}
              className="text-slate-500 hover:text-emerald-600 dark:text-slate-400 dark:hover:text-emerald-400 font-medium transition-colors cursor-pointer"
            >
              Dashboard Tổng quan
            </button>

            <span className="text-slate-400 dark:text-slate-500">&gt;</span>

            {dashboardViewLevel === 'line_overview' && (
              <span className="font-bold text-slate-900 dark:text-white">
                Dây chuyền {lines.find((l) => l.id === selectedLineId || l.code === selectedLineId)?.code || selectedLineId || 'LN-PRS-01'}
              </span>
            )}

            {dashboardViewLevel === 'machine_detail' && (
              <>
                <button
                  onClick={() => setDashboardViewLevel('line_overview')}
                  className="text-slate-500 hover:text-emerald-600 dark:text-slate-400 dark:hover:text-emerald-400 font-medium transition-colors cursor-pointer"
                >
                  Dây chuyền {lines.find((l) => l.id === selectedLineId || l.code === selectedLineId)?.code || selectedLineId || 'LN-PRS-01'}
                </button>
                <span className="text-slate-400 dark:text-slate-500">&gt;</span>
                <span className="font-bold text-slate-900 dark:text-white">
                  Máy {lines.flatMap((l) => l.machines || []).find((m) => m.id === selectedMachineId || m.code === selectedMachineId)?.code || selectedMachineId || 'OP50'}
                </span>
              </>
            )}

            {dashboardViewLevel === 'check_sheet' && (
              <>
                <button
                  onClick={() => setDashboardViewLevel('line_overview')}
                  className="text-slate-500 hover:text-emerald-600 dark:text-slate-400 dark:hover:text-emerald-400 font-medium transition-colors cursor-pointer hidden md:inline"
                >
                  Dây chuyền {lines.find((l) => l.id === selectedLineId || l.code === selectedLineId)?.code || selectedLineId || 'LN-PRS-01'}
                </button>
                <span className="text-slate-400 dark:text-slate-500 hidden md:inline">&gt;</span>
                <button
                  onClick={() => setDashboardViewLevel('machine_detail')}
                  className="text-slate-500 hover:text-emerald-600 dark:text-slate-400 dark:hover:text-emerald-400 font-medium transition-colors cursor-pointer"
                >
                  Máy {lines.flatMap((l) => l.machines || []).find((m) => m.id === selectedMachineId || m.code === selectedMachineId)?.code || selectedMachineId || 'OP50'}
                </button>
                <span className="text-slate-400 dark:text-slate-500">&gt;</span>
                <span className="font-bold text-blue-600 dark:text-blue-400">
                  CHECK SHEET
                </span>
              </>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-1.5">
            <span className="text-slate-500 dark:text-slate-400 font-medium">{group}</span>
            <span className="text-slate-400 dark:text-slate-500 font-normal">/</span>
            <span className="font-bold text-slate-900 dark:text-white">{page}</span>
          </div>
        )}
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

        {/* Nút Khôi phục Trạng thái Chuẩn khi có sự cố */}
        {isAdmin && isEmergencyActive && (
          <button
            type="button"
            onClick={handleRestoreEmergency}
            title="Khôi phục ngay toàn bộ máy và điểm an toàn về trạng thái chuẩn"
            className="flex items-center gap-1.5 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 active:scale-95 transition-all cursor-pointer shadow-xs animate-in fade-in"
          >
            <RotateCcw className="h-3.5 w-3.5 text-emerald-500" />
            <span className="hidden sm:inline">Khôi phục Sự cố</span>
            <span className="sm:hidden">Khôi phục</span>
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

        {/* User Profile Pill with Avatar (Chỉ hiển thị thông tin, không cho phép Upload đổi ảnh tại đây) */}
        <div
          className="flex items-center gap-2.5 rounded-full border border-slate-200 dark:border-factory-border bg-slate-100/80 dark:bg-factory-surface py-1 pl-1.5 pr-3 text-xs font-medium select-none shadow-xs"
        >
          <div className="relative h-7 w-7 rounded-full overflow-hidden bg-emerald-500 text-white font-bold flex items-center justify-center shrink-0 shadow-xs border border-white/40 dark:border-slate-700">
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
              <span className="text-[11px] font-bold">{initials}</span>
            )}
          </div>
          <span className="font-semibold text-slate-800 dark:text-slate-200 truncate max-w-[140px]">
            {displayName}
          </span>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 font-bold uppercase tracking-wider border border-emerald-500/20">
            {userRole}
          </span>
        </div>

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
