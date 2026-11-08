/**
 * @file MachineDetailModal.tsx
 * @description Modal Chi tiết Thiết bị chuẩn xác theo thiết kế vận hành DENSO KaiLink
 * Hiển thị Banner thuộc tính, Thẻ Metric hiện tại và Biểu đồ lịch sử AreaChart
 * Tương thích cao với cả giao diện Sáng (Light) và Tối (Dark)
 */

import { useState, useEffect, useCallback } from 'react';
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
} from '@heroui/react';
import {
  RefreshCw,
  QrCode,
  Sliders,
  Calendar,
  FileSpreadsheet,
  Cpu,
} from 'lucide-react';
import { MachineComponent } from '../../types/hierarchy';
import { MetricHistoryChart } from '../../components/charts/MetricHistoryChart';
import { useMonitoringStore } from '../../stores/useMonitoringStore';
import { historyService } from '../../services/historyService';

export type TimeRangeMode = '1h' | '6h' | '24h' | 'csv_preset' | 'custom';

interface MachineDetailModalProps {
  machine: MachineComponent | null;
  lineName?: string;
  isOpen: boolean;
  onClose: () => void;
  onOpenQR?: () => void;
}

export function MachineDetailModal({
  machine,
  lineName,
  isOpen,
  onClose,
  onOpenQR,
}: MachineDetailModalProps) {
  const { lines, setActiveTab, simulateTick } = useMonitoringStore();
  const [selectedMetricId, setSelectedMetricId] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState<TimeRangeMode>('1h');
  const [customDate, setCustomDate] = useState<string>('2026-05-22');
  const [customHistory, setCustomHistory] = useState<Array<{ timestamp: string; value: number }> | null>(null);
  const [isLoadingHistory, setIsLoadingHistory] = useState<boolean>(false);

  // Metric đang chọn để xem biểu đồ
  const activeMetric =
    machine?.metrics.find((m) => m.id === selectedMetricId) || machine?.metrics[0];

  const fetchChartHistory = useCallback(async () => {
    if (!machine || !activeMetric) return;
    setIsLoadingHistory(true);
    try {
      const filterParams: any = {
        machineId: machine.id,
        metricId: activeMetric.id,
        limit: 100,
        sortBy: 'timestamp',
        sortOrder: 'ASC',
      };

      if (timeRange === 'csv_preset') {
        filterParams.startDate = '2026-05-22';
        filterParams.endDate = '2026-05-22';
      } else if (timeRange === 'custom') {
        if (customDate) {
          filterParams.startDate = customDate;
          filterParams.endDate = customDate;
        }
      }

      const res = await historyService.getTelemetryLogs(filterParams);
      if (res && Array.isArray(res.data) && res.data.length > 0) {
        setCustomHistory(
          res.data.map((item) => {
            const rawTs = item.timestamp || '';
            const timeLabel = rawTs.length >= 19 ? rawTs.replace('T', ' ').slice(11, 19) : rawTs;
            return {
              timestamp: timeLabel,
              value: Number(item.value),
            };
          })
        );
      } else {
        setCustomHistory([]);
      }
    } catch {
      setCustomHistory([]);
    } finally {
      setIsLoadingHistory(false);
    }
  }, [machine?.id, activeMetric?.id, timeRange, customDate]);

  useEffect(() => {
    if (isOpen && machine && activeMetric) {
      fetchChartHistory();
    }
  }, [isOpen, machine?.id, activeMetric?.id, timeRange, customDate, fetchChartHistory]);

  if (!machine || !activeMetric) return null;

  const lineObj = lines.find((l) => l.id === machine.lineId || l.code === machine.lineId);
  const displayLineCode = lineObj?.code || machine.lineId;
  const displayLineName = lineObj?.name || lineName || machine.lineName || '';

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      backdrop="blur"
      size="5xl"
      scrollBehavior="inside"
      classNames={{
        base: 'bg-factory-card border border-factory-border text-foreground max-h-[92vh] rounded-2xl',
        header: 'border-b border-factory-border p-6 pb-4 bg-factory-card',
        footer: 'border-t border-factory-border p-4 bg-factory-card',
      }}
    >
      <ModalContent>
        {() => (
          <>
            {/* ========================================================================= */}
            {/* HEADER MODAL: TIÊU ĐỀ CHI TIẾT THIẾT BỊ & NÚT LÀM MỚI                     */}
            {/* ========================================================================= */}
            <ModalHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">
                  Chi tiết Thiết bị
                </h2>
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                  {displayLineCode ? `${displayLineCode} • ` : ''}
                  {displayLineName ? `${displayLineName} • ` : ''}
                  Giá trị hiện tại và biến động lịch sử của các thông số đo thuộc thiết bị.
                </p>
              </div>

              <div className="flex items-center gap-2">
                {/* Selector badge thiết bị */}
                <div className="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-factory-bg border border-slate-200 dark:border-factory-border font-mono text-xs font-bold text-slate-900 dark:text-white">
                  {machine.code || machine.id}
                </div>

                <Button
                  size="sm"
                  variant="flat"
                  isLoading={isLoadingHistory}
                  className="bg-slate-100 dark:bg-factory-bg border border-slate-200 dark:border-factory-border text-slate-700 dark:text-gray-300 hover:text-slate-950 dark:hover:text-white text-xs font-semibold"
                  startContent={!isLoadingHistory && <RefreshCw className="w-3.5 h-3.5" />}
                  onPress={() => {
                    fetchChartHistory();
                    simulateTick();
                  }}
                >
                  Làm mới
                </Button>
              </div>
            </ModalHeader>

            <ModalBody className="p-6 space-y-6">
              {/* ========================================================================= */}
              {/* BANNER THÔNG TIN META DỮ LIỆU CỦA THIẾT BỊ                                */}
              {/* ========================================================================= */}
              <div className="bg-slate-50 dark:bg-factory-bg/60 p-4 rounded-xl border border-slate-200 dark:border-factory-border grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-4 text-xs font-mono">
                <div>
                  <p className="text-[10px] text-slate-500 dark:text-gray-400 uppercase font-bold">THIẾT BỊ</p>
                  <p className="font-bold text-slate-900 dark:text-white mt-0.5 truncate" title={machine.name}>
                    {machine.code || machine.id}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-500 dark:text-gray-400 uppercase font-bold">DÂY CHUYỀN</p>
                  <p className="font-bold text-slate-900 dark:text-white mt-0.5 truncate" title={displayLineName}>
                    {displayLineCode}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-500 dark:text-gray-400 uppercase font-bold">LOẠI</p>
                  <p className="mt-0.5">
                    <span className="px-2 py-0.5 rounded bg-white dark:bg-factory-card border border-slate-200 dark:border-factory-border text-[10px] font-bold text-slate-700 dark:text-gray-300">
                      {machine.dataSourceType === 'FILE_INGEST' ? 'CSV FILE' : 'PLC / ADC'}
                    </span>
                  </p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-500 dark:text-gray-400 uppercase font-bold">NGUỒN</p>
                  <p className="font-bold text-slate-900 dark:text-white mt-0.5 truncate">
                    {machine.dataSourceType === 'FILE_INGEST' ? 'FILE INGEST (TEST)' : 'MODBUS (DISCONNECTED)'}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-500 dark:text-gray-400 uppercase font-bold">OBJECT</p>
                  <p className="font-bold text-slate-900 dark:text-white mt-0.5 truncate">{machine.model || machine.name}</p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-500 dark:text-gray-400 uppercase font-bold">METRIC</p>
                  <p className="font-bold text-emerald-600 dark:text-emerald-500 mt-0.5">
                    {machine.metrics.length} đang thu thập
                  </p>
                </div>
              </div>

              {/* THÔNG TIN TRẠM PLC KẾ THỪA TỪ DÂY CHUYỀN (CHẾ ĐỘ CHỈ ĐỌC) */}
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-factory-bg/60 border border-slate-200 dark:border-factory-border flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="p-1.5 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 shrink-0">
                    <Cpu className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
                      Trạm PLC Dây Chuyền Kế Thừa ({displayLineCode}{displayLineName ? ` — ${displayLineName}` : ''})
                    </span>
                    <span className="font-semibold text-slate-900 dark:text-white font-mono truncate block mt-0.5">
                      {machine.plc?.name || machine.plcName || 'Chưa cấu hình trạm PLC cho dây chuyền này'}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap shrink-0">
                  {machine.plc?.isDemo && (
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/70 dark:text-amber-300">
                      MÔ PHỎNG / DEMO
                    </span>
                  )}
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                    {machine.plc?.status === 'CONNECTED' ? 'CONNECTED' : 'CHƯA KẾT NỐI VẬT LÝ (UNKNOWN)'}
                  </span>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 italic">
                    (Chỉ đọc)
                  </span>
                </div>
              </div>

              {/* ========================================================================= */}
              {/* PHẦN 1: THÔNG SỐ ĐO HIỆN TẠI (CÁC THẺ CHỈ SỐ LỚN CHUẨN ẢNH MẪU 1)        */}
              {/* ========================================================================= */}
              <section className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    Thông số đo hiện tại
                  </h3>
                  <span className="text-[11px] text-slate-500 dark:text-gray-400 font-mono font-medium">
                    Cập nhật {activeMetric.lastUpdated}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                  {machine.metrics.map((metric) => {
                    const isSelected = activeMetric.id === metric.id;
                    const isCrit = metric.status === 'critical';
                    const isWarn = metric.status === 'warning';

                    return (
                      <div
                        key={metric.id}
                        onClick={() => setSelectedMetricId(metric.id)}
                        className={`p-4 rounded-xl border cursor-pointer transition-all duration-150 select-none ${
                          isSelected
                            ? 'border-emerald-500 ring-1 ring-emerald-500 shadow-md bg-emerald-500/10'
                            : 'bg-white dark:bg-factory-card border-slate-200 dark:border-factory-border hover:border-slate-400 dark:hover:border-gray-500'
                        } ${
                          isCrit
                            ? 'bg-rose-50 dark:bg-rose-950/30 border-rose-500 animate-alarm-blink'
                            : isWarn
                            ? 'bg-amber-50 dark:bg-amber-950/20 border-amber-500'
                            : ''
                        }`}
                      >
                        {/* Tên định danh Metric */}
                        <p className="text-[11px] font-bold text-slate-500 dark:text-gray-400 uppercase font-mono tracking-wider">
                          {metric.id.replace('MTR-', '')}
                        </p>

                        {/* Giá trị số lớn xanh lá nổi bật */}
                        <div className="my-2">
                          <span
                            className={`font-mono text-3xl font-extrabold ${
                              isCrit
                                ? 'text-rose-600 dark:text-rose-500'
                                : isWarn
                                ? 'text-amber-600 dark:text-amber-500'
                                : 'text-emerald-600 dark:text-emerald-500'
                            }`}
                          >
                            {metric.currentValue}
                          </span>
                        </div>

                        {/* Tên chỉ số & Đơn vị */}
                        <p className="text-xs text-slate-600 dark:text-gray-400 font-medium">
                          {metric.unit} &bull; {metric.name}
                        </p>

                        {/* Chip trạng thái tròn xanh lá chuẩn ảnh */}
                        <div className="mt-3 flex items-center gap-1.5">
                          {metric.status === 'normal' && (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/15 text-emerald-700 dark:text-emerald-400">
                              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
                              Bình thường
                            </span>
                          )}
                          {metric.status === 'warning' && (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-500/15 text-amber-700 dark:text-amber-400">
                              <span className="h-1.5 w-1.5 rounded-full bg-amber-500"></span>
                              Cảnh báo
                            </span>
                          )}
                          {metric.status === 'critical' && (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-rose-500/15 text-rose-700 dark:text-rose-400 animate-pulse">
                              <span className="h-1.5 w-1.5 rounded-full bg-rose-500"></span>
                              Nguy hiểm
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>

              {/* ========================================================================= */}
              {/* PHẦN 2: BIỂU ĐỒ LỊCH SỬ — [METRIC_NAME] (CHUẨN ẢNH MẪU 1)                  */}
              {/* ========================================================================= */}
              <section className="bg-white dark:bg-factory-card p-5 rounded-2xl border border-slate-200 dark:border-factory-border space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 dark:border-factory-border pb-3">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                      Biểu đồ lịch sử &mdash; {activeMetric.id.replace('MTR-', '')}
                    </h3>
                  </div>

                  {/* Nút lọc khoảng thời gian 1h / 6h / 24h & Ngày tùy chọn */}
                  <div className="flex flex-wrap items-center gap-1.5 bg-slate-100 dark:bg-factory-bg p-1.5 rounded-xl border border-slate-200 dark:border-factory-border">
                    {(['1h', '6h', '24h'] as const).map((r) => (
                      <button
                        key={r}
                        onClick={() => setTimeRange(r)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer ${
                          timeRange === r
                            ? 'bg-emerald-600 text-white shadow-xs'
                            : 'text-slate-600 dark:text-gray-400 hover:text-slate-950 dark:hover:text-white'
                        }`}
                      >
                        {r}
                      </button>
                    ))}

                    {/* Nút xem nhanh dữ liệu ngày 22/05/2026 từ file log215 */}
                    <button
                      onClick={() => setTimeRange('csv_preset')}
                      className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer flex items-center gap-1 ${
                        timeRange === 'csv_preset'
                          ? 'bg-blue-600 text-white shadow-xs'
                          : 'text-blue-600 dark:text-blue-400 hover:bg-blue-500/10'
                      }`}
                      title="Xem dữ liệu nạp từ file CSV log215 (22/05/2026)"
                    >
                      <FileSpreadsheet className="w-3.5 h-3.5" />
                      22/05/2026 (CSV)
                    </button>

                    {/* Nút mở chọn ngày tùy chỉnh */}
                    <button
                      onClick={() => setTimeRange('custom')}
                      className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer flex items-center gap-1 ${
                        timeRange === 'custom'
                          ? 'bg-purple-600 text-white shadow-xs'
                          : 'text-slate-600 dark:text-gray-400 hover:text-slate-950 dark:hover:text-white'
                      }`}
                    >
                      <Calendar className="w-3.5 h-3.5" />
                      Tùy chọn
                    </button>

                    {timeRange === 'custom' && (
                      <div className="flex items-center gap-1 pl-1 border-l border-slate-300 dark:border-slate-700">
                        <input
                          type="date"
                          value={customDate}
                          onChange={(e) => setCustomDate(e.target.value)}
                          className="bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-2 py-0.5 text-xs font-mono text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                        />
                      </div>
                    )}
                  </div>
                </div>

                {/* Dòng hiển thị Rule & Ngưỡng Warning / Critical */}
                <div className="flex flex-wrap items-center gap-4 text-xs font-mono">
                  <span className="text-slate-600 dark:text-gray-400 font-semibold">
                    Rule: <span className="text-slate-900 dark:text-white">PLC_{activeMetric.plcMapping?.dataType || 'SCALE'}_FRESHNESS</span>
                  </span>
                  <span className="flex items-center gap-1 text-amber-600 dark:text-amber-500 font-semibold">
                    <span className="h-2 w-2 rounded-full bg-amber-500"></span>
                    Warning GT {activeMetric.warningMax}
                  </span>
                  <span className="flex items-center gap-1 text-rose-600 dark:text-rose-500 font-semibold">
                    <span className="h-2 w-2 rounded-full bg-rose-500"></span>
                    Critical GT {activeMetric.criticalMax}
                  </span>
                </div>

                {/* Biểu đồ Recharts kèm Loading & Empty State */}
                {isLoadingHistory ? (
                  <div className="h-[260px] flex items-center justify-center text-xs text-slate-500 dark:text-gray-400 font-mono">
                    <RefreshCw className="w-4 h-4 animate-spin mr-2 text-emerald-500" />
                    Đang nạp dữ liệu lịch sử từ CSDL...
                  </div>
                ) : customHistory && customHistory.length > 0 ? (
                  <MetricHistoryChart
                    metric={activeMetric}
                    height={260}
                    customData={customHistory}
                    isDatabaseSource={true}
                  />
                ) : (
                  <div className="h-[260px] flex flex-col items-center justify-center text-center p-6 border border-dashed border-slate-300 dark:border-factory-border rounded-xl bg-slate-50/50 dark:bg-factory-bg/20">
                    <Calendar className="w-8 h-8 text-slate-400 dark:text-gray-500 mb-2" />
                    <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                      Không có dữ liệu đo lường trong khoảng thời gian đã chọn
                    </p>
                    <p className="text-xs text-slate-500 dark:text-gray-400 mt-1 max-w-md">
                      Chưa có bản ghi đo nào khớp bộ lọc. Bấm nút <span className="font-bold text-blue-500">"22/05/2026 (CSV)"</span> để xem 207 điểm đo thực tế nạp từ file log215.
                    </p>
                    <Button size="sm" variant="flat" color="primary" className="mt-3 text-xs" onPress={() => setTimeRange('csv_preset')}>
                      Xem dữ liệu ngày 22/05/2026 (CSV)
                    </Button>
                  </div>
                )}
              </section>
            </ModalBody>

            <ModalFooter className="flex justify-between items-center">
              <div className="text-xs text-slate-500 dark:text-gray-400 font-mono">
                Model: {machine.model} &bull; {machine.location}
              </div>

              <div className="flex gap-2">
                {onOpenQR && (
                  <Button
                    size="sm"
                    variant="flat"
                    className="bg-slate-100 dark:bg-factory-bg border border-slate-200 dark:border-factory-border text-slate-700 dark:text-gray-300 hover:text-slate-950 dark:hover:text-white text-xs font-semibold"
                    startContent={<QrCode className="w-3.5 h-3.5" />}
                    onPress={onOpenQR}
                  >
                    Mã QR
                  </Button>
                )}

                <Button
                  size="sm"
                  variant="flat"
                  className="bg-slate-100 dark:bg-factory-bg border border-slate-200 dark:border-factory-border text-amber-700 dark:text-amber-400 text-xs font-semibold"
                  startContent={<Sliders className="w-3.5 h-3.5" />}
                  onPress={() => {
                    onClose();
                    setActiveTab('thresholds');
                  }}
                >
                  Cấu hình ngưỡng
                </Button>

                <Button
                  size="sm"
                  variant="light"
                  color="default"
                  className="text-xs font-semibold"
                  onPress={onClose}
                >
                  Đóng
                </Button>
              </div>
            </ModalFooter>
          </>
        )}
      </ModalContent>
    </Modal>
  );
}
