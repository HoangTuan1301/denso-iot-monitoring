/**
 * @file AIPredictiveMaintenanceTab.tsx
 * @description Tab 3: Dự đoán Bảo trì (AI Predictive Maintenance)
 * Chuẩn thiết kế tham chiếu Image 3 (media_1794454583471_b12a5595.jpg).
 * 
 * TÍNH NĂNG CHÍNH:
 * 1. 5 Thẻ KPI: Tổng khuyến nghị bảo trì, Ưu tiên cao (P1), Ưu tiên trung bình (P2), Ưu tiên thấp (P3), Định kỳ (P4).
 * 2. Bộ lọc tương tác: Chọn Dây chuyền, Mức ưu tiên, Trạng thái và Tìm kiếm theo tên / mã máy.
 * 3. Danh sách khuyến nghị bảo trì trực quan: Hình ảnh máy, Badge ưu tiên, Thanh tiến độ độ tin cậy AI,
 *    Triệu chứng phát hiện, Nguyên nhân nghi ngờ, Khuyến nghị xử lý, Phụ trách, Hạn xử lý và Trạng thái.
 * 4. Đồng bộ tức thời khi có sự cố giả lập từ Header: Tự động nâng cấp phiếu khẩn cấp P1.
 */

import React, { useMemo, useState } from 'react';
import {
  Wrench,
  AlertOctagon,
  AlertTriangle,
  Info,
  Calendar,
  ClipboardList,
  Search,
  User,
  Activity,
  Settings,
  TrendingUp,
  Clock,
  CheckCircle2,
  MoreHorizontal,
} from 'lucide-react';
import { AIPredictiveOrder, MaintenancePriority } from '../types/ai';
import { AIProcessedMachine } from '../adapters/aiTelemetryAdapter';

interface AIPredictiveMaintenanceTabProps {
  allMachines?: AIProcessedMachine[];
  orders: AIPredictiveOrder[];
  onSelectMachine?: (machineId: string) => void;
  onNavigateToTab?: (tab: 'overview' | 'anomaly' | 'predictive' | 'assistant') => void;
}

