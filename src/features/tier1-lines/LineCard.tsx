/**
 * @file LineCard.tsx
 * @description Thẻ Card hiển thị Tầng 1 (Luồng / Dây chuyền sản xuất)
 * Tích hợp Chip màu báo trạng thái, % chỉ số an toàn toàn dây chuyền và liên kết tới Tầng 2
 * Hỗ trợ độ tương phản sắc nét ở cả Light Mode và Dark Mode
 */

import { Progress } from '@heroui/react';
import { 
  ShieldCheck, 
  AlertTriangle, 
  AlertOctagon, 
  Layers, 
  Clock, 
  ArrowRight,
  Activity
} from 'lucide-react';
import { ProductionLine } from '../../types/hierarchy';
import { useMonitoringStore } from '../../stores/useMonitoringStore';

interface LineCardProps {
  line: ProductionLine;
  onViewDetails?: (lineId: string) => void;
}

export function LineCard({ line, onViewDetails }: LineCardProps) {
  const { setSelectedLineId, setActiveTab } = useMonitoringStore();

  const isCritical = line.status === 'critical';
  const isWarning = line.status === 'warning';

  // Định cấu hình màu sắc trạng thái
  const statusColor = isCritical ? 'danger' : isWarning ? 'warning' : 'success';

  const statusLabel = isCritical
    ? 'Nguy hiểm'
    : isWarning
    ? 'Cảnh báo'
    : 'Bình thường';

  const StatusIcon = isCritical
    ? AlertOctagon
    : isWarning
    ? AlertTriangle
    : ShieldCheck;

  // Thống kê trạng thái các máy con (Tầng 2)
  const totalMachines = line.machines.length;
  const normalMachines = line.machines.filter((m) => m.status === 'normal').length;
  const warningMachines = line.machines.filter((m) => m.status === 'warning').length;
  const criticalMachines = line.machines.filter((m) => m.status === 'critical').length;

  const handleDrillDown = () => {
    setSelectedLineId(line.id);
    if (onViewDetails) {
      onViewDetails(line.id);
    } else {
      setActiveTab('lines');
    }
  };

  return (
    <div
      className={`flex flex-col justify-between h-full relative overflow-hidden bg-factory-card border transition-all duration-300 hover:shadow-xl rounded-2xl ${
        isCritical
          ? 'border-rose-500/60 shadow-rose-950/20'
          : isWarning
          ? 'border-amber-500/50 shadow-amber-950/10'
          : 'border-factory-border hover:border-slate-400 dark:hover:border-gray-600'
      }`}
    >
      {/* Vạch màu định danh trên cùng của Card */}
      <div
        className={`h-1.5 w-full shrink-0 ${
          isCritical
            ? 'bg-gradient-to-r from-rose-600 to-red-500 animate-alarm-blink'
            : isWarning
            ? 'bg-gradient-to-r from-amber-500 to-yellow-400'
            : 'bg-gradient-to-r from-emerald-500 to-teal-400'
        }`}
      />

      {/* Header của Line Card */}
      <div className="flex justify-between items-start p-5 pb-3 shrink-0">
        <div className="space-y-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono text-xs font-bold px-2.5 py-0.5 rounded-lg bg-slate-100 dark:bg-factory-bg border border-slate-200 dark:border-factory-border text-blue-600 dark:text-blue-400 shrink-0">
              {line.code}
            </span>

            {/* Badge Mức Độ Đậm Nổi Bật */}
            {isCritical ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-600 text-white shadow-xs tracking-wide animate-pulse shrink-0">
                <StatusIcon className="w-3.5 h-3.5" />
                <span>{statusLabel}</span>
              </span>
            ) : isWarning ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-500 text-white shadow-xs tracking-wide shrink-0">
                <StatusIcon className="w-3.5 h-3.5" />
                <span>{statusLabel}</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-600 text-white shadow-xs tracking-wide shrink-0">
                <StatusIcon className="w-3.5 h-3.5" />
                <span>{statusLabel}</span>
              </span>
            )}
          </div>
          <h3 className="text-base font-bold text-slate-900 dark:text-white tracking-wide mt-2 truncate">
            {line.name}
          </h3>
        </div>

        {/* Biểu tượng phân tầng Tầng 1 */}
        <div className="p-2 rounded-xl bg-slate-100 dark:bg-factory-bg border border-slate-200 dark:border-factory-border/80 text-slate-500 dark:text-gray-400 shrink-0">
          <Activity className="w-5 h-5 text-blue-500 dark:text-blue-400" />
        </div>
      </div>

      {/* Body của Line Card */}
      <div className="p-5 pt-1 space-y-4 flex-1 flex flex-col justify-between">
        {/* Mô tả dây chuyền: cố định đúng 2 dòng không xô lệch */}
        <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-2 h-10 text-ellipsis overflow-hidden leading-relaxed">
          {line.description || 'Dây chuyền sản xuất tự động tích hợp giám sát PLC.'}
        </p>

        {/* Thanh % Chỉ số an toàn toàn dây chuyền (Safety Score) */}
        <div className="space-y-1.5 bg-slate-50 dark:bg-factory-bg/70 p-3 rounded-xl border border-slate-200 dark:border-factory-border/60">
          <div className="flex justify-between items-center text-xs">
            <span className="text-slate-700 dark:text-gray-300 font-semibold">Chỉ số An Toàn Toàn Line</span>
            <span
              className={`font-mono font-bold text-sm ${
                line.safetyScore >= 90
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : line.safetyScore >= 75
                  ? 'text-amber-600 dark:text-amber-400'
                  : 'text-rose-600 dark:text-rose-400'
              }`}
            >
              {line.safetyScore}%
            </span>
          </div>
          <Progress
            size="md"
            radius="full"
            value={line.safetyScore}
            color={statusColor}
            aria-label={`Safety score for ${line.name}`}
            className="w-full"
          />
        </div>

        {/* Phân rã trạng thái các máy thành phần (Card nhỏ THIẾT BỊ & VẬN HÀNH) */}
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="flex items-center gap-2 p-2.5 rounded-lg bg-slate-50 dark:bg-factory-bg/40 border border-slate-200 dark:border-factory-border/50">
            <Layers className="w-4 h-4 text-blue-500 dark:text-blue-400 shrink-0" />
            <div className="min-w-0">
              <p className="text-[10px] text-slate-600 dark:text-slate-400 uppercase font-bold tracking-wider truncate">
                Thiết Bị (Tầng 2)
              </p>
              <p className="font-mono font-bold text-slate-900 dark:text-white mt-0.5 truncate">
                {totalMachines} Máy
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 p-2.5 rounded-lg bg-slate-50 dark:bg-factory-bg/40 border border-slate-200 dark:border-factory-border/50">
            <Clock className="w-4 h-4 text-emerald-500 dark:text-emerald-400 shrink-0" />
            <div className="min-w-0">
              <p className="text-[10px] text-slate-600 dark:text-slate-400 uppercase font-bold tracking-wider truncate">
                Vận Hành
              </p>
              <p className="font-mono font-bold text-slate-900 dark:text-white mt-0.5 truncate">
                {line.operatingHours}h liên tục
              </p>
            </div>
          </div>
        </div>

        {/* Tình trạng máy móc dạng Badges Pill + Progress Bar liền mạch */}
        <div className="space-y-2 pt-1">
          <div className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-400 font-semibold">
            <span>Tình trạng máy móc:</span>
          </div>

          {/* Badges dạng Pill */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-300/80 dark:border-emerald-800/40">
              <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
              <span>{normalMachines} OK</span>
            </span>

            {warningMachines > 0 && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-300/80 dark:border-amber-800/40">
                <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" />
                <span>{warningMachines} Cảnh báo</span>
              </span>
            )}

            {criticalMachines > 0 && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-300/80 dark:border-rose-800/40 animate-pulse">
                <span className="w-2 h-2 rounded-full bg-rose-500 shrink-0" />
                <span>{criticalMachines} Nguy hiểm</span>
              </span>
            )}
          </div>

          {/* Progress bar liền mạch */}
          <div className="h-2 w-full rounded-full bg-slate-200 dark:bg-slate-700/80 overflow-hidden flex shadow-inner">
            {normalMachines > 0 && (
              <div
                style={{ width: `${(normalMachines / totalMachines) * 100}%` }}
                className="h-full bg-emerald-500 transition-all duration-300"
                title={`${normalMachines} Máy OK`}
              />
            )}
            {warningMachines > 0 && (
              <div
                style={{ width: `${(warningMachines / totalMachines) * 100}%` }}
                className="h-full bg-amber-500 transition-all duration-300"
                title={`${warningMachines} Máy Cảnh báo`}
              />
            )}
            {criticalMachines > 0 && (
              <div
                style={{ width: `${(criticalMachines / totalMachines) * 100}%` }}
                className="h-full bg-rose-600 animate-pulse transition-all duration-300"
                title={`${criticalMachines} Máy Nguy hiểm`}
              />
            )}
          </div>
        </div>
      </div>

      {/* Chân Card luôn cố định chiều cao h-14, flex justify-between và hiển thị rõ ràng */}
      <div className="mt-auto h-14 shrink-0 px-4 border-t border-slate-200/80 dark:border-factory-border/60 flex justify-between items-center bg-slate-50/60 dark:bg-factory-bg/40">
        <span className="text-[11px] text-slate-500 dark:text-slate-400 font-mono font-bold">
          ID: {line.id}
        </span>
        <button
          type="button"
          onClick={handleDrillDown}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-500/15 hover:bg-emerald-500/25 cursor-pointer transition-colors shrink-0"
        >
          <span>Chi Tiết Máy & Chỉ Số</span>
          <ArrowRight className="w-4 h-4 shrink-0" />
        </button>
      </div>
    </div>
  );
}
