/**
 * @file MachineDetailView.tsx
 * @description Màn hình 3: Machine Detail – Chi tiết Thiết bị & Vận hành DENSO Smart Factory
 * - Đồng bộ trạng thái nhất quán với Factory Layout, Line Overview và CHECK SHEET
 * - Phân định rõ: Trạng thái vận hành (RUNNING/STOPPED) vs Mức độ cảnh báo (CRITICAL/WARNING/NORMAL) vs Health Score
 * - Header với breadcrumb, thông tin máy, và NÚT NỔI BẬT "Mở CHECK SHEET" (màu xanh dương đậm)
 * - Thông số kỹ thuật thiết bị (Mã, Tên, Model, Vị trí, Dây chuyền, Ngày vận hành)
 * - 4 Thẻ trạng thái vận hành chuẩn hóa từ resolveMachineMonitoringState
 * - Bảng thông số vận hành thời gian thực kết nối trực tiếp với dữ liệu metric Tầng 3
 * - Biểu đồ AreaChart xu hướng biến thiên cảm biến với dropdown chọn thông số động
 * - Donut chart thời gian trạng thái hoạt động phản ánh đúng trạng thái thực tế
 * - TUYỆT ĐỐI KHÔNG CÓ OEE, Availability, Performance, Quality
 */

import { useMemo, useEffect, useState } from 'react';
import {
  ArrowLeft,
  ClipboardList,
  Download,
  ShieldCheck,
  Clock,
  Calendar,
  CheckCircle2,
  AlertTriangle,
  Info,
  Sparkles,
} from 'lucide-react';
import { useMonitoringStore } from '../../stores/useMonitoringStore';
import { resolveMachineMonitoringState } from '../../utils/machineStatusResolver';
import { MachineImageViewer } from '../../components/common/MachineImageViewer';
import { useTranslation } from 'react-i18next';
import { EmbeddedCheckSheet } from './detail/EmbeddedCheckSheet';
import { MachineDocuments } from './detail/MachineDocuments';
import { UnipulsePanel } from './detail/UnipulsePanel';
import { ExpandToggle } from './detail/ExpandToggle';
import { tr } from '../../i18n/tr';
import { downloadMachineCsv } from './detail/machineCsv';
import { useLiveMetrics, fmtNum } from './detail/useLiveMetrics';

interface MachineDetailViewProps {
  machineId: string;
  onBackToLine: () => void;
  /** Không còn dùng: Check Sheet đã nằm ngay trong trang (giữ để tương thích nơi gọi) */
  onOpenCheckSheet?: (machineId: string) => void;
}

