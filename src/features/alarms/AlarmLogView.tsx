/**
 * @file AlarmLogView.tsx
 * @description Trang Nhật Ký Sự Cố (Alert Log) & Quy Trình Tiếp Nhận Xử Lý Sự Cố
 * Hỗ trợ các bộ lọc đa tiêu chí, Modal xác nhận hoàn thành, và tính năng Xuất Báo Cáo Excel/CSV (UTF-8 BOM)
 */

import { useState } from 'react';
import {
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

        {/* Nút Xuất Báo Cáo Gradient Xanh Lá */}
        <button
          type="button"
          onClick={handleExportCSV}
          className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-semibold text-xs px-4 h-9.5 rounded-xl shadow-md hover:shadow-lg transition-all flex items-center gap-2 cursor-pointer shrink-0"
        >
          <Download className="w-4 h-4 shrink-0" />
          <span>Xuất Báo Cáo (CSV/Excel)</span>
        </button>
      </div>

      {/* ========================================================================= */}
      {/* TOP STATS CARDS: THỐNG KÊ NHANH CÁC SỰ CỐ (INDUSTRIAL CONTROL CENTER)      */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Thẻ 1: CRITICAL (Nguy hiểm) */}
        <div className="bg-red-50/70 dark:bg-rose-950/20 border border-slate-200/80 dark:border-slate-800 border-l-4 border-l-red-500 rounded-xl p-4 shadow-sm flex items-center justify-between transition-all hover:shadow-md">
          <div>
            <p className="text-[11px] font-bold text-red-700 dark:text-red-400 uppercase tracking-wider">
              Nguy hiểm (Critical)
            </p>
            <p className="font-mono text-3xl font-black text-red-600 dark:text-red-400 mt-1">
              {criticalCount}
            </p>
          </div>
          <div className="p-2.5 rounded-xl bg-red-500/15 border border-red-500/30 text-red-600 dark:text-red-400">
            <AlertOctagon className="w-5 h-5 animate-pulse" />
          </div>
        </div>

        {/* Thẻ 2: PENDING (Chờ xử lý) */}
        <div className="bg-amber-50/70 dark:bg-amber-950/20 border border-slate-200/80 dark:border-slate-800 border-l-4 border-l-amber-500 rounded-xl p-4 shadow-sm flex items-center justify-between transition-all hover:shadow-md">
          <div>
            <p className="text-[11px] font-bold text-amber-700 dark:text-amber-400 uppercase tracking-wider">
              Chờ xử lý (Pending)
            </p>
            <p className="font-mono text-3xl font-black text-amber-600 dark:text-amber-400 mt-1">
              {pendingCount}
            </p>
          </div>
          <div className="p-2.5 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-600 dark:text-amber-400">
            <Clock className="w-5 h-5" />
          </div>
        </div>

        {/* Thẻ 3: RESOLVED (Đã giải quyết) */}
        <div className="bg-emerald-50/70 dark:bg-emerald-950/20 border border-slate-200/80 dark:border-slate-800 border-l-4 border-l-emerald-500 rounded-xl p-4 shadow-sm flex items-center justify-between transition-all hover:shadow-md">
          <div>
            <p className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider">
              Đã giải quyết (Resolved)
            </p>
            <p className="font-mono text-3xl font-black text-emerald-600 dark:text-emerald-400 mt-1">
              {resolvedCount}
            </p>
          </div>
          <div className="p-2.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>

        {/* Thẻ 4: TỔNG (Tổng sự cố) */}
        <div className="bg-slate-50 dark:bg-slate-900/40 border border-slate-200/80 dark:border-slate-800 border-l-4 border-l-slate-400 rounded-xl p-4 shadow-sm flex items-center justify-between transition-all hover:shadow-md">
          <div>
            <p className="text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
              Tổng sự cố
            </p>
            <p className="font-mono text-3xl font-black text-slate-800 dark:text-slate-100 mt-1">
              {totalAlarms}
            </p>
          </div>
          <div className="p-2.5 rounded-xl bg-slate-200/60 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-400">
            <FileSpreadsheet className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* KHU VỰC BỘ LỌC ĐA TIÊU CHÍ & TÌM KIẾM                                     */}
      {/* ========================================================================= */}
      <div className="bg-slate-50/80 dark:bg-slate-900/60 p-3 rounded-xl border border-slate-200/80 dark:border-slate-800 shadow-xs">
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center gap-3">
          {/* Ô tìm kiếm mở rộng chiếm phần lớn bên trái */}
          <div className="flex-1 min-w-[260px]">
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
                inputWrapper: 'bg-white dark:bg-factory-bg border border-slate-200 dark:border-factory-border h-9.5 rounded-xl shadow-xs',
              }}
            />
          </div>

          {/* Dồn 3 Select box lọc gọn về bên phải */}
          <div className="flex flex-wrap sm:flex-nowrap items-center gap-2.5 shrink-0">
            {/* Lọc theo Dây chuyền */}
            <select
              value={selectedLine}
              onChange={(e) => setSelectedLine(e.target.value)}
              aria-label="Lọc theo Dây chuyền"
              className="w-full sm:w-auto min-w-[160px] bg-white dark:bg-factory-bg border border-slate-200 dark:border-factory-border text-slate-800 dark:text-slate-200 rounded-xl text-xs h-9.5 px-3 outline-none cursor-pointer hover:border-slate-300 dark:hover:border-slate-600 transition-colors shadow-xs"
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
              className="w-full sm:w-auto min-w-[130px] bg-white dark:bg-factory-bg border border-slate-200 dark:border-factory-border text-slate-800 dark:text-slate-200 rounded-xl text-xs h-9.5 px-3 outline-none cursor-pointer hover:border-slate-300 dark:hover:border-slate-600 transition-colors shadow-xs"
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
              className="w-full sm:w-auto min-w-[160px] bg-white dark:bg-factory-bg border border-slate-200 dark:border-factory-border text-slate-800 dark:text-slate-200 rounded-xl text-xs h-9.5 px-3 outline-none cursor-pointer hover:border-slate-300 dark:hover:border-slate-600 transition-colors shadow-xs"
            >
              <option value="all">Tất cả Trạng thái</option>
              <option value="pending">Chờ tiếp nhận ({pendingCount})</option>
              <option value="acknowledged">Đang xử lý ({acknowledgedCount})</option>
              <option value="resolved">Đã giải quyết ({resolvedCount})</option>
            </select>
          </div>
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
          <span className="text-xs font-mono text-slate-500 dark:text-slate-400 font-bold">
            {filteredAlarms.length} / {totalAlarms} sự cố
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-slate-100/90 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 font-bold uppercase text-[11px] tracking-wider py-3.5 border-b border-slate-200 dark:border-slate-700">
                <th className="py-3.5 px-3 w-[13%]">MÃ & THỜI ĐIỂM</th>
                <th className="py-3.5 px-2 w-[13%]">VỊ TRÍ / THIẾT BỊ</th>
                <th className="py-3.5 px-2 w-[13%]">CHỈ SỐ & GIÁ TRỊ</th>
                <th className="py-3.5 px-2 w-[12%]">MỨC ĐỘ</th>
                <th className="py-3.5 px-3 w-[35%]">NỘI DUNG SỰ CỐ</th>
                <th className="py-3.5 px-2 w-[11%]">TRẠNG THÁI</th>
                <th className="py-3.5 px-3 w-[13%] text-right">QUY TRÌNH XỬ LÝ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
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
                      className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-all border-b border-slate-100 dark:border-slate-800/60"
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
                      <td className="py-3.5 px-2">
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`font-mono px-2 py-0.5 rounded font-bold text-sm ${
                              isCrit
                                ? 'bg-red-100/80 dark:bg-red-950/60 text-red-700 dark:text-red-400 border border-red-200/60 dark:border-red-900/40'
                                : 'bg-amber-100/80 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 border border-amber-200/60 dark:border-amber-900/40'
                            }`}
                          >
                            {alarm.triggeredValue} {alarm.unit}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                          Ngưỡng: &gt;{alarm.thresholdValue} {alarm.unit}
                        </p>
                      </td>

                      {/* Cột 4: Mức độ (Pill Badge nổi bật với Ping Effect) */}
                      <td className="py-3.5 px-2">
                        {isCrit ? (
                          <span className="bg-red-100 text-red-700 border border-red-200 dark:bg-rose-950/60 dark:text-rose-400 dark:border-rose-800/40 px-2.5 py-1 rounded-full font-bold text-xs inline-flex items-center gap-1.5 shadow-xs">
                            <span className="relative flex h-2 w-2">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                              <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
                            </span>
                            <AlertOctagon className="w-3.5 h-3.5 text-red-600 dark:text-rose-400 shrink-0" />
                            CRITICAL
                          </span>
                        ) : (
                          <span className="bg-amber-100 text-amber-800 border border-amber-200 dark:bg-amber-950/60 dark:text-amber-400 dark:border-amber-800/40 px-2.5 py-1 rounded-full font-bold text-xs inline-flex items-center gap-1.5">
                            <span className="h-2 w-2 rounded-full bg-amber-500" />
                            <AlertTriangle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                            WARNING
                          </span>
                        )}
                      </td>

                      {/* Cột 5: Nội dung sự cố (Dành 35% độ rộng) */}
                      <td className="py-3.5 px-3">
                        <p className="text-slate-800 dark:text-slate-200 font-medium leading-relaxed">
                          {alarm.message}
                        </p>
                        {alarm.resolutionNotes && (
                          <div className="bg-emerald-50/80 dark:bg-emerald-950/30 border-l-2 border-emerald-500 p-2 mt-1.5 rounded-r text-xs text-emerald-800 dark:text-emerald-300 flex items-start gap-1.5 shadow-xs">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                            <span>Xử lý: {alarm.resolutionNotes}</span>
                          </div>
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
