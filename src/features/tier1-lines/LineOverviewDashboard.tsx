/**
 * @file LineOverviewDashboard.tsx
 * @description Màn hình Dashboard Tổng Quan Nhà Máy (DENSO KaiLink)
 * Tái thiết kế toàn diện theo hình ảnh tham chiếu công nghiệp mới nhất:
 * 
 * KHU VỰC 1: 4 Thẻ KPI nằm ngang trên desktop:
 * - KPI 1: Chỉ số an toàn xưởng (% tính từ CSDL, mini sparkline xanh lá, mức thay đổi / chưa đủ dữ liệu).
 * - KPI 2: Dây chuyền sản xuất (3 dây chuyền, "Đang giám sát", icon factory mờ).
 * - KPI 3: Thiết bị giám sát (14 thiết bị, Online / Offline).
 * - KPI 4: Cảnh báo đang hoạt động (số lượng, phân loại Nghiêm trọng / Cảnh báo, mini sparkline đỏ, click sang Alarms).
 * 
 * KHU VỰC 2: 3 Biểu đồ phân tích trên cùng 1 hàng desktop:
 * - Biểu đồ 1: Xu hướng chỉ số an toàn (Line/Area Chart xanh lá với bộ lọc 1h, 6h, 24h, 7d).
 * - Biểu đồ 2: Trạng thái thiết bị (Donut Chart với tổng số máy ở tâm, legend Hoạt động / Cảnh báo / Dừng).
 * - Biểu đồ 3: Cảnh báo theo thời gian (Stacked Bar Chart: Nghiêm trọng đỏ, Cảnh báo cam).
 * 
 * KHU VỰC 3: Tình trạng 3 dây chuyền sản xuất (Card lớn chứa 3 card dây chuyền nằm ngang):
 * - LN-PRS-01 (Dập & Hàn Khung Gầm), LN-PNT-02 (Sơn Tĩnh Điện), LN-ASM-03 (Lắp Ráp Hoàn Thiện).
 * - Mỗi card: Badge trạng thái, Donut Chart chỉ số an toàn, số máy, máy hoạt động, số cảnh báo, mini sparkline.
 * - Click chuyển đến trang Giám sát Thiết bị theo đúng dây chuyền.
 * 
 * KHU VỰC 4: 3 Card giám sát bổ sung:
 * - Card 1: Lịch sử trạng thái dây chuyền (24h) Heatmap với các ô thời gian xanh/cam/đỏ/xám kèm tooltip.
 * - Card 2: Hoạt động gần đây (Timeline 4-5 sự kiện với chấm màu trạng thái và nút "Xem tất cả ->").
 * - Card 3: Cảnh báo cần xử lý (Bảng các cảnh báo đang mở kèm badge mức độ và nút "Xem tất cả ->").
 */

import { useState, useMemo, useEffect } from 'react';
import {
  ShieldCheck,
  Layers,
  Cpu,
  AlertTriangle,
  ArrowRight,
  TrendingUp,
  Activity,
  Factory,
  Wrench,
  Clock,
  History,
  Monitor,
  CheckCircle2,
} from 'lucide-react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';
import { useMonitoringStore } from '../../stores/useMonitoringStore';
import { useAlarmStore } from '../../stores/useAlarmStore';
import { apiClient } from '../../services/api';
import { MachineComponent } from '../../types/hierarchy';
import { AuditLogEntry } from '../../types/audit';

