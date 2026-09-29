/**
 * @file AlarmLogView.tsx
 * @description Trang Nhật Ký Sự Cố (Alert Log) & Quy Trình Tiếp Nhận Xử Lý Sự Cố
 * Hỗ trợ các bộ lọc đa tiêu chí, Modal xác nhận hoàn thành, và tính năng Xuất Báo Cáo Excel/CSV (UTF-8 BOM)
 */

import { useState } from 'react';
import {
  Card,
  CardBody,
  Button,
  Chip,
  Input,
} from '@heroui/react';
import {
  AlertOctagon,
  AlertTriangle,
  Download,
  Search,
  CheckCircle2,
  Clock,
  UserCheck,
  FileSpreadsheet,
  X,
} from 'lucide-react';
import { useAlarmStore } from '../../stores/useAlarmStore';
import { useAuthStore } from '../../stores/useAuthStore';
import { useMonitoringStore } from '../../stores/useMonitoringStore';
import { AlarmEvent } from '../../types/alarm';

export function AlarmLogView() {
  const { alarms, acknowledgeAlarm, resolveAlarm } = useAlarmStore();
  const { currentUser } = useAuthStore();
  const { lines } = useMonitoringStore();

  // Bộ lọc
  const [selectedLine, setSelectedLine] = useState<string>('all');
  const [selectedSeverity, setSelectedSeverity] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [searchKeyword, setSearchKeyword] = useState<string>('');

  // Modal xử lý hoàn tất sự cố
  const [resolvingAlarm, setResolvingAlarm] = useState<AlarmEvent | null>(null);
  const [resolutionNote, setResolutionNote] = useState<string>('');

  // Thống kê nhanh
  const totalAlarms = alarms.length;
  const criticalCount = alarms.filter((a) => a.severity === 'critical').length;
  const pendingCount = alarms.filter((a) => a.status === 'pending').length;
  const acknowledgedCount = alarms.filter((a) => a.status === 'acknowledged').length;
  const resolvedCount = alarms.filter((a) => a.status === 'resolved').length;

  // Lọc dữ liệu
  const filteredAlarms = alarms.filter((alarm) => {
    const matchLine = selectedLine === 'all' || alarm.lineId === selectedLine;
    const matchSeverity = selectedSeverity === 'all' || alarm.severity === selectedSeverity;
    const matchStatus = selectedStatus === 'all' || alarm.status === selectedStatus;
    const matchSearch =
      searchKeyword.trim() === '' ||
      alarm.id.toLowerCase().includes(searchKeyword.toLowerCase()) ||
      alarm.machineName.toLowerCase().includes(searchKeyword.toLowerCase()) ||
      alarm.message.toLowerCase().includes(searchKeyword.toLowerCase()) ||
      alarm.lineName.toLowerCase().includes(searchKeyword.toLowerCase());

    return matchLine && matchSeverity && matchStatus && matchSearch;
  });

  // Tiếp nhận sự cố (Acknowledge)
  const handleAcknowledge = (alarmId: string) => {
    acknowledgeAlarm(alarmId, currentUser.name);
  };

  // Mở modal hoàn tất sự cố
  const handleOpenResolveModal = (alarm: AlarmEvent) => {
    setResolvingAlarm(alarm);
    setResolutionNote(
      `Đã kiểm tra và xử lý kỹ thuật bởi ${currentUser.name}. Thông số đã trở về dải an toàn.`
    );
  };

  // Xác nhận hoàn tất sự cố
  const handleConfirmResolve = () => {
    if (!resolvingAlarm) return;
    resolveAlarm(resolvingAlarm.id, resolutionNote);
    setResolvingAlarm(null);
    setResolutionNote('');
  };

  /**
   * Xuất báo cáo sự cố dưới dạng file CSV/Excel UTF-8 có BOM
   * Mở trực tiếp trên Microsoft Excel không bị lỗi phông chữ tiếng Việt
   */
  const handleExportCSV = () => {
    const headers = [
      'Mã Sự Cố',
      'Dây Chuyền',
      'Tên Thiết Bị',
      'Chỉ Số Đo',
      'Mức Độ',
      'Giá Trị Đo',
      'Ngưỡng Cho Phép',
      'Đơn Vị',
      'Nội Dung Cảnh Báo',
      'Thời Gian Phát Sinh',
      'Trạng Thái',
      'Người Tiếp Nhận',
      'Thời Gian Tiếp Nhận',
      'Thời Gian Hoàn Tất',
      'Ghi Chú Khắc Phục',
    ];

    const rows = filteredAlarms.map((a) => [
      `"${a.id}"`,
      `"${a.lineName} (${a.lineId})"`,
      `"${a.machineName} (${a.machineId})"`,
      `"${a.metricName}"`,
      `"${a.severity === 'critical' ? 'NGHIÊM TRỌNG' : 'CẢNH BÁO'}"`,
      `"${a.triggeredValue}"`,
      `"${a.thresholdValue}"`,
      `"${a.unit}"`,
      `"${a.message.replace(/"/g, '""')}"`,
      `"${new Date(a.timestamp).toLocaleString('vi-VN')}"`,
      `"${
        a.status === 'resolved'
          ? 'Đã giải quyết'
          : a.status === 'acknowledged'
          ? 'Đang xử lý'
          : 'Chờ tiếp nhận'
      }"`,
      `"${a.assignedTo || 'Chưa phân công'}"`,
      `"${a.acknowledgedAt ? new Date(a.acknowledgedAt).toLocaleString('vi-VN') : ''}"`,
      `"${a.resolvedAt ? new Date(a.resolvedAt).toLocaleString('vi-VN') : ''}"`,
      `"${(a.resolutionNotes || '').replace(/"/g, '""')}"`,
    ]);

    // Thêm UTF-8 Byte Order Mark (\uFEFF) để Excel nhận diện bảng mã tiếng Việt
    const csvContent =
      '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');

    const now = new Date();
    const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(
      now.getDate()
    ).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}${String(
      now.getMinutes()
    ).padStart(2, '0')}`;

    link.setAttribute('href', url);
    link.setAttribute('download', `Bao_Cao_Su_Co_Nha_May_${dateStr}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* ========================================================================= */}
      {/* TIÊU ĐỀ TRANG & NÚT XUẤT BÁO CÁO                                          */}
      {/* ========================================================================= */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded text-xs font-bold bg-rose-500/15 text-rose-700 dark:text-rose-400 border border-rose-500/30">
              NHẬT KÝ VẬN HÀNH
            </span>
            <h1 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">
              Nhật Ký Cảnh Báo & Xử Lý Sự Cố
            </h1>
          </div>
          <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
            Theo dõi dòng sự kiện bất thường thời gian thực, quản lý quy trình 3 bước tiếp nhận và xuất báo cáo vận hành.
          </p>
        </div>

        {/* Nút Xuất Báo Cáo */}
        <Button
          size="sm"
          color="success"
          variant="solid"
          className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs px-4 h-9 shadow-md shadow-emerald-600/20"
          startContent={<Download className="w-4 h-4" />}
          onPress={handleExportCSV}
        >
          Xuất Báo Cáo (CSV/Excel)
        </Button>
      </div>

      {/* ========================================================================= */}
      {/* TOP STATS CARDS: THỐNG KÊ NHANH CÁC SỰ CỐ                                 */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card className="bg-factory-card border border-factory-border p-4 shadow-xs">
          <CardBody className="p-0 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase">
                Tổng sự cố
              </p>
              <p className="font-mono text-2xl font-extrabold text-slate-900 dark:text-white mt-1">
                {totalAlarms}
              </p>
            </div>
            <div className="p-2.5 rounded-xl bg-slate-100 dark:bg-factory-bg text-slate-600 dark:text-slate-400">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
          </CardBody>
        </Card>

        <Card className="bg-factory-card border border-factory-border p-4 shadow-xs">
          <CardBody className="p-0 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold text-rose-600 dark:text-rose-400 uppercase">
                Nguy hiểm (Critical)
              </p>
              <p className="font-mono text-2xl font-extrabold text-rose-600 dark:text-rose-500 mt-1">
                {criticalCount}
              </p>
            </div>
            <div className="p-2.5 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
              <AlertOctagon className="w-5 h-5 animate-pulse" />
            </div>
          </CardBody>
        </Card>

        <Card className="bg-factory-card border border-factory-border p-4 shadow-xs">
          <CardBody className="p-0 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold text-amber-600 dark:text-amber-400 uppercase">
                Chờ xử lý (Pending)
              </p>
              <p className="font-mono text-2xl font-extrabold text-amber-600 dark:text-amber-500 mt-1">
                {pendingCount}
              </p>
            </div>
            <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
              <Clock className="w-5 h-5" />
            </div>
          </CardBody>
        </Card>

        <Card className="bg-factory-card border border-factory-border p-4 shadow-xs">
          <CardBody className="p-0 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 uppercase">
                Đã giải quyết (Resolved)
              </p>
              <p className="font-mono text-2xl font-extrabold text-emerald-600 dark:text-emerald-500 mt-1">
                {resolvedCount}
              </p>
            </div>
            <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </CardBody>
        </Card>
      </div>

      {/* ========================================================================= */}
      {/* KHU VỰC BỘ LỌC ĐA TIÊU CHÍ & TÌM KIẾM                                     */}
      {/* ========================================================================= */}
      <div className="bg-factory-card rounded-2xl border border-factory-border p-4 shadow-xs">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Ô tìm kiếm */}
          <Input
            size="sm"
            placeholder="Tìm theo mã sự cố, thiết bị, nội dung..."
            value={searchKeyword}
            onChange={(e) => setSearchKeyword(e.target.value)}
            startContent={<Search className="w-4 h-4 text-slate-400" />}
            isClearable
            onClear={() => setSearchKeyword('')}
            classNames={{
              input: 'text-xs',
              inputWrapper: 'bg-slate-100 dark:bg-factory-bg border border-slate-200 dark:border-factory-border h-9',
            }}
          />

          {/* Lọc theo Dây chuyền */}
          <select
            value={selectedLine}
            onChange={(e) => setSelectedLine(e.target.value)}
            aria-label="Lọc theo Dây chuyền"
            className="w-full bg-slate-100 dark:bg-factory-bg border border-slate-200 dark:border-factory-border text-slate-800 dark:text-slate-200 rounded-xl text-xs h-9 px-3 outline-none cursor-pointer"
          >
            <option value="all">Tất cả Dây chuyền</option>
            {lines.map((l) => (
              <option key={l.id} value={l.id}>
                {l.code} - {l.name}
              </option>
            ))}
          </select>

          {/* Lọc theo Mức độ */}
          <select
            value={selectedSeverity}
            onChange={(e) => setSelectedSeverity(e.target.value)}
            aria-label="Lọc theo Mức độ"
            className="w-full bg-slate-100 dark:bg-factory-bg border border-slate-200 dark:border-factory-border text-slate-800 dark:text-slate-200 rounded-xl text-xs h-9 px-3 outline-none cursor-pointer"
          >
            <option value="all">Tất cả Mức độ</option>
            <option value="critical">Critical (Nguy hiểm)</option>
            <option value="warning">Warning (Cảnh báo)</option>
          </select>

          {/* Lọc theo Trạng thái quy trình */}
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            aria-label="Lọc theo Trạng thái"
            className="w-full bg-slate-100 dark:bg-factory-bg border border-slate-200 dark:border-factory-border text-slate-800 dark:text-slate-200 rounded-xl text-xs h-9 px-3 outline-none cursor-pointer"
          >
            <option value="all">Tất cả Trạng thái</option>
            <option value="pending">Chờ tiếp nhận ({pendingCount})</option>
            <option value="acknowledged">Đang xử lý ({acknowledgedCount})</option>
            <option value="resolved">Đã giải quyết ({resolvedCount})</option>
          </select>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* BẢNG DANH SÁCH SỰ CỐ & THAO TÁC XỬ LÝ                                     */}
      {/* ========================================================================= */}
      <div className="bg-factory-card rounded-2xl border border-factory-border p-5 space-y-4 shadow-xs">
        <div className="flex items-center justify-between border-b border-factory-border pb-3">
          <div>
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">
              Bảng Sự Cố Vận Hành ({filteredAlarms.length} sự cố)
            </h2>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              Quy trình 3 bước: Chờ tiếp nhận &rarr; Thợ nhận sửa &rarr; Đã khắc phục hoàn tất
            </p>
          </div>
          <span className="text-xs font-mono text-slate-500 dark:text-slate-400">
            {filteredAlarms.length} / {totalAlarms} sự cố
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-factory-border text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                <th className="py-3 px-3">MÃ & THỜI ĐIỂM</th>
                <th className="py-3 px-2">VỊ TRÍ / THIẾT BỊ</th>
                <th className="py-3 px-2">CHỈ SỐ & GIÁ TRỊ</th>
                <th className="py-3 px-2">MỨC ĐỘ</th>
                <th className="py-3 px-3">NỘI DUNG SỰ CỐ</th>
                <th className="py-3 px-2">TRẠNG THÁI</th>
                <th className="py-3 px-3 text-right">QUY TRÌNH XỬ LÝ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-factory-border">
              {filteredAlarms.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-500 dark:text-slate-400 text-xs">
                    Không tìm thấy sự cố nào phù hợp với bộ lọc hiện tại.
                  </td>
                </tr>
              ) : (
                filteredAlarms.map((alarm) => {
                  const isCrit = alarm.severity === 'critical';
                  const timeFormatted = new Date(alarm.timestamp).toLocaleString('vi-VN', {
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                    day: '2-digit',
                    month: '2-digit',
                  });

                  return (
                    <tr
                      key={alarm.id}
                      className="hover:bg-slate-50 dark:hover:bg-white/5 transition-colors"
                    >
                      {/* Cột 1: Mã & Thời điểm */}
                      <td className="py-3.5 px-3 font-mono">
                        <span className="font-bold text-slate-900 dark:text-white">
                          {alarm.id}
                        </span>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                          {timeFormatted}
                        </p>
                      </td>

                      {/* Cột 2: Vị trí / Thiết bị */}
                      <td className="py-3.5 px-2">
                        <span className="font-semibold text-slate-900 dark:text-white">
                          {alarm.machineName}
                        </span>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 font-mono mt-0.5">
                          {alarm.lineName}
                        </p>
                      </td>

                      {/* Cột 3: Chỉ số & Giá trị vượt */}
                      <td className="py-3.5 px-2 font-mono">
                        <div className="flex items-baseline gap-1">
                          <span
                            className={`font-bold text-sm ${
                              isCrit
                                ? 'text-rose-600 dark:text-rose-500'
                                : 'text-amber-600 dark:text-amber-500'
                            }`}
                          >
                            {alarm.triggeredValue}
                          </span>
                          <span className="text-[11px] text-slate-500">{alarm.unit}</span>
                        </div>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                          Ngưỡng: &gt;{alarm.thresholdValue} {alarm.unit}
                        </p>
                      </td>

                      {/* Cột 4: Mức độ */}
                      <td className="py-3.5 px-2">
                        <Chip
                          size="sm"
                          color={isCrit ? 'danger' : 'warning'}
                          variant="flat"
                          startContent={
                            isCrit ? (
                              <AlertOctagon className="w-3.5 h-3.5 text-rose-500 animate-pulse" />
                            ) : (
                              <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                            )
                          }
                          className="font-bold text-[10px] uppercase"
                        >
                          {alarm.severity}
                        </Chip>
                      </td>

                      {/* Cột 5: Nội dung sự cố */}
                      <td className="py-3.5 px-3 max-w-[240px]">
                        <p className="text-slate-800 dark:text-slate-200 line-clamp-2 leading-relaxed">
                          {alarm.message}
                        </p>
                        {alarm.resolutionNotes && (
                          <p className="text-[11px] text-emerald-600 dark:text-emerald-400 mt-1 line-clamp-1 italic">
                            Xử lý: {alarm.resolutionNotes}
                          </p>
                        )}
                      </td>

                      {/* Cột 6: Trạng thái quy trình */}
                      <td className="py-3.5 px-2">
                        {alarm.status === 'pending' && (
                          <Chip size="sm" color="danger" variant="dot" className="font-semibold text-[11px]">
                            Chờ tiếp nhận
                          </Chip>
                        )}
                        {alarm.status === 'acknowledged' && (
                          <div>
                            <Chip size="sm" color="warning" variant="flat" className="font-semibold text-[11px]">
                              Đang xử lý
                            </Chip>
                            <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 font-medium truncate">
                              Bởi: {alarm.assignedTo}
                            </p>
                          </div>
                        )}
                        {alarm.status === 'resolved' && (
                          <div>
                            <Chip size="sm" color="success" variant="flat" className="font-semibold text-[11px]">
                              Đã giải quyết
                            </Chip>
                            <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 font-medium truncate">
                              Xong: {alarm.assignedTo}
                            </p>
                          </div>
                        )}
                      </td>

                      {/* Cột 7: Nút Thao tác theo workflow */}
                      <td className="py-3.5 px-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {alarm.status === 'pending' && (
                            <Button
                              size="sm"
                              color="warning"
                              variant="flat"
                              className="text-xs font-semibold h-8 text-amber-700 dark:text-amber-400"
                              startContent={<UserCheck className="w-3.5 h-3.5" />}
                              onPress={() => handleAcknowledge(alarm.id)}
                            >
                              Tiếp nhận
                            </Button>
                          )}

                          {alarm.status === 'acknowledged' && (
                            <Button
                              size="sm"
                              color="success"
                              variant="solid"
                              className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold h-8 shadow-xs"
                              startContent={<CheckCircle2 className="w-3.5 h-3.5" />}
                              onPress={() => handleOpenResolveModal(alarm)}
                            >
                              Hoàn thành
                            </Button>
                          )}

                          {alarm.status === 'resolved' && (
                            <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              Khép quy trình
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* MODAL XÁC NHẬN HOÀN THÀNH SỰ CỐ & NHẬP GHI CHÚ                            */}
      {/* ========================================================================= */}
      {resolvingAlarm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-fade-in">
          <div className="relative bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-100 dark:border-slate-700 w-full max-w-lg overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between p-6 pb-4 border-b border-slate-100 dark:border-slate-700/60">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                  <CheckCircle2 className="w-5 h-5 shrink-0" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white leading-tight">
                    Xác Nhận Hoàn Thành Xử Lý Sự Cố
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                    Ghi nhận kết quả khắc phục kỹ thuật vào nhật ký hệ thống
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setResolvingAlarm(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-white transition-colors p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700/50 cursor-pointer"
                aria-label="Đóng"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body */}
            <div className="p-6 space-y-4">
              {/* Thông tin sự cố */}
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-700/80 text-xs space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-mono font-bold text-slate-900 dark:text-white">
                    {resolvingAlarm.id}
                  </span>
                  <span className="text-[11px] px-2 py-0.5 rounded-md font-semibold bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">
                    {resolvingAlarm.lineName || resolvingAlarm.lineId}
                  </span>
                </div>
                <div className="flex items-center justify-between text-slate-600 dark:text-slate-400 font-medium pt-0.5">
                  <span>
                    Thiết bị:{' '}
                    <strong className="text-slate-800 dark:text-slate-200">
                      {resolvingAlarm.machineName}
                    </strong>
                  </span>
                  <span className="font-mono">
                    {resolvingAlarm.metricName}:{' '}
                    <strong className="text-rose-600 dark:text-rose-400">
                      {resolvingAlarm.triggeredValue} {resolvingAlarm.unit}
                    </strong>
                  </span>
                </div>
              </div>

              {/* Ghi chú khắc phục */}
              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1.5">
                  Ghi chú khắc phục & biên bản xử lý:
                </label>
                <textarea
                  rows={3}
                  value={resolutionNote}
                  onChange={(e) => setResolutionNote(e.target.value)}
                  placeholder="Nhập chi tiết linh kiện đã thay thế, biện pháp can thiệp..."
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700 rounded-xl text-xs sm:text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all resize-none"
                />
              </div>

              {/* Footer buttons */}
              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setResolvingAlarm(null)}
                  className="border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 px-5 py-2.5 rounded-xl font-medium text-xs sm:text-sm cursor-pointer transition-colors"
                >
                  Đóng
                </button>
                <button
                  type="button"
                  onClick={handleConfirmResolve}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 rounded-xl font-medium text-xs sm:text-sm shadow-sm cursor-pointer transition-colors flex items-center gap-2"
                >
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>Xác Nhận Đã Khắc Phục</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
