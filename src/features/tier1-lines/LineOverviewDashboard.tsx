/**
 * @file LineOverviewDashboard.tsx
 * @description Màn hình Dashboard Tổng Quan Nhà Máy: KPI thống kê toàn xưởng và Lưới thẻ Card Tầng 1 (Line)
 * Tối ưu hoàn hảo độ tương phản màu chữ cho cả Light Mode và Dark Mode
 */

import { Chip, Button } from '@heroui/react';
import { 
  ShieldCheck, 
  AlertOctagon, 
  Cpu, 
  Layers, 
  ArrowUpRight,
  TrendingUp,
  AlertCircle
} from 'lucide-react';
import { useMonitoringStore } from '../../stores/useMonitoringStore';
import { useAlarmStore } from '../../stores/useAlarmStore';
import { LineCard } from './LineCard';

export function LineOverviewDashboard() {
  const { lines, setActiveTab, setSelectedLineId } = useMonitoringStore();
  const { alarms } = useAlarmStore();

  // Tính toán các chỉ số KPI cấp nhà máy
  const totalLines = lines.length;
  const normalLines = lines.filter((l) => l.status === 'normal').length;
  const warningLines = lines.filter((l) => l.status === 'warning').length;
  const criticalLines = lines.filter((l) => l.status === 'critical').length;

  // Tính % an toàn trung bình toàn xưởng
  const avgSafetyScore =
    totalLines > 0
      ? Math.round(lines.reduce((acc, curr) => acc + curr.safetyScore, 0) / totalLines)
      : 100;

  // Tổng số máy con Tầng 2
  const totalMachines = lines.reduce((acc, curr) => acc + curr.machines.length, 0);

  // Tổng số sự cố chưa giải quyết
  const unresolvedAlarms = alarms.filter((a) => a.status !== 'resolved');

  // Sự cố khẩn cấp nhất (nếu có)
  const urgentCriticalAlarm = alarms.find(
    (a) => a.severity === 'critical' && a.status === 'pending'
  );

  return (
    <div className="space-y-6">
      {/* Banner Cảnh Báo Khẩn Cấp Nếu Có Sự Cố Critical Đang Chờ Xử Lý */}
      {urgentCriticalAlarm && (
        <div className="p-4 rounded-xl bg-gradient-to-r from-rose-950/80 to-red-900/60 border border-rose-500/80 shadow-lg shadow-rose-950/40 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 animate-alarm-blink">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-rose-500 text-white shrink-0 shadow-lg shadow-rose-500/50">
              <AlertOctagon className="w-6 h-6 animate-bounce" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm text-rose-200 uppercase tracking-wider">
                  Cảnh báo khẩn cấp toàn xưởng
                </span>
                <Chip size="sm" color="danger" variant="solid">
                  CRITICAL
                </Chip>
              </div>
              <p className="text-sm font-semibold text-white mt-0.5">
                {urgentCriticalAlarm.lineName} &bull; {urgentCriticalAlarm.machineName}: {urgentCriticalAlarm.message}
              </p>
            </div>
          </div>

          <Button
            size="sm"
            color="danger"
            variant="solid"
            className="font-bold shrink-0 self-end md:self-center shadow-lg"
            onPress={() => setActiveTab('alarms')}
          >
            Đến Nhật Ký Sự Cố
          </Button>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TOP KPI CARDS: CÁC THẺ THỐNG KÊ TỔNG QUAN TOÀN NHÀ MÁY                     */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 w-full overflow-hidden">
        {/* KPI 1: Điểm An Toàn Trung Bình Toàn Xưởng */}
        <div className="bg-emerald-50/80 dark:bg-emerald-950/20 border border-emerald-200/80 dark:border-emerald-800/30 p-5 rounded-2xl shadow-sm hover:shadow-md transition-all flex flex-col justify-between min-w-0">
          <div className="flex justify-between items-start gap-2">
            <div className="min-w-0">
              <p className="text-xs font-bold text-emerald-800 dark:text-emerald-300 uppercase tracking-wider truncate">
                Chỉ Số An Toàn Xưởng
              </p>
              <div className="flex items-baseline gap-2 mt-2">
                <span
                  className={`font-mono text-3xl sm:text-4xl font-black tracking-tight ${
                    avgSafetyScore >= 90
                      ? 'text-emerald-700 dark:text-emerald-400'
                      : avgSafetyScore >= 75
                      ? 'text-amber-700 dark:text-amber-400'
                      : 'text-rose-700 dark:text-rose-400'
                  }`}
                >
                  {avgSafetyScore}%
                </span>
                <span className="text-xs text-emerald-600/80 dark:text-emerald-400/80 font-bold">/ 100%</span>
              </div>
            </div>
            <div className="p-2.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-700 dark:text-emerald-400 shadow-xs shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-emerald-200/60 dark:border-emerald-800/30 flex items-center gap-1.5 text-xs text-emerald-800 dark:text-emerald-300">
            <TrendingUp className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span className="font-semibold truncate">Đạt chuẩn ISO/IATF 16949</span>
          </div>
        </div>

        {/* KPI 2: Phân Bổ Trạng Thái Dây Chuyền (Lines) */}
        <div className="bg-blue-50/80 dark:bg-blue-950/20 border border-blue-200/80 dark:border-blue-800/30 p-5 rounded-2xl shadow-sm hover:shadow-md transition-all flex flex-col justify-between min-w-0">
          <div className="flex justify-between items-start gap-2">
            <div className="min-w-0">
              <p className="text-xs font-bold text-blue-800 dark:text-blue-300 uppercase tracking-wider truncate">
                Dây Chuyền (Tầng 1)
              </p>
              <div className="flex items-baseline gap-2 mt-2">
                <span className="font-mono text-3xl sm:text-4xl font-black tracking-tight text-blue-800 dark:text-blue-300">
                  {totalLines}
                </span>
                <span className="text-xs text-blue-600/80 dark:text-blue-400/80 font-bold">Cụm sản xuất</span>
              </div>
            </div>
            <div className="p-2.5 rounded-xl bg-blue-500/15 border border-blue-500/30 text-blue-700 dark:text-blue-400 shadow-xs shrink-0">
              <Layers className="w-5 h-5" />
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-blue-200/60 dark:border-blue-800/30 flex items-center justify-between text-xs font-bold">
            <span className="text-emerald-700 dark:text-emerald-400">{normalLines} An toàn</span>
            <span className="text-amber-700 dark:text-amber-400">{warningLines} Cảnh báo</span>
            <span className="text-rose-700 dark:text-rose-400">{criticalLines} Nguy hiểm</span>
          </div>
        </div>

        {/* KPI 3: Tổng Số Thiết Bị Đang Giám Sát (Tầng 2) */}
        <div className="bg-indigo-50/80 dark:bg-indigo-950/20 border border-indigo-200/80 dark:border-indigo-800/30 p-5 rounded-2xl shadow-sm hover:shadow-md transition-all flex flex-col justify-between min-w-0">
          <div className="flex justify-between items-start gap-2">
            <div className="min-w-0">
              <p className="text-xs font-bold text-indigo-800 dark:text-indigo-300 uppercase tracking-wider truncate">
                Thiết Bị Giám Sát (Tầng 2)
              </p>
              <div className="flex items-baseline gap-2 mt-2">
                <span className="font-mono text-3xl sm:text-4xl font-black tracking-tight text-indigo-800 dark:text-indigo-300">
                  {totalMachines}
                </span>
                <span className="text-xs text-indigo-600/80 dark:text-indigo-400/80 font-bold">Máy thành phần</span>
              </div>
            </div>
            <div className="p-2.5 rounded-xl bg-indigo-500/15 border border-indigo-500/30 text-indigo-700 dark:text-indigo-400 shadow-xs shrink-0">
              <Cpu className="w-5 h-5" />
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-indigo-200/60 dark:border-indigo-800/30 flex items-center gap-1.5 text-xs text-indigo-800 dark:text-indigo-300 font-semibold">
            <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0"></span>
            <span className="truncate">100% tích hợp định danh mã QR</span>
          </div>
        </div>

        {/* KPI 4: Sự Cố Cần Tiếp Nhận / Xử Lý */}
        <div
          className={`p-5 rounded-2xl shadow-sm hover:shadow-md transition-all border flex flex-col justify-between min-w-0 ${
            unresolvedAlarms.length > 0
              ? 'bg-rose-50/80 dark:bg-rose-950/25 border-rose-200/80 dark:border-rose-800/35'
              : 'bg-emerald-50/80 dark:bg-emerald-950/20 border-emerald-200/80 dark:border-emerald-800/30'
          }`}
        >
          <div className="flex justify-between items-start gap-2">
            <div className="min-w-0">
              <p
                className={`text-xs font-bold uppercase tracking-wider truncate ${
                  unresolvedAlarms.length > 0
                    ? 'text-rose-800 dark:text-rose-300'
                    : 'text-emerald-800 dark:text-emerald-300'
                }`}
              >
                Sự Cố Cần Xử Lý
              </p>
              <div className="flex items-baseline gap-2 mt-2">
                <span
                  className={`font-mono text-3xl sm:text-4xl font-black tracking-tight ${
                    unresolvedAlarms.length > 0
                      ? 'text-rose-600 dark:text-rose-400 animate-pulse'
                      : 'text-emerald-700 dark:text-emerald-400'
                  }`}
                >
                  {unresolvedAlarms.length}
                </span>
                <span
                  className={`text-xs font-bold ${
                    unresolvedAlarms.length > 0
                      ? 'text-rose-600/80 dark:text-rose-400/80'
                      : 'text-emerald-600/80 dark:text-emerald-400/80'
                  }`}
                >
                  Sự cố đang mở
                </span>
              </div>
            </div>
            <div
              className={`p-2.5 rounded-xl border shadow-xs shrink-0 ${
                unresolvedAlarms.length > 0
                  ? 'bg-rose-500/15 border-rose-500/30 text-rose-600 dark:text-rose-400 animate-pulse'
                  : 'bg-emerald-500/15 border-emerald-500/30 text-emerald-700 dark:text-emerald-400'
              }`}
            >
              <AlertCircle className="w-5 h-5" />
            </div>
          </div>

          <div
            className={`mt-4 pt-3 border-t flex items-center justify-between text-xs ${
              unresolvedAlarms.length > 0
                ? 'border-rose-200/60 dark:border-rose-800/30 text-rose-800 dark:text-rose-300'
                : 'border-emerald-200/60 dark:border-emerald-800/30 text-emerald-800 dark:text-emerald-300'
            }`}
          >
            <span className="font-medium truncate">Quy trình: 3 bước</span>
            <button
              onClick={() => setActiveTab('alarms')}
              className="text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-0.5 font-bold cursor-pointer shrink-0"
            >
              Xem chi tiết <ArrowUpRight className="w-3 h-3" />
            </button>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* PHẦN CHÍNH: LƯỚI THẺ CARD TẦNG 1 (PRODUCTION LINES)                       */}
      {/* ========================================================================= */}
      <section className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-factory-border pb-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded text-xs font-bold bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30">
                TẦNG 1
              </span>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white tracking-wide">
                Các Dây Chuyền Sản Xuất (Production Lines)
              </h2>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
              Giám sát tổng quan chỉ số an toàn toàn dây chuyền và trạng thái thời gian thực.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="flat"
              color="primary"
              className="text-xs font-semibold"
              onPress={() => setActiveTab('lines')}
            >
              Xem Chi Tiết Máy (Tầng 2 & 3)
            </Button>
          </div>
        </div>

        {/* Lưới các Thẻ Card Tầng 1 */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {lines.map((line) => (
            <LineCard
              key={line.id}
              line={line}
              onViewDetails={(lineId) => {
                setSelectedLineId(lineId);
                setActiveTab('lines');
              }}
            />
          ))}
        </div>
      </section>
    </div>
  );
}