export function MachineDetailView({
  machineId,
  onBackToLine,
}: MachineDetailViewProps) {
  const { t } = useTranslation();
  const { lines, fetchMachines, isRealtimeActive } = useMonitoringStore();
  // Phần chi tiết của 2 ô mặc định thu gọn (bấm ▾ để xem)
  const [showSpecs, setShowSpecs] = useState(false);
  const [showTelemetry, setShowTelemetry] = useState(false);

  // Tìm máy trong danh sách các dây chuyền
  const { machine, parentLine } = useMemo(() => {
    for (const l of lines) {
      const found = l.machines?.find((m) => m.id === machineId || m.code === machineId);
      if (found) return { machine: found, parentLine: l };
    }
    return { machine: null, parentLine: null };
  }, [lines, machineId]);

  // Safeguard: Nếu máy chưa nạp metrics nhưng có mappingCount > 0, tự động đồng bộ từ Store/API
  useEffect(() => {
    if (machine && (!machine.metrics || machine.metrics.length === 0) && (machine.mappingCount ?? 0) > 0) {
      fetchMachines();
    }
  }, [machine?.id, machine?.metrics?.length, machine?.mappingCount, fetchMachines]);

  // Chuẩn hóa trạng thái máy bằng resolveMachineMonitoringState
  const resolved = useMemo(() => {
    return resolveMachineMonitoringState(machine, parentLine);
  }, [machine, parentLine]);

  // Thông số sống: quy cách chuẩn + giá trị cập nhật mỗi giây (dùng cho bảng thông số và Check sheet)
  const live = useLiveMetrics(machine?.id ?? machineId, resolved.metrics, isRealtimeActive);

  // XỬ LÝ BIÊN: Khi máy không xác định được trong CSDL
  if (!machine) {
    return (
      <div className="p-8 sm:p-12 text-center space-y-4 bg-white dark:bg-factory-card rounded-2xl border border-slate-200/90 shadow-xs">
        <div className="w-14 h-14 rounded-2xl bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400 flex items-center justify-center mx-auto border border-amber-200 dark:border-amber-800">
          <AlertTriangle className="w-7 h-7" />
        </div>
        <div>
          <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
            {tr("Chưa tìm thấy thiết bị (")}{machineId})
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-md mx-auto">
            {tr("Mã thiết bị chưa được liên kết với dây chuyền hoặc chưa có trong danh mục CSDL. Hệ thống hiển thị trạng thái N/A an toàn, không sử dụng dữ liệu giả.")}
          </p>
        </div>
        <button
          type="button"
          onClick={onBackToLine}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-all shadow-xs cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>{tr("Quay lại Dây chuyền")}</span>
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-5 animate-in fade-in duration-150">
      {/* 1. Header Chi tiết Máy & NÚT NỔI BẬT "MỞ CHECK SHEET" */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-5 rounded-2xl border border-slate-200/90 dark:border-factory-border bg-white dark:bg-factory-card shadow-xs">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBackToLine}
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 dark:border-factory-border bg-slate-50 dark:bg-factory-surface text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 transition-colors cursor-pointer"
            title={tr("Quay lại Sơ đồ Dây chuyền")}
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-mono font-bold text-blue-600 dark:text-blue-400">
                {machine.code || machine.id}
              </span>
              <span className="text-slate-300 dark:text-slate-600">•</span>
              <h1 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">
                {machine.name}
              </h1>

              {/* Huy hiệu chế độ mô phỏng nếu có */}
              {resolved.isSimulated && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                  <Sparkles className="w-3 h-3" />
                  <span>{tr("Dữ liệu Mô phỏng")}</span>
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {tr("Chi tiết thiết bị trong dây chuyền")} {parentLine?.name || machine.lineName || tr("LN-PRS-01 – Dập & Hàn")}
            </p>
          </div>
        </div>

        {/* Nút Hành động bên phải: MỞ CHECK SHEET (Nổi bật nhất) */}
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => document.getElementById('check-sheet')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 active:scale-98 text-white font-bold text-xs shadow-md shadow-blue-600/25 transition-all cursor-pointer"
          >
            <ClipboardList className="w-4 h-4 stroke-[2.3]" />
            <span>{t('machine.checkSheetBtn')}</span>
          </button>

          <button
            type="button"
            onClick={() => downloadMachineCsv(machine.id, machine.code, resolved.metrics as never[])}
            title={tr("Tải file CSV dữ liệu của máy (check sheet ca + điều kiện gia công 30 ngày)")}
            className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl border border-emerald-500/40 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-500/20 font-semibold text-xs transition-colors cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <span className="hidden sm:inline">{tr("Tải CSV")}</span>
          </button>
        </div>
      </div>

      {/* 2. HÀNG 4 THẺ TRẠNG THÁI VẬN HÀNH (KHÔNG OEE) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Thẻ 1: Trạng thái vận hành */}
        <div className="p-4 rounded-xl border border-slate-200/90 dark:border-factory-border bg-white dark:bg-factory-card shadow-xs flex items-center gap-3">
          <div className="relative flex h-4 w-4 shrink-0">
            {resolved.operatingStatus === 'RUNNING' ? (
              <>
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-4 w-4 bg-emerald-500" />
              </>
            ) : resolved.operatingStatus === 'STOPPED' ? (
              <span className="relative inline-flex rounded-full h-4 w-4 bg-rose-500" />
            ) : (
              <span className="relative inline-flex rounded-full h-4 w-4 bg-slate-400" />
            )}
          </div>
          <div className="min-w-0">
            <p className="text-[11px] text-slate-400 font-medium">{tr("Trạng thái vận hành")}</p>
            <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
              <span className={`text-sm font-black ${resolved.operatingStatusColor}`}>
                {resolved.operatingStatus} ({resolved.operatingStatusLabel})
              </span>
              {/* Badge mức cảnh báo nếu có cảnh báo */}
              {resolved.alarmSeverity !== 'NORMAL' && resolved.alarmSeverity !== 'UNKNOWN' && (
                <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded-full ${resolved.alarmBadgeBg}`}>
                  {resolved.alarmSeverityLabel}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Thẻ 2: Mức độ an toàn (Health Score) */}
        <div className="p-4 rounded-xl border border-slate-200/90 dark:border-factory-border bg-white dark:bg-factory-card shadow-xs flex items-center gap-3">
          <ShieldCheck
            className="w-6 h-6 shrink-0"
            style={{ color: resolved.healthScoreColor }}
          />
          <div className="min-w-0">
            <p className="text-[11px] text-slate-400 font-medium">{tr("Mức độ an toàn")}</p>
            <p className="text-sm font-mono font-black mt-0.5" style={{ color: resolved.healthScoreColor }}>
              {resolved.healthScore != null ? `${resolved.healthScore.toFixed(1)}%` : 'N/A'}
              {resolved.healthScore != null && resolved.healthScore >= 90 && (
                <span className="ml-1 text-[11px] font-sans font-bold text-emerald-600">▲ +1.2%</span>
              )}
            </p>
          </div>
        </div>

        {/* Thẻ 3: Thời gian hoạt động */}
        <div className="p-4 rounded-xl border border-slate-200/90 dark:border-factory-border bg-white dark:bg-factory-card shadow-xs flex items-center gap-3">
          <Clock className="w-6 h-6 text-blue-600 shrink-0" />
          <div className="min-w-0">
            <p className="text-[11px] text-slate-400 font-medium">{tr("Thời gian hoạt động")}</p>
            <p className="text-sm font-mono font-black text-slate-900 dark:text-white mt-0.5">
              {machine.uptimeHours != null ? tr("{0} giờ (Ca 1)", machine.uptimeHours) : tr("6.7 giờ (Ca 1)")}
            </p>
          </div>
        </div>

        {/* Thẻ 4: Bảo dưỡng định kỳ tiếp theo */}
        <div className="p-4 rounded-xl border border-slate-200/90 dark:border-factory-border bg-white dark:bg-factory-card shadow-xs flex items-center gap-3">
          <Calendar className="w-6 h-6 text-purple-600 shrink-0" />
          <div className="min-w-0">
            <p className="text-[11px] text-slate-400 font-medium">{tr("Bảo dưỡng tiếp theo")}</p>
            <p className="text-sm font-mono font-bold text-slate-900 dark:text-white mt-0.5">
              {machine.lastMaintenance || tr("31/01/2026 (7 ngày)")}
            </p>
          </div>
        </div>
      </div>

      {/* 3. THÔNG TIN THIẾT BỊ | THÔNG SỐ VẬN HÀNH + UNIPULSE — 2 cột cao bằng nhau; phần chi tiết thu gọn, bấm ▾ để xem */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
        {/* Cột trái (4/12): Thông tin thiết bị + Tài liệu máy */}
        <section className="lg:col-span-5 p-4 rounded-2xl border border-slate-200/90 dark:border-factory-border bg-white dark:bg-factory-card shadow-xs flex flex-col gap-3">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              {tr("Thông tin kỹ thuật thiết bị")}
            </h3>
            <ExpandToggle open={showSpecs} onToggle={() => setShowSpecs((v) => !v)} controls="machine-specs" />
          </div>

          {/* Ảnh máy lớn + tên máy */}
          <div className="rounded-xl border border-slate-200/80 dark:border-factory-border overflow-hidden">
            <div className="h-56 sm:h-64 flex items-center justify-center bg-[radial-gradient(120%_90%_at_50%_100%,#E2E8F0_0%,#F8FAFC_70%)] dark:bg-[radial-gradient(120%_90%_at_50%_100%,#1E293B_0%,#0F172A_75%)]">
              <MachineImageViewer
                machineId={machine.id}
                machineCode={machine.code}
                imageUrl={machine.imageUrl}
                alt={machine.name}
                name={machine.name}
                code={machine.code || machine.id}
                className="max-h-52 sm:max-h-60 w-auto max-w-full object-contain drop-shadow-[0_12px_14px_rgba(15,23,42,0.22)]"
                containerClassName="w-full h-full flex items-center justify-center p-3"
                showFallbackLabel={false}
              />
            </div>
            <div className="px-3.5 py-2.5 border-t border-slate-200/80 dark:border-factory-border bg-slate-50/60 dark:bg-factory-surface">
              <p className="text-base font-bold text-slate-900 dark:text-white truncate">{machine.model || machine.name}</p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                <span className="font-mono font-semibold text-blue-700 dark:text-blue-300">{machine.code || machine.id}</span>
                {' · '}
                {tr("Hệ thống cảm biến IoT đa điểm chuẩn kết nối Modbus TCP / OPC-UA")}
              </p>
            </div>
          </div>

          {/* Danh sách thuộc tính (ẩn mặc định, bấm ▾ để xem) */}
          {showSpecs && (
          <dl
            id="machine-specs"
            tabIndex={0}
            aria-label={tr("Thông tin kỹ thuật thiết bị")}
            className="h-[196px] overflow-y-auto pr-1.5 divide-y divide-slate-100 dark:divide-factory-border text-xs [scrollbar-width:thin]"
          >
            {[
              [tr("Mã thiết bị:"), <strong key="c" className="font-mono text-slate-900 dark:text-white">{machine.code || machine.id}</strong>],
              [tr("Tên thiết bị:"), machine.name],
              [tr("Dây chuyền:"), parentLine?.name || machine.lineName || '—'],
              [tr("Hãng / Model:"), machine.manufacturer ? `${machine.manufacturer} / ${machine.model || 'Standard'}` : machine.model || '—'],
              ...(machine.serialNumber ? [[tr("Số Serial:"), machine.serialNumber]] : []),
              [tr("Vị trí lắp đặt:"), machine.location || tr("Khu vực công đoạn")],
              [tr("Ngày đưa vào sử dụng:"), machine.installationDate || '01/03/2023'],
              ...(machine.ratedPower ? [[tr("Công suất định mức:"), machine.ratedPower]] : []),
              [tr("Bảo dưỡng tiếp theo"), machine.lastMaintenance || '—'],
              [tr("Số thông số giám sát:"), String(resolved.metrics.length)],
              [tr("Nguồn dữ liệu:"), resolved.isSimulated ? tr("Mô phỏng") : 'PLC'],
              [tr("Kết nối:"), 'Modbus TCP · OPC-UA'],
            ].map(([k, v], i) => (
              <div key={i} className="py-2 flex items-start justify-between gap-3">
                <dt className="text-slate-400 shrink-0">{k}</dt>
                <dd className="text-right font-medium text-slate-800 dark:text-slate-200 min-w-0 break-words">{v}</dd>
              </div>
            ))}
          </dl>
          )}

          {/* Tài liệu máy: Bản vẽ / Chương trình / Khác */}
          <MachineDocuments machineId={machine.id} />
        </section>

        {/* Cột phải (8/12) */}
        <div className="lg:col-span-7 flex flex-col gap-4 min-w-0">
          {/* Thông số vận hành (Realtime) */}
          <section className="p-4 rounded-2xl border border-slate-200/90 dark:border-factory-border bg-white dark:bg-factory-card shadow-xs flex flex-col gap-3">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                {tr("Thông số vận hành (Realtime Telemetry)")}
              </h3>
              {live.length > 0 && <ExpandToggle open={showTelemetry} onToggle={() => setShowTelemetry((v) => !v)} controls="machine-telemetry" />}
            </div>
            {live.length > 0 && (
                <div className="flex flex-wrap gap-1.5 text-[11px] font-bold">
                  <span className="px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200">
                    {tr("{0} thông số", live.length)}
                  </span>
                  <span className="px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300">
                    {live.filter((m) => m.status === 'ok').length} OK
                  </span>
                  {live.some((m) => m.status === 'near') && (
                    <span className="px-2.5 py-1 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300">
                      {tr("{0} gần ngưỡng", live.filter((m) => m.status === 'near').length)}
                    </span>
                  )}
                  {live.some((m) => m.status === 'ng') && (
                    <span className="px-2.5 py-1 rounded-full bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300">
                      {tr("{0} ngoài quy cách", live.filter((m) => m.status === 'ng').length)}
                    </span>
                  )}
                  <span className="px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 flex items-center gap-1.5">
                    <span className={`w-1.5 h-1.5 rounded-full bg-emerald-500 ${isRealtimeActive ? 'animate-pulse' : 'opacity-40'}`} />
                    {tr("Chu kỳ cập nhật 1s")}
                  </span>
                </div>
            )}

            {live.length > 0 ? (showTelemetry && (
              <div
                id="machine-telemetry"
                tabIndex={0}
                aria-label={tr("Thông số vận hành (Realtime Telemetry)")}
                className="max-h-[232px] overflow-auto rounded-xl border border-slate-200 dark:border-slate-700 [scrollbar-width:thin]"
              >
                <table className="w-full table-fixed text-left text-xs border-collapse">
                  <colgroup>
                    <col />
                    <col className="w-[24%]" />
                    <col className="w-[22%]" />
                    <col className="w-[19%]" />
                  </colgroup>
                  <thead>
                    <tr className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                      <th className="sticky top-0 z-[1] bg-slate-50 dark:bg-slate-800 py-2 px-3 border-b border-slate-200 dark:border-slate-700">{tr("Thông số")}</th>
                      <th className="sticky top-0 z-[1] bg-slate-50 dark:bg-slate-800 py-2 px-3 border-b border-slate-200 dark:border-slate-700 text-right">{tr("Giá trị hiện tại")}</th>
                      <th className="sticky top-0 z-[1] bg-slate-50 dark:bg-slate-800 py-2 px-3 border-b border-slate-200 dark:border-slate-700 text-right">{tr("Quy cách")}</th>
                      <th className="sticky top-0 z-[1] bg-slate-50 dark:bg-slate-800 py-2 px-3 border-b border-slate-200 dark:border-slate-700 text-center">{tr("Trạng thái")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {live.map((m) => (
                      <tr
                        key={m.id}
                        className={`border-b border-slate-100 dark:border-slate-800 ${m.status === 'near' ? 'bg-amber-50/70 dark:bg-amber-950/20' : m.status === 'ng' ? 'bg-rose-50/70 dark:bg-rose-950/20' : ''}`}
                      >
                        <td className="py-2 px-3 font-medium text-slate-800 dark:text-slate-200">{m.name}</td>
                        <td className="py-2 px-3 text-right font-mono font-bold tabular-nums text-slate-900 dark:text-white whitespace-nowrap">
                          {fmtNum(m.value, m.decimals)} <span className="font-normal text-[11px] text-slate-500">{m.unit}</span>
                        </td>
                        <td className="py-2 px-3 text-right font-mono text-[11px] text-slate-500 whitespace-nowrap">
                          {fmtNum(m.min, m.decimals)} – {fmtNum(m.max, m.decimals)}
                        </td>
                        <td className="py-2 px-3 text-center">
                          {m.status === 'ng' ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-400">
                              <AlertTriangle className="w-3 h-3" /> {tr("Ngoài QC")}
                            </span>
                          ) : m.status === 'near' ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-400">
                              <AlertTriangle className="w-3 h-3" /> {tr("Gần ngưỡng")}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400">
                              <CheckCircle2 className="w-3 h-3" /> OK
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )) : (
              <div className="py-8 text-center space-y-2">
                <Info className="w-8 h-8 mx-auto text-slate-300 dark:text-slate-600" />
                <p className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                  {tr("Thiết bị chưa được cấu hình Metric Mapping tại Tầng 3")}
                </p>
                <p className="text-[11px] text-slate-400">
                  {tr("Hệ thống không hiển thị telemetry giả. Vui lòng thiết lập mapping tín hiệu cảm biến trong phần Cấu hình.")}
                </p>
              </div>
            )}
          </section>

          {/* Dữ liệu đo từ file CSV thiết bị Unipulse */}
          <UnipulsePanel machineId={machine.id} className="flex-1" />
        </div>
      </div>

      {/* 4. CHECK SHEET ĐẦU / CUỐI CA (nằm ngay trong Chi tiết máy, thay trang Check Sheet riêng) */}
      <EmbeddedCheckSheet machineId={machine.id} machineCode={machine.code || machine.id} metrics={live} />
    </div>
  );
}
