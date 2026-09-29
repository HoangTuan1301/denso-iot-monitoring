/**
 * @file MachineDetailModal.tsx
 * @description Modal Chi tiết Component chuẩn xác theo thiết kế ảnh mẫu (Image 1)
 * Hiển thị Banner thuộc tính, Thẻ Metric hiện tại và Biểu đồ lịch sử AreaChart
 * Tương thích cao với cả giao diện Sáng (Light) và Tối (Dark)
 */

import { useState } from 'react';
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
} from 'lucide-react';
import { MachineComponent } from '../../types/hierarchy';
import { MetricHistoryChart } from '../../components/charts/MetricHistoryChart';
import { useMonitoringStore } from '../../stores/useMonitoringStore';

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
  const { setActiveTab, simulateTick } = useMonitoringStore();
  const [selectedMetricId, setSelectedMetricId] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState<'1h' | '6h' | '24h'>('1h');

  if (!machine) return null;

  // Metric đang chọn để xem biểu đồ
  const activeMetric =
    machine.metrics.find((m) => m.id === selectedMetricId) || machine.metrics[0];

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
            {/* HEADER MODAL: TIÊU ĐỀ CHI TIẾT COMPONENT & NÚT LÀM MỚI                    */}
            {/* ========================================================================= */}
            <ModalHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">
                  Chi tiết Component
                </h2>
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                  {lineName ? `${lineName} • ` : ''}Giá trị hiện tại và biến động lịch sử của các metric thuộc component.
                </p>
              </div>

              <div className="flex items-center gap-2">
                {/* Selector component badge */}
                <div className="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-factory-bg border border-slate-200 dark:border-factory-border font-mono text-xs font-bold text-slate-900 dark:text-white">
                  {machine.id}
                </div>

                <Button
                  size="sm"
                  variant="flat"
                  className="bg-slate-100 dark:bg-factory-bg border border-slate-200 dark:border-factory-border text-slate-700 dark:text-gray-300 hover:text-slate-950 dark:hover:text-white text-xs font-semibold"
                  startContent={<RefreshCw className="w-3.5 h-3.5" />}
                  onPress={() => simulateTick()}
                >
                  Làm mới
                </Button>
              </div>
            </ModalHeader>

            <ModalBody className="p-6 space-y-6">
              {/* ========================================================================= */}
              {/* BANNER THÔNG TIN META DỮ LIỆU CỦA COMPONENT                               */}
              {/* ========================================================================= */}
              <div className="bg-slate-50 dark:bg-factory-bg/60 p-4 rounded-xl border border-slate-200 dark:border-factory-border grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-4 text-xs font-mono">
                <div>
                  <p className="text-[10px] text-slate-500 dark:text-gray-400 uppercase font-bold">COMPONENT</p>
                  <p className="font-bold text-slate-900 dark:text-white mt-0.5 truncate">{machine.id}</p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-500 dark:text-gray-400 uppercase font-bold">LUỒNG</p>
                  <p className="font-bold text-slate-900 dark:text-white mt-0.5 truncate">{machine.lineId}</p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-500 dark:text-gray-400 uppercase font-bold">LOẠI</p>
                  <p className="mt-0.5">
                    <span className="px-2 py-0.5 rounded bg-white dark:bg-factory-card border border-slate-200 dark:border-factory-border text-[10px] font-bold text-slate-700 dark:text-gray-300">
                      PLC / ADC
                    </span>
                  </p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-500 dark:text-gray-400 uppercase font-bold">NGUỒN</p>
                  <p className="font-bold text-slate-900 dark:text-white mt-0.5 truncate">MODBUS / TCP</p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-500 dark:text-gray-400 uppercase font-bold">OBJECT</p>
                  <p className="font-bold text-slate-900 dark:text-white mt-0.5 truncate">{machine.model}</p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-500 dark:text-gray-400 uppercase font-bold">METRIC</p>
                  <p className="font-bold text-emerald-600 dark:text-emerald-500 mt-0.5">
                    {machine.metrics.length} đang thu thập
                  </p>
                </div>
              </div>

              {/* ========================================================================= */}
              {/* PHẦN 1: METRIC HIỆN TẠI (3 THẺ CHỈ SỐ LỚN CHUẨN ẢNH MẪU 1)               */}
              {/* ========================================================================= */}
              <section className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    Metric hiện tại
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

                  {/* Nút lọc khoảng thời gian 1h / 6h / 24h chuẩn ảnh 1 */}
                  <div className="flex items-center gap-1 bg-slate-100 dark:bg-factory-bg p-1 rounded-xl border border-slate-200 dark:border-factory-border">
                    {(['1h', '6h', '24h'] as const).map((r) => (
                      <button
                        key={r}
                        onClick={() => setTimeRange(r)}
                        className={`px-3 py-1 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer ${
                          timeRange === r
                            ? 'bg-emerald-600 text-white shadow-xs'
                            : 'text-slate-600 dark:text-gray-400 hover:text-slate-950 dark:hover:text-white'
                        }`}
                      >
                        {r}
                      </button>
                    ))}
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

                {/* Component Biểu đồ Recharts */}
                <MetricHistoryChart metric={activeMetric} height={260} />
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
