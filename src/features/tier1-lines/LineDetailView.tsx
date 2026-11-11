/**
 * @file LineDetailView.tsx
 * @description Màn hình 2: Line Overview – Giám sát và hiệu suất dây chuyền DENSO Smart Factory
 * - Tái hiện chuẩn xác theo hình ảnh tham chiếu công nghiệp mới nhất của DENSO
 * - Bố cục Hàng 1 (Tổng quan): [Trạng thái dây chuyền] [OEE dạng Donut] [Line Health] [Sản lượng hôm nay]
 * - Bố cục Hàng 2: [Availability] [Performance] [Quality]
 * - Sơ đồ dây chuyền OP10–OP60 hiển thị đầy đủ 6 công đoạn trên desktop không bị cuộn ngang, bỏ hoàn toàn AGV
 * - Đồng bộ màu Trạng thái dây chuyền: CRITICAL/ERROR (đỏ), WARNING (vàng/cam), RUNNING/NORMAL (xanh lá)
 * - Đồng bộ màu Line Health (khiên và chữ) theo hàm phân loại tập trung getHealthScoreColor
 * - Chuẩn hóa bộ đếm card Cảnh báo & Sự cố khớp chính xác số phần tử hiển thị
 * - Hàng dưới: [Trạng thái thiết bị dạng Donut] và [Bảng thông số vận hành chính]
 * - Xóa bỏ hoàn toàn biểu đồ xu hướng theo giờ và ô mã dây chuyền lặp lại
 */

