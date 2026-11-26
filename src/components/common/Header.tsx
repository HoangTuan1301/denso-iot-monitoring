/**
 * @file Header.tsx
 * Chuẩn ảnh mẫu: Breadcrumb | Nút Giả lập Sự cố | Pill "Làm mới" | Pill "Quyền sửa" | Giờ | Nút Theme
 * Tương thích hoàn hảo Dark & Light Mode với độ tương phản cao
 */

import { lineDisplayName } from '../../config/lineDisplayName';
import { useState, useEffect } from "react";
import { Sun, Moon, RefreshCw, LogOut, Radio, Menu, Flame, RotateCcw, Pause, AlertOctagon } from "lucide-react";
import { apiClient } from "../../services/api";
import { requestProductionRefresh } from "../../utils/productionRefresh";
import { useUiStore, useIsDesktop } from "../../stores/useUiStore";
import { useMonitoringStore } from "../../stores/useMonitoringStore";
import { useAuthStore }       from "../../stores/useAuthStore";
import { useThemeStore }      from "../../stores/useThemeStore";
import { socketClient }       from "../../services/socket";
import { useTranslation }     from "react-i18next";
import { LanguageSwitcher }   from "./LanguageSwitcher";

/* ------------------------------------------------------------------ */
/* Bản đồ tiêu đề breadcrumb theo tab                                  */
/* ------------------------------------------------------------------ */
// group/page là key i18n (breadcrumb.* và nav.*)
const BREADCRUMBS: Record<string, { group: string; page: string }> = {
  dashboard:  { group: "breadcrumb.monitoring", page: "nav.dashboard" },
  devices:    { group: "breadcrumb.monitoring", page: "nav.devices" },
  lines:      { group: "breadcrumb.config",     page: "nav.lines" },
  metrics:    { group: "breadcrumb.config",     page: "nav.metrics" },
  thresholds: { group: "breadcrumb.config",     page: "nav.thresholds" },
  users:      { group: "breadcrumb.config",     page: "nav.users" },
  audit:      { group: "breadcrumb.config",     page: "nav.audit" },
  alarms:     { group: "breadcrumb.monitoring", page: "nav.alarms" },
  history:    { group: "breadcrumb.monitoring", page: "nav.history" },
  ai:         { group: "breadcrumb.monitoring", page: "nav.ai" },
  qr:         { group: "breadcrumb.utilities",  page: "nav.qr" },
  settings:   { group: "breadcrumb.config",     page: "nav.settings" },
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
    dashboardViewLevel,
    selectedLineId,
    selectedMachineId,
    lines,
    setDashboardViewLevel,
    setSelectedLineId,
    activeEmergencyMetricId,
    triggerEmergencyDemo,
    resetEmergencyDemo,
    setActiveTab,
  } = useMonitoringStore();
  const setMobileNavOpen = useUiStore((s) => s.setMobileNavOpen);
  const isDesktop = useIsDesktop();
  const { currentUser, logout, setAvatarUrl } = useAuthStore();
  const { theme, toggleTheme }  = useThemeStore();
  const { t }                   = useTranslation();

  const [timeStr, setTimeStr]       = useState("");
  const [isWsConnected, setIsWsConnected] = useState(false);
  const [pausedAt, setPausedAt] = useState<string | null>(null);
  const [serverEmergency, setServerEmergency] = useState(false);
  const [emgBusy, setEmgBusy] = useState(false);
  const [notice, setNotice] = useState<{ text: string; tone: "alarm" | "ok" } | null>(null);
  const isAdmin = (currentUser?.role || "").toUpperCase() === "ADMIN";
  const isEmergencyActive = serverEmergency || !!activeEmergencyMetricId;

  /* Trạng thái sự cố giả lập phía máy chủ (để mọi trang / mọi người dùng thấy cùng một sự cố) */
  useEffect(() => {
    let alive = true;
    const load = () =>
      apiClient
        .getEmergency()
        .then((r) => alive && setServerEmergency(!!r.emergency))
        .catch(() => {});
    load();
    const id = window.setInterval(load, 30_000);
    return () => {
      alive = false;
      window.clearInterval(id);
    };
  }, []);

  const flash = (text: string, tone: "alarm" | "ok", ms: number) => {
    setNotice({ text, tone });
    window.setTimeout(() => setNotice((n) => (n && n.text === text ? null : n)), ms);
  };

  /* Giả lập sự cố: chọn 1 line đang chạy tốt (hoặc line đang xem) → 1 máy vượt ngưỡng nguy hiểm */
  const handleTriggerEmergency = async () => {
    setEmgBusy(true);
    try {
      let target = selectedLineId || undefined;
      if (!target) {
        const ov = await apiClient.getProductionOverview().catch(() => null);
        const withMetrics = new Set(
          lines.filter((l) => l.machines.some((m) => m.metrics?.length && m.status !== "no_data")).map((l) => l.id)
        );
        const healthy = (ov?.lineStates || []).filter((x) => !x.virtual && x.productionStatus === "RUNNING" && withMetrics.has(x.lineId));
        const pool = healthy.length ? healthy.map((x) => x.lineId) : [...withMetrics];
        target = pool[Math.floor(Math.random() * pool.length)];
      }
      const info = triggerEmergencyDemo(target);
      if (!info) return;
      await apiClient
        .startEmergency({ lineId: info.lineId, lineCode: info.lineCode, machineId: info.machineId, machineName: info.machineName, metricName: info.metricName })
        .then(() => setServerEmergency(true))
        .catch(() => {});
      requestProductionRefresh();
      flash(
        t("header.emergencyNotice2", { line: lineDisplayName(info.lineCode, info.lineName), machine: info.machineName, metric: info.metricName, value: info.value, unit: info.unit }),
        "alarm",
        10000
      );
    } finally {
      setEmgBusy(false);
    }
  };

  const handleRestoreEmergency = async () => {
    setEmgBusy(true);
    try {
      resetEmergencyDemo();
      await apiClient.stopEmergency().catch(() => {});
      setServerEmergency(false);
      requestProductionRefresh();
      flash(t("header.restoredNotice"), "ok", 3500);
    } finally {
      setEmgBusy(false);
    }
  };

  /* Realtime: tạm dừng / tiếp tục toàn bộ cập nhật (thông số máy + sản lượng) */
  const handleToggleRealtime = () => {
    if (isRealtimeActive) {
      const d = new Date();
      setPausedAt(`${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`);
      toggleRealtime(false);
    } else {
      setPausedAt(null);
      toggleRealtime(true);
      simulateTick();
      requestProductionRefresh();
    }
  };

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
      ? { group: "breadcrumb.monitoring", page: "nav.devices" }
      : BREADCRUMBS[activeTab] ?? BREADCRUMBS.dashboard;
  const { group, page } = currentBreadcrumb;
  const userRole        = (currentUser?.role || "OPERATOR").toUpperCase();

  const displayName     = currentUser?.fullName || currentUser?.name || t("common.defaultUser");
  const initials        = displayName
    .split(" ")
    .filter(Boolean)
    .slice(-2)
    .map((w) => w[0])
    .join("")
    .toUpperCase() || "DN";

  return (
    <header className="relative flex h-[60px] shrink-0 items-center justify-between border-b border-factory-border bg-factory-card gap-2 px-3 sm:px-6 z-20">
      {notice && (
        <div
          role="status"
          className={`absolute top-[66px] right-6 z-50 flex items-center gap-2.5 rounded-xl px-4 py-2.5 shadow-2xl text-xs font-semibold text-white ${
            notice.tone === "alarm" ? "bg-gradient-to-r from-rose-600 to-red-600 shadow-rose-950/40" : "bg-emerald-600 shadow-emerald-950/30"
          }`}
        >
          {notice.tone === "alarm" && <AlertOctagon className="w-4 h-4 shrink-0 animate-bounce" />}
          <span
            onClick={() => notice.tone === "alarm" && setActiveTab("alarms")}
            className={notice.tone === "alarm" ? "cursor-pointer hover:underline" : ""}
          >
            {notice.text}
          </span>
          {notice.tone === "alarm" && isAdmin && (
            <button
              type="button"
              onClick={handleRestoreEmergency}
              className="ml-2 px-2.5 py-1 rounded-lg bg-white/20 hover:bg-white/30 text-white text-[11px] font-bold cursor-pointer"
            >
              {t("header.restoreNow")}
            </button>
          )}
        </div>
      )}

      {/* ---- Nút mở menu (điện thoại / máy tính bảng) ---- */}
      <button
        type="button"
        onClick={() => setMobileNavOpen(true)}
        aria-label={t("nav.openMenu")}
        className="lg:hidden flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 dark:border-factory-border bg-slate-100 dark:bg-factory-surface text-slate-700 dark:text-slate-200 cursor-pointer"
      >
        <Menu className="h-4.5 w-4.5" />
      </button>

      {/* ---- Góc trái: Breadcrumb phân tầng thông minh ---- */}
      <div className="flex min-w-0 flex-1 items-center gap-1.5 overflow-hidden whitespace-nowrap text-xs sm:text-sm select-none">
        {activeTab === 'dashboard' && dashboardViewLevel !== 'factory_layout' ? (
          <div className="flex items-center gap-1.5 whitespace-nowrap">
            <button
              onClick={() => {
                setDashboardViewLevel('factory_layout');
                setSelectedLineId(null);
              }}
              className="text-slate-500 hover:text-emerald-600 dark:text-slate-400 dark:hover:text-emerald-400 font-medium transition-colors cursor-pointer"
            >
              {t("nav.dashboard")}
            </button>

            <span className="text-slate-400 dark:text-slate-500">&gt;</span>

            {dashboardViewLevel === 'line_overview' && (
              <span className="font-bold text-slate-900 dark:text-white">
                {t("breadcrumb.line", { code: (() => { const c = lines.find((l) => l.id === selectedLineId || l.code === selectedLineId)?.code || selectedLineId || 'LN-PRS-01'; return lineDisplayName(c); })() })}
              </span>
            )}

            {dashboardViewLevel === 'machine_detail' && (
              <>
                <button
                  onClick={() => setDashboardViewLevel('line_overview')}
                  className="text-slate-500 hover:text-emerald-600 dark:text-slate-400 dark:hover:text-emerald-400 font-medium transition-colors cursor-pointer"
                >
                  {t("breadcrumb.line", { code: (() => { const c = lines.find((l) => l.id === selectedLineId || l.code === selectedLineId)?.code || selectedLineId || 'LN-PRS-01'; return lineDisplayName(c); })() })}
                </button>
                <span className="text-slate-400 dark:text-slate-500">&gt;</span>
                <span className="font-bold text-slate-900 dark:text-white">
                  {t("breadcrumb.machine", { code: lines.flatMap((l) => l.machines || []).find((m) => m.id === selectedMachineId || m.code === selectedMachineId)?.code || selectedMachineId || 'OP50' })}
                </span>
              </>
            )}

            {dashboardViewLevel === 'check_sheet' && (
              <>
                <button
                  onClick={() => setDashboardViewLevel('line_overview')}
                  className="text-slate-500 hover:text-emerald-600 dark:text-slate-400 dark:hover:text-emerald-400 font-medium transition-colors cursor-pointer hidden md:inline"
                >
                  {t("breadcrumb.line", { code: (() => { const c = lines.find((l) => l.id === selectedLineId || l.code === selectedLineId)?.code || selectedLineId || 'LN-PRS-01'; return lineDisplayName(c); })() })}
                </button>
                <span className="text-slate-400 dark:text-slate-500 hidden md:inline">&gt;</span>
                <button
                  onClick={() => setDashboardViewLevel('machine_detail')}
                  className="text-slate-500 hover:text-emerald-600 dark:text-slate-400 dark:hover:text-emerald-400 font-medium transition-colors cursor-pointer"
                >
                  {t("breadcrumb.machine", { code: lines.flatMap((l) => l.machines || []).find((m) => m.id === selectedMachineId || m.code === selectedMachineId)?.code || selectedMachineId || 'OP50' })}
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
            <span className="text-slate-500 dark:text-slate-400 font-medium">{t(group)}</span>
            <span className="text-slate-400 dark:text-slate-500 font-normal">/</span>
            <span className="font-bold text-slate-900 dark:text-white">{t(page)}</span>
          </div>
        )}
      </div>

      {/* ---- Góc phải: các pill & nút ---- */}
      <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">

        {/* Nút Giả lập sự cố (chỉ Admin) – bấm lần nữa để khôi phục */}
        {isAdmin &&
          (isEmergencyActive ? (
            <button
              type="button"
              onClick={handleRestoreEmergency}
              disabled={emgBusy}
              title={t("header.restoreTitle")}
              className="flex shrink-0 whitespace-nowrap items-center gap-1.5 rounded-full border border-emerald-500/50 bg-emerald-500/10 px-3 py-1 text-xs font-bold text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/20 active:scale-95 transition-all cursor-pointer disabled:opacity-60"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{t("header.restoreIncident")}</span>
              <span className="sm:hidden">{t("header.restore")}</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={handleTriggerEmergency}
              disabled={emgBusy}
              title={t("header.emergencyTitle")}
              className="flex shrink-0 whitespace-nowrap items-center gap-1.5 rounded-full border border-rose-500/40 bg-rose-500/10 px-3 py-1 text-xs font-bold text-rose-600 dark:text-rose-400 hover:bg-rose-500/20 active:scale-95 transition-all cursor-pointer disabled:opacity-60"
            >
              <Flame className="h-3.5 w-3.5 text-rose-500 animate-pulse" />
              <span className="hidden sm:inline">{t("header.emergency")}</span>
              <span className="sm:hidden">{t("header.emergencyShort")}</span>
            </button>
          ))}

        {/* Realtime = Stream + WS gộp lại: trạng thái kết nối + bấm để tạm dừng / tiếp tục mọi cập nhật */}
        <button
          type="button"
          onClick={handleToggleRealtime}
          aria-pressed={isRealtimeActive}
          title={
            isRealtimeActive
              ? `${isWsConnected ? t("header.rtLiveTitle") : t("header.rtReconnectTitle")} ${t("header.rtClickPause")}`
              : t("header.rtPausedTitle", { time: pausedAt || "" })
          }
          className={[
            "hidden md:flex shrink-0 whitespace-nowrap items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold transition-colors cursor-pointer",
            !isRealtimeActive
              ? "border-slate-300 dark:border-factory-border bg-slate-100 dark:bg-factory-surface text-slate-600 dark:text-slate-400 hover:border-slate-400"
              : isWsConnected
                ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/20"
                : "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400 hover:bg-amber-500/20",
          ].join(" ")}
        >
          {isRealtimeActive ? (
            <span className={["h-1.5 w-1.5 rounded-full", isWsConnected ? "bg-emerald-500 animate-pulse" : "bg-amber-500"].join(" ")} />
          ) : (
            <Pause className="h-3 w-3" />
          )}
          <Radio className="h-3 w-3 shrink-0" />
          <span>
            {!isRealtimeActive
              ? t("header.rtPaused", { time: pausedAt || "" })
              : isWsConnected
                ? t("header.rtLive")
                : t("header.rtReconnecting")}
          </span>
        </button>

        {/* Chọn ngôn ngữ VI / EN / 日本語 */}
        <LanguageSwitcher compact={!isDesktop} />

        {/* User Profile Pill with Avatar (Chỉ hiển thị thông tin, không cho phép Upload đổi ảnh tại đây) */}
        <div
          className="flex shrink-0 items-center gap-2.5 rounded-full border border-slate-200 dark:border-factory-border bg-slate-100/80 dark:bg-factory-surface p-0.5 md:py-1 md:pl-1.5 md:pr-3 text-xs font-medium select-none shadow-xs"
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
          <span className="hidden md:inline font-semibold text-slate-800 dark:text-slate-200 truncate max-w-[140px]">
            {displayName}
          </span>
          <span className="hidden md:inline text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 font-bold uppercase tracking-wider border border-emerald-500/20">
            {userRole}
          </span>
        </div>

        {/* Đồng hồ */}
        <span className="hidden lg:block text-xs font-mono text-slate-600 dark:text-slate-400 tabular-nums min-w-[60px] text-right font-medium">
          {timeStr}
        </span>

        {/* Divider */}
        <div className="hidden sm:block h-5 w-px bg-slate-200 dark:bg-factory-border" />

        {/* Refresh thủ công */}
        <button
          onClick={() => {
            simulateTick();
            requestProductionRefresh();
          }}
          title={t("header.refreshTitle")}
          className="hidden sm:flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 dark:border-factory-border bg-slate-100 dark:bg-factory-surface text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:border-slate-400 transition-colors cursor-pointer"
        >
          <RefreshCw className="h-3.5 w-3.5" />
        </button>

        {/* Nút Theme — Mặt trời / Mặt trăng */}
        <button
          onClick={toggleTheme}
          title={theme === "dark" ? t("header.toLight") : t("header.toDark")}
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
          title={t("header.logout")}
          className="flex h-8 w-8 items-center justify-center rounded-full border border-rose-200 dark:border-rose-900/40 bg-rose-50 dark:bg-rose-950/20 text-rose-600 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-900/30 transition-colors cursor-pointer"
        >
          <LogOut className="h-3.5 w-3.5" />
        </button>
      </div>
    </header>
  );
}
