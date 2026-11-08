/**
 * @file MappingFormModal.tsx
 * @description Modal Gán Thông Số Vào Thiết Bị và Chỉnh sửa Kênh đo
 * Tích hợp Backend API (POST /api/mappings & PUT /api/mappings/:id)
 * - Lọc tự động các thông số đã được gán trùng cho thiết bị hiện tại.
 * - Hỗ trợ tìm kiếm thông số theo mã, tên, phân nhóm.
 * - Chuẩn hóa toàn bộ nhãn tiếng Việt theo yêu cầu nghiệp vụ DENSO KaiLink.
 */

import { useState, useEffect, useMemo } from 'react';
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
} from '@heroui/react';
import {
  Sliders,
  CheckCircle2,
  XCircle,
  Loader2,
  Cpu,
  Search,
  AlertTriangle,
} from 'lucide-react';
import { MachineComponent } from '../../types/hierarchy';
import { MetricCatalogItem, MetricMappingItem } from '../../types/metric';
import { apiClient } from '../../services/api';

interface MappingFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  mode: 'create' | 'edit';
  machine: MachineComponent | null;
  initialMapping?: MetricMappingItem | null;
  preselectedMetricId?: string | null;
  existingMetricIds?: string[];
  onSuccess: () => void;
}

export function MappingFormModal({
  isOpen,
  onClose,
  mode,
  machine,
  initialMapping,
  preselectedMetricId,
  existingMetricIds = [],
  onSuccess,
}: MappingFormModalProps) {
  const [metrics, setMetrics] = useState<MetricCatalogItem[]>([]);
  const [isLoadingMetrics, setIsLoadingMetrics] = useState(false);
  const [metricSearch, setMetricSearch] = useState('');

  // Form fields
  const [selectedMetricId, setSelectedMetricId] = useState<string>('');
  const [mappingCode, setMappingCode] = useState<string>('');
  const [channelName, setChannelName] = useState<string>('');
  const [plcRegister, setPlcRegister] = useState<string>('');
  const [scaleFactor, setScaleFactor] = useState<number>(1.0);
  const [samplingRateMs, setSamplingRateMs] = useState<number>(1000);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Nạp danh mục metric chuẩn
  useEffect(() => {
    if (isOpen) {
      setError(null);
      setSuccessMessage(null);
      setIsLoadingMetrics(true);
      setMetricSearch('');

      apiClient
        .getMetrics({ limit: 100, status: 'ACTIVE' })
        .then((res) => {
          setMetrics(res.metrics || []);
        })
        .catch((err) => {
          console.warn('[Get Metrics Error]:', err);
        })
        .finally(() => {
          setIsLoadingMetrics(false);
        });

      if (mode === 'edit' && initialMapping) {
        setSelectedMetricId(initialMapping.metric_id);
        setMappingCode(initialMapping.mapping_code);
        setChannelName(initialMapping.channel_name);
        setPlcRegister(initialMapping.plc_register || '');
        setScaleFactor(Number(initialMapping.scale_factor) || 1.0);
        setSamplingRateMs(Number(initialMapping.sampling_rate_ms) || 1000);
      } else {
        // Mode create
        const metricId = preselectedMetricId || '';
        setSelectedMetricId(metricId);
        setMappingCode(machine ? `MAP-${machine.code || machine.id}-${Date.now().toString().slice(-4)}` : '');
        setChannelName('');
        setPlcRegister('');
        setScaleFactor(1.0);
        setSamplingRateMs(1000);
      }
    }
  }, [isOpen, mode, initialMapping, machine, preselectedMetricId]);

  // Lọc thông số khả dụng (loại bỏ các thông số đã gán trùng cho thiết bị hiện tại)
  const availableMetrics = useMemo(() => {
    return metrics.filter((m) => {
      if (mode === 'edit') return true;
      return !existingMetricIds.includes(m.id);
    });
  }, [metrics, existingMetricIds, mode]);

  // Lọc thông số theo ô tìm kiếm
  const filteredAvailableMetrics = useMemo(() => {
    if (!metricSearch.trim()) return availableMetrics;
    const term = metricSearch.toLowerCase();
    return availableMetrics.filter(
      (m) =>
        m.code.toLowerCase().includes(term) ||
        m.name.toLowerCase().includes(term) ||
        (m.category && m.category.toLowerCase().includes(term))
    );
  }, [availableMetrics, metricSearch]);

  if (!machine) return null;

  const selectedMetric = metrics.find((m) => m.id === selectedMetricId);

  // Khi người dùng chọn metric mới, tự động gợi ý tên kênh đo và mã mapping nếu chưa nhập
  const handleSelectMetric = (mId: string) => {
    setSelectedMetricId(mId);
    const chosen = metrics.find((m) => m.id === mId);
    if (chosen && machine) {
      setChannelName(`${chosen.name} - ${machine.name}`);
      const cleanMetCode = chosen.code.replace(/[^A-Za-z0-9_]/g, '');
      const cleanMachCode = (machine.code || machine.id).replace(/[^A-Za-z0-9_]/g, '');
      setMappingCode(`MAP-${cleanMachCode}-${cleanMetCode}`);
    }
  };

  const handleSubmit = async () => {
    if (mode === 'create' && !selectedMetricId) {
      setError('Vui lòng chọn một thông số từ Danh mục chuẩn.');
      return;
    }
    if (!channelName.trim()) {
      setError('Vui lòng nhập tên kênh đo.');
      return;
    }
    if (!mappingCode.trim()) {
      setError('Vui lòng nhập mã mapping.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      if (mode === 'create') {
        const payload = {
          machine_id: machine.id,
          metric_id: selectedMetricId,
          mapping_code: mappingCode.trim(),
          channel_name: channelName.trim(),
          plc_id: machine.plc?.id || machine.plcId || null,
          plc_register: plcRegister.trim() || null,
          scale_factor: Number(scaleFactor) || 1.0,
          sampling_rate_ms: Number(samplingRateMs) || 1000,
        };

        const res = await apiClient.createMapping(payload);
        setSuccessMessage(res.message || 'Gán thông số vào thiết bị thành công!');
      } else if (mode === 'edit' && initialMapping) {
        const payload = {
          mapping_code: mappingCode.trim(),
          channel_name: channelName.trim(),
          plc_id: machine.plc?.id || machine.plcId || null,
          plc_register: plcRegister.trim() || null,
          scale_factor: Number(scaleFactor) || 1.0,
          sampling_rate_ms: Number(samplingRateMs) || 1000,
        };

        const res = await apiClient.updateMapping(initialMapping.id, payload);
        setSuccessMessage(res.message || 'Cập nhật cấu hình kênh đo thành công!');
      }

      setTimeout(() => {
        onSuccess();
        onClose();
      }, 500);
    } catch (err: any) {
      console.warn('[Submit Mapping Error]:', err);
      setError(err.message || 'Lỗi khi lưu cấu hình thông số.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="xl"
      backdrop="blur"
      placement="center"
      classNames={{
        base: 'bg-white dark:bg-[#1a202c] border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white',
        header: 'border-b border-slate-200 dark:border-slate-800 pb-3',
        footer: 'border-t border-slate-200 dark:border-slate-800 pt-3',
      }}
    >
      <ModalContent>
        {() => (
          <>
            <ModalHeader className="flex items-center gap-2">
              <div className="p-2 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-lg">
                <Sliders className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  {mode === 'create' ? 'Gán Thông Số Vào Thiết Bị' : 'Chỉnh Sửa Kênh Đo Thiết Bị'}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-normal">
                  {mode === 'create'
                    ? 'Chọn thông số từ Danh mục chuẩn để thu thập dữ liệu cho thiết bị'
                    : 'Cập nhật thông tin kênh đo và thanh ghi PLC'}
                </p>
              </div>
            </ModalHeader>

            <ModalBody className="py-4 space-y-4">
              {/* Thẻ tóm tắt Thiết bị & Trạm PLC mục tiêu */}
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 grid grid-cols-2 gap-3 text-xs">
                <div>
                  <span className="text-slate-500 font-medium">Thiết bị:</span>
                  <div className="font-bold text-slate-800 dark:text-slate-200 truncate">
                    {machine.name} ({machine.code || machine.id})
                  </div>
                </div>

                <div>
                  <span className="text-slate-500 font-medium">Trạm PLC dây chuyền:</span>
                  <div className="font-bold flex items-center gap-1 text-slate-800 dark:text-slate-200 truncate">
                    <Cpu className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span>{machine.plc?.name || machine.plcName || machine.plcId || 'Kế thừa từ Line'}</span>
                  </div>
                </div>
              </div>

              {/* Lựa chọn Thông số từ Danh mục chuẩn */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                  <span>Thông số từ Danh mục chuẩn <span className="text-rose-500">*</span></span>
                  {isLoadingMetrics && (
                    <span className="flex items-center gap-1 text-[11px] text-slate-400">
                      <Loader2 className="w-3 h-3 animate-spin" /> Đang tải...
                    </span>
                  )}
                </label>

                {mode === 'edit' ? (
                  <div className="px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-medium text-slate-600 dark:text-slate-300 font-mono">
                    {initialMapping?.metricCode || initialMapping?.metricName || initialMapping?.metric_id}{' '}
                    <span className="text-emerald-600 font-bold">[{initialMapping?.unit || 'N/A'}]</span>
                  </div>
                ) : (
                  <>
                    {/* Ô tìm kiếm thông số khi gán */}
                    {availableMetrics.length > 5 && (
                      <div className="relative">
                        <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                          type="text"
                          placeholder="Lọc thông số theo mã, tên hoặc nhóm..."
                          value={metricSearch}
                          onChange={(e) => setMetricSearch(e.target.value)}
                          className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                        />
                      </div>
                    )}

                    {availableMetrics.length === 0 ? (
                      <div className="p-3.5 rounded-xl border border-amber-200 dark:border-amber-900/40 bg-amber-50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-300 text-xs flex items-start gap-2">
                        <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-600" />
                        <div>
                          <strong>Đã gán toàn bộ thông số:</strong> Tất cả thông số hoạt động trong Danh mục đã được gán cho thiết bị <strong>{machine.name}</strong>. Để thêm thông số mới cho toàn nhà máy, vui lòng truy cập trang <em>"Danh mục Thông số"</em>.
                        </div>
                      </div>
                    ) : (
                      <select
                        value={selectedMetricId}
                        onChange={(e) => handleSelectMetric(e.target.value)}
                        disabled={isSubmitting || isLoadingMetrics}
                        className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono"
                      >
                        <option value="" disabled>-- Chọn Thông số từ Danh mục ({availableMetrics.length} khả dụng) --</option>
                        {filteredAvailableMetrics.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.code} — {m.name} [{m.unit}] ({m.category})
                          </option>
                        ))}
                      </select>
                    )}
                  </>
                )}

                {selectedMetric && (
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono flex items-center gap-2 pt-0.5">
                    <span>Đơn vị: <strong className="text-emerald-600">{selectedMetric.unit}</strong></span>
                    <span>&bull;</span>
                    <span>Kiểu: {selectedMetric.dataType}</span>
                    <span>&bull;</span>
                    <span>Nhóm: {selectedMetric.category}</span>
                  </div>
                )}
              </div>

              {/* Nhập Mã Mapping & Tên Kênh đo */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Mã Kênh đo (mapping_code) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={mappingCode}
                    onChange={(e) => setMappingCode(e.target.value)}
                    placeholder="VD: MAP-PRS-01-PRESSURE"
                    disabled={isSubmitting}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Tên Kênh đo (channel_name) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={channelName}
                    onChange={(e) => setChannelName(e.target.value)}
                    placeholder="VD: Áp suất dầu nén chính"
                    disabled={isSubmitting}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              {/* Thông số Thanh ghi PLC & Lấy mẫu */}
              <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 space-y-3">
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
                  Thông số Kỹ thuật & Tần suất thu thập
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <label className="text-[11px] font-medium text-slate-600 dark:text-slate-400">
                      Thanh ghi PLC / Tag File
                    </label>
                    <input
                      type="text"
                      value={plcRegister}
                      onChange={(e) => setPlcRegister(e.target.value)}
                      placeholder="VD: D100, 40001, HR1"
                      disabled={isSubmitting}
                      className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-mono"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-medium text-slate-600 dark:text-slate-400">
                      Hệ số nhân (Scale)
                    </label>
                    <input
                      type="number"
                      step="any"
                      value={scaleFactor}
                      onChange={(e) => setScaleFactor(parseFloat(e.target.value) || 1.0)}
                      disabled={isSubmitting}
                      className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-mono"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-medium text-slate-600 dark:text-slate-400">
                      Chu kỳ lấy mẫu (ms)
                    </label>
                    <input
                      type="number"
                      step="100"
                      min="100"
                      value={samplingRateMs}
                      onChange={(e) => setSamplingRateMs(parseInt(e.target.value, 10) || 1000)}
                      disabled={isSubmitting}
                      className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-mono"
                    />
                  </div>
                </div>
              </div>

              {/* Thông báo lỗi nếu có */}
              {error && (
                <div className="flex items-center gap-2 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-rose-700 dark:text-rose-400 text-xs">
                  <XCircle className="w-4 h-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {/* Thông báo thành công */}
              {successMessage && (
                <div className="flex items-center gap-2 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/60 text-emerald-700 dark:text-emerald-400 text-xs font-semibold">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>{successMessage}</span>
                </div>
              )}
            </ModalBody>

            <ModalFooter className="flex items-center justify-between">
              <Button
                size="sm"
                variant="flat"
                color="default"
                onPress={onClose}
                isDisabled={isSubmitting}
                className="text-xs"
              >
                Hủy bỏ
              </Button>

              <Button
                size="sm"
                color="primary"
                variant="solid"
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs px-5 shadow-sm shadow-emerald-600/20"
                onPress={handleSubmit}
                isLoading={isSubmitting}
                isDisabled={mode === 'create' && (!selectedMetricId || availableMetrics.length === 0)}
              >
                {mode === 'create' ? 'Gán thông số' : 'Lưu thay đổi'}
              </Button>
            </ModalFooter>
          </>
        )}
      </ModalContent>
    </Modal>
  );
}
