/**
 * @file AIPredictiveMaintenanceTab.tsx
 * @description Tab 3 Redesign: Maintenance Priority Dashboard
 * - Thiết kế tối giản, ưu tiên hiển thị thông tin quan trọng trước
 * - Chi tiết kỹ thuật và dụng cụ đưa vào accordion mở rộng
 * - Loại bỏ các đoạn văn dài dòng không cần thiết
 */

import React, { useMemo, useState } from 'react';
import {
  Wrench,
  AlertOctagon,
  AlertTriangle,
  Clock,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Calendar,
} from 'lucide-react';
import { useAIStore } from '../stores/useAIStore';
import {
  computeAllEquipmentHealth,
  generatePredictiveOrders,
} from '../simulation/aiSimulationEngine';
import { MaintenancePriority } from '../types/ai';

interface AIPredictiveMaintenanceTabProps {
  machines: any[];
}

export const AIPredictiveMaintenanceTab: React.FC<AIPredictiveMaintenanceTabProps> = ({
  machines,
}) => {
  const {
    activeScenarioId,
    isDemoActive,
    orderStatusOverrides,
    updateOrderStatus,
  } = useAIStore();

  const [expandedOrderIds, setExpandedOrderIds] = useState<Set<string>>(new Set());

  const toggleExpand = (id: string) => {
    setExpandedOrderIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Tạo danh sách lệnh bảo trì từ engine
  const orders = useMemo(() => {
    const healthList = computeAllEquipmentHealth(machines, activeScenarioId, isDemoActive);
    const rawOrders = generatePredictiveOrders(healthList, activeScenarioId, isDemoActive);
    return rawOrders.map((o) => {
      const override = orderStatusOverrides[o.id];
      if (override) {
        return { ...o, status: override };
      }
      return o;
    });
  }, [activeScenarioId, isDemoActive, machines, orderStatusOverrides]);

  // Thống kê tổng quan
  const stats = useMemo(() => {
    const p1Count = orders.filter((o) => o.priority === 'P1_CRITICAL').length;
    const p2Count = orders.filter((o) => o.priority === 'P2_HIGH').length;
    const totalHours = orders.reduce((sum, o) => sum + o.estimatedWorkHours, 0);
    const completedCount = orders.filter((o) => o.status === 'COMPLETED').length;

    return { p1Count, p2Count, totalHours, completedCount, total: orders.length };
  }, [orders]);

  const getPriorityBadge = (priority: MaintenancePriority) => {
    switch (priority) {
      case 'P1_CRITICAL':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-bold bg-rose-100 text-rose-700 dark:bg-rose-950/70 dark:text-rose-400">
            <AlertOctagon className="w-3.5 h-3.5" /> P1 - Khẩn cấp
          </span>
        );
      case 'P2_HIGH':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/70 dark:text-amber-400">
            <AlertTriangle className="w-3.5 h-3.5" /> P2 - Ưu tiên cao
          </span>
        );
      case 'P3_MEDIUM':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-semibold bg-blue-100 text-blue-800 dark:bg-blue-950/70 dark:text-blue-400">
            P3 - Trung bình
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-400">
            <CheckCircle2 className="w-3.5 h-3.5" /> P4 - Định kỳ
          </span>
        );
    }
  };

  return (
    <div className="space-y-4">
      {/* 1. KPI Toolbar (4 Thẻ gọn) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {/* P1 Urgent */}
        <div className="bg-white dark:bg-slate-800 p-3.5 rounded-xl border border-slate-200/90 dark:border-slate-700/70 shadow-xs">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Khẩn cấp (P1)</span>
            <AlertOctagon className="w-4 h-4 text-rose-500" />
          </div>
          <div className="mt-1 text-2xl font-bold text-rose-600 dark:text-rose-400">
            {stats.p1Count} <span className="text-xs font-normal text-slate-400">phiếu</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Cần can thiệp dưới 6h</p>
        </div>

        {/* P2 High Priority */}
        <div className="bg-white dark:bg-slate-800 p-3.5 rounded-xl border border-slate-200/90 dark:border-slate-700/70 shadow-xs">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Ưu tiên cao (P2)</span>
            <AlertTriangle className="w-4 h-4 text-amber-500" />
          </div>
          <div className="mt-1 text-2xl font-bold text-amber-600 dark:text-amber-400">
            {stats.p2Count} <span className="text-xs font-normal text-slate-400">phiếu</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Xử lý trong ca làm việc</p>
        </div>

        {/* Estimated Work Hours */}
        <div className="bg-white dark:bg-slate-800 p-3.5 rounded-xl border border-slate-200/90 dark:border-slate-700/70 shadow-xs">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Ước tính giờ công</span>
            <Clock className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="mt-1 text-2xl font-bold text-slate-900 dark:text-slate-100">
            {stats.totalHours.toFixed(1)} <span className="text-xs font-normal text-slate-400">giờ</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Cho {stats.total} đầu việc</p>
        </div>

        {/* Completion Progress */}
        <div className="bg-white dark:bg-slate-800 p-3.5 rounded-xl border border-slate-200/90 dark:border-slate-700/70 shadow-xs">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Tiến độ hoàn thành</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="mt-1 text-2xl font-bold text-emerald-600 dark:text-emerald-400">
            {stats.completedCount} / {stats.total}
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Phiếu đã nghiệm thu</p>
        </div>
      </div>

      {/* 2. Priority Maintenance Orders Dashboard */}
      <div className="space-y-3">
        {orders.map((order) => {
          const isExpanded = expandedOrderIds.has(order.id);

          return (
            <div
              key={order.id}
              className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200/90 dark:border-slate-700/70 shadow-xs overflow-hidden transition-all"
            >
              {/* Primary Header Row */}
              <div className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-slate-800">
                <div className="flex items-center gap-3">
                  {getPriorityBadge(order.priority)}
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                        {order.machineCode} — {order.machineName}
                      </h4>
                      <span className="text-xs px-2 py-0.2 rounded bg-slate-100 dark:bg-slate-700 font-semibold text-slate-700 dark:text-slate-300">
                        Sức khỏe: {order.healthScore}/100
                      </span>
                    </div>
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                      Dây chuyền: {order.lineName} • Cụm: <strong className="text-slate-700 dark:text-slate-300">{order.component}</strong>
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-auto">
                  {/* Status Switcher */}
                  <select
                    aria-label="Cập nhật trạng thái phiếu"
                    value={order.status}
                    onChange={(e) => updateOrderStatus(order.id, e.target.value as any)}
                    className="text-xs font-semibold px-2.5 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 cursor-pointer focus:outline-none"
                  >
                    <option value="PENDING">Chờ tiếp nhận</option>
                    <option value="IN_PROGRESS">Đang xử lý</option>
                    <option value="COMPLETED">Đã hoàn thành</option>
                  </select>

                  {/* Expand button */}
                  <button
                    onClick={() => toggleExpand(order.id)}
                    className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-colors"
                    title="Mở rộng chi tiết"
                  >
                    {isExpanded ? (
                      <ChevronUp className="w-4 h-4" />
                    ) : (
                      <ChevronDown className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              {/* Core Essential Information (3 items) */}
              <div className="px-4 pb-3 grid grid-cols-1 md:grid-cols-3 gap-3 text-xs border-t border-slate-100 dark:border-slate-700/40 pt-2.5">
                <div>
                  <span className="text-slate-400 font-medium">Triệu chứng quan trắc:</span>
                  <p className="text-slate-800 dark:text-slate-200 font-semibold mt-0.5">
                    {order.symptom}
                  </p>
                </div>

                <div>
                  <span className="text-slate-400 font-medium">Nguyên nhân nghi ngờ (Root Cause):</span>
                  <p className="text-slate-800 dark:text-slate-200 mt-0.5">
                    {order.rootCause}
                  </p>
                </div>

                <div>
                  <span className="text-slate-400 font-medium">Đề xuất kiểm tra & xử lý:</span>
                  <p className="text-emerald-700 dark:text-emerald-400 font-semibold mt-0.5">
                    {order.recommendedAction}
                  </p>
                </div>
              </div>

              {/* Accordion / Collapsible Expanded Drawer */}
              {isExpanded && (
                <div className="px-4 py-3 bg-slate-50 dark:bg-slate-900/50 border-t border-slate-200/80 dark:border-slate-700/60 text-xs grid grid-cols-1 md:grid-cols-3 gap-3 animate-in fade-in duration-150">
                  <div>
                    <span className="text-slate-400 font-medium flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-rose-500" /> Dự báo thời gian suy thoái:
                    </span>
                    <span className="font-bold text-rose-600 dark:text-rose-400 mt-1 block">
                      {order.estimatedTimeToDegrade}
                    </span>
                  </div>

                  <div>
                    <span className="text-slate-400 font-medium flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5 text-blue-500" /> Thời lượng bảo dưỡng:
                    </span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200 mt-1 block">
                      {order.estimatedWorkHours} giờ công kỹ thuật
                    </span>
                  </div>

                  <div>
                    <span className="text-slate-400 font-medium flex items-center gap-1">
                      <Wrench className="w-3.5 h-3.5 text-emerald-600" /> Dụng cụ cần chuẩn bị:
                    </span>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {order.suggestedTools.map((tool, idx) => (
                        <span
                          key={idx}
                          className="px-2 py-0.5 rounded text-[11px] font-medium bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300"
                        >
                          {tool}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {orders.length === 0 && (
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700/70 p-10 text-center text-xs text-slate-400">
            Không có phiếu công tác bảo trì nào cần lập trong kịch bản này.
          </div>
        )}
      </div>
    </div>
  );
};