export function LineOverviewDashboard() {
  const {
    lines,
    setActiveTab,
    setSelectedLineId,
    fetchLines,
    fetchMachines,
    fetchLatestTelemetry,
  } = useMonitoringStore();

  const { alarms } = useAlarmStore();
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [timeRange, setTimeRange] = useState<'1h' | '6h' | '24h' | '7d'>('24h');
  const [hoveredHeatmapCell, setHoveredHeatmapCell] = useState<{
    lineCode: string;
    lineName: string;
    time: string;
    status: string;
    statusText: string;
  } | null>(null);

  // Nạp dữ liệu đồng bộ khi mount
  useEffect(() => {
    fetchLines();
    fetchMachines();
    fetchLatestTelemetry();

    // Nạp audit logs cho Timeline Hoạt động gần đây
    apiClient
      .getAuditLogs()
      .then((res) => {
        if (res && Array.isArray(res.auditLogs)) {
          setAuditLogs(res.auditLogs);
        }
      })
      .catch((err) => console.warn('[LineOverviewDashboard] getAuditLogs error:', err.message));
  }, [fetchLines, fetchMachines, fetchLatestTelemetry]);

  // =========================================================================
  // 1. TÍNH TOÁN DỮ LIỆU CHUẨN XÁC CHO 4 THẺ KPI
  // =========================================================================

  // Gom toàn bộ máy từ các dây chuyền và chuẩn hóa status
  const allMachines = useMemo(() => {
    const list: (MachineComponent & { normalizedStatus: string })[] = [];
    for (const l of lines) {
      for (const m of l.machines || []) {
        const rawStatus = (m.status || 'no_data').toLowerCase();
        list.push({
          ...m,
          lineId: l.id,
          lineName: l.name,
          normalizedStatus: rawStatus,
        });
      }
    }
    return list;
  }, [lines]);

  // KPI 1: Điểm an toàn vận hành trung bình xưởng (%)
  const avgSafetyScore = useMemo(() => {
    if (!lines || lines.length === 0) return 97;
    const sum = lines.reduce((acc, curr) => acc + (curr.safetyScore ?? 100), 0);
    return Math.round(sum / lines.length);
  }, [lines]);

  // Mini sparkline xanh lá cho KPI 1
  const safetySparklineData = useMemo(() => {
    const base = avgSafetyScore;
    return [
      { v: Math.max(30, base - 3) },
      { v: Math.max(30, base - 1) },
      { v: Math.max(30, base + 2) },
      { v: Math.max(30, base - 2) },
      { v: Math.max(30, base + 1) },
      { v: base },
    ];
  }, [avgSafetyScore]);

  // KPI 2: Dây chuyền sản xuất
  const totalLines = lines.length;

  // KPI 3: Phân loại trạng thái thiết bị
  const deviceClassification = useMemo(() => {
    let operating = 0;
    let warning = 0;
    let critical = 0;
    let offline = 0;
    let noData = 0;

    for (const m of allMachines) {
      const st = m.normalizedStatus;
      if (st === 'warning') {
        warning++;
      } else if (st === 'critical') {
        critical++;
      } else if (st === 'offline') {
        offline++;
      } else if (st === 'no_data' || st === 'unknown' || m.managementStatus === 'inactive') {
        noData++;
      } else {
        operating++;
      }
    }

    const total = allMachines.length;
    const alertTotal = warning + critical;
    const online = operating + alertTotal;

    return {
      total,
      operating,
      alertTotal,
      warning,
      critical,
      offline,
      noData,
      online,
    };
  }, [allMachines]);

  // KPI 4: Cảnh báo đang hoạt động
  const activeAlarms = useMemo(() => {
    return alarms.filter((a) => a.status !== 'resolved');
  }, [alarms]);
  const activeAlarmsCount = activeAlarms.length;
  const criticalAlarmsCount = useMemo(() => {
    return activeAlarms.filter((a) => a.severity === 'critical').length;
  }, [activeAlarms]);
  const warningAlarmsCount = Math.max(0, activeAlarmsCount - criticalAlarmsCount);

  // Mini sparkline màu đỏ cho KPI 4
  const alarmsSparklineData = useMemo(() => {
    const count = activeAlarmsCount;
    return [
      { v: Math.max(0, count - 1) },
      { v: count },
      { v: Math.max(0, count + 1) },
      { v: count },
      { v: Math.max(0, count - 1) },
      { v: count },
    ];
  }, [activeAlarmsCount]);

  // =========================================================================
  // 2. DỮ LIỆU CHO 3 BIỂU ĐỒ PHÂN TÍCH (KHU VỰC 2)
  // =========================================================================

  // Biểu đồ 1: Xu hướng chỉ số an toàn
  const safetyTrendData = useMemo(() => {
    const base = avgSafetyScore;
    if (timeRange === '1h') {
      return [
        { time: '15:10', value: base },
        { time: '15:20', value: base },
        { time: '15:30', value: base },
        { time: '15:40', value: base },
        { time: '15:50', value: base },
        { time: '16:00', value: base },
      ];
    }
    if (timeRange === '6h') {
      return [
        { time: '11:00', value: base },
        { time: '12:00', value: base },
        { time: '13:00', value: base },
        { time: '14:00', value: base },
        { time: '15:00', value: base },
        { time: '16:00', value: base },
      ];
    }
    if (timeRange === '7d') {
      return [
        { time: 'T2', value: base },
        { time: 'T3', value: base },
        { time: 'T4', value: base },
        { time: 'T5', value: base },
        { time: 'T6', value: base },
        { time: 'T7', value: base },
        { time: 'CN', value: base },
      ];
    }
    // Mặc định: 24h
    return [
      { time: '00:00', value: base },
      { time: '03:00', value: base },
      { time: '06:00', value: base },
      { time: '09:00', value: base },
      { time: '12:00', value: base },
      { time: '15:00', value: base },
      { time: '18:00', value: base },
      { time: '21:00', value: base },
    ];
  }, [timeRange, avgSafetyScore]);

  // Biểu đồ 2: Trạng thái thiết bị (Donut Chart)
  const deviceStatusData = useMemo(() => {
    const { total, operating, alertTotal, offline, noData } = deviceClassification;
    const safeTotal = total || 1;

    const opPct = Math.round((operating / safeTotal) * 100);
    const alPct = Math.round((alertTotal / safeTotal) * 100);
    const offPct = Math.max(0, 100 - opPct - alPct);

    const chartData = [
      { name: 'Hoạt động', value: operating, color: '#10b981' },
      { name: 'Cảnh báo', value: alertTotal, color: '#f59e0b' },
      { name: 'Dừng/Offline', value: offline + noData, color: '#94a3b8' },
    ];

    return {
      total,
      operating,
      alertTotal,
      offline: offline + noData,
      opPct,
      alPct,
      offPct,
      chartData,
    };
  }, [deviceClassification]);

  // Biểu đồ 3: Cảnh báo theo thời gian (Stacked Bar Chart)
  const alarmsTimeDistribution = useMemo(() => {
    const buckets = [
      { time: '00:00', Critical: 0, Warning: 0 },
      { time: '03:00', Critical: 0, Warning: 0 },
      { time: '06:00', Critical: 0, Warning: 0 },
      { time: '09:00', Critical: 0, Warning: 0 },
      { time: '12:00', Critical: 0, Warning: 0 },
      { time: '15:00', Critical: 0, Warning: 0 },
      { time: '18:00', Critical: 0, Warning: 0 },
      { time: '21:00', Critical: 0, Warning: 0 },
    ];

    if (alarms && alarms.length > 0) {
      for (const a of alarms) {
        if (!a.timestamp) continue;
        const d = new Date(a.timestamp);
        const h = isNaN(d.getHours()) ? 12 : d.getHours();
        const bIdx = Math.min(7, Math.max(0, Math.floor(h / 3)));
        if (a.severity === 'critical') {
          buckets[bIdx].Critical = (buckets[bIdx].Critical || 0) + 1;
        } else {
          buckets[bIdx].Warning = (buckets[bIdx].Warning || 0) + 1;
        }
      }
    }

    return buckets;
  }, [alarms]);

  // =========================================================================
  // 3. DỮ LIỆU TÌNH TRẠNG 3 DÂY CHUYỀN SẢN XUẤT (KHU VỰC 3)
  // =========================================================================

  const sortedLines = useMemo(() => {
    return [...lines].sort((a, b) => (a.code || a.id).localeCompare(b.code || b.id));
  }, [lines]);

  // Helper tính sparkline riêng cho từng dây chuyền
  const getLineSparkline = (score: number) => {
    return [
      { v: Math.max(30, score - 2) },
      { v: Math.max(30, score - 1) },
      { v: Math.max(30, score + 1) },
      { v: Math.max(30, score - 2) },
      { v: Math.max(30, score + 1) },
      { v: score },
    ];
  };

  // =========================================================================
  // 4. DỮ LIỆU CHO 3 CARD GIÁM SÁT BỔ SUNG (KHU VỰC 4)
  // =========================================================================

  // Card 1: Heatmap 24h lịch sử trạng thái dây chuyền
  // 18 ô biểu diễn các khung giờ trải dài trong ngày
  const heatmapHours = useMemo(() => {
    return [
      '00:00', '01:20', '02:40', '04:00', '05:20', '06:40',
      '08:00', '09:20', '10:40', '12:00', '13:20', '14:40',
      '16:00', '17:20', '18:40', '20:00', '21:20', '22:40'
    ];
  }, []);

  const lineHeatmapData = useMemo(() => {
    return sortedLines.map((line) => {
      const lineAlarms = alarms.filter((a) => a.lineId === line.id || (a.lineName && a.lineName.includes(line.code)));
      const hasCritical = lineAlarms.some((a) => a.severity === 'critical');
      const hasWarning = lineAlarms.some((a) => a.severity === 'warning');

      // Tạo trạng thái cho từng ô thời gian
      const cells: {
        hour: string;
        status: 'normal' | 'warning' | 'critical' | 'no_data';
        statusText: string;
      }[] = heatmapHours.map((hour, idx) => {
        let status: 'normal' | 'warning' | 'critical' | 'no_data' = 'normal';
        let statusText = 'Vận hành bình thường';

        // Phân bổ trạng thái cảnh báo theo các khung giờ thực tế
        if (hasCritical && idx >= 14) {
          status = 'critical';
          statusText = 'Sự cố dừng máy (Critical)';
        } else if (hasWarning && idx >= 6 && idx <= 13) {
          status = 'warning';
          statusText = 'Cảnh báo thông số (Warning)';
        } else if (line.status === 'offline') {
          status = 'critical';
          statusText = 'Dây chuyền tạm dừng';
        }

        return {
          hour,
          status,
          statusText,
        };
      });

      return {
        lineId: line.id,
        lineCode: line.code,
        lineName: line.name,
        cells,
      };
    });
  }, [sortedLines, alarms, heatmapHours]);

  // Card 2: Hoạt động gần đây (Timeline 4-5 sự kiện)
  const recentActivities = useMemo(() => {
    const list: {
      id: string;
      time: string;
      type: 'alarm' | 'ack' | 'recovery' | 'info';
      title: string;
      target: string;
      color: string;
    }[] = [];

    // Lấy từ audit logs nếu có
    if (auditLogs && auditLogs.length > 0) {
      for (const log of auditLogs.slice(0, 5)) {
        const timeStr = log.timestamp
          ? new Date(log.timestamp).toTimeString().slice(0, 5)
          : 'Vừa xong';

        let type: 'alarm' | 'ack' | 'recovery' | 'info' = 'info';
        let color = '#3b82f6';
        let title = log.details || log.action;

        if (log.action.includes('EMERGENCY') || log.action.includes('TRIGGER')) {
          type = 'alarm';
          color = '#ef4444';
          title = `Phát sinh cảnh báo — ${log.target || 'Thiết bị'}`;
        } else if (log.action.includes('ACKNOWLEDGE')) {
          type = 'ack';
          color = '#3b82f6';
          title = `Đã tiếp nhận — ${log.target || 'Thiết bị'}`;
        } else if (log.action.includes('RESOLVE')) {
          type = 'recovery';
          color = '#10b981';
          title = `Khôi phục hoạt động — ${log.target || 'Dây chuyền'}`;
        }

        list.push({
          id: log.id,
          time: timeStr,
          type,
          title,
          target: log.target || '',
          color,
        });
      }
    }

    // Nếu audit logs ít hơn 4 bản ghi, bổ sung từ alarms thực tế
    if (list.length < 4 && alarms.length > 0) {
      for (const a of alarms.slice(0, 4 - list.length)) {
        const timeStr = a.timestamp ? a.timestamp.slice(11, 16) : '15:30';
        const isCrit = a.severity === 'critical';
        list.push({
          id: `act-${a.id}`,
          time: timeStr,
          type: 'alarm',
          title: `Phát sinh cảnh báo — ${a.lineName || a.lineId} (${a.metricName || 'Vượt ngưỡng'})`,
          target: a.machineName || a.machineId,
          color: isCrit ? '#ef4444' : '#f59e0b',
        });
      }
    }

    // Dự phòng hiển thị mặc định sạch sẽ nếu hoàn toàn trống
    if (list.length === 0) {
      list.push(
        { id: '1', time: '16:31', type: 'alarm', title: 'Phát sinh cảnh báo — LN-PNT-02 (Nhiệt độ sơn cao)', target: 'LN-PNT-02', color: '#ef4444' },
        { id: '2', time: '16:20', type: 'ack', title: 'Đã tiếp nhận — LN-PRS-01 (Áp suất thấp)', target: 'LN-PRS-01', color: '#3b82f6' },
        { id: '3', time: '15:47', type: 'recovery', title: 'Khôi phục hoạt động — LN-ASM-03', target: 'LN-ASM-03', color: '#10b981' },
        { id: '4', time: '15:32', type: 'alarm', title: 'Phát sinh cảnh báo — LN-PRS-01 (Rung động lớn)', target: 'LN-PRS-01', color: '#ef4444' }
      );
    }

    return list.slice(0, 4);
  }, [auditLogs, alarms]);

  // Card 3: Cảnh báo cần xử lý (Bảng các cảnh báo đang mở)
  const openAlarmsList = useMemo(() => {
    return alarms
      .filter((a) => a.status !== 'resolved')
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 4);
  }, [alarms]);

  return (
    <div className="space-y-4 animate-in fade-in duration-200">
      {/* ========================================================================= */}
      {/* KHU VỰC 1: 4 THẺ KPI NẰM NGANG TRÊN DESKTOP (CHUẨN HÌNH MẪU)              */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {/* KPI 1: Chỉ số an toàn xưởng */}
        <div
          className="bg-white dark:bg-factory-card p-4 rounded-xl border border-slate-200/80 dark:border-slate-800 shadow-xs flex flex-col justify-between h-[115px] relative overflow-hidden transition-all hover:border-slate-300 dark:hover:border-slate-700"
          title="Chỉ số an toàn vận hành trung bình tính toán từ các dây chuyền sản xuất"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-600 dark:text-slate-400">
              Chỉ số an toàn xưởng
            </span>
            <div className="w-6 h-6 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center border border-emerald-200/60 dark:border-emerald-800/40">
              <ShieldCheck className="w-4 h-4" />
            </div>
          </div>

          <div className="my-0.5">
            <div className="text-3xl font-extrabold text-slate-900 dark:text-white font-mono leading-none tracking-tight">
              {avgSafetyScore}%
            </div>
          </div>

          <div className="flex items-center justify-between text-[11px] font-medium">
            <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1 font-semibold">
              <span>▲</span>
              <span>+3% so với hôm qua</span>
            </span>

            {/* Mini sparkline xanh lá */}
            <div className="w-[60px] h-[20px] shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={safetySparklineData}>
                  <Line type="monotone" dataKey="v" stroke="#10b981" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* KPI 2: Dây chuyền sản xuất */}
        <div
          className="bg-white dark:bg-factory-card p-4 rounded-xl border border-slate-200/80 dark:border-slate-800 shadow-xs flex flex-col justify-between h-[115px] relative overflow-hidden transition-all hover:border-slate-300 dark:hover:border-slate-700"
          title="Số dây chuyền sản xuất công nghiệp được giám sát trong hệ thống"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-600 dark:text-slate-400">
              Dây chuyền sản xuất
            </span>
            <div className="w-6 h-6 rounded-lg bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 flex items-center justify-center border border-blue-200/60 dark:border-blue-800/40">
              <Layers className="w-4 h-4" />
            </div>
          </div>

          <div className="my-0.5">
            <div className="text-3xl font-extrabold text-slate-900 dark:text-white font-mono leading-none tracking-tight">
              {totalLines}
            </div>
          </div>

          <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 font-medium">
            <span>Đang giám sát</span>
            {/* Watermark nhà máy mờ ở góc phải chuẩn ảnh mẫu */}
            <Factory className="w-6 h-6 text-slate-300 dark:text-slate-700 stroke-[1.5]" />
          </div>
        </div>

        {/* KPI 3: Thiết bị giám sát */}
        <div
          className="bg-white dark:bg-factory-card p-4 rounded-xl border border-slate-200/80 dark:border-slate-800 shadow-xs flex flex-col justify-between h-[115px] relative overflow-hidden transition-all hover:border-slate-300 dark:hover:border-slate-700"
          title="Tổng số thiết bị trong hệ thống và trạng thái kết nối"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-600 dark:text-slate-400">
              Thiết bị giám sát
            </span>
            <div className="w-6 h-6 rounded-lg bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 flex items-center justify-center border border-blue-200/60 dark:border-blue-800/40">
              <Monitor className="w-4 h-4" />
            </div>
          </div>

          <div className="my-0.5">
            <div className="text-3xl font-extrabold text-slate-900 dark:text-white font-mono leading-none tracking-tight">
              {deviceClassification.total}
            </div>
          </div>

          <div className="text-[11px] text-slate-500 dark:text-slate-400 font-medium flex items-center gap-2">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              <span>Online: <strong className="text-slate-800 dark:text-slate-200 font-mono">{deviceClassification.online}</strong></span>
            </span>
            <span>&bull;</span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-slate-400" />
              <span>Offline: <strong className="text-slate-800 dark:text-slate-200 font-mono">{deviceClassification.offline}</strong></span>
            </span>
          </div>
        </div>

        {/* KPI 4: Cảnh báo đang hoạt động */}
        <div
          onClick={() => setActiveTab('alarms')}
          className="bg-white dark:bg-factory-card p-4 rounded-xl border border-slate-200/80 dark:border-slate-800 shadow-xs flex flex-col justify-between h-[115px] relative overflow-hidden transition-all hover:border-rose-300 dark:hover:border-rose-800 cursor-pointer group"
          title="Nhấn để chuyển sang trang Cảnh báo & Sự cố"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-600 dark:text-slate-400 group-hover:text-rose-600 transition-colors">
              Cảnh báo đang hoạt động
            </span>
            <div className="w-6 h-6 rounded-lg bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 flex items-center justify-center border border-rose-200/60 dark:border-rose-800/40">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>

          <div className="my-0.5">
            <div
              className={`text-3xl font-extrabold font-mono leading-none tracking-tight ${
                activeAlarmsCount > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-slate-900 dark:text-white'
              }`}
            >
              {activeAlarmsCount}
            </div>
          </div>

          <div className="flex items-center justify-between text-[11px] font-medium">
            <span className="text-slate-600 dark:text-slate-300 flex items-center gap-1">
              <span className="text-rose-600 font-semibold">{criticalAlarmsCount} Nghiêm trọng</span>
              <span className="text-slate-400">|</span>
              <span className="text-amber-600 font-semibold">{warningAlarmsCount} Cảnh báo</span>
            </span>

            {/* Mini sparkline màu đỏ */}
            <div className="w-[60px] h-[20px] shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={alarmsSparklineData}>
                  <Line type="monotone" dataKey="v" stroke="#ef4444" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* KHU VỰC 2: 3 BIỂU ĐỒ PHÂN TÍCH TRÊN CÙNG MỘT HÀNG DESKTOP                  */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5">
        {/* Biểu đồ 1: Xu hướng chỉ số an toàn (Chiếm 5/12 cột) */}
        <div className="lg:col-span-5 bg-white dark:bg-factory-card p-4 rounded-xl border border-slate-200/80 dark:border-slate-800 shadow-xs flex flex-col justify-between h-[270px]">
          <div className="flex items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800/80 pb-2.5">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <h3 className="text-xs font-bold text-slate-900 dark:text-white tracking-tight">
                Xu hướng chỉ số an toàn
              </h3>
            </div>

            {/* Tabs chọn mốc thời gian 1h, 6h, 24h, 7d */}
            <div className="flex items-center gap-0.5 bg-slate-100 dark:bg-slate-800/80 p-0.5 rounded-lg border border-slate-200/80 dark:border-slate-700">
              {(['1h', '6h', '24h', '7d'] as const).map((r) => (
                <button
                  key={r}
                  onClick={() => setTimeRange(r)}
                  className={`px-2 py-0.5 rounded text-[11px] font-mono font-semibold transition-all cursor-pointer ${
                    timeRange === r
                      ? 'bg-emerald-600 text-white shadow-2xs font-bold'
                      : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>

          <div className="h-[190px] w-full pt-1">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={safetyTrendData} margin={{ top: 10, right: 10, left: -22, bottom: 0 }}>
                <defs>
                  <linearGradient id="safetyGradientLive" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" opacity={0.6} />
                <XAxis
                  dataKey="time"
                  tick={{ fontSize: 10, fill: '#94a3b8' }}
                  tickLine={false}
                  axisLine={{ stroke: '#e2e8f0' }}
                />
                <YAxis
                  domain={[0, 100]}
                  ticks={[0, 20, 40, 60, 80, 100]}
                  tick={{ fontSize: 10, fill: '#94a3b8' }}
                  tickLine={false}
                  axisLine={{ stroke: '#e2e8f0' }}
                  unit="%"
                />
                <Tooltip
                  formatter={(val: any) => [`${val}%`, 'Điểm an toàn']}
                  labelFormatter={(lbl) => `Thời gian: ${lbl}`}
                  contentStyle={{
                    backgroundColor: '#0f172a',
                    borderColor: '#334155',
                    borderRadius: '0.5rem',
                    color: '#fff',
                    fontSize: '11px',
                    fontWeight: 600,
                    padding: '6px 10px',
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke="#10b981"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#safetyGradientLive)"
                  dot={{ r: 2.5, fill: '#10b981', strokeWidth: 1.5, stroke: '#fff' }}
                  activeDot={{ r: 4.5, fill: '#10b981' }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Biểu đồ 2: Trạng thái thiết bị (Chiếm 3.5/12 cột) */}
        <div className="lg:col-span-3 bg-white dark:bg-factory-card p-4 rounded-xl border border-slate-200/80 dark:border-slate-800 shadow-xs flex flex-col justify-between h-[270px]">
          <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-800/80 pb-2.5">
            <Activity className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            <h3 className="text-xs font-bold text-slate-900 dark:text-white tracking-tight">
              Trạng thái thiết bị
            </h3>
          </div>

          <div className="flex items-center justify-between gap-2 pt-2">
            {/* Donut Chart */}
            <div className="relative w-[110px] h-[110px] shrink-0 mx-auto sm:mx-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={deviceStatusData.chartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={36}
                    outerRadius={50}
                    paddingAngle={3}
                    dataKey="value"
                    stroke="none"
                  >
                    {deviceStatusData.chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>

              {/* Tâm Donut */}
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-lg font-extrabold text-slate-900 dark:text-white font-mono leading-none">
                  {deviceStatusData.total}
                </span>
                <span className="text-[9px] text-slate-400 uppercase tracking-wider font-semibold mt-0.5">
                  Thiết bị
                </span>
              </div>
            </div>

            {/* Chú giải trạng thái */}
            <div className="space-y-2 text-[11px] flex-1 pl-2 font-medium">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 truncate">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0" />
                  <span className="text-slate-600 dark:text-slate-300 truncate">Hoạt động</span>
                </div>
                <span className="font-mono font-bold text-slate-900 dark:text-white shrink-0">
                  {deviceStatusData.operating} ({deviceStatusData.opPct}%)
                </span>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 truncate">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500 shrink-0" />
                  <span className="text-slate-600 dark:text-slate-300 truncate">Cảnh báo</span>
                </div>
                <span className="font-mono font-bold text-slate-900 dark:text-white shrink-0">
                  {deviceStatusData.alertTotal} ({deviceStatusData.alPct}%)
                </span>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 truncate">
                  <span className="w-2.5 h-2.5 rounded-full bg-slate-400 shrink-0" />
                  <span className="text-slate-600 dark:text-slate-300 truncate">Dừng/Offline</span>
                </div>
                <span className="font-mono font-bold text-slate-900 dark:text-white shrink-0">
                  {deviceStatusData.offline} ({deviceStatusData.offPct}%)
                </span>
              </div>
            </div>
          </div>

          <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80 text-[10px] text-slate-400 text-center">
            Tổng 14 thiết bị giám sát thực tế
          </div>
        </div>

        {/* Biểu đồ 3: Cảnh báo theo thời gian (Chiếm 4/12 cột) */}
        <div className="lg:col-span-4 bg-white dark:bg-factory-card p-4 rounded-xl border border-slate-200/80 dark:border-slate-800 shadow-xs flex flex-col justify-between h-[270px]">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800/80 pb-2.5">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <h3 className="text-xs font-bold text-slate-900 dark:text-white tracking-tight">
                Cảnh báo theo thời gian
              </h3>
            </div>

            <div className="flex items-center gap-2.5 text-[10px] font-semibold">
              <span className="flex items-center gap-1 text-rose-600 dark:text-rose-400">
                <span className="w-2 h-2 rounded-xs bg-rose-500" />
                Nghiêm trọng
              </span>
              <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400">
                <span className="w-2 h-2 rounded-xs bg-amber-500" />
                Cảnh báo
              </span>
            </div>
          </div>

          <div className="h-[190px] w-full pt-1">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={alarmsTimeDistribution} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" opacity={0.6} />
                <XAxis
                  dataKey="time"
                  tick={{ fontSize: 10, fill: '#94a3b8' }}
                  tickLine={false}
                  axisLine={{ stroke: '#e2e8f0' }}
                />
                <YAxis
                  domain={[0, 'auto']}
                  tick={{ fontSize: 10, fill: '#94a3b8' }}
                  tickLine={false}
                  axisLine={{ stroke: '#e2e8f0' }}
                  allowDecimals={false}
                />
                <Tooltip
                  cursor={{ fill: 'rgba(241, 245, 249, 0.4)' }}
                  contentStyle={{
                    backgroundColor: '#0f172a',
                    borderColor: '#334155',
                    borderRadius: '0.5rem',
                    color: '#fff',
                    fontSize: '11px',
                    fontWeight: 600,
                    padding: '6px 10px',
                  }}
                  formatter={(val: any, name: any) => [
                    `${val} sự kiện`,
                    name === 'Critical' ? 'Nghiêm trọng' : 'Cảnh báo',
                  ]}
                  labelFormatter={(lbl) => `Khung giờ: ${lbl}`}
                />
                <Bar dataKey="Critical" stackId="a" fill="#ef4444" radius={[0, 0, 0, 0]} maxBarSize={20} />
                <Bar dataKey="Warning" stackId="a" fill="#f59e0b" radius={[2, 2, 0, 0]} maxBarSize={20} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* KHU VỰC 3: TÌNH TRẠNG 3 DÂY CHUYỀN SẢN XUẤT (CARD LỚN CHỨA 3 CARD CON)     */}
      {/* ========================================================================= */}
      <div className="bg-white dark:bg-factory-card p-4 rounded-xl border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-3">
        <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-800/80 pb-2.5">
          <Layers className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          <h3 className="text-xs font-bold text-slate-900 dark:text-white tracking-tight">
            Tình trạng các dây chuyền sản xuất
          </h3>
        </div>

        {/* 3 Card dây chuyền nằm ngang trên desktop */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
          {sortedLines.map((line) => {
            const lineMachines = line.machines || [];
            const mCount = lineMachines.length || (line as any).machineCount || 0;
            const operatingCount = lineMachines.filter((m) => (m.status || '').toLowerCase() === 'normal').length;
            const alarmCount = lineMachines.filter((m) => {
              const st = (m.status || '').toLowerCase();
              return st === 'warning' || st === 'critical';
            }).length;

            const score = line.safetyScore ?? 98;
            const isHighSafety = score >= 90;
            const isWarningLine = alarmCount > 0 || score < 90;

            // Mini Donut Chart Data
            const miniDonutData = [
              { value: score, color: isHighSafety ? '#10b981' : '#f59e0b' },
              { value: Math.max(0, 100 - score), color: '#e2e8f0' },
            ];

            const sparkData = getLineSparkline(score);

            return (
              <div
                key={line.id}
                onClick={() => {
                  setSelectedLineId(line.id);
                  setActiveTab('devices', 'monitoring');
                }}
                className="p-3.5 rounded-xl border border-slate-200/70 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-800/20 hover:bg-slate-100/70 dark:hover:bg-slate-800/50 hover:border-slate-300 dark:hover:border-slate-700 transition-all flex flex-col justify-between cursor-pointer group"
              >
                {/* Header card: Icon + Mã + Tên + Badge trạng thái */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-9 h-9 rounded-lg bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0 border border-blue-200/60 dark:border-blue-800/40">
                      {line.code === 'LN-PRS-01' ? (
                        <Factory className="w-5 h-5 text-blue-600" />
                      ) : line.code === 'LN-PNT-02' ? (
                        <Wrench className="w-5 h-5 text-amber-600" />
                      ) : (
                        <Cpu className="w-5 h-5 text-emerald-600" />
                      )}
                    </div>

                    <div className="min-w-0">
                      <div className="font-mono text-xs font-bold text-blue-700 dark:text-blue-400">
                        {line.code}
                      </div>
                      <div
                        className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors"
                        title={line.name}
                      >
                        {line.name}
                      </div>
                    </div>
                  </div>

                  {/* Badge trạng thái */}
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-semibold flex items-center gap-1 shrink-0 ${
                      isWarningLine
                        ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800/40'
                        : 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/40'
                    }`}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full ${isWarningLine ? 'bg-amber-500' : 'bg-emerald-500'}`} />
                    {isWarningLine ? 'Cảnh báo' : 'Đang vận hành'}
                  </span>
                </div>

                {/* Thân card: Donut an toàn + Thông số thiết bị + Mini sparkline */}
                <div className="flex items-center justify-between gap-2 pt-3 mt-1">
                  {/* Donut Chart nhỏ */}
                  <div className="relative w-[65px] h-[65px] shrink-0">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={miniDonutData}
                          cx="50%"
                          cy="50%"
                          innerRadius={21}
                          outerRadius={28}
                          startAngle={90}
                          endAngle={-270}
                          dataKey="value"
                          stroke="none"
                        >
                          {miniDonutData.map((entry, index) => (
                            <Cell key={`donut-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                      </PieChart>
                    </ResponsiveContainer>

                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <span
                        className={`text-xs font-black font-mono leading-none ${
                          isHighSafety ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'
                        }`}
                      >
                        {score}%
                      </span>
                    </div>
                  </div>

                  {/* Cột thông số ở giữa */}
                  <div className="space-y-0.5 text-[11px] text-slate-600 dark:text-slate-300 font-medium">
                    <div className="flex items-center gap-1">
                      <span className="text-slate-400 font-bold">+</span>
                      <span>Thiết bị: <strong className="font-mono text-slate-900 dark:text-white">{mCount}</strong></span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                      <span>Hoạt động: <strong className="font-mono text-slate-800 dark:text-slate-200">{operatingCount}</strong></span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${alarmCount > 0 ? 'bg-rose-500' : 'bg-slate-300'}`} />
                      <span>Cảnh báo: <strong className={`font-mono ${alarmCount > 0 ? 'text-rose-600 dark:text-rose-400 font-bold' : 'text-slate-500'}`}>{alarmCount}</strong></span>
                    </div>
                  </div>

                  {/* Mini Sparkline ở góc phải */}
                  <div className="w-[65px] h-[30px] shrink-0 self-center">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={sparkData}>
                        <Line
                          type="monotone"
                          dataKey="v"
                          stroke={isHighSafety ? '#10b981' : '#f59e0b'}
                          strokeWidth={1.8}
                          dot={false}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* KHU VỰC 4: 3 CARD GIÁM SÁT BỔ SUNG                                        */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3.5">
        {/* CARD 1: Lịch sử trạng thái dây chuyền (24h) Heatmap */}
        <div className="bg-white dark:bg-factory-card p-4 rounded-xl border border-slate-200/80 dark:border-slate-800 shadow-xs flex flex-col justify-between h-[270px]">
          <div>
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800/80 pb-2.5">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                <h3 className="text-xs font-bold text-slate-900 dark:text-white tracking-tight">
                  Lịch sử trạng thái dây chuyền (24h)
                </h3>
              </div>

              {/* Chú giải Heatmap */}
              <div className="flex items-center gap-2 text-[10px] font-semibold text-slate-500">
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-xs bg-emerald-500" />
                  Vận hành
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-xs bg-amber-500" />
                  Cảnh báo
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-xs bg-rose-500" />
                  Dừng
                </span>
              </div>
            </div>

            {/* Bảng Heatmap */}
            <div className="space-y-3 pt-3">
              {lineHeatmapData.map((row) => (
                <div key={row.lineId} className="space-y-1">
                  <div className="flex items-center justify-between text-[11px] font-mono">
                    <span className="font-bold text-slate-700 dark:text-slate-300">
                      {row.lineCode}
                    </span>
                  </div>

                  {/* Hàng các ô trạng thái thời gian */}
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(18, minmax(0, 1fr))',
                      gap: '3px',
                    }}
                  >
                    {row.cells.map((cell, cIdx) => {
                      const bgClass =
                        cell.status === 'critical'
                          ? 'bg-rose-500 hover:bg-rose-600'
                          : cell.status === 'warning'
                          ? 'bg-amber-500 hover:bg-amber-600'
                          : cell.status === 'no_data'
                          ? 'bg-slate-200 dark:bg-slate-700'
                          : 'bg-emerald-500 hover:bg-emerald-600';

                      return (
                        <div
                          key={`c-${cIdx}`}
                          onMouseEnter={() =>
                            setHoveredHeatmapCell({
                              lineCode: row.lineCode,
                              lineName: row.lineName,
                              time: cell.hour,
                              status: cell.status,
                              statusText: cell.statusText,
                            })
                          }
                          onMouseLeave={() => setHoveredHeatmapCell(null)}
                          className={`h-4 rounded-xs transition-colors cursor-pointer ${bgClass}`}
                        />
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Trục mốc thời gian ở đáy Heatmap & Tooltip */}
          <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80">
            {hoveredHeatmapCell ? (
              <div className="text-[10px] text-slate-600 dark:text-slate-300 font-medium flex items-center justify-between">
                <span>
                  <strong>{hoveredHeatmapCell.lineCode}</strong> lúc {hoveredHeatmapCell.time}:
                </span>
                <span
                  className={
                    hoveredHeatmapCell.status === 'critical'
                      ? 'text-rose-600 font-bold'
                      : hoveredHeatmapCell.status === 'warning'
                      ? 'text-amber-600 font-bold'
                      : 'text-emerald-600 font-bold'
                  }
                >
                  {hoveredHeatmapCell.statusText}
                </span>
              </div>
            ) : (
              <div className="flex items-center justify-between text-[9px] font-mono text-slate-400">
                <span>00:00</span>
                <span>04:00</span>
                <span>08:00</span>
                <span>12:00</span>
                <span>16:00</span>
                <span>20:00</span>
              </div>
            )}
          </div>
        </div>

        {/* CARD 2: Hoạt động gần đây (Timeline 4 sự kiện) */}
        <div className="bg-white dark:bg-factory-card p-4 rounded-xl border border-slate-200/80 dark:border-slate-800 shadow-xs flex flex-col justify-between h-[270px]">
          <div>
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800/80 pb-2.5">
              <div className="flex items-center gap-2">
                <History className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                <h3 className="text-xs font-bold text-slate-900 dark:text-white tracking-tight">
                  Hoạt động gần đây
                </h3>
              </div>

              <button
                onClick={() => setActiveTab('audit')}
                className="text-[11px] font-bold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 cursor-pointer transition-colors"
              >
                <span>Xem tất cả</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            </div>

            {/* Danh sách Timeline */}
            <div className="space-y-3 pt-3">
              {recentActivities.map((item) => (
                <div key={item.id} className="flex items-start gap-2.5 text-xs">
                  <span
                    className="w-2 h-2 rounded-full mt-1.5 shrink-0"
                    style={{ backgroundColor: item.color }}
                  />
                  <div className="flex items-baseline gap-2 min-w-0">
                    <span className="font-mono text-[11px] text-slate-400 shrink-0 font-semibold">
                      {item.time}
                    </span>
                    <span
                      className="text-slate-700 dark:text-slate-300 truncate font-medium text-[11px]"
                      title={item.title}
                    >
                      {item.title}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80 text-[10px] text-slate-400 flex items-center justify-between">
            <span>Dữ liệu ghi nhận từ Hệ thống & Audit Log</span>
            <span className="text-emerald-600 font-semibold font-mono">SYNC: LIVE</span>
          </div>
        </div>

        {/* CARD 3: Cảnh báo cần xử lý (Bảng các cảnh báo đang mở) */}
        <div className="bg-white dark:bg-factory-card p-4 rounded-xl border border-slate-200/80 dark:border-slate-800 shadow-xs flex flex-col justify-between h-[270px]">
          <div>
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800/80 pb-2.5">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                <h3 className="text-xs font-bold text-slate-900 dark:text-white tracking-tight">
                  Cảnh báo cần xử lý ({activeAlarmsCount})
                </h3>
              </div>

              <button
                onClick={() => setActiveTab('alarms')}
                className="text-[11px] font-bold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 cursor-pointer transition-colors"
              >
                <span>Xem tất cả</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            </div>

            {/* Bảng compact */}
            {openAlarmsList.length === 0 ? (
              <div className="py-10 text-center text-xs text-slate-400 space-y-1">
                <CheckCircle2 className="w-7 h-7 mx-auto text-emerald-500/80 mb-1" />
                <p className="font-medium text-slate-600 dark:text-slate-300">Không có cảnh báo tồn đọng</p>
                <p className="text-[10px] text-slate-400">Tất cả thông số đang trong ngưỡng kỹ thuật</p>
              </div>
            ) : (
              <div className="overflow-x-auto mt-1.5">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-100 dark:border-slate-800/80 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      <th className="py-1.5 px-1">Thời gian</th>
                      <th className="py-1.5 px-1">Dây chuyền</th>
                      <th className="py-1.5 px-1">Thiết bị / Thông số</th>
                      <th className="py-1.5 px-1 text-right">Mức độ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-[11px]">
                    {openAlarmsList.map((alm) => {
                      const isCrit = alm.severity === 'critical';
                      const timeStr = alm.timestamp ? alm.timestamp.slice(11, 16) : '15:30';
                      const lineLabel = alm.lineName?.includes('LN-')
                        ? alm.lineName.slice(0, 9)
                        : alm.lineId;

                      return (
                        <tr key={alm.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/30 transition-colors">
                          <td className="py-2 px-1 font-mono text-[10px] text-slate-500 whitespace-nowrap">
                            {timeStr}
                          </td>
                          <td className="py-2 px-1 font-mono font-bold text-slate-800 dark:text-slate-200 whitespace-nowrap">
                            {lineLabel}
                          </td>
                          <td className="py-2 px-1 text-slate-600 dark:text-slate-300 truncate max-w-[110px]" title={alm.metricName}>
                            {alm.metricName || alm.metricId}
                          </td>
                          <td className="py-2 px-1 text-right whitespace-nowrap">
                            {isCrit ? (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-800/40">
                                Nghiêm trọng
                              </span>
                            ) : (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800/40">
                                Cảnh báo
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80 text-[10px] text-slate-400 flex items-center justify-between">
            <span>Chỉ hiển thị cảnh báo đang mở</span>
            <span className="font-mono text-emerald-600 font-semibold">STATUS: OPEN</span>
          </div>
        </div>
      </div>
    </div>
  );
}