import { useState, useMemo } from 'react';
import {
  ArrowLeft,
  Activity,
  ShieldCheck,
  Cpu,
  AlertTriangle,
  CheckCircle2,
  ArrowRight,
  BrainCircuit,
  Gauge,
  Thermometer,
  Zap,
  RefreshCw,
  Calendar,
  Award,
  Factory,
  PlayCircle,
  StopCircle,
  Clock,
  Layers,
  Box,
} from 'lucide-react';
import { ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { useMonitoringStore } from '../../stores/useMonitoringStore';
import { useAlarmStore } from '../../stores/useAlarmStore';
import { getHealthScoreColor } from '../dashboard/factoryMapConfig';
import { resolveMachineMonitoringState } from '../../utils/machineStatusResolver';
import { MachineImage } from '../../config/machineImages';
import { Line1PhotorealisticView } from './Line1PhotorealisticView';
import { Line2PhotorealisticView } from './Line2PhotorealisticView';
import { Line3PhotorealisticView } from './Line3PhotorealisticView';
import { Line3DView } from './3d/Line3DView';

interface LineDetailViewProps {
  lineId: string;
  onBackToDashboard: () => void;
  onSelectMachine: (machineId: string) => void;
}

export function LineDetailView({
  lineId,
  onBackToDashboard,
  onSelectMachine,
}: LineDetailViewProps) {
  const { lines, isLoadingLines } = useMonitoringStore();
  const { alarms } = useAlarmStore();

  // Tìm dây chuyền hiện tại theo ID hoặc Code
  const currentLine = useMemo(() => {
    return (
      lines.find((l) => l.id === lineId || l.code === lineId || String(l.id) === String(lineId)) ||
      lines[0] ||
      null
    );
  }, [lines, lineId]);

  // Nhận diện Line 1 (LN-PRS-01) để kích hoạt chế độ xem 3D chuyên biệt
  const isLine1 = useMemo(() => {
    return (
      lineId === 'LN-PRS-01' ||
      lineId === 'LINE-01' ||
      currentLine?.code === 'LN-PRS-01' ||
      currentLine?.id === 'LN-PRS-01' ||
      currentLine?.id === 'LINE-01'
    );
  }, [lineId, currentLine]);

  // Nhận diện Line 2 (LN-PNT-02) để kích hoạt sơ đồ công nghiệp phối cảnh 4 máy
  const isLine2 = useMemo(() => {
    return (
      lineId === 'LN-PNT-02' ||
      lineId === 'LINE-02' ||
      currentLine?.code === 'LN-PNT-02' ||
      currentLine?.id === 'LN-PNT-02' ||
      currentLine?.id === 'LINE-02'
    );
  }, [lineId, currentLine]);

  // Nhận diện Line 3 (LN-ASM-03) để kích hoạt sơ đồ công nghiệp phối cảnh 4 máy
  const isLine3 = useMemo(() => {
    return (
      lineId === 'LN-ASM-03' ||
      lineId === 'LINE-03' ||
      currentLine?.code === 'LN-ASM-03' ||
      currentLine?.id === 'LN-ASM-03' ||
      currentLine?.id === 'LINE-03'
    );
  }, [lineId, currentLine]);

  // Trạng thái chuyển đổi chế độ xem 2D / 3D (Mặc định 2D an toàn)
  const [viewMode3D, setViewMode3D] = useState<'2d' | '3d'>('2d');

  // Danh sách máy thuộc dây chuyền này
  const machines = useMemo(() => {
    return currentLine?.machines || [];
  }, [currentLine]);

  // Cảnh báo thuộc dây chuyền này
  const lineAlarms = useMemo(() => {
    return (alarms || []).filter(
      (a) =>
        a.lineId === currentLine?.id ||
        (currentLine?.code && a.lineName?.includes(currentLine.code)) ||
        machines.some((m) => m.id === a.machineId)
    );
  }, [alarms, currentLine, machines]);

  // Danh sách cảnh báo hiển thị thực tế (bảo đảm bộ đếm khớp chính xác số phần tử)
  const displayedAlarms = useMemo(() => {
    if (lineAlarms.length > 0) {
      return lineAlarms.slice(0, 3).map((a) => ({
        id: a.id,
        machineName: a.machineName || a.machineId || 'Thiết bị',
        message: a.message,
        time: a.timestamp
          ? (a.timestamp.includes('T') ? a.timestamp.split('T')[1].slice(0, 5) : a.timestamp.slice(11, 16))
          : '14:20',
        severity: (a.severity || 'warning').toLowerCase(),
      }));
    }
    // Trong Normal Demo mặc định: Không tự bịa cảnh báo giả khi không có sự cố thực tế
    return [];
  }, [lineAlarms]);

  // Thống kê trạng thái máy (tính toán động từ tập máy thực tế)
  const machineStats = useMemo(() => {
    const total = machines.length || 6;
    if (machines.length > 0) {
      let running = 0;
      let warning = 0;
      let critical = 0;

      for (const m of machines) {
        const res = resolveMachineMonitoringState(m, currentLine);
        if (res.operatingStatus === 'STOPPED' || res.operatingStatus === 'OFFLINE') {
          critical++;
        } else if (res.alarmSeverity === 'CRITICAL' || res.alarmSeverity === 'WARNING') {
          warning++;
        } else {
          running++;
        }
      }

      const runningPct = ((running / total) * 100).toFixed(1);
      const warningPct = ((warning / total) * 100).toFixed(1);
      const criticalPct = ((critical / total) * 100).toFixed(1);

      return { total, running, warning, critical, runningPct, warningPct, criticalPct };
    }

    const actualRunning = 6;
    const actualWarning = 0;
    const actualCritical = 0;
    const runningPct = '100.0';
    const warningPct = '0.0';
    const criticalPct = '0.0';

    return { total, running: actualRunning, warning: actualWarning, critical: actualCritical, runningPct, warningPct, criticalPct };
  }, [machines, currentLine]);

  const donutData = useMemo(() => {
    return [
      { name: 'Đang chạy', value: machineStats.running, color: '#10B981' },
      { name: 'Cần theo dõi', value: machineStats.warning, color: '#F59E0B' },
      { name: 'Dừng máy', value: machineStats.critical, color: '#EF4444' },
    ];
  }, [machineStats]);

  // Chỉ số OEE, Availability, Performance, Quality đồng bộ theo công thức toán học:
  // OEE = (Availability / 100) * (Performance / 100) * (Quality / 100) * 100
  const kpis = useMemo(() => {
    let availability = 98.0;
    let performance = 96.2;
    let quality = 99.3;
    let target = 90.0;
    let targetOutput = 10000;
    let actualOutput = 9850;

    if (currentLine?.code === 'LN-PNT-02' || currentLine?.id === 'LN-PNT-02') {
      availability = 96.5;
      performance = 94.2;
      quality = 98.8;
      target = 90.0;
      targetOutput = 8000;
      actualOutput = 7600;
    } else if (currentLine?.code === 'LN-ASM-03' || currentLine?.id === 'LN-ASM-03') {
      availability = 92.4;
      performance = 90.5;
      quality = 97.6;
      target = 85.0;
      targetOutput = 5000;
      actualOutput = 4400;
    }

    const oee = Number(((availability / 100) * (performance / 100) * (quality / 100) * 100).toFixed(1));
    const oeeDiff = Number((oee - target).toFixed(1));
    const outputPct = Number(((actualOutput / targetOutput) * 100).toFixed(1));

    return {
      availability,
      performance,
      quality,
      oee,
      target,
      oeeDiff,
      targetOutput,
      actualOutput,
      outputPct,
    };
  }, [currentLine]);

  // HOTFIX ƯU TIÊN 2: Chuẩn hóa và đồng bộ màu Trạng thái dây chuyền
  const lineStatusInfo = useMemo(() => {
    const rawStatus = (currentLine?.status || 'RUNNING').toUpperCase();

    if (rawStatus === 'CRITICAL' || rawStatus === 'ERROR') {
      return {
        text: 'CRITICAL',
        color: '#DC2626',
        textColor: 'text-rose-600 dark:text-rose-400',
        bgColor: 'bg-rose-50 dark:bg-rose-950/40',
        borderColor: 'border-rose-200/80 dark:border-rose-800/60',
        iconType: 'critical',
      };
    }
    if (rawStatus === 'WARNING') {
      return {
        text: 'WARNING',
        color: '#EAB308',
        textColor: 'text-amber-600 dark:text-amber-400',
        bgColor: 'bg-amber-50 dark:bg-amber-950/40',
        borderColor: 'border-amber-200/80 dark:border-amber-800/60',
        iconType: 'warning',
      };
    }
    if (rawStatus === 'STOPPED') {
      return {
        text: 'STOPPED',
        color: '#64748B',
        textColor: 'text-slate-600 dark:text-slate-400',
        bgColor: 'bg-slate-100 dark:bg-slate-800',
        borderColor: 'border-slate-200 dark:border-slate-700',
        iconType: 'stopped',
      };
    }
    if (rawStatus === 'OFFLINE' || rawStatus === 'UNKNOWN') {
      return {
        text: 'OFFLINE',
        color: '#94A3B8',
        textColor: 'text-slate-500 dark:text-slate-400',
        bgColor: 'bg-slate-50 dark:bg-slate-800/50',
        borderColor: 'border-slate-200 dark:border-slate-700',
        iconType: 'offline',
      };
    }
    // Mặc định: RUNNING / NORMAL
    return {
      text: 'RUNNING',
      color: '#16A34A',
      textColor: 'text-emerald-600 dark:text-emerald-400',
      bgColor: 'bg-emerald-50 dark:bg-emerald-950/40',
      borderColor: 'border-emerald-200/80 dark:border-emerald-800/60',
      iconType: 'running',
    };
  }, [currentLine]);

  // HOTFIX ƯU TIÊN 3: Đồng bộ màu Line Health theo ngưỡng phân loại tập trung
  const rawSafetyScore = currentLine && currentLine.safetyScore != null ? Number(currentLine.safetyScore) : null;
  const healthColor = getHealthScoreColor(rawSafetyScore);

  const healthStyle = useMemo(() => {
    if (rawSafetyScore == null) {
      return {
        textColor: 'text-slate-600 dark:text-slate-400',
        bgColor: 'bg-slate-100 dark:bg-slate-800',
        borderColor: 'border-slate-200 dark:border-slate-700',
        trendColor: 'text-slate-400',
      };
    }
    if (rawSafetyScore >= 90) {
      return {
        textColor: 'text-emerald-600 dark:text-emerald-400',
        bgColor: 'bg-emerald-50 dark:bg-emerald-950/40',
        borderColor: 'border-emerald-200/80 dark:border-emerald-800/60',
        trendColor: 'text-emerald-600 dark:text-emerald-400',
      };
    }
    if (rawSafetyScore >= 80) {
      return {
        textColor: 'text-amber-600 dark:text-amber-400',
        bgColor: 'bg-amber-50 dark:bg-amber-950/40',
        borderColor: 'border-amber-200/80 dark:border-amber-800/60',
        trendColor: 'text-amber-600 dark:text-amber-400',
      };
    }
    if (rawSafetyScore >= 70) {
      return {
        textColor: 'text-orange-600 dark:text-orange-400',
        bgColor: 'bg-orange-50 dark:bg-orange-950/40',
        borderColor: 'border-orange-200/80 dark:border-orange-800/60',
        trendColor: 'text-orange-600 dark:text-orange-400',
      };
    }
    return {
      textColor: 'text-rose-600 dark:text-rose-400',
      bgColor: 'bg-rose-50 dark:bg-rose-950/40',
      borderColor: 'border-rose-200/80 dark:border-rose-800/60',
      trendColor: 'text-rose-600 dark:text-rose-400',
    };
  }, [rawSafetyScore]);

  // Danh sách các công đoạn luồng chuyền (OP10..OP60)
  const flowStations = useMemo(() => {
    if (machines.length > 0) {
      return machines.map((m, index) => {
        const resM = resolveMachineMonitoringState(m, currentLine);
        const isStopped = resM.operatingStatus === 'STOPPED' || resM.operatingStatus === 'OFFLINE';
        const isCritical = resM.alarmSeverity === 'CRITICAL';
        const isWarning = resM.alarmSeverity === 'WARNING';

        let status: 'OK' | 'WARNING' | 'CRITICAL' | 'STOPPED' = 'OK';
        let statusLabel = 'Đang chạy';

        if (isStopped) {
          status = 'STOPPED';
          statusLabel = resM.operatingStatus === 'OFFLINE' ? 'Mất kết nối' : 'Dừng máy';
        } else if (isCritical) {
          status = 'CRITICAL';
          statusLabel = 'Nguy hiểm';
        } else if (isWarning) {
          status = 'WARNING';
          statusLabel = 'Cần theo dõi';
        } else {
          status = 'OK';
          statusLabel = 'Đang chạy';
        }

        return {
          id: m.id,
          code: `OP${(index + 1) * 10}`,
          name: m.name,
          actualCode: m.code || m.id,
          status,
          statusLabel,
          machine: m,
          resolved: resM,
        };
      });
    }
    // Dữ liệu 6 trạm chuẩn khớp với giao diện website hiện tại (Mặc định Normal Demo: Toàn bộ trạm OK)
    return [
      { id: 'MCH-01', code: 'OP10', name: 'Lắp trục', actualCode: 'MCH-01', status: 'OK' as const, statusLabel: 'OK', machine: null },
      { id: 'MCH-02', code: 'OP20', name: 'Ép bạc đạn', actualCode: 'MCH-02', status: 'OK' as const, statusLabel: 'OK', machine: null },
      { id: 'MCH-03', code: 'OP30', name: 'Lắp motor', actualCode: 'MCH-03', status: 'OK' as const, statusLabel: 'OK', machine: null },
      { id: 'MCH-04', code: 'OP40', name: 'Vặn vít', actualCode: 'MCH-04', status: 'OK' as const, statusLabel: 'OK', machine: null },
      { id: 'MCH-05', code: 'OP50', name: 'Kiểm tra', actualCode: 'MCH-05', status: 'OK' as const, statusLabel: 'OK', machine: null },
      { id: 'MCH-06', code: 'OP60', name: 'Đóng gói', actualCode: 'MCH-06', status: 'OK' as const, statusLabel: 'OK', machine: null },
    ];
  }, [machines, currentLine]);

  // TRƯỜNG HỢP 1: Đang nạp dữ liệu từ backend
  if (isLoadingLines && lines.length === 0) {
    return (
      <div className="p-12 text-center space-y-3 bg-white dark:bg-factory-card rounded-2xl border border-slate-200/90 shadow-xs">
        <RefreshCw className="w-8 h-8 animate-spin mx-auto text-emerald-600" />
        <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">
          Đang nạp thông tin dây chuyền sản xuất...
        </h3>
        <p className="text-xs text-slate-400">Vui lòng chờ trong giây lát</p>
      </div>
    );
  }

  // TRƯỜNG HỢP 2: Không tìm thấy dây chuyền
  if (!currentLine) {
    return (
      <div className="p-10 text-center space-y-4 bg-white dark:bg-factory-card rounded-2xl border border-slate-200/90 shadow-xs">
        <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto border border-amber-200">
          <AlertTriangle className="w-6 h-6" />
        </div>
        <div>
          <h3 className="text-base font-bold text-slate-900 dark:text-white">
            Không tìm thấy thông tin dây chuyền ({lineId})
          </h3>
          <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
            Mã định danh dây chuyền không tồn tại trong CSDL hoặc đã bị thay đổi cấu hình.
          </p>
        </div>
        <button
          type="button"
          onClick={onBackToDashboard}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all shadow-xs cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Quay lại Dashboard Tổng quan</span>
        </button>
      </div>
    );
  }

  // Chu vi vòng tròn OEE: 2 * PI * 14 ~= 87.96
  const oeeCircumference = 87.96;
  const oeeStrokeDash = (kpis.oee / 100) * oeeCircumference;

  return (
    <div className="space-y-4 animate-in fade-in duration-150">
      {/* ========================================================================= */}
      {/* 1. KHU VỰC TIÊU ĐỀ (HEADER)                                               */}
      {/* ========================================================================= */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onBackToDashboard}
          className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200/80 dark:border-factory-border bg-white dark:bg-factory-card text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 transition-colors cursor-pointer shadow-2xs"
          title="Quay lại Dashboard Tổng quan"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">
              {currentLine.code || lineId} – {currentLine.name || 'Dây chuyền sản xuất'}
            </h1>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Line Overview – Giám sát và hiệu suất dây chuyền
          </p>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. HÀNG THÔNG TIN TỔNG QUAN (4 CARDS: TRẠNG THÁI | OEE | HEALTH | SẢN LƯỢNG) */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {/* Card 1: Trạng thái dây chuyền (Đồng bộ icon & nhãn theo trạng thái) */}
        <div className="bg-white dark:bg-factory-card p-4 rounded-xl border border-slate-200/80 dark:border-slate-800 shadow-xs flex items-center gap-3.5 h-[105px]">
          <div className={`w-12 h-12 rounded-full ${lineStatusInfo.bgColor} ${lineStatusInfo.textColor} flex items-center justify-center shrink-0 border ${lineStatusInfo.borderColor}`}>
            {lineStatusInfo.iconType === 'critical' ? (
              <AlertTriangle className="w-7 h-7" />
            ) : lineStatusInfo.iconType === 'warning' ? (
              <AlertTriangle className="w-7 h-7" />
            ) : lineStatusInfo.iconType === 'stopped' ? (
              <StopCircle className="w-7 h-7" />
            ) : lineStatusInfo.iconType === 'offline' ? (
              <Activity className="w-7 h-7" />
            ) : (
              <PlayCircle className="w-7 h-7" />
            )}
          </div>
          <div className="min-w-0">
            <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
              Trạng thái dây chuyền
            </p>
            <p className={`text-lg font-black font-mono tracking-wide mt-0.5 ${lineStatusInfo.textColor}`}>
              {lineStatusInfo.text}
            </p>
          </div>
        </div>

        {/* Card 2: Ô OEE Dạng Donut Gauge (Cùng hàng, ngay bên phải Trạng thái) */}
        <div className="bg-white dark:bg-factory-card p-4 rounded-xl border border-slate-200/80 dark:border-slate-800 shadow-xs flex flex-col justify-between h-[105px] relative">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
              OEE
            </span>
          </div>

          <div className="flex items-center gap-3.5 my-auto">
            {/* Vòng tròn Donut OEE SVG */}
            <div className="relative w-14 h-14 shrink-0 flex items-center justify-center">
              <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
                <circle
                  cx="18"
                  cy="18"
                  r="14"
                  fill="none"
                  stroke="#E2E8F0"
                  strokeWidth="3.6"
                />
                <circle
                  cx="18"
                  cy="18"
                  r="14"
                  fill="none"
                  stroke="#16A34A"
                  strokeWidth="3.6"
                  strokeDasharray={`${oeeStrokeDash} ${oeeCircumference}`}
                  strokeLinecap="round"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="font-mono font-black text-xs text-slate-900 dark:text-white leading-none">
                  {kpis.oee}%
                </span>
                <span className="text-[7.5px] font-bold text-slate-400 leading-tight mt-0.5">
                  OEE
                </span>
              </div>
            </div>

            {/* Mục tiêu & chênh lệch */}
            <div className="space-y-0.5 text-xs">
              <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                Mục tiêu: <strong className="text-slate-800 dark:text-slate-200 font-mono">{kpis.target}%</strong>
              </p>
              <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-0.5">
                <span>▲</span>
                <span>+{kpis.oeeDiff}% so với hôm qua</span>
              </p>
            </div>
          </div>
        </div>

        {/* Card 3: Mức độ an toàn (Line Health) (Đồng bộ icon và màu theo ngưỡng) */}
        <div className="bg-white dark:bg-factory-card p-4 rounded-xl border border-slate-200/80 dark:border-slate-800 shadow-xs flex items-center gap-3.5 h-[105px]">
          <div
            className={`w-12 h-12 rounded-full ${healthStyle.bgColor} flex items-center justify-center shrink-0 border ${healthStyle.borderColor}`}
            style={{ color: healthColor }}
          >
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
              Mức độ an toàn (Line Health)
            </p>
            <div className="flex items-baseline gap-2 mt-0.5">
              <span className="text-2xl font-black font-mono leading-none" style={{ color: healthColor }}>
                {rawSafetyScore != null ? `${rawSafetyScore.toFixed(1)}%` : 'N/A'}
              </span>
              <span className={`text-[11px] font-semibold ${healthStyle.trendColor}`}>
                ▲ +1.2%
              </span>
            </div>
          </div>
        </div>

        {/* Card 4: Sản lượng (hôm nay) */}
        <div className="bg-white dark:bg-factory-card p-4 rounded-xl border border-slate-200/80 dark:border-slate-800 shadow-xs flex flex-col justify-between h-[105px]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Factory className="w-4 h-4 text-blue-600" />
              <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                Sản lượng (hôm nay)
              </span>
            </div>
          </div>

          <div className="flex items-baseline justify-between">
            <span className="text-xl font-black font-mono text-slate-900 dark:text-white">
              {kpis.actualOutput.toLocaleString()} <span className="text-xs text-slate-400 font-normal">/ {kpis.targetOutput.toLocaleString()} pcs</span>
            </span>
            <span className="text-xs font-bold font-mono text-emerald-600">
              {kpis.outputPct}%
            </span>
          </div>

          {/* Thanh tiến độ sản lượng */}
          <div className="w-full bg-slate-100 dark:bg-factory-surface rounded-full h-1.5 overflow-hidden">
            <div
              className="bg-emerald-500 h-1.5 rounded-full transition-all"
              style={{ width: `${Math.min(100, kpis.outputPct)}%` }}
            />
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 3. HÀNG KPI: AVAILABILITY | PERFORMANCE | QUALITY                         */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
        {/* Availability */}
        <div className="bg-white dark:bg-factory-card p-4 rounded-xl border border-slate-200/80 dark:border-slate-800 shadow-xs flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 flex items-center justify-center border border-blue-200/60 dark:border-blue-800/40">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                Availability
              </p>
              <p className="text-2xl font-black font-mono text-slate-900 dark:text-white leading-none mt-1">
                {kpis.availability}%
              </p>
            </div>
          </div>
          <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
            ▲ +1.2%
          </span>
        </div>

        {/* Performance */}
        <div className="bg-white dark:bg-factory-card p-4 rounded-xl border border-slate-200/80 dark:border-slate-800 shadow-xs flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 flex items-center justify-center border border-blue-200/60 dark:border-blue-800/40">
              <Gauge className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                Performance
              </p>
              <p className="text-2xl font-black font-mono text-slate-900 dark:text-white leading-none mt-1">
                {kpis.performance}%
              </p>
            </div>
          </div>
          <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
            ▲ +2.1%
          </span>
        </div>

        {/* Quality */}
        <div className="bg-white dark:bg-factory-card p-4 rounded-xl border border-slate-200/80 dark:border-slate-800 shadow-xs flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 flex items-center justify-center border border-blue-200/60 dark:border-blue-800/40">
              <Award className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                Quality
              </p>
              <p className="text-2xl font-black font-mono text-slate-900 dark:text-white leading-none mt-1">
                {kpis.quality}%
              </p>
            </div>
          </div>
          <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
            ▲ +0.3%
          </span>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 4. SƠ ĐỒ DÂY CHUYỀN & TRẠNG THÁI THIẾT BỊ (CHIẾM 100% CHIỀU RỘNG NỘI DUNG) */}
      {/* LINE 1: BÁM SÁT 100% ẢNH MẪU CÔNG NGHIỆP PHỐI CẢNH CỐ ĐỊNH (6 CÔNG ĐOẠN)   */}
      {/* LINE 2: BÁM SÁT 100% THIẾT KẾ LINE 1 (4 CÔNG ĐOẠN: OP10..OP40 SẤY & SƠN)    */}
      {/* LINE 3: BÁM SÁT 100% THIẾT KẾ LINE 1 (4 CÔNG ĐOẠN: OP10..OP40 LẮP RÁP & TEST) */}
      {/* ========================================================================= */}
      {isLine1 && viewMode3D !== '3d' ? (
        <Line1PhotorealisticView
          flowStations={flowStations}
          onSelectMachine={onSelectMachine}
          currentLine={currentLine}
        />
      ) : isLine2 ? (
        <Line2PhotorealisticView
          flowStations={flowStations}
          onSelectMachine={onSelectMachine}
          currentLine={currentLine}
        />
      ) : isLine3 ? (
        <Line3PhotorealisticView
          flowStations={flowStations}
          onSelectMachine={onSelectMachine}
          currentLine={currentLine}
        />
      ) : (
      <div className="w-full p-4 sm:p-5 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-factory-card shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400">
              <Activity className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
                Sơ đồ dây chuyền & trạng thái thiết bị
              </h3>
              {isLine1 && viewMode3D === '3d' && (
                <p className="text-[10px] text-slate-400 font-mono">
                  Góc nhìn 3D Digital Twin tương tác WebGL (Three.js)
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2.5 self-start sm:self-auto">
            {/* Bộ chọn chế độ xem 2D / 3D (Độc quyền Line 1 - LN-PRS-01) */}
            {isLine1 && (
              <div className="flex items-center bg-slate-100 dark:bg-factory-surface p-0.5 rounded-lg border border-slate-200/90 dark:border-slate-700/80">
                <button
                  type="button"
                  onClick={() => setViewMode3D('2d')}
                  className={`px-3 py-1 text-xs font-bold rounded-md transition-all cursor-pointer ${
                    viewMode3D === '2d'
                      ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-2xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                  title="Chuyển sang sơ đồ phẳng 2D"
                >
                  2D
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode3D('3d')}
                  className={`flex items-center gap-1.5 px-3 py-1 text-xs font-bold rounded-md transition-all cursor-pointer ${
                    viewMode3D === '3d'
                      ? 'bg-blue-600 text-white shadow-2xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                  title="Chuyển sang mô hình 3D tương tác thực tế ảo"
                >
                  <Box className="w-3.5 h-3.5" />
                  <span>3D</span>
                </button>
              </div>
            )}

            <span className="text-[10px] sm:text-xs font-mono font-bold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-factory-surface px-2.5 py-1 rounded-lg">
              {flowStations.length} Công đoạn
            </span>
          </div>
        </div>

        {/* NỘI DUNG SƠ ĐỒ: CHẾ ĐỘ 3D HOẶC 2D HIỆN TẠI */}
        {isLine1 && viewMode3D === '3d' ? (
          <Line3DView
            flowStations={flowStations}
            onSelectMachine={onSelectMachine}
            onSwitchTo2D={() => setViewMode3D('2d')}
          />
        ) : (
          /* Luồng công đoạn OP10..OP60: Trải dài 100% chiều ngang, phân bố đều 2D */
          <div className="overflow-x-auto lg:overflow-x-visible py-1">
            <div className="w-full flex items-center justify-between gap-1.5 sm:gap-2 md:gap-3 lg:gap-3.5 relative min-w-[700px] lg:min-w-0">
              {/* Điểm ĐẦU VÀO */}
              <div className="flex flex-col items-center justify-center py-2.5 px-2 sm:px-3 rounded-xl bg-blue-600 text-white font-bold text-[10px] sm:text-[11px] shrink-0 shadow-2xs w-12 sm:w-14 text-center">
                <span>ĐẦU</span>
                <span>VÀO</span>
              </div>

              <ArrowRight className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-slate-300 dark:text-slate-600 shrink-0" />

              {/* 6 Trạm OP10..OP60: phân bố đều với flex-1 min-w-0 */}
              {flowStations.map((st, idx) => {
                const isWarning = st.status === 'WARNING';
                const isStopped = st.status === 'STOPPED';
                const isCritical = st.status === 'CRITICAL';

                return (
                  <div key={st.id || idx} className="flex items-center gap-1.5 sm:gap-2 md:gap-3 lg:gap-3.5 flex-1 min-w-0">
                    <div
                      onClick={() => onSelectMachine(st.machine ? st.machine.id : st.id)}
                      className={`flex-1 min-w-0 flex flex-col p-2 sm:p-2.5 rounded-xl border transition-all cursor-pointer hover:shadow-xs hover:-translate-y-0.5 ${
                        isCritical
                          ? 'border-rose-400 bg-rose-50/50 dark:bg-rose-950/30'
                          : isStopped
                          ? 'border-slate-300 bg-slate-100/60 dark:bg-slate-800/40'
                          : isWarning
                          ? 'border-amber-300 bg-amber-50/40 dark:bg-amber-950/20'
                          : 'border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-factory-surface hover:border-emerald-500/60'
                      }`}
                      title={`${st.code} – ${st.name} (${st.statusLabel})`}
                    >
                      <div className="text-center min-w-0">
                        <span className="text-xs sm:text-sm font-mono font-bold text-slate-900 dark:text-white block">
                          {st.code}
                        </span>
                        <p className="text-[10px] sm:text-xs font-medium text-slate-700 dark:text-slate-300 truncate mt-0.5">
                          {st.name}
                        </p>
                      </div>

                      {/* Status pill */}
                      <div className="flex justify-center mt-1.5">
                        <span
                          className={`text-[9px] sm:text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center justify-center gap-1 max-w-full truncate ${
                            isCritical
                              ? 'bg-rose-100 text-rose-800 dark:bg-rose-900/60 dark:text-rose-300'
                              : isStopped
                              ? 'bg-slate-200 text-slate-800 dark:bg-slate-800 dark:text-slate-300'
                              : isWarning
                              ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-300'
                              : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-300'
                          }`}
                        >
                          {isCritical ? (
                            <AlertTriangle className="w-2.5 h-2.5 shrink-0" />
                          ) : isStopped ? (
                            <StopCircle className="w-2.5 h-2.5 shrink-0" />
                          ) : isWarning ? (
                            <AlertTriangle className="w-2.5 h-2.5 shrink-0" />
                          ) : (
                            <CheckCircle2 className="w-2.5 h-2.5 shrink-0" />
                          )}
                          <span className="truncate">{st.statusLabel}</span>
                        </span>
                      </div>

                      {/* Minh họa thiết bị CAD */}
                      <div className="mt-2 py-1 px-1 flex items-center justify-center bg-white dark:bg-factory-card rounded-lg border border-slate-200/60 dark:border-slate-800 h-9 sm:h-10 overflow-hidden">
                        <MachineImage
                          machineId={st.machine?.id || st.id}
                          machineCode={st.code}
                          alt={st.name}
                          className="max-h-7 sm:max-h-8 w-auto object-contain"
                          fallbackIconClassName={`w-4 h-4 sm:w-5 sm:h-5 ${
                            isCritical
                              ? 'text-rose-500'
                              : isStopped
                              ? 'text-slate-500'
                              : isWarning
                              ? 'text-amber-500'
                              : 'text-emerald-600 dark:text-emerald-400'
                          }`}
                        />
                      </div>
                    </div>

                    {idx < flowStations.length - 1 && (
                      <ArrowRight className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-slate-300 dark:text-slate-600 shrink-0" />
                    )}
                  </div>
                );
              })}

              <ArrowRight className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-slate-300 dark:text-slate-600 shrink-0" />

              {/* Điểm ĐẦU RA */}
              <div className="flex flex-col items-center justify-center py-2.5 px-2 sm:px-3 rounded-xl bg-blue-600 text-white font-bold text-[10px] sm:text-[11px] shrink-0 shadow-2xs w-12 sm:w-14 text-center">
                <span>ĐẦU</span>
                <span>RA</span>
              </div>
            </div>
          </div>
        )}
      </div>
      )}

      {/* ========================================================================= */}
      {/* 5. LƯỚI 4 CARDS BÊN DƯỚI (LƯỚI 2 CỘT TRÊN DESKTOP: lg:grid-cols-2)        */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Card 1: Trạng thái thiết bị (Donut) */}
        <div className="p-4 sm:p-5 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-factory-card shadow-xs flex flex-col justify-between">
          <div className="flex items-center gap-2 mb-3">
            <Clock className="w-4 h-4 text-blue-600" />
            <h4 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
              Trạng thái thiết bị
            </h4>
          </div>

          <div className="flex items-center justify-between gap-4 my-auto py-2">
            <div className="w-28 h-28 relative shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={donutData}
                    cx="50%"
                    cy="50%"
                    innerRadius={32}
                    outerRadius={50}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {donutData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-lg font-black text-slate-900 dark:text-white leading-none">
                  {machineStats.total}
                </span>
                <span className="text-[9px] text-slate-400 font-medium">Thiết bị</span>
              </div>
            </div>

            <div className="space-y-2 text-xs flex-1 max-w-xs">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                  <span className="text-slate-600 dark:text-slate-400 text-xs">Đang chạy:</span>
                </div>
                <span className="font-mono text-xs font-bold text-slate-900 dark:text-white">
                  {machineStats.running} ({machineStats.runningPct}%)
                </span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                  <span className="text-slate-600 dark:text-slate-400 text-xs">Cần theo dõi:</span>
                </div>
                <span className="font-mono text-xs font-bold text-amber-600">
                  {machineStats.warning} ({machineStats.warningPct}%)
                </span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
                  <span className="text-slate-600 dark:text-slate-400 text-xs">Dừng:</span>
                </div>
                <span className="font-mono text-xs font-bold text-rose-600">
                  {machineStats.critical} ({machineStats.criticalPct}%)
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Card 2: Thông số vận hành chính (Bảng 4 thông số) */}
        <div className="p-4 sm:p-5 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-factory-card shadow-xs flex flex-col justify-between">
          <div className="flex items-center gap-2 mb-2">
            <Layers className="w-4 h-4 text-blue-600" />
            <h4 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
              Thông số vận hành chính
            </h4>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-800 text-slate-400">
                  <th className="pb-2 font-medium">Thông số</th>
                  <th className="pb-2 font-medium text-right">Giá trị</th>
                  <th className="pb-2 font-medium text-right">Ngưỡng</th>
                  <th className="pb-2 font-medium text-right">Trạng thái</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 dark:divide-slate-800/60 font-mono">
                <tr>
                  <td className="py-1.5 font-sans text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <Thermometer className="w-3.5 h-3.5 text-slate-400" />
                    <span>Nhiệt độ (°C)</span>
                  </td>
                  <td className="py-1.5 text-right font-bold text-slate-900 dark:text-white">56.2</td>
                  <td className="py-1.5 text-right text-slate-400">&le; 75.0</td>
                  <td className="py-1.5 text-right text-emerald-600 font-sans font-bold">
                    <span className="inline-flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" /> OK
                    </span>
                  </td>
                </tr>
                <tr>
                  <td className="py-1.5 font-sans text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <Activity className="w-3.5 h-3.5 text-slate-400" />
                    <span>Độ rung (mm/s)</span>
                  </td>
                  <td className="py-1.5 text-right font-bold text-slate-900 dark:text-white">3.1</td>
                  <td className="py-1.5 text-right text-slate-400">&le; 4.0</td>
                  <td className="py-1.5 text-right text-emerald-600 font-sans font-bold">
                    <span className="inline-flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" /> OK
                    </span>
                  </td>
                </tr>
                <tr>
                  <td className="py-1.5 font-sans text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <Gauge className="w-3.5 h-3.5 text-slate-400" />
                    <span>Áp suất (MPa)</span>
                  </td>
                  <td className="py-1.5 text-right font-bold text-slate-900 dark:text-white">0.62</td>
                  <td className="py-1.5 text-right text-slate-400">0.50 - 0.80</td>
                  <td className="py-1.5 text-right text-emerald-600 font-sans font-bold">
                    <span className="inline-flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" /> OK
                    </span>
                  </td>
                </tr>
                <tr>
                  <td className="py-1.5 font-sans text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <Zap className="w-3.5 h-3.5 text-slate-400" />
                    <span>Dòng điện (A)</span>
                  </td>
                  <td className="py-1.5 text-right font-bold text-slate-900 dark:text-white">18.4</td>
                  <td className="py-1.5 text-right text-slate-400">&le; 20.0</td>
                  <td className="py-1.5 text-right text-emerald-600 font-sans font-bold">
                    <span className="inline-flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" /> OK
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Card 3: Cảnh báo & Sự cố (Bộ đếm khớp chính xác danh sách) */}
        <div className="p-4 sm:p-5 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-factory-card shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-blue-600" />
              <h3 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
                Cảnh báo & Sự cố ({displayedAlarms.length})
              </h3>
            </div>
            <span className="text-[11px] text-blue-600 dark:text-blue-400 font-medium hover:underline cursor-pointer">
              Xem tất cả &rarr;
            </span>
          </div>

          {displayedAlarms.length > 0 ? (
            <div className="space-y-2 text-xs">
              {displayedAlarms.map((a) => (
                <div
                  key={a.id}
                  className={`p-2.5 rounded-xl border flex items-start gap-2.5 ${
                    a.severity === 'critical'
                      ? 'border-rose-200/80 bg-rose-50/40 dark:bg-rose-950/20'
                      : 'border-amber-200/80 bg-amber-50/40 dark:bg-amber-950/20'
                  }`}
                >
                  <AlertTriangle
                    className={`w-4 h-4 shrink-0 mt-0.5 ${
                      a.severity === 'critical' ? 'text-rose-500' : 'text-amber-500'
                    }`}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <p className="font-bold text-slate-900 dark:text-white text-xs truncate">
                        {a.machineName}
                      </p>
                      <span className="text-[10px] text-slate-400 font-mono">{a.time}</span>
                    </div>
                    <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-0.5">
                      {a.message}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-4 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 text-center py-6">
              <CheckCircle2 className="w-5 h-5 text-emerald-500 mx-auto mb-1" />
              <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Không có cảnh báo nào đang hoạt động
              </p>
              <p className="text-[10px] text-slate-400 mt-0.5">
                Tất cả thiết bị trong dây chuyền đang vận hành bình thường
              </p>
            </div>
          )}
        </div>

        {/* Card 4: AI Dự đoán & Bảo dưỡng */}
        <div className="p-4 sm:p-5 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-factory-card shadow-xs space-y-3 flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <BrainCircuit className="w-4 h-4 text-blue-600" />
              <h3 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
                AI Dự đoán & Bảo dưỡng
              </h3>
            </div>

            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Dự đoán rủi ro thiết bị (7 ngày tới)
            </p>

            <div className="p-3 rounded-xl border border-amber-200/80 bg-amber-50/50 dark:bg-amber-950/20 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs font-bold text-slate-900 dark:text-white">
                  <Cpu className="w-4 h-4 text-amber-600" />
                  <span>OP50 – Máy kiểm tra</span>
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300">
                  Rủi ro cao (85%)
                </span>
              </div>
              <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
                Khuyến nghị: Kiểm tra và bảo dưỡng cảm biến rung.
              </p>
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="button"
              className="inline-flex items-center gap-1 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-colors cursor-pointer shadow-xs"
            >
              <span>Xem chi tiết</span>
              <span>&rarr;</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
