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
  Camera,
} from "lucide-react";
import { Tooltip } from "@heroui/react";
import { useMonitoringStore, NavigationTab } from "../../stores/useMonitoringStore";
import { useAlarmStore } from "../../stores/useAlarmStore";
import { useAuthStore } from "../../stores/useAuthStore";
import { useState, useRef, useEffect } from "react";

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
  const { currentUser, uploadAvatar } = useAuthStore();
  const [collapsed, setCollapsed]   = useState(false);
  const [topImgError, setTopImgError] = useState(false);
  const [bottomImgError, setBottomImgError] = useState(false);
  const fileInputRef                = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setTopImgError(false);
    setBottomImgError(false);
  }, [currentUser?.avatarUrl]);

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

  /* -------- Avatar initials từ tên -------- */
  const displayName = currentUser?.fullName || currentUser?.name || "Người dùng";
  const firstLetter = (displayName.trim()[0] || "U").toUpperCase();
  const initials = displayName
    .split(" ")
    .filter(Boolean)
    .slice(-2)
    .map((w) => w[0])
    .join("")
    .toUpperCase() || "DN";

  const userRoleUpper = (currentUser?.role || "OPERATOR").toUpperCase();
  const roleLabel =
    userRoleUpper === "ADMIN"
      ? "Quản trị viên (Admin)"
      : userRoleUpper === "MAINTENANCE"
      ? "Kỹ thuật bảo trì"
      : "Vận hành viên (Operator)";

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
              <div className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full overflow-hidden bg-emerald-500 text-white font-bold text-base shadow-md shadow-emerald-500/25 border border-emerald-400/30">
                {currentUser?.avatarUrl && !topImgError ? (
                  <img
                    src={currentUser.avatarUrl}
                    alt={displayName}
                    className="h-full w-full object-cover"
                    onError={() => setTopImgError(true)}
                  />
                ) : (
                  <span>{firstLetter}</span>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-slate-900 dark:text-white truncate leading-tight tracking-tight">
                  Admin Monitoring
                </p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                  Trung tâm phân tích
                </p>
              </div>
            </div>
          ) : (
            <Tooltip content={`Admin Monitoring • ${displayName}`} placement="right">
              <div className="mx-auto relative flex h-9 w-9 items-center justify-center rounded-full overflow-hidden bg-emerald-500 text-white font-bold text-base shadow-md shadow-emerald-500/25 border border-emerald-400/30">
                {currentUser?.avatarUrl && !topImgError ? (
                  <img
                    src={currentUser.avatarUrl}
                    alt={displayName}
                    className="h-full w-full object-cover"
                    onError={() => setTopImgError(true)}
                  />
                ) : (
                  <span>{firstLetter}</span>
                )}
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

      {/* -------- ĐÁY: User Profile Card (hiển thị rõ cả Dark & Light Mode) -------- */}
      <div className="border-t border-factory-sidebarBorder p-3">
        {collapsed ? (
          <Tooltip
            content={`${displayName} ${currentUser?.employeeId ? `(${currentUser.employeeId})` : ""} • ${roleLabel}`}
            placement="right"
          >
            <div className="flex items-center justify-center rounded-xl p-2 transition-colors bg-slate-100/90 dark:bg-white/5 hover:bg-slate-200/80 dark:hover:bg-white/10 border border-slate-200/70 dark:border-white/5">
              {/* Avatar (Bấm vào để đổi ảnh) */}
              <div
                onClick={() => fileInputRef.current?.click()}
                title="Bấm để tải lên và thay đổi ảnh đại diện"
                className="group relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full overflow-hidden bg-emerald-500 text-white text-xs font-bold shadow-sm cursor-pointer border border-emerald-400/40 hover:opacity-90 transition-opacity"
              >
                {currentUser?.avatarUrl && !bottomImgError ? (
                  <img
                    src={currentUser.avatarUrl}
                    alt={displayName}
                    className="h-full w-full object-cover"
                    onError={() => setBottomImgError(true)}
                  />
                ) : (
                  <span>{initials}</span>
                )}
                <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity rounded-full">
                  <Camera className="w-3.5 h-3.5 text-white" />
                </div>
              </div>
            </div>
          </Tooltip>
        ) : (
          <div className="flex items-center gap-2.5 rounded-xl p-2.5 transition-colors bg-slate-100/90 dark:bg-white/5 hover:bg-slate-200/80 dark:hover:bg-white/10 border border-slate-200/70 dark:border-white/5">
            {/* Avatar (Bấm vào để đổi ảnh) */}
            <div
              onClick={() => fileInputRef.current?.click()}
              title="Bấm để tải lên và thay đổi ảnh đại diện"
              className="group relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full overflow-hidden bg-emerald-500 text-white text-xs font-bold shadow-sm cursor-pointer border border-emerald-400/40 hover:opacity-90 transition-opacity"
            >
              {currentUser?.avatarUrl && !bottomImgError ? (
                <img
                  src={currentUser.avatarUrl}
                  alt={displayName}
                  className="h-full w-full object-cover"
                  onError={() => setBottomImgError(true)}
                />
              ) : (
                <span>{initials}</span>
              )}
              <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity rounded-full">
                <Camera className="w-3.5 h-3.5 text-white" />
              </div>
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-1.5">
                <p
                  className="text-xs font-bold text-slate-900 dark:text-white truncate leading-tight"
                  title={displayName}
                >
                  {displayName}
                </p>
                {currentUser?.employeeId && (
                  <span className="shrink-0 text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/10 dark:bg-emerald-400/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20 font-bold">
                    {currentUser.employeeId}
                  </span>
                )}
              </div>
              <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold truncate mt-1">
                {roleLabel}
              </p>
            </div>
          </div>
        )}

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
      </div>
    </aside>
  );
}
