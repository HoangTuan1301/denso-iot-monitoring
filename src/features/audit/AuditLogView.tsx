/**
 * @file AuditLogView.tsx
 * @description Trang Nhật Ký Thao Tác & Truy Vết Sự Cố (Enterprise Audit Log System)
 * Ghi nhận toàn bộ thay đổi cấu hình, thao tác người dùng và hỗ trợ Xuất File Audit Log CSV/Excel (UTF-8 BOM).
 */

import { useState, useEffect } from 'react';
import {
  Button,
  Input,
} from '@heroui/react';
import {
  ShieldAlert,
  Search,
  Download,
  UserCheck,
  RefreshCw,
  FileSpreadsheet,
  Terminal,
} from 'lucide-react';
import { apiClient } from '../../services/api';
import { socketClient } from '../../services/socket';
import { AuditLogEntry } from '../../types/audit';

export function AuditLogView() {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [selectedActionFilter, setSelectedActionFilter] = useState('all');

  const loadAuditLogs = async () => {
    setIsLoading(true);
    try {
      const res = await apiClient.getAuditLogs({
        action: selectedActionFilter !== 'all' ? selectedActionFilter : undefined,
        search: searchKeyword || undefined,
      });
      setLogs(res.auditLogs);
    } catch {
      // Mock fallback
      setLogs([
        {
          id: 'AUD-20260929-001',
          userId: 'usr-admin-01',
          userEmail: 'admin@denso.com',
          userName: 'Hoàng Minh Hải',
          employeeId: 'DNS-1001',
          action: 'UPDATE_THRESHOLD',
          target: 'MTR-STP-01-TMP',
          details: 'Cập nhật ngưỡng nhiệt độ máy dập: Warning Max: 68°C, Critical Max: 80°C',
          ipAddress: '192.168.1.15',
          timestamp: '2026-09-29T08:15:22.000Z',
        },
        {
          id: 'AUD-20260929-002',
          userId: 'usr-admin-01',
          userEmail: 'admin@denso.com',
          userName: 'Hoàng Minh Hải',
          employeeId: 'DNS-1001',
          action: 'TOGGLE_PLC',
          target: 'PLC-STATION-01',
          details: 'Khởi động lại kết nối truyền thông Modbus/TCP Siemens S7-1500',
          ipAddress: '192.168.1.15',
          timestamp: '2026-09-29T08:30:10.000Z',
        },
        {
          id: 'AUD-20260929-003',
          userId: 'usr-operator-01',
          userEmail: 'user@denso.com',
          userName: 'Trần Quang Huy',
          employeeId: 'DNS-1024',
          action: 'ACKNOWLEDGE_ALARM',
          target: 'ALM-20260927-001',
          details: 'Tiếp nhận xử lý cảnh báo quá nhiệt ổ bi băng tải MC-CVY-01',
          ipAddress: '192.168.1.42',
          timestamp: '2026-09-29T09:05:40.000Z',
        },
        {
          id: 'AUD-20260929-004',
          userId: 'usr-admin-01',
          userEmail: 'admin@denso.com',
          userName: 'Hoàng Minh Hải',
          employeeId: 'DNS-1001',
          action: 'CREATE_USER',
          target: 'user@denso.com',
          details: 'Tạo tài khoản Operator mới: Trần Quang Huy (Mã NV: DNS-1024)',
          ipAddress: '192.168.1.15',
          timestamp: '2026-09-29T09:20:00.000Z',
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadAuditLogs();

    // Lắng nghe sự kiện Audit Log mới đẩy từ WebSocket Server thời gian thực
    const unsubscribe = socketClient.on('audit_event', (payload: any) => {
      if (payload && payload.data) {
        setLogs((prev) => [payload.data, ...prev]);
      }
    });

    return () => unsubscribe();
  }, [selectedActionFilter]);

  // Xuất file Audit Log sang CSV UTF-8 có BOM
  const handleExportCSV = () => {
    const headers = [
      'Mã Log',
      'Thời Điểm',
      'Mã Nhân Viên',
      'Họ Và Tên',
      'Email',
      'Hành Động',
      'Đối Tượng Tác Động',
      'Chi Tiết Thay Đổi',
      'Địa Chỉ IP',
    ];

    const rows = logs.map((l) => [
      `"${l.id}"`,
      `"${new Date(l.timestamp).toLocaleString('vi-VN')}"`,
      `"${l.employeeId}"`,
      `"${l.userName}"`,
      `"${l.userEmail}"`,
      `"${l.action}"`,
      `"${l.target}"`,
      `"${l.details.replace(/"/g, '""')}"`,
      `"${l.ipAddress}"`,
    ]);

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
    link.setAttribute('download', `Nhat_Ky_Audit_Log_Denso_${dateStr}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Thống kê nhanh
  const totalAudit = logs.length;
  const configAudit = logs.filter((l) => l.action.includes('THRESHOLD') || l.action.includes('PLC')).length;
  const authAudit = logs.filter((l) => l.action === 'LOGIN' || l.action === 'LOGOUT').length;
  const alarmAudit = logs.filter((l) => l.action.includes('ALARM') || l.action.includes('EMERGENCY')).length;

  return (
    <div className="space-y-6">
      {/* Tiêu đề & Nút Xuất File */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded text-xs font-bold bg-indigo-500/15 text-indigo-700 dark:text-indigo-400 border border-indigo-500/30">
              TRUY VẾT BẢO MẬT
            </span>
            <h1 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">
              Nhật Ký Thao Tác & Truy Vết Sự Cố (Audit Logs)
            </h1>
          </div>
          <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
            Ghi nhận tự động lịch sử thao tác của Admin & Nhân viên: sửa ngưỡng, bật/tắt trạm PLC, xử lý cảnh báo và đăng nhập.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="flat"
            className="text-xs font-semibold h-9"
            startContent={<RefreshCw className="w-3.5 h-3.5" />}
            onPress={loadAuditLogs}
          >
            Làm mới
          </Button>

          <Button
            size="sm"
            className="bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-semibold text-xs px-4 h-9 shadow-md hover:shadow-lg rounded-lg transition-all"
            startContent={<Download className="w-4 h-4" />}
            onPress={handleExportCSV}
          >
            Xuất File Audit Log (CSV/Excel)
          </Button>
        </div>
      </div>

      {/* 4 Thẻ KPI Thống Kê Đỉnh */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 w-full">
        {/* Card 1: SỰ CỐ & KHẨN CẤP */}
        <div className="bg-red-50/70 dark:bg-rose-950/20 border-l-4 border-red-500 border border-red-100 dark:border-rose-900/30 rounded-xl p-4 flex items-center justify-between shadow-xs">
          <div>
            <p className="text-[11px] font-bold text-red-600 dark:text-red-400 uppercase tracking-wider">
              Sự cố & Khẩn cấp
            </p>
            <p className="font-mono text-3xl font-black text-red-600 dark:text-red-400 mt-1">
              {alarmAudit}
            </p>
          </div>
          <div className="p-2.5 rounded-xl bg-red-100/80 dark:bg-rose-950/40 text-red-600 dark:text-red-400 border border-red-200 dark:border-rose-800/40">
            <ShieldAlert className="w-5 h-5" />
          </div>
        </div>

        {/* Card 2: CẤU HÌNH & PLC */}
        <div className="bg-amber-50/70 dark:bg-amber-950/20 border-l-4 border-amber-500 border border-amber-100 dark:border-amber-900/30 rounded-xl p-4 flex items-center justify-between shadow-xs">
          <div>
            <p className="text-[11px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider">
              Cấu hình & PLC
            </p>
            <p className="font-mono text-3xl font-black text-amber-600 dark:text-amber-400 mt-1">
              {configAudit}
            </p>
          </div>
          <div className="p-2.5 rounded-xl bg-amber-100/80 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800/40">
            <Terminal className="w-5 h-5" />
          </div>
        </div>

        {/* Card 3: ĐĂNG NHẬP / RA */}
        <div className="bg-blue-50/70 dark:bg-blue-950/20 border-l-4 border-blue-500 border border-blue-100 dark:border-blue-900/30 rounded-xl p-4 flex items-center justify-between shadow-xs">
          <div>
            <p className="text-[11px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider">
              Đăng nhập / Ra
            </p>
            <p className="font-mono text-3xl font-black text-blue-600 dark:text-blue-400 mt-1">
              {authAudit}
            </p>
          </div>
          <div className="p-2.5 rounded-xl bg-blue-100/80 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800/40">
            <UserCheck className="w-5 h-5" />
          </div>
        </div>

        {/* Card 4: TỔNG NHẬT KÝ */}
        <div className="bg-slate-50 dark:bg-slate-900/40 border-l-4 border-slate-400 border border-slate-200 dark:border-slate-800 rounded-xl p-4 flex items-center justify-between shadow-xs">
          <div>
            <p className="text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
              Tổng nhật ký
            </p>
            <p className="font-mono text-3xl font-black text-slate-800 dark:text-slate-100 mt-1">
              {totalAudit}
            </p>
          </div>
          <div className="p-2.5 rounded-xl bg-slate-200/60 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-400">
            <FileSpreadsheet className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Thanh Bộ Lọc & Dropdown */}
      <div className="bg-slate-50/80 dark:bg-slate-900/60 p-3 rounded-xl border border-slate-200/80 dark:border-slate-800 shadow-xs flex flex-col sm:flex-row gap-3">
        <div className="flex-1">
          <Input
            size="sm"
            placeholder="Tìm theo nhân viên, hành động, đối tượng, nội dung..."
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

        <div className="sm:w-64 shrink-0">
          <select
            value={selectedActionFilter}
            onChange={(e) => setSelectedActionFilter(e.target.value)}
            aria-label="Lọc theo Hành động"
            className="w-full bg-white dark:bg-factory-bg border border-slate-200 dark:border-factory-border text-slate-800 dark:text-slate-200 rounded-xl text-xs h-9.5 px-3 outline-none cursor-pointer hover:border-slate-300 dark:hover:border-slate-600 transition-colors shadow-xs"
          >
            <option value="all">Tất cả Hành động</option>
            <option value="UPDATE_THRESHOLD">UPDATE_THRESHOLD (Sửa ngưỡng)</option>
            <option value="TOGGLE_PLC">TOGGLE_PLC (Bật/Tắt PLC)</option>
            <option value="ACKNOWLEDGE_ALARM">ACKNOWLEDGE_ALARM (Nhận sửa)</option>
            <option value="RESOLVE_ALARM">RESOLVE_ALARM (Hoàn thành sự cố)</option>
            <option value="LOGIN">LOGIN (Đăng nhập)</option>
            <option value="LOGOUT">LOGOUT (Đăng xuất)</option>
            <option value="CREATE_USER">CREATE_USER (Tạo nhân viên)</option>
            <option value="TRIGGER_EMERGENCY">TRIGGER_EMERGENCY (Giả lập sự cố)</option>
          </select>
        </div>
      </div>

      {/* Bảng Nhật Ký Audit (Data Table) */}
      <div className="bg-factory-card rounded-2xl border border-factory-border p-5 space-y-4 shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-slate-100/90 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 font-bold uppercase text-[11px] tracking-wider py-3.5 border-b border-slate-200 dark:border-slate-700">
                <th className="py-3.5 px-3">THỜI GIAN & MÃ</th>
                <th className="py-3.5 px-2">NHÂN VIÊN (THỰC HIỆN)</th>
                <th className="py-3.5 px-2">HÀNH ĐỘNG</th>
                <th className="py-3.5 px-2">ĐỐI TƯỢNG</th>
                <th className="py-3.5 px-3">CHI TIẾT THAY ĐỔI</th>
                <th className="py-3.5 px-3 font-mono text-right">IP ADDRESS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400 text-xs">
                    Đang tải dữ liệu nhật ký...
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400 text-xs">
                    Không tìm thấy bản ghi Audit Log nào phù hợp.
                  </td>
                </tr>
              ) : (
                logs.map((log) => {
                  return (
                    <tr
                      key={log.id}
                      className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-all border-b border-slate-100 dark:border-slate-800/60"
                    >
                      {/* Thời gian & Mã */}
                      <td className="py-3.5 px-3 font-mono">
                        <span className="font-bold text-slate-900 dark:text-white">
                          {new Date(log.timestamp).toLocaleTimeString('vi-VN', {
                            hour: '2-digit',
                            minute: '2-digit',
                            second: '2-digit',
                          })}
                        </span>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                          {new Date(log.timestamp).toLocaleDateString('vi-VN')}{' '}
                          <span className="font-mono text-[11px] text-slate-400 dark:text-slate-500">
                            &bull; {log.id}
                          </span>
                        </p>
                      </td>

                      {/* Nhân viên */}
                      <td className="py-3.5 px-2">
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono font-bold text-slate-900 dark:text-white">
                            {log.employeeId}
                          </span>
                          <span className="text-slate-600 dark:text-slate-300 font-medium">
                            &bull; {log.userName}
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-500 dark:text-slate-400 font-mono mt-0.5">
                          {log.userEmail}
                        </p>
                      </td>

                      {/* Hành động (Pill Badges) */}
                      <td className="py-3.5 px-2">
                        {log.action === 'LOGIN' ? (
                          <span className="inline-block bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/40 font-bold px-2.5 py-1 rounded-full text-xs">
                            LOGIN
                          </span>
                        ) : log.action === 'LOGOUT' ? (
                          <span className="inline-block bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-200 dark:border-slate-700 font-bold px-2.5 py-1 rounded-full text-xs">
                            LOGOUT
                          </span>
                        ) : log.action.includes('EMERGENCY') ? (
                          <span className="inline-block bg-red-100 text-red-800 dark:bg-rose-950/60 dark:text-rose-300 border border-red-200 dark:border-rose-800/40 font-bold px-2.5 py-1 rounded-full text-xs">
                            {log.action}
                          </span>
                        ) : (
                          <span className="inline-block bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200 dark:border-amber-800/40 font-bold px-2.5 py-1 rounded-full text-xs">
                            {log.action}
                          </span>
                        )}
                      </td>

                      {/* Đối tượng */}
                      <td className="py-3.5 px-2">
                        <span className="font-mono text-xs bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700 inline-block">
                          {log.target}
                        </span>
                      </td>

                      {/* Chi tiết thay đổi */}
                      <td className="py-3.5 px-3 max-w-[320px]">
                        <p className="text-slate-800 dark:text-slate-200 line-clamp-2 leading-relaxed">
                          {log.details}
                        </p>
                      </td>

                      {/* IP Address */}
                      <td className="py-3.5 px-3 text-right">
                        <span className="font-mono text-xs text-slate-500 dark:text-slate-400 bg-slate-100/60 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60 px-2 py-0.5 rounded inline-block">
                          {log.ipAddress}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
