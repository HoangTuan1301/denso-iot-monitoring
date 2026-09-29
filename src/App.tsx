/**
 * @file App.tsx
 * @description Điểm điều phối ứng dụng chính với MainLayout, Sidebar điều hướng, Header và các view phân hệ:
 * Dashboard Tầng 1, Luồng & Thành phần Tầng 2, Cấu hình Ngưỡng & Trạm PLC, Nhật ký Cảnh báo & Sự cố
 */

import { useEffect } from 'react';
import { MainLayout } from './layouts/MainLayout';
import { LineOverviewDashboard } from './features/tier1-lines/LineOverviewDashboard';
import { MachineListView } from './features/tier2-machines/MachineListView';
import { ThresholdConfigView } from './features/admin/ThresholdConfigView';
import { UserManagementView } from './features/admin/UserManagementView';
import { AuditLogView } from './features/audit/AuditLogView';
import { AlarmLogView } from './features/alarms/AlarmLogView';
import { LoginPage } from './features/auth/LoginPage';
import { useMonitoringStore } from './stores/useMonitoringStore';
import { useAuthStore } from './stores/useAuthStore';
import { useThemeStore, applyThemeClass } from './stores/useThemeStore';
import { socketClient } from './services/socket';
import { Card, CardBody, Button } from '@heroui/react';
import { QrCode, ShieldAlert } from 'lucide-react';

export default function App() {
  const { activeTab, setActiveTab, isRealtimeActive, simulateTick } = useMonitoringStore();
  const { currentUser, isAuthenticated, checkAuth } = useAuthStore();
  const theme = useThemeStore((state) => state.theme);

  // Áp dụng class theme (dark/light) vào <html> khi khởi chạy và khi người dùng chuyển đổi
  useEffect(() => {
    applyThemeClass(theme);
  }, [theme]);

  // Kiểm tra phiên đăng nhập JWT từ token storage
  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  // Kết nối WebSocket IoT Server và lắng nghe luồng telemetry
  useEffect(() => {
    socketClient.connect();

    const unsubTick = socketClient.on('iot_telemetry_tick', () => {
      if (isRealtimeActive) {
        simulateTick();
      }
    });

    return () => {
      unsubTick();
      socketClient.disconnect();
    };
  }, [isRealtimeActive, simulateTick]);

  // Màn hình Đăng nhập mặc định khi chưa xác thực
  if (!isAuthenticated) {
    return <LoginPage />;
  }

  const userRole = (currentUser?.role || 'OPERATOR').toUpperCase();
  const isAdmin = userRole === 'ADMIN';

  // Điều hướng hiển thị theo Tab kèm rào chắn phân quyền RBAC
  const renderTabContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return <LineOverviewDashboard />;

      case 'lines':
        return <MachineListView />;

      case 'thresholds':
        if (!isAdmin && userRole !== 'MAINTENANCE') {
          return (
            <Card className="bg-factory-card border border-rose-500/20 p-8 text-center shadow-sm">
              <CardBody className="flex flex-col items-center gap-4">
                <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400">
                  <ShieldAlert className="w-10 h-10" />
                </div>
                <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                  Không Đủ Quyền Truy Cập (403 Forbidden)
                </h2>
                <p className="text-sm text-slate-600 dark:text-slate-400 max-w-lg">
                  Tài khoản nhân viên vận hành (Operator) không có quyền thay đổi thông số kỹ thuật và cấu hình trạm PLC. Vui lòng liên hệ Admin (<span className="font-mono text-emerald-600 dark:text-emerald-400 font-semibold">admin@denso.com</span>) để được cấp quyền.
                </p>
                <Button color="primary" variant="solid" className="bg-emerald-600 text-white" onPress={() => setActiveTab('dashboard')}>
                  Quay Về Dashboard Tổng Quan
                </Button>
              </CardBody>
            </Card>
          );
        }
        return <ThresholdConfigView />;

      case 'users':
        if (!isAdmin) {
          return (
            <Card className="bg-factory-card border border-rose-500/20 p-8 text-center shadow-sm">
              <CardBody className="flex flex-col items-center gap-4">
                <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400">
                  <ShieldAlert className="w-10 h-10" />
                </div>
                <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                  Phân Hệ Dành Riêng Cho Quản Trị Viên (Admin)
                </h2>
                <p className="text-sm text-slate-600 dark:text-slate-400 max-w-lg">
                  Chỉ Quản trị viên hệ thống (Admin) mới có quyền truy cập trang Quản lý Người dùng & Phân quyền nhân viên.
                </p>
                <Button color="primary" variant="solid" className="bg-emerald-600 text-white" onPress={() => setActiveTab('dashboard')}>
                  Quay Về Dashboard Tổng Quan
                </Button>
              </CardBody>
            </Card>
          );
        }
        return <UserManagementView />;

      case 'audit':
        if (!isAdmin && userRole !== 'MAINTENANCE') {
          return (
            <Card className="bg-factory-card border border-rose-500/20 p-8 text-center shadow-sm">
              <CardBody className="flex flex-col items-center gap-4">
                <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400">
                  <ShieldAlert className="w-10 h-10" />
                </div>
                <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                  Nhật Ký Kiểm Toán Bị Khóa
                </h2>
                <p className="text-sm text-slate-600 dark:text-slate-400 max-w-lg">
                  Nhật ký kiểm toán hệ thống yêu cầu tài khoản Quản trị viên (Admin) hoặc Kỹ thuật bảo trì (Maintenance).
                </p>
                <Button color="primary" variant="solid" className="bg-emerald-600 text-white" onPress={() => setActiveTab('dashboard')}>
                  Quay Về Dashboard Tổng Quan
                </Button>
              </CardBody>
            </Card>
          );
        }
        return <AuditLogView />;

      case 'alarms':
        return <AlarmLogView />;

      case 'qr':
        return (
          <Card className="bg-factory-card border border-factory-border p-8 text-center shadow-sm">
            <CardBody className="flex flex-col items-center gap-4">
              <div className="p-4 rounded-2xl bg-purple-500/10 border border-purple-500/20 text-purple-600 dark:text-purple-400">
                <QrCode className="w-10 h-10" />
              </div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">Quét Mã QR Thiết Bị Tầng 2</h2>
              <p className="text-sm text-slate-600 dark:text-slate-400 max-w-lg">
                Hỗ trợ Camera quét QR trên thân máy hoặc mở modal QR tại danh sách thiết bị để tra cứu nhanh thông số đo lường Tầng 3.
              </p>
              <Button color="primary" variant="solid" className="bg-emerald-600 text-white" onPress={() => setActiveTab('lines')}>
                Đến Danh Sách Thiết Bị & Mã QR
              </Button>
            </CardBody>
          </Card>
        );

      case 'settings':
      default:
        return <LineOverviewDashboard />;
    }
  };

  return <MainLayout>{renderTabContent()}</MainLayout>;
}
