/**
 * @file Sidebar.tsx
 * Chuẩn 100% ảnh mẫu: Logo xanh lá • Nhóm CẤU HÌNH / GIÁM SÁT •
 * Badge đỏ Alert • flex-row items-center gap-3 mọi item • Tương thích hoàn hảo Dark & Light Mode
 */

import {
  LayoutDashboard,
  BrainCircuit,
  GitBranch,
  Bell,
  ArrowLeftRight,
  Users,
  Cpu,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  History,
  Gauge,
} from "lucide-react";
import { Tooltip } from "./Tooltip";
import { useMonitoringStore, NavigationTab } from "../../stores/useMonitoringStore";
import { useAlarmStore } from "../../stores/useAlarmStore";
import { useAuthStore } from "../../stores/useAuthStore";
import { useState, useEffect } from "react";
import { X } from "lucide-react";
import { useUiStore, useIsDesktop } from "../../stores/useUiStore";
import { useTranslation } from "react-i18next";

interface NavItem {
  id: NavigationTab;
  label: string;
  group: 'config' | 'monitoring';
  icon: typeof LayoutDashboard;
  badgeCount?: number;
}

/* ------------------------------------------------------------------ */
/* Sidebar Component                                                    */
/* ------------------------------------------------------------------ */
export function Sidebar() {
  const { activeTab, activeNavGroup, setActiveTab } = useMonitoringStore();
  const { alarms }                  = useAlarmStore();
  const { currentUser }             = useAuthStore();
  const [collapsedPref, setCollapsed] = useState(false);
  const isDesktop                   = useIsDesktop();
  const { mobileNavOpen, setMobileNavOpen } = useUiStore();
  // Trên điện thoại/máy tính bảng menu luôn hiển thị đầy đủ trong drawer
  const collapsed                   = isDesktop && collapsedPref;

  // Đóng drawer khi chuyển lên màn hình lớn; khóa cuộn nền khi drawer mở
  useEffect(() => {
    if (isDesktop && mobileNavOpen) setMobileNavOpen(false);
  }, [isDesktop, mobileNavOpen, setMobileNavOpen]);
  useEffect(() => {
    if (isDesktop || !mobileNavOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMobileNavOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isDesktop, mobileNavOpen, setMobileNavOpen]);
  const { t }                       = useTranslation();

  const pendingCount = alarms.filter((a) => a.status !== "resolved").length;
  const userRole     = (currentUser?.role || "OPERATOR").toUpperCase();
  const isAdmin      = userRole === "ADMIN";
  const isMaintenance= userRole === "MAINTENANCE";

  /* -------- Danh sách menu theo phân quyền RBAC -------- */
  const configItems: NavItem[] = [];

  if (isAdmin || isMaintenance) {
    configItems.push({ id: "lines", group: "config", label: t("nav.lines"), icon: GitBranch });
    configItems.push({ id: "metrics", group: "config", label: t("nav.metrics"), icon: Gauge });
    configItems.push({ id: "thresholds", group: "config", label: t("nav.thresholds"), icon: ArrowLeftRight });
  }

  if (isAdmin) {
    configItems.push({ id: "users", group: "config", label: t("nav.users"), icon: Users });
  }

  if (isAdmin || isMaintenance) {
    configItems.push({ id: "audit", group: "config", label: t("nav.audit"), icon: ShieldCheck });
  }

  const monitoringItems: NavItem[] = [
    { id: "dashboard",  group: "monitoring", label: t("nav.dashboard"), icon: LayoutDashboard },
    { id: "devices",    group: "monitoring", label: t("nav.devices"), icon: Cpu },
    { id: "alarms",     group: "monitoring", label: t("nav.alarms"), icon: Bell, badgeCount: pendingCount },
    { id: "history",    group: "monitoring", label: t("nav.history"), icon: History },
    { id: "ai",         group: "monitoring", label: t("nav.ai"), icon: BrainCircuit },
  ];

  /* -------- Render 1 button menu -------- */
  const NavBtn = ({ item }: { item: NavItem }) => {
    const Icon     = item.icon;
    const isActive =
      item.id === "devices"
        ? activeTab === "devices" || (activeTab === "lines" && activeNavGroup === "monitoring")
        : item.id === "lines"
        ? activeTab === "lines" && activeNavGroup === item.group
        : activeTab === item.id;
    const hasBadge = (item.badgeCount ?? 0) > 0;

    const inner = (
      <button
        onClick={() => { setActiveTab(item.id, item.group); setMobileNavOpen(false); }}
        className={[
          // === layout ===
          "w-full flex flex-row items-center gap-3 rounded-xl",
          "h-10 text-sm font-medium select-none cursor-pointer",
          "transition-colors duration-150",
          collapsed ? "justify-center px-2" : "justify-start px-3",
          // === màu trạng thái: tương thích Dark & Light Mode ===
          isActive
            ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-semibold"
            : "text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5",
        ].join(" ")}
      >
        {/* Icon — cố định kích thước, không bị đẩy */}
        <Icon
          className={[
            "h-[18px] w-[18px] shrink-0",
            isActive
              ? "text-emerald-600 dark:text-emerald-400 stroke-[2.2]"
              : "text-slate-500 dark:text-slate-400 stroke-[1.8]",
          ].join(" ")}
        />

        {/* Label — chỉ hiện khi mở rộng (line-height chuẩn tránh cắt nét g, y, p, q và dấu tiếng Việt) */}
        {!collapsed && (
          <span className="flex-1 truncate text-left leading-normal py-0.5 font-medium">
            {item.label}
          </span>
        )}

        {/* Badge đỏ số alert — chỉ hiện khi mở rộng */}
        {!collapsed && hasBadge && (
          <span className="ml-auto flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white leading-none shrink-0 shadow-xs">
            {item.badgeCount}
          </span>
        )}
      </button>
    );

    return collapsed ? (
      <Tooltip key={item.label} content={item.label} placement="right">
        {inner}
      </Tooltip>
    ) : (
      <div key={item.label}>{inner}</div>
    );
  };

  /* -------- Render nhóm (header + danh sách) -------- */
  const NavGroup = ({
    title,
    items,
  }: {
    title: string;
    items: NavItem[];
  }) => (
    <div className="space-y-1">
      {!collapsed && (
        <p className="mb-1.5 px-3 text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 leading-normal py-0.5">
          {title}
        </p>
      )}
      {items.map((item) => (
        <NavBtn key={`${item.group}-${item.id}-${item.label}`} item={item} />
      ))}
    </div>
  );

  /* -------- JSX -------- */
  return (
    <>
    {/* Lớp nền mờ phía sau drawer (điện thoại) */}
    {!isDesktop && mobileNavOpen && (
      <div
        className="fixed inset-0 z-40 bg-slate-950/50 backdrop-blur-[1px]"
        onClick={() => setMobileNavOpen(false)}
        aria-hidden="true"
      />
    )}
    <aside
      aria-hidden={!isDesktop && !mobileNavOpen ? true : undefined}
      className={[
        "flex flex-col justify-between shrink-0 select-none overflow-y-auto",
        "border-r border-factory-sidebarBorder bg-factory-sidebar",
        isDesktop
          ? ["relative z-30 transition-[width] duration-300 ease-in-out", collapsed ? "w-[72px]" : "w-64"].join(" ")
          : ["fixed inset-y-0 left-0 z-50 w-72 max-w-[85vw] shadow-2xl transition-transform duration-300 ease-in-out",
             mobileNavOpen ? "translate-x-0" : "-translate-x-full"].join(" "),
      ].join(" ")}
    >
      {/* -------- ĐỈNH: Logo + toggle -------- */}
      <div>
        <div className="flex h-[60px] items-center justify-between border-b border-factory-sidebarBorder px-3.5">
          {/* Logo & Tên trung tâm */}
          {!collapsed ? (
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white dark:bg-slate-900 border border-red-500/30 shadow-sm shadow-red-500/10">
                <span className="font-black italic text-xl tracking-tighter text-[#E60012] select-none leading-none pr-0.5">
                  D
                </span>
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-slate-800 dark:text-white truncate leading-tight tracking-tight">
                  DENSO IoT System
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
                  {t("common.appSubtitle")}
                </p>
              </div>
            </div>
          ) : (
            <Tooltip content={`DENSO IoT System • ${t("common.appSubtitle")}`} placement="right">
              <div className="mx-auto flex h-9 w-9 items-center justify-center rounded-xl bg-white dark:bg-slate-900 border border-red-500/30 shadow-sm shadow-red-500/10">
                <span className="font-black italic text-xl tracking-tighter text-[#E60012] select-none leading-none pr-0.5">
                  D
                </span>
              </div>
            </Tooltip>
          )}

          {/* Nút Toggle thu gọn/mở rộng */}
          <Tooltip content={collapsed ? t("nav.expand") : t("nav.collapse")} placement={collapsed ? "right" : "bottom"}>
            <button
              onClick={() => (isDesktop ? setCollapsed(!collapsedPref) : setMobileNavOpen(false))}
              aria-label="Toggle Sidebar"
              className={[
                "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg cursor-pointer",
                "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10 transition-colors",
                collapsed ? "absolute -right-3 top-4 bg-factory-card border border-factory-border shadow-sm rounded-full h-6 w-6 z-40" : "ml-1",
              ].join(" ")}
            >
              {!isDesktop ? (
                <X className="h-4 w-4" />
              ) : collapsed ? (
                <ChevronRight className="h-3.5 w-3.5" />
              ) : (
                <ChevronLeft className="h-4 w-4" />
              )}
            </button>
          </Tooltip>
        </div>

        {/* -------- MENU NHÓM -------- */}
        <nav className="px-3 py-5 space-y-6">
          <NavGroup title={t("nav.groupMonitoring")} items={monitoringItems} />
          {configItems.length > 0 && (
            <NavGroup title={t("nav.groupConfig")} items={configItems} />
          )}
        </nav>
      </div>
    </aside>
    </>
  );
}
