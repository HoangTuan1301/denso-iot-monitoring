/**
 * @file Sidebar.tsx
 * Chuẩn 100% ảnh mẫu: Logo xanh lá • Nhóm CẤU HÌNH / GIÁM SÁT •
 * Badge đỏ Alert • flex-row items-center gap-3 mọi item • Tương thích hoàn hảo Dark & Light Mode
 */

import {
  LayoutDashboard,
  GitBranch,
  Bell,
  ArrowLeftRight,
  Users,
  Cpu,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
} from "lucide-react";
import { Tooltip } from "@heroui/react";
import { useMonitoringStore, NavigationTab } from "../../stores/useMonitoringStore";
import { useAlarmStore } from "../../stores/useAlarmStore";
import { useAuthStore } from "../../stores/useAuthStore";
import { useState } from "react";

interface NavItem {
  id: NavigationTab;
  label: string;
  icon: typeof LayoutDashboard;
  badgeCount?: number;
}

/* ------------------------------------------------------------------ */
/* Sidebar Component                                                    */
/* ------------------------------------------------------------------ */
export function Sidebar() {
  const { activeTab, setActiveTab } = useMonitoringStore();
  const { alarms }                  = useAlarmStore();
  const { currentUser }             = useAuthStore();
  const [collapsed, setCollapsed]   = useState(false);

  const pendingCount = alarms.filter((a) => a.status !== "resolved").length;
  const userRole     = (currentUser?.role || "OPERATOR").toUpperCase();
  const isAdmin      = userRole === "ADMIN";
  const isMaintenance= userRole === "MAINTENANCE";

  /* -------- Danh sách menu theo phân quyền RBAC -------- */
  const configItems: NavItem[] = [
    { id: "lines", label: "Luồng & Thành phần", icon: GitBranch },
  ];

  if (isAdmin || isMaintenance) {
    configItems.push({ id: "thresholds", label: "Mapping & Ngưỡng", icon: ArrowLeftRight });
  }

  if (isAdmin) {
    configItems.push({ id: "users", label: "Quản lý Người dùng", icon: Users });
  }

  if (isAdmin || isMaintenance) {
    configItems.push({ id: "audit", label: "Nhật ký Audit", icon: ShieldCheck });
  }

  const monitoringItems: NavItem[] = [
    { id: "dashboard",  label: "Dashboard Tổng quan", icon: LayoutDashboard },
    { id: "lines",      label: "Chi tiết Component",  icon: Cpu },
    { id: "alarms",     label: "Danh sách Alert",     icon: Bell, badgeCount: pendingCount },
  ];

  /* -------- Render 1 button menu -------- */
  const NavBtn = ({ item }: { item: NavItem }) => {
    const Icon     = item.icon;
    const isActive = activeTab === item.id;
    const hasBadge = (item.badgeCount ?? 0) > 0;

    const inner = (
      <button
        onClick={() => setActiveTab(item.id)}
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

        {/* Label — chỉ hiện khi mở rộng */}
        {!collapsed && (
          <span className="flex-1 truncate text-left leading-none font-medium">
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
        <p className="mb-1.5 px-3 text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">
          {title}
        </p>
      )}
      {items.map((item) => (
        <NavBtn key={`${item.id}-${item.label}`} item={item} />
      ))}
    </div>
  );

  /* -------- JSX -------- */
  return (
    <aside
      className={[
        "relative flex flex-col justify-between z-30 shrink-0 select-none",
        "border-r border-factory-sidebarBorder bg-factory-sidebar",
        "transition-[width] duration-300 ease-in-out",
        collapsed ? "w-[72px]" : "w-64",
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
                  Hệ Thống Giám Sát
                </p>
              </div>
            </div>
          ) : (
            <Tooltip content="DENSO IoT System • Hệ Thống Giám Sát" placement="right">
              <div className="mx-auto flex h-9 w-9 items-center justify-center rounded-xl bg-white dark:bg-slate-900 border border-red-500/30 shadow-sm shadow-red-500/10">
                <span className="font-black italic text-xl tracking-tighter text-[#E60012] select-none leading-none pr-0.5">
                  D
                </span>
              </div>
            </Tooltip>
          )}

          {/* Nút Toggle thu gọn/mở rộng */}
          <button
            onClick={() => setCollapsed(!collapsed)}
            aria-label="Toggle Sidebar"
            className={[
              "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg cursor-pointer",
              "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10 transition-colors",
              collapsed ? "absolute -right-3 top-4 bg-factory-card border border-factory-border shadow-sm rounded-full h-6 w-6 z-40" : "ml-1",
            ].join(" ")}
          >
            {collapsed ? (
              <ChevronRight className="h-3.5 w-3.5" />
            ) : (
              <ChevronLeft className="h-4 w-4" />
            )}
          </button>
        </div>

        {/* -------- MENU NHÓM -------- */}
        <nav className="px-3 py-5 space-y-6">
          <NavGroup title="Cấu hình" items={configItems} />
          <NavGroup title="Giám sát" items={monitoringItems} />
        </nav>
      </div>
    </aside>
  );
}
