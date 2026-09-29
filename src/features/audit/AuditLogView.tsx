/**
 * @file AuditLogView.tsx
 * @description Trang Nhật Ký Thao Tác & Truy Vết Sự Cố (Enterprise Audit Log System)
 * Ghi nhận toàn bộ thay đổi cấu hình, thao tác người dùng và hỗ trợ Xuất File Audit Log CSV/Excel (UTF-8 BOM).
 */

import { useState, useEffect } from 'react';
import {
  Card,
  CardBody,
  Button,
  Chip,
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
            color="success"
            variant="solid"
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs px-4 h-9 shadow-md shadow-emerald-600/20"
            startContent={<Download className="w-4 h-4" />}
            onPress={handleExportCSV}
          >
            Xuất File Audit Log (CSV/Excel)
          </Button>
        </div>
      </div>

      {/* KPI Thống Kê Hành Động */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card className="bg-factory-card border border-factory-border p-4 shadow-xs">
          <CardBody className="p-0 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase">
                Tổng nhật ký
              </p>
              <p className="font-mono text-2xl font-extrabold text-slate-900 dark:text-white mt-1">
                {totalAudit}
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
              <p className="text-[11px] font-bold text-amber-600 dark:text-amber-400 uppercase">
                Cấu hình & PLC
              </p>
              <p className="font-mono text-2xl font-extrabold text-amber-600 dark:text-amber-400 mt-1">
                {configAudit}
              </p>
            </div>
            <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
              <Terminal className="w-5 h-5" />
            </div>
          </CardBody>
        </Card>

        <Card className="bg-factory-card border border-factory-border p-4 shadow-xs">
          <CardBody className="p-0 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold text-blue-600 dark:text-blue-400 uppercase">
                Đăng nhập / Ra
              </p>
              <p className="font-mono text-2xl font-extrabold text-blue-600 dark:text-blue-400 mt-1">
                {authAudit}
              </p>
            </div>
            <div className="p-2.5 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
              <UserCheck className="w-5 h-5" />
            </div>
          </CardBody>
        </Card>

        <Card className="bg-factory-card border border-factory-border p-4 shadow-xs">
          <CardBody className="p-0 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold text-rose-600 dark:text-rose-400 uppercase">
                Sự cố & Khẩn cấp
              </p>
              <p className="font-mono text-2xl font-extrabold text-rose-600 dark:text-rose-400 mt-1">
                {alarmAudit}
              </p>
            </div>
            <div className="p-2.5 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
              <ShieldAlert className="w-5 h-5" />
            </div>
          </CardBody>
        </Card>
      </div>

      {/* Bộ Lọc & Bảng Dữ Liệu Audit Log */}
      <div className="bg-factory-card rounded-2xl border border-factory-border p-5 space-y-4 shadow-xs">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 border-b border-factory-border pb-4">
          <div className="sm:col-span-2">
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
                inputWrapper: 'bg-slate-100 dark:bg-factory-bg border border-slate-200 dark:border-factory-border h-9',
              }}
            />
          </div>

          <div>
            <select
              value={selectedActionFilter}
              onChange={(e) => setSelectedActionFilter(e.target.value)}
              className="w-full bg-slate-100 dark:bg-factory-bg border border-slate-200 dark:border-factory-border text-slate-800 dark:text-slate-200 rounded-xl text-xs h-9 px-3 outline-none cursor-pointer"
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

        {/* Bảng Dữ Liệu */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-factory-border text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                <th className="py-3 px-3">THỜI GIAN & MÃ</th>
                <th className="py-3 px-2">NHÂN VIÊN (THỰC HIỆN)</th>
                <th className="py-3 px-2">HÀNH ĐỘNG</th>
                <th className="py-3 px-2">ĐỐI TƯỢNG</th>
                <th className="py-3 px-3">CHI TIẾT THAY ĐỔI</th>
                <th className="py-3 px-2 font-mono text-right">IP ADDRESS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-factory-border">
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
                  const isThreshold = log.action.includes('THRESHOLD');
                  const isPLC = log.action.includes('PLC');
                  const isAlarm = log.action.includes('ALARM');
                  const isUser = log.action.includes('USER');
                  const isEmergency = log.action.includes('EMERGENCY');

                  const chipColor = isEmergency
                    ? 'danger'
                    : isAlarm
                    ? 'warning'
                    : isThreshold
                    ? 'primary'
                    : isPLC
                    ? 'success'
                    : isUser
                    ? 'secondary'
                    : 'default';

                  return (
                    <tr key={log.id} className="hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">
                      {/* Thời gian & Mã */}
                      <td className="py-3 px-3 font-mono">
                        <span className="font-bold text-slate-900 dark:text-white">
                          {new Date(log.timestamp).toLocaleTimeString('vi-VN', {
                            hour: '2-digit',
                            minute: '2-digit',
                            second: '2-digit',
                          })}
                        </span>
                        <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                          {new Date(log.timestamp).toLocaleDateString('vi-VN')} &bull; {log.id}
                        </p>
                      </td>

                      {/* Nhân viên */}
                      <td className="py-3 px-2">
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

                      {/* Hành động */}
                      <td className="py-3 px-2">
                        <Chip size="sm" color={chipColor as any} variant="flat" className="font-mono font-bold text-[10px]">
                          {log.action}
                        </Chip>
                      </td>

                      {/* Đối tượng */}
                      <td className="py-3 px-2 font-mono">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 dark:bg-factory-bg border border-slate-200 dark:border-factory-border text-slate-700 dark:text-gray-300">
                          {log.target}
                        </span>
                      </td>

                      {/* Chi tiết thay đổi */}
                      <td className="py-3 px-3 max-w-[300px]">
                        <p className="text-slate-800 dark:text-slate-200 line-clamp-2 leading-relaxed">
                          {log.details}
                        </p>
                      </td>

                      {/* IP Address */}
                      <td className="py-3 px-2 text-right font-mono text-[11px] text-slate-500 dark:text-slate-400">
                        {log.ipAddress}
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
