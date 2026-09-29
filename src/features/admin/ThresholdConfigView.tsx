/**
 * @file ThresholdConfigView.tsx
 * @description Trang Cấu hình Ngưỡng Kỹ thuật (Warning Limit, Critical Limit) & Mô phỏng Trạm PLC (Modbus/TCP, OPC-UA)
 * Dành cho Kỹ sư Tự động hóa & Quản trị viên hệ thống (Admin)
 */

import { useState } from 'react';
import {
  Card,
  CardBody,
  Button,
  Input,
  Chip,
} from '@heroui/react';
import { CustomSwitch } from '../../components/common/CustomSwitch';
import {
  Sliders,
  Wifi,
  WifiOff,
  Save,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  Server,
  Layers,
  Thermometer,
  Gauge,
  Activity,
  Zap,
  Lock,
} from 'lucide-react';
import { useMonitoringStore } from '../../stores/useMonitoringStore';
import { useAuthStore } from '../../stores/useAuthStore';

export function ThresholdConfigView() {
  const {
    lines,
    plcStations,
    togglePLCStationConnection,
    setPLCStationPollingRate,
    updateMetricThresholds,
  } = useMonitoringStore();
  const { currentUser } = useAuthStore();
  const userRole = (currentUser?.role || 'OPERATOR').toUpperCase();
  const canEdit = userRole === 'ADMIN' || userRole === 'MAINTENANCE';

  // Lọc theo Dây chuyền và Loại chỉ số
  const [selectedLineFilter, setSelectedLineFilter] = useState<string>('all');
  const [selectedTypeFilter, setSelectedTypeFilter] = useState<string>('all');

  // Quản lý trạng thái form chỉnh sửa tạm thời trước khi Lưu
  const [editingValues, setEditingValues] = useState<
    Record<
      string,
      {
        warningMin: number;
        warningMax: number;
        criticalMin: number;
        criticalMax: number;
      }
    >
  >({});

  // Thông báo lưu thành công
  const [savedMetricId, setSavedMetricId] = useState<string | null>(null);

  // Tập hợp danh sách phẳng toàn bộ các Metric từ tất cả Lines & Machines
  const allMetrics = lines.flatMap((line) =>
    line.machines.flatMap((machine) =>
      machine.metrics.map((metric) => ({
        ...metric,
        lineId: line.id,
        lineName: line.name,
        machineId: machine.id,
        machineName: machine.name,
      }))
    )
  );

  // Lọc dữ liệu theo bộ lọc
  const filteredMetrics = allMetrics.filter((m) => {
    const matchLine = selectedLineFilter === 'all' || m.lineId === selectedLineFilter;
    const matchType =
      selectedTypeFilter === 'all' ||
      (selectedTypeFilter === 'temp' && m.unit === '°C') ||
      (selectedTypeFilter === 'pressure' && m.unit === 'bar') ||
      (selectedTypeFilter === 'vib' && m.unit === 'mm/s') ||
      (selectedTypeFilter === 'elec' && (m.unit === 'A' || m.unit === 'Hz' || m.unit === 'rpm'));
    return matchLine && matchType;
  });

  // Xử lý thay đổi input ngưỡng
  const handleThresholdChange = (
    metricId: string,
    field: 'warningMin' | 'warningMax' | 'criticalMin' | 'criticalMax',
    val: number,
    currentMetric: typeof allMetrics[0]
  ) => {
    setEditingValues((prev) => {
      const current = prev[metricId] || {
        warningMin: currentMetric.warningMin,
        warningMax: currentMetric.warningMax,
        criticalMin: currentMetric.criticalMin,
        criticalMax: currentMetric.criticalMax,
      };
      return {
        ...prev,
        [metricId]: {
          ...current,
          [field]: val,
        },
      };
    });
  };

  // Lưu ngưỡng xuống store
  const handleSave = (metricId: string, currentMetric: typeof allMetrics[0]) => {
    if (!canEdit) {
      alert('Bạn không có quyền thay đổi ngưỡng kỹ thuật. Vui lòng đăng nhập quyền Admin.');
      return;
    }

    const values = editingValues[metricId] || {
      warningMin: currentMetric.warningMin,
      warningMax: currentMetric.warningMax,
      criticalMin: currentMetric.criticalMin,
      criticalMax: currentMetric.criticalMax,
    };

    // Kiểm tra tính hợp lệ cơ bản
    if (values.warningMax <= values.warningMin || values.criticalMax <= values.criticalMin) {
      alert('Lỗi: Ngưỡng Max phải lớn hơn ngưỡng Min!');
      return;
    }

    updateMetricThresholds(metricId, values);
    setSavedMetricId(metricId);
    setTimeout(() => setSavedMetricId(null), 2500);
  };

  // Khôi phục giá trị ban đầu
  const handleReset = (metricId: string) => {
    setEditingValues((prev) => {
      const next = { ...prev };
      delete next[metricId];
      return next;
    });
  };

  return (
    <div className="space-y-6">
      {/* ========================================================================= */}
      {/* TIÊU ĐỀ TRANG                                                             */}
      {/* ========================================================================= */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span
              className={
                canEdit
                  ? "px-2 py-0.5 rounded text-xs font-bold bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30"
                  : "px-2 py-0.5 rounded text-xs font-bold bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30"
              }
            >
              {canEdit ? "PHÂN HỆ CẤU HÌNH NGƯỠNG" : "CHẾ ĐỘ XEM (READ-ONLY)"}
            </span>
            <h1 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">
              Cấu Hình Ngưỡng & Trạm PLC
            </h1>
          </div>
          <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
            Thiết lập 4 ngưỡng kỹ thuật (Warning / Critical) cho từng loại Metric và quản lý trạng thái kết nối trạm PLC công nghiệp.
          </p>
        </div>

        {!canEdit && (
          <div className="flex items-center gap-2 bg-amber-500/10 border border-amber-500/20 px-3 py-1.5 rounded-xl text-amber-700 dark:text-amber-400 text-xs font-semibold">
            <Lock className="w-3.5 h-3.5 shrink-0" />
            <span>Tài khoản chỉ có quyền xem. Vui lòng đăng nhập Admin để lưu thay đổi.</span>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* PHẦN 1: MÔ PHỎNG TRẠM PLC (MODBUS/TCP & OPC-UA)                            */}
      {/* ========================================================================= */}
      <section className="space-y-3">
        <div className="flex items-center gap-2 border-b border-factory-border pb-2">
          <Server className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          <h2 className="text-sm font-bold text-slate-900 dark:text-white">
            Trạm Kết Nối PLC Nhà Máy (PLC Stations)
          </h2>
          <span className="text-xs text-slate-500 dark:text-slate-400 font-mono">
            ({plcStations.length} trạm)
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {plcStations.map((station) => (
            <Card
              key={station.id}
              className={`border transition-all ${
                station.isConnected
                  ? 'border-emerald-500/40 bg-factory-card shadow-xs'
                  : 'border-rose-500/40 bg-rose-50/30 dark:bg-rose-950/10'
              }`}
            >
              <CardBody className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div
                      className={`p-2.5 rounded-xl ${
                        station.isConnected
                          ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                          : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20'
                      }`}
                    >
                      {station.isConnected ? (
                        <Wifi className="w-5 h-5" />
                      ) : (
                        <WifiOff className="w-5 h-5 animate-pulse" />
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-slate-900 dark:text-white">
                          {station.id}
                        </span>
                        <Chip
                          size="sm"
                          color={station.isConnected ? 'success' : 'danger'}
                          variant="flat"
                          className="font-bold text-[10px]"
                        >
                          {station.isConnected ? 'ONLINE' : 'DISCONNECTED'}
                        </Chip>
                      </div>
                      <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200 mt-0.5">
                        {station.name}
                      </h3>
                    </div>
                  </div>

                  {/* Switch Bật/Tắt mô phỏng kết nối */}
                  <div className="flex flex-col items-end">
                    <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 mb-1">
                      {station.isConnected ? 'Ngắt kết nối' : 'Kết nối lại'}
                    </span>
                    <CustomSwitch
                      isSelected={station.isConnected}
                      size="sm"
                      color="success"
                      onValueChange={() => togglePLCStationConnection(station.id)}
                      aria-label="Bật/Tắt trạm PLC"
                    />
                  </div>
                </div>

                {/* Thông tin kỹ thuật trạm */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-slate-200 dark:border-factory-border/60 text-xs font-mono">
                  <div>
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 font-semibold uppercase">
                      Giao thức
                    </span>
                    <p className="font-bold text-emerald-600 dark:text-emerald-400">
                      {station.protocol}
                    </p>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 font-semibold uppercase">
                      IP & Port
                    </span>
                    <p className="font-medium text-slate-800 dark:text-slate-200 truncate">
                      {station.ipAddress}:{station.port}
                    </p>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 font-semibold uppercase">
                      Độ trễ (Ping)
                    </span>
                    <p className="font-bold text-slate-800 dark:text-slate-200">
                      {station.isConnected ? `${station.latencyMs} ms` : '--'}
                    </p>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 font-semibold uppercase">
                      Số Tag đọc
                    </span>
                    <p className="font-bold text-slate-800 dark:text-slate-200">
                      {station.tagsCount} tags
                    </p>
                  </div>
                </div>

                {/* Tùy chỉnh chu kỳ quét tín hiệu */}
                <div className="flex items-center justify-between pt-1 text-xs">
                  <span className="text-slate-600 dark:text-slate-400 font-medium">
                    Chu kỳ quét (Polling rate):
                  </span>
                  <div className="flex items-center gap-1.5 font-mono text-xs">
                    {[500, 1000, 2500].map((rate) => (
                      <button
                        key={rate}
                        onClick={() => setPLCStationPollingRate(station.id, rate)}
                        className={`px-2 py-0.5 rounded text-[11px] font-semibold border transition-all cursor-pointer ${
                          station.pollingRateMs === rate
                            ? 'bg-emerald-600 text-white border-emerald-600'
                            : 'bg-slate-100 dark:bg-factory-bg text-slate-600 dark:text-slate-400 border-slate-200 dark:border-factory-border hover:border-slate-400'
                        }`}
                      >
                        {rate}ms
                      </button>
                    ))}
                  </div>
                </div>
              </CardBody>
            </Card>
          ))}
        </div>
      </section>

      {/* ========================================================================= */}
      {/* PHẦN 2: BẢNG CẤU HÌNH NGƯỠNG CHO TỪNG LOẠI METRIC                          */}
      {/* ========================================================================= */}
      <section className="bg-factory-card rounded-2xl border border-factory-border p-5 space-y-4 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-factory-border pb-4">
          <div className="flex items-center gap-2">
            <Sliders className="w-5 h-5 text-amber-500" />
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                Bảng 4 Ngưỡng Cảnh Báo (Thresholds Matrix)
              </h2>
              <p className="text-xs text-slate-600 dark:text-slate-400">
                Cho phép nhập trực tiếp giới hạn Warning & Critical. Giá trị lưu tự động áp dụng vào hệ thống giám sát.
              </p>
            </div>
          </div>

          {/* Bộ lọc Dây chuyền & Loại Metric */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Bộ lọc Dây chuyền */}
            <div className="w-40">
              <select
                value={selectedLineFilter}
                onChange={(e) => setSelectedLineFilter(e.target.value)}
                aria-label="Chọn Dây chuyền"
                className="w-full bg-slate-100 dark:bg-factory-bg border border-slate-200 dark:border-factory-border text-slate-800 dark:text-slate-200 rounded-xl text-xs h-9 px-3 outline-none cursor-pointer"
              >
                <option value="all">Tất cả Line</option>
                {lines.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.code} ({l.name})
                  </option>
                ))}
              </select>
            </div>

            {/* Nút lọc Loại nhanh */}
            <div className="flex items-center gap-1 bg-slate-100 dark:bg-factory-bg p-1 rounded-xl border border-slate-200 dark:border-factory-border">
              {[
                { id: 'all', label: 'Tất cả', icon: Layers },
                { id: 'temp', label: 'Nhiệt độ', icon: Thermometer },
                { id: 'pressure', label: 'Áp suất', icon: Gauge },
                { id: 'vib', label: 'Độ rung', icon: Activity },
                { id: 'elec', label: 'Điện/Động cơ', icon: Zap },
              ].map((tab) => {
                const Icon = tab.icon;
                const active = selectedTypeFilter === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setSelectedTypeFilter(tab.id)}
                    className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                      active
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    <Icon className="w-3 h-3" />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Danh sách bảng Metric với form input trực quan */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-factory-border text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                <th className="py-3 px-3">CHỈ SỐ & THIẾT BỊ</th>
                <th className="py-3 px-2 text-center">HIỆN TẠI</th>
                <th className="py-3 px-2 text-rose-600 dark:text-rose-400">CRITICAL MIN</th>
                <th className="py-3 px-2 text-amber-600 dark:text-amber-400">WARNING MIN</th>
                <th className="py-3 px-2 text-amber-600 dark:text-amber-400">WARNING MAX</th>
                <th className="py-3 px-2 text-rose-600 dark:text-rose-400">CRITICAL MAX</th>
                <th className="py-3 px-3 text-right">THAO TÁC</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-factory-border">
              {filteredMetrics.map((metric) => {
                const currentEdit = editingValues[metric.id] || {
                  warningMin: metric.warningMin,
                  warningMax: metric.warningMax,
                  criticalMin: metric.criticalMin,
                  criticalMax: metric.criticalMax,
                };

                const isModified =
                  currentEdit.warningMin !== metric.warningMin ||
                  currentEdit.warningMax !== metric.warningMax ||
                  currentEdit.criticalMin !== metric.criticalMin ||
                  currentEdit.criticalMax !== metric.criticalMax;

                const isJustSaved = savedMetricId === metric.id;

                return (
                  <tr
                    key={metric.id}
                    className="hover:bg-slate-50 dark:hover:bg-white/5 transition-colors"
                  >
                    {/* Cột 1: Thông tin chỉ số */}
                    <td className="py-3.5 px-3">
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono font-bold text-slate-900 dark:text-white">
                            {metric.id}
                          </span>
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-100 dark:bg-factory-bg border border-slate-200 dark:border-factory-border text-slate-700 dark:text-gray-300">
                            {metric.unit}
                          </span>
                        </div>
                        <p className="font-medium text-slate-800 dark:text-slate-200 mt-0.5">
                          {metric.name}
                        </p>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                          {metric.lineId} &bull; {metric.machineName}
                        </p>
                      </div>
                    </td>

                    {/* Cột 2: Giá trị hiện tại */}
                    <td className="py-3.5 px-2 text-center font-mono">
                      <span
                        className={`text-sm font-bold ${
                          metric.status === 'critical'
                            ? 'text-rose-600 dark:text-rose-500 animate-pulse'
                            : metric.status === 'warning'
                            ? 'text-amber-600 dark:text-amber-500'
                            : 'text-emerald-600 dark:text-emerald-500'
                        }`}
                      >
                        {metric.currentValue}
                      </span>
                      <div className="mt-1">
                        <Chip
                          size="sm"
                          color={
                            metric.status === 'critical'
                              ? 'danger'
                              : metric.status === 'warning'
                              ? 'warning'
                              : 'success'
                          }
                          variant="flat"
                          className="text-[10px] font-bold uppercase"
                        >
                          {metric.status}
                        </Chip>
                      </div>
                    </td>

                    {/* Cột 3: Critical Min */}
                    <td className="py-3.5 px-2">
                      <div className="w-24">
                        <Input
                          type="number"
                          size="sm"
                          value={String(currentEdit.criticalMin)}
                          onChange={(e) =>
                            handleThresholdChange(
                              metric.id,
                              'criticalMin',
                              parseFloat(e.target.value) || 0,
                              metric
                            )
                          }
                          classNames={{
                            input: 'font-mono text-xs font-semibold text-rose-600 dark:text-rose-400',
                            inputWrapper: 'h-8 bg-slate-100 dark:bg-factory-bg border border-slate-200 dark:border-factory-border',
                          }}
                        />
                      </div>
                    </td>

                    {/* Cột 4: Warning Min */}
                    <td className="py-3.5 px-2">
                      <div className="w-24">
                        <Input
                          type="number"
                          size="sm"
                          value={String(currentEdit.warningMin)}
                          onChange={(e) =>
                            handleThresholdChange(
                              metric.id,
                              'warningMin',
                              parseFloat(e.target.value) || 0,
                              metric
                            )
                          }
                          classNames={{
                            input: 'font-mono text-xs font-semibold text-amber-600 dark:text-amber-400',
                            inputWrapper: 'h-8 bg-slate-100 dark:bg-factory-bg border border-slate-200 dark:border-factory-border',
                          }}
                        />
                      </div>
                    </td>

                    {/* Cột 5: Warning Max */}
                    <td className="py-3.5 px-2">
                      <div className="w-24">
                        <Input
                          type="number"
                          size="sm"
                          value={String(currentEdit.warningMax)}
                          onChange={(e) =>
                            handleThresholdChange(
                              metric.id,
                              'warningMax',
                              parseFloat(e.target.value) || 0,
                              metric
                            )
                          }
                          classNames={{
                            input: 'font-mono text-xs font-semibold text-amber-600 dark:text-amber-400',
                            inputWrapper: 'h-8 bg-slate-100 dark:bg-factory-bg border border-slate-200 dark:border-factory-border',
                          }}
                        />
                      </div>
                    </td>

                    {/* Cột 6: Critical Max */}
                    <td className="py-3.5 px-2">
                      <div className="w-24">
                        <Input
                          type="number"
                          size="sm"
                          value={String(currentEdit.criticalMax)}
                          onChange={(e) =>
                            handleThresholdChange(
                              metric.id,
                              'criticalMax',
                              parseFloat(e.target.value) || 0,
                              metric
                            )
                          }
                          classNames={{
                            input: 'font-mono text-xs font-semibold text-rose-600 dark:text-rose-400',
                            inputWrapper: 'h-8 bg-slate-100 dark:bg-factory-bg border border-slate-200 dark:border-factory-border',
                          }}
                        />
                      </div>
                    </td>

                    {/* Cột 7: Nút Hành động */}
                    <td className="py-3.5 px-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {isJustSaved ? (
                          <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 text-xs font-bold">
                            <CheckCircle2 className="w-4 h-4" />
                            Đã lưu
                          </span>
                        ) : (
                          <>
                            {isModified && (
                              <button
                                onClick={() => handleReset(metric.id)}
                                title="Hủy thay đổi"
                                className="p-1.5 rounded-lg bg-slate-100 dark:bg-factory-bg border border-slate-200 dark:border-factory-border text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer"
                              >
                                <RotateCcw className="w-3.5 h-3.5" />
                              </button>
                            )}

                            <Button
                              size="sm"
                              color={isModified ? 'primary' : 'default'}
                              variant={isModified ? 'solid' : 'flat'}
                              className={`text-xs font-semibold h-8 ${
                                isModified
                                  ? 'bg-emerald-600 text-white shadow-xs'
                                  : 'bg-slate-100 dark:bg-factory-bg border border-slate-200 dark:border-factory-border text-slate-600 dark:text-slate-400'
                              }`}
                              startContent={<Save className="w-3.5 h-3.5" />}
                              onPress={() => handleSave(metric.id, metric)}
                            >
                              Lưu
                            </Button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Footer ghi chú */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-3 border-t border-factory-border text-xs text-slate-500 dark:text-slate-400">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-500" />
            <span>
              Quy tắc chuẩn: <span className="font-mono">Critical Min &le; Warning Min &lt; Warning Max &le; Critical Max</span>
            </span>
          </div>
          <span className="font-mono">Hiển thị {filteredMetrics.length} / {allMetrics.length} chỉ số đo lường</span>
        </div>
      </section>
    </div>
  );
}