export const AIPredictiveMaintenanceTab: React.FC<AIPredictiveMaintenanceTabProps> = ({
  allMachines: _allMachines = [],
  orders,
  onSelectMachine,
  onNavigateToTab,
}) => {
  const [lineFilter, setLineFilter] = useState<string>('ALL');
  const [priorityFilter, setPriorityFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [activeMenuOrderId, setActiveMenuOrderId] = useState<string | null>(null);

  // Thống kê 5 thẻ KPI
  const stats = useMemo(() => {
    const total = orders.length;
    const p1Count = orders.filter((o) => o.priority === 'P1_CRITICAL').length;
    const p2Count = orders.filter((o) => o.priority === 'P2_HIGH').length;
    const p3Count = orders.filter((o) => o.priority === 'P3_MEDIUM').length;
    const p4Count = orders.filter((o) => o.priority === 'P4_ROUTINE').length;

    return { total, p1Count, p2Count, p3Count, p4Count };
  }, [orders]);

  // Lọc danh sách theo filter bar
  const filteredOrders = useMemo(() => {
    return orders.filter((order) => {
      // Lọc dây chuyền
      if (lineFilter !== 'ALL' && !order.lineName.toLowerCase().includes(lineFilter.toLowerCase())) {
        return false;
      }
      // Lọc mức ưu tiên
      if (priorityFilter !== 'ALL' && order.priority !== priorityFilter) {
        return false;
      }
      // Lọc trạng thái
      if (statusFilter !== 'ALL' && order.status !== statusFilter) {
        return false;
      }
      // Tìm kiếm từ khóa
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchCode = order.machineCode.toLowerCase().includes(q);
        const matchName = order.machineName.toLowerCase().includes(q);
        const matchSymptom = order.symptom.toLowerCase().includes(q);
        if (!matchCode && !matchName && !matchSymptom) return false;
      }
      return true;
    });
  }, [orders, lineFilter, priorityFilter, statusFilter, searchQuery]);

  // Render badge mức ưu tiên
  const renderPriorityBadge = (priority: MaintenancePriority) => {
    switch (priority) {
      case 'P1_CRITICAL':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-rose-500 text-white shadow-2xs">
            P1 - Khẩn cấp
          </span>
        );
      case 'P2_HIGH':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-amber-500 text-white shadow-2xs">
            P2 - Ưu tiên cao
          </span>
        );
      case 'P3_MEDIUM':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-sky-500 text-white shadow-2xs">
            P3 - Theo dõi
          </span>
        );
      case 'P4_ROUTINE':
      default:
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-500 text-white shadow-2xs">
            P4 - Định kỳ
          </span>
        );
    }
  };

  // Render pill trạng thái
  const renderStatusPill = (status: string) => {
    switch (status) {
      case 'IN_PROGRESS':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-sky-50 text-sky-700 dark:bg-sky-950/60 dark:text-sky-300 border border-sky-200 dark:border-sky-800">
            <span className="w-2 h-2 rounded-full bg-sky-500 animate-pulse" />
            Đang triển khai
          </span>
        );
      case 'PLANNED':
      case 'COMPLETED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            Đã lên kế hoạch
          </span>
        );
      case 'PENDING':
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
            <Clock className="w-3.5 h-3.5 text-rose-500" />
            Chờ xử lý
          </span>
        );
    }
  };

  return (
    <div className="space-y-4">
      {/* ========================================================================= */}
      {/* THÔNG TIN MINH BẠCH DỰ ĐOÁN BẢO TRÌ & CÁCH LY AN TOÀN                     */}
      {/* ========================================================================= */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 px-4 py-2.5 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 shadow-2xs">
        <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
          <Info className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
          <span className="font-medium">
            Đánh giá sức khỏe thiết bị thời gian thực, phát hiện dị biệt và đề xuất kế hoạch bảo trì dự đoán.
          </span>
        </div>
        <div className="flex items-center gap-2 text-[11px]">
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 font-semibold">
            Mô phỏng an toàn — Cách ly với CSDL &amp; PLC vật lý
          </span>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 1. KHỐI 5 THẺ TỔNG QUAN KPI (Tham chiếu Image 3)                           */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
        {/* Card 1: Tổng khuyến nghị */}
        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200/90 dark:border-slate-700/80 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Tổng khuyến nghị bảo trì
            </span>
            <div className="mt-1 flex items-baseline gap-1.5">
              <span className="text-2xl font-black text-slate-900 dark:text-slate-100 tracking-tight">
                {stats.total}
              </span>
              <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">công việc</span>
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center border border-emerald-200/80 dark:border-emerald-800/60 shrink-0">
            <ClipboardList className="w-5 h-5" />
          </div>
        </div>

        {/* Card 2: Ưu tiên cao P1 */}
        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200/90 dark:border-slate-700/80 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Ưu tiên cao (P1)
            </span>
            <div className="mt-1 flex items-baseline gap-1.5">
              <span className="text-2xl font-black text-rose-600 dark:text-rose-400 tracking-tight">
                {stats.p1Count}
              </span>
              <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">công việc</span>
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 flex items-center justify-center border border-rose-200/80 dark:border-rose-800/60 shrink-0">
            <AlertOctagon className="w-5 h-5" />
          </div>
        </div>

        {/* Card 3: Ưu tiên trung bình P2 */}
        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200/90 dark:border-slate-700/80 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Ưu tiên trung bình (P2)
            </span>
            <div className="mt-1 flex items-baseline gap-1.5">
              <span className="text-2xl font-black text-amber-500 dark:text-amber-400 tracking-tight">
                {stats.p2Count}
              </span>
              <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">công việc</span>
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-950/50 text-amber-500 dark:text-amber-400 flex items-center justify-center border border-amber-200/80 dark:border-amber-800/60 shrink-0">
            <AlertTriangle className="w-5 h-5" />
          </div>
        </div>

        {/* Card 4: Ưu tiên thấp P3 */}
        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200/90 dark:border-slate-700/80 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Ưu tiên thấp (P3)
            </span>
            <div className="mt-1 flex items-baseline gap-1.5">
              <span className="text-2xl font-black text-sky-600 dark:text-sky-400 tracking-tight">
                {stats.p3Count}
              </span>
              <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">công việc</span>
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-sky-50 dark:bg-sky-950/50 text-sky-600 dark:text-sky-400 flex items-center justify-center border border-sky-200/80 dark:border-sky-800/60 shrink-0">
            <Info className="w-5 h-5" />
          </div>
        </div>

        {/* Card 5: Định kỳ P4 */}
        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200/90 dark:border-slate-700/80 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Định kỳ (P4)
            </span>
            <div className="mt-1 flex items-baseline gap-1.5">
              <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400 tracking-tight">
                {stats.p4Count}
              </span>
              <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">công việc</span>
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center border border-emerald-200/80 dark:border-emerald-800/60 shrink-0">
            <Calendar className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. KHUNG DANH SÁCH KHUYẾN NGHỊ BẢO TRÌ (Tham chiếu Image 3)               */}
      {/* ========================================================================= */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200/90 dark:border-slate-700/80 shadow-xs overflow-hidden">
        {/* Header Khối & Thanh Công Cụ Bộ Lọc */}
        <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-700/70 flex flex-col xl:flex-row xl:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400 flex items-center justify-center border border-emerald-200 dark:border-emerald-800 shrink-0 mt-0.5">
              <Wrench className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                Danh sách Khuyến nghị Bảo trì Dự đoán
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Các công việc bảo trì được AI phân tích và đề xuất dựa trên dữ liệu vận hành, xu hướng và bất thường.
              </p>
            </div>
          </div>

          {/* Nhóm bộ lọc (4 bộ điều khiển) */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Lọc dây chuyền */}
            <select
              aria-label="Lọc theo dây chuyền"
              value={lineFilter}
              onChange={(e) => setLineFilter(e.target.value)}
              className="text-xs font-medium px-3 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-1 focus:ring-emerald-500 cursor-pointer"
            >
              <option value="ALL">Tất cả dây chuyền</option>
              <option value="Dập & Hàn">Dập & Hàn Khung Gầm</option>
              <option value="Gia công cơ khí">Gia công cơ khí</option>
              <option value="Tiện ích">Tiện ích (Utility)</option>
            </select>

            {/* Lọc mức ưu tiên */}
            <select
              aria-label="Lọc theo mức ưu tiên"
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className="text-xs font-medium px-3 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-1 focus:ring-emerald-500 cursor-pointer"
            >
              <option value="ALL">Tất cả mức ưu tiên</option>
              <option value="P1_CRITICAL">P1 - Khẩn cấp</option>
              <option value="P2_HIGH">P2 - Ưu tiên cao</option>
              <option value="P3_MEDIUM">P3 - Theo dõi</option>
              <option value="P4_ROUTINE">P4 - Định kỳ</option>
            </select>

            {/* Lọc trạng thái */}
            <select
              aria-label="Lọc theo trạng thái"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="text-xs font-medium px-3 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-1 focus:ring-emerald-500 cursor-pointer"
            >
              <option value="ALL">Tất cả trạng thái</option>
              <option value="PENDING">Chờ xử lý</option>
              <option value="IN_PROGRESS">Đang triển khai</option>
              <option value="PLANNED">Đã lên kế hoạch</option>
            </select>

            {/* Ô tìm kiếm */}
            <div className="relative min-w-[200px]">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Tìm theo mã, tên máy..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>
          </div>
        </div>

        {/* Danh sách các dòng phiếu công việc */}
        <div className="divide-y divide-slate-100 dark:divide-slate-700/50">
          {filteredOrders.map((order) => {
            const confidence = order.confidence || 90;

            return (
              <div
                key={order.id}
                className="p-4 sm:p-5 hover:bg-slate-50/70 dark:hover:bg-slate-750 transition-colors flex flex-col xl:flex-row xl:items-center justify-between gap-4"
              >
                {/* Cột 1 & 2: Ảnh máy + Tên máy + Mức ưu tiên & Độ tin cậy */}
                <div className="flex items-start gap-3.5 min-w-[280px]">
                  {/* Thumbnail máy */}
                  <div className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-slate-700/60 border border-slate-200 dark:border-slate-600 flex items-center justify-center shrink-0 overflow-hidden p-1 shadow-2xs">
                    <img
                      src={order.imageUrl || '/images/machines/ROB-01.png'}
                      alt={order.machineName}
                      className="w-full h-full object-contain"
                      onError={(e) => {
                        // Fallback icon nếu ảnh lỗi
                        (e.target as HTMLElement).style.display = 'none';
                      }}
                    />
                  </div>

                  <div>
                    <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100 leading-snug">
                      {order.machineName}
                    </h4>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                      Mã máy: <span className="font-semibold text-slate-700 dark:text-slate-300">{order.machineCode}</span>
                    </p>
                    <p className="text-[11px] text-slate-400">
                      Dây chuyền: {order.lineName}
                    </p>

                    {/* Mức ưu tiên & Độ tin cậy AI */}
                    <div className="mt-2 flex items-center gap-2">
                      {renderPriorityBadge(order.priority)}
                      <div className="flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400">
                        <span>Độ tin cậy:</span>
                        <span className="font-bold text-slate-800 dark:text-slate-200">{confidence}%</span>
                      </div>
                    </div>
                    {/* Mini progress bar độ tin cậy */}
                    <div className="w-32 h-1 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden mt-1">
                      <div
                        className="h-full bg-cyan-500 rounded-full transition-all"
                        style={{ width: `${confidence}%` }}
                      />
                    </div>
                  </div>
                </div>

                {/* Cột 3, 4, 5: Triệu chứng, Nguyên nhân, Đề xuất xử lý */}
                <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-3.5 text-xs">
                  {/* Triệu chứng phát hiện */}
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5 text-[11px] font-semibold text-sky-600 dark:text-sky-400">
                      <Activity className="w-3.5 h-3.5" />
                      <span>Triệu chứng phát hiện</span>
                    </div>
                    <p className="text-slate-800 dark:text-slate-200 text-xs leading-relaxed font-medium">
                      {order.symptom}
                    </p>
                  </div>

                  {/* Nguyên nhân nghi ngờ */}
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                      <Settings className="w-3.5 h-3.5" />
                      <span>Nguyên nhân nghi ngờ</span>
                    </div>
                    <p className="text-slate-600 dark:text-slate-300 text-xs leading-relaxed">
                      {order.rootCause}
                    </p>
                  </div>

                  {/* Khuyến nghị xử lý */}
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                      <TrendingUp className="w-3.5 h-3.5" />
                      <span>Khuyến nghị xử lý</span>
                    </div>
                    <p className="text-emerald-800 dark:text-emerald-300 text-xs leading-relaxed font-medium">
                      {order.recommendedAction}
                    </p>
                  </div>
                </div>

                {/* Cột 6: Phụ trách & Hạn xử lý */}
                <div className="min-w-[150px] space-y-1 text-xs border-t xl:border-t-0 pt-2 xl:pt-0 border-slate-100 dark:border-slate-700/60">
                  <div className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300">
                    <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span>Phụ trách: <strong>{order.assignee || 'Trần Văn Minh'}</strong></span>
                  </div>
                  <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400 text-[11px]">
                    <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span>Hạn xử lý: <strong>{order.dueDate || 'Hôm nay, 17:00'}</strong></span>
                  </div>
                </div>

                {/* Cột 7: Status pill & Thao tác */}
                <div className="flex items-center justify-between xl:justify-end gap-3 shrink-0">
                  {renderStatusPill(order.status)}

                  {/* Nút 3 chấm thao tác */}
                  <div className="relative">
                    <button
                      onClick={() => setActiveMenuOrderId(activeMenuOrderId === order.id ? null : order.id)}
                      className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-300 transition-colors"
                      title="Tùy chọn bổ sung"
                    >
                      <MoreHorizontal className="w-4 h-4" />
                    </button>

                    {/* Dropdown menu */}
                    {activeMenuOrderId === order.id && (
                      <div className="absolute right-0 mt-1 w-44 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-lg py-1 z-20 text-xs">
                        <button
                          onClick={() => {
                            if (onSelectMachine) onSelectMachine(order.machineId);
                            if (onNavigateToTab) onNavigateToTab('anomaly');
                            setActiveMenuOrderId(null);
                          }}
                          className="w-full text-left px-3 py-1.5 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300"
                        >
                          Xem phân tích dị biệt
                        </button>
                        <button
                          onClick={() => {
                            if (onSelectMachine) onSelectMachine(order.machineId);
                            if (onNavigateToTab) onNavigateToTab('assistant');
                            setActiveMenuOrderId(null);
                          }}
                          className="w-full text-left px-3 py-1.5 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300"
                        >
                          Hỏi trợ lý AI KaiLink
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}

          {filteredOrders.length === 0 && (
            <div className="p-12 text-center text-slate-400 text-xs">
              <ClipboardList className="w-8 h-8 mx-auto mb-2 opacity-50" />
              Không tìm thấy khuyến nghị bảo trì nào phù hợp với bộ lọc hiện tại.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
