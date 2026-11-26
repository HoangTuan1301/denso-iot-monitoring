/**
 * @file App.tsx
 * @description Điểm điều phối ứng dụng chính với MainLayout, Sidebar điều hướng, Header và các view phân hệ:
 * Dashboard Tầng 1, Luồng & Thành phần Tầng 2, Cấu hình Ngưỡng & Trạm PLC, Nhật ký Cảnh báo & Sự cố
 */

import { useEffect, lazy, Suspense } from 'react';
import { MainLayout } from './layouts/MainLayout';
import { LoginPage } from './features/auth/LoginPage';

// [PERF] Code-splitting: mỗi phân hệ là một chunk riêng, chỉ tải khi mở tab tương ứng.
// Trang Login vì vậy tải nhẹ hơn nhiều so với 1 bundle ~1.6MB như trước.
const loadDashboard = () => import('./features/tier1-lines/LineOverviewDashboard');
const LineOverviewDashboard = lazy(() => loadDashboard().then((m) => ({ default: m.LineOverviewDashboard })));
const MachineListView = lazy(() => import('./features/tier2-machines/MachineListView').then((m) => ({ default: m.MachineListView })));
const DeviceMonitoringView = lazy(() => import('./features/tier2-machines/DeviceMonitoringView').then((m) => ({ default: m.DeviceMonitoringView })));
const ThresholdConfigView = lazy(() => import('./features/admin/ThresholdConfigView').then((m) => ({ default: m.ThresholdConfigView })));
const UserManagementView = lazy(() => import('./features/admin/UserManagementView').then((m) => ({ default: m.UserManagementView })));
const AuditLogView = lazy(() => import('./features/audit/AuditLogView').then((m) => ({ default: m.AuditLogView })));
const AlarmLogView = lazy(() => import('./features/alarms/AlarmLogView').then((m) => ({ default: m.AlarmLogView })));
const MachineHistoryView = lazy(() => import('./features/history/MachineHistoryView').then((m) => ({ default: m.MachineHistoryView })));
const MetricCatalogView = lazy(() => import('./features/metrics/MetricCatalogView').then((m) => ({ default: m.MetricCatalogView })));
const AIIntelligenceView = lazy(() => import('./features/ai-intelligence/AIIntelligenceView').then((m) => ({ default: m.AIIntelligenceView })));

// Khung chờ hiển thị trong lúc tải chunk của phân hệ
function ViewSkeleton() {
  return (
    <div className="space-y-4 animate-pulse" aria-busy="true" aria-label={tr("Đang tải")}>
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-28 rounded-2xl bg-slate-200/70 dark:bg-white/5" />
        ))}
      </div>
      <div className="h-[420px] rounded-2xl bg-slate-200/70 dark:bg-white/5" />
    </div>
  );
}
import { useMonitoringStore } from './stores/useMonitoringStore';
import { useAuthStore } from './stores/useAuthStore';
import { useThemeStore, applyThemeClass } from './stores/useThemeStore';
import { socketClient } from './services/socket';
import { Card, CardBody, Button } from '@heroui/react';
import { QrCode, ShieldAlert } from 'lucide-react';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import { tr } from './i18n/tr';

export default function App() {
  const {
    activeTab,
    activeNavGroup,
    setActiveTab,
    isRealtimeActive,
    simulateTick,
    fetchLines,
    fetchMachines,
    fetchLatestTelemetry,
    fetchIngestionOverview,
    handleLiveTelemetryPacket,
    handleHistoricalBatchIngested,
  } = useMonitoringStore();
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

  // [PERF] Tải trước chunk Dashboard ở nền trong lúc người dùng còn ở trang Login,
  // để sau khi đăng nhập Dashboard hiện ra ngay.
  useEffect(() => {
    const id = window.setTimeout(() => {
      loadDashboard().catch(() => {});
    }, 300);
    return () => window.clearTimeout(id);
  }, []);

  // Tải dữ liệu ban đầu từ MySQL Backend khi người dùng đã xác thực
  useEffect(() => {
    if (isAuthenticated) {
      fetchLines();
      fetchMachines();
      fetchLatestTelemetry();
      fetchIngestionOverview();
    }
  }, [isAuthenticated, fetchLines, fetchMachines, fetchLatestTelemetry, fetchIngestionOverview]);

  // Kết nối WebSocket IoT Server và lắng nghe luồng telemetry + file ingestion
  // [PERF] Chỉ kết nối khi đã đăng nhập: trước đây socket mở ngay ở trang Login và
  // sự kiện "connected" kích hoạt 4 API cần token => 401 hàng loạt + logout lặp.
  useEffect(() => {
    if (!isAuthenticated) return;
    socketClient.connect();

    const unsubTick = socketClient.on('iot_telemetry_tick', () => {
      if (isRealtimeActive) {
        simulateTick();
      }
    });

    const unsubTelemetry = socketClient.on('telemetry_packet', (msg: any) => {
      const packet = msg.payload || msg;
      handleLiveTelemetryPacket(packet);
    });

    const unsubHistorical = socketClient.on('historical_batch_ingested', (msg: any) => {
      const batch = msg.payload || msg;
      handleHistoricalBatchIngested(batch);
      // Tự động đồng bộ lại overview khi có file mới xử lý xong
      fetchIngestionOverview();
    });

    const unsubIngestionStatus = socketClient.on('ingestion_status_changed', () => {
      fetchIngestionOverview();
    });

    // Lắng nghe sự kiện cấu hình Mapping & Ngưỡng để tự động đồng bộ tức thì vào Store
    const unsubMappingCreated = socketClient.on('mapping_created', () => fetchMachines());
    const unsubMappingUpdated = socketClient.on('mapping_updated', () => fetchMachines());
    const unsubMappingDeleted = socketClient.on('mapping_deleted', () => fetchMachines());
    const unsubMappingDeactivated = socketClient.on('mapping_deactivated', () => fetchMachines());
    const unsubThresholdsUpdated = socketClient.on('thresholds_updated', () => fetchMachines());

    // Đồng bộ lại khi WebSocket phục hồi kết nối (Reconnect Synchronization)
    // [PERF] Bỏ qua lần kết nối ĐẦU TIÊN vì dữ liệu ban đầu đã được tải ở effect phía trên
    // (trước đây mỗi API bị gọi 2 lần khi vào Dashboard).
    let hasConnectedOnce = false;
    const unsubStatus = socketClient.onStatusChange((connected) => {
      if (!connected) return;
      if (!hasConnectedOnce) {
        hasConnectedOnce = true;
        return;
      }
      {
        fetchLines();
        fetchMachines();
        fetchLatestTelemetry();
        fetchIngestionOverview();
      }
    });

    return () => {
      unsubTick();
      unsubTelemetry();
      unsubHistorical();
      unsubIngestionStatus();
      unsubMappingCreated();
      unsubMappingUpdated();
      unsubMappingDeleted();
      unsubMappingDeactivated();
      unsubThresholdsUpdated();
      unsubStatus();
      socketClient.disconnect();
    };
  }, [
    isAuthenticated,
    isRealtimeActive,
    simulateTick,
    handleLiveTelemetryPacket,
    handleHistoricalBatchIngested,
    fetchLines,
    fetchMachines,
    fetchLatestTelemetry,
    fetchIngestionOverview,
  ]);

  // Màn hình Đăng nhập mặc định khi chưa xác thực
  // Chặn sẵn: nếu đang đứng ở màn hình tài khoản này không có quyền (VD còn sót từ phiên trước
  // hoặc khôi phục sau khi đổi ngôn ngữ) thì đưa về Dashboard thay vì hiện trang 403.
  useEffect(() => {
    if (!isAuthenticated) return;
    const role = (currentUser?.role || 'OPERATOR').toUpperCase();
    const admin = role === 'ADMIN';
    const canConfig = admin || role === 'MAINTENANCE';
    const configOnly =
      activeTab === 'thresholds' ||
      activeTab === 'metrics' ||
      activeTab === 'settings' ||
      activeTab === 'audit' ||
      (activeTab === 'lines' && activeNavGroup !== 'monitoring');
    if ((activeTab === 'users' && !admin) || (configOnly && !canConfig)) setActiveTab('dashboard');
  }, [activeTab, activeNavGroup, currentUser?.role, isAuthenticated, setActiveTab]);

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

      case 'devices':
        return <DeviceMonitoringView />;

      case 'lines':
        if (activeNavGroup === 'monitoring') {
          return <DeviceMonitoringView />;
        }
        if (!isAdmin && userRole !== 'MAINTENANCE') {
          return (
            <Card className="bg-factory-card border border-rose-500/20 p-8 text-center shadow-sm">
              <CardBody className="flex flex-col items-center gap-4">
                <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400">
                  <ShieldAlert className="w-10 h-10" />
                </div>
                <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                  {tr("Không Đủ Quyền Truy Cập (403 Forbidden)")}
                </h2>
                <p className="text-sm text-slate-600 dark:text-slate-400 max-w-lg">
                  {tr("Tài khoản nhân viên vận hành (Operator) không có quyền cấu hình Dây chuyền & Thiết bị. Vui lòng liên hệ Quản trị viên để được hỗ trợ.")}
                </p>
                <Button color="primary" variant="solid" className="bg-emerald-600 text-white" onPress={() => setActiveTab('dashboard')}>
                  {tr("Quay Về Dashboard Tổng Quan")}
                </Button>
              </CardBody>
            </Card>
          );
        }
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
                  {tr("Không Đủ Quyền Truy Cập (403 Forbidden)")}
                </h2>
                <p className="text-sm text-slate-600 dark:text-slate-400 max-w-lg">
                  {tr("Tài khoản nhân viên vận hành (Operator) không có quyền thay đổi thông số kỹ thuật và cấu hình trạm PLC. Vui lòng liên hệ Admin (")}<span className="font-mono text-emerald-600 dark:text-emerald-400 font-semibold">admin@denso.com</span>{tr(") để được cấp quyền.")}
                </p>
                <Button color="primary" variant="solid" className="bg-emerald-600 text-white" onPress={() => setActiveTab('dashboard')}>
                  {tr("Quay Về Dashboard Tổng Quan")}
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
                  {tr("Phân Hệ Dành Riêng Cho Quản Trị Viên (Admin)")}
                </h2>
                <p className="text-sm text-slate-600 dark:text-slate-400 max-w-lg">
                  {tr("Chỉ Quản trị viên hệ thống (Admin) mới có quyền truy cập trang Quản lý Người dùng & Phân quyền nhân viên.")}
                </p>
                <Button color="primary" variant="solid" className="bg-emerald-600 text-white" onPress={() => setActiveTab('dashboard')}>
                  {tr("Quay Về Dashboard Tổng Quan")}
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
                  {tr("Nhật Ký Kiểm Toán Bị Khóa")}
                </h2>
                <p className="text-sm text-slate-600 dark:text-slate-400 max-w-lg">
                  {tr("Nhật ký kiểm toán hệ thống yêu cầu tài khoản Quản trị viên (Admin) hoặc Kỹ thuật bảo trì (Maintenance).")}
                </p>
                <Button color="primary" variant="solid" className="bg-emerald-600 text-white" onPress={() => setActiveTab('dashboard')}>
                  {tr("Quay Về Dashboard Tổng Quan")}
                </Button>
              </CardBody>
            </Card>
          );
        }
        return <AuditLogView />;

      case 'alarms':
        return <AlarmLogView />;

      case 'history':
        return <MachineHistoryView />;

      case 'ai':
        return <AIIntelligenceView />;

      case 'qr':
        return (
          <Card className="bg-factory-card border border-factory-border p-8 text-center shadow-sm">
            <CardBody className="flex flex-col items-center gap-4">
              <div className="p-4 rounded-2xl bg-purple-500/10 border border-purple-500/20 text-purple-600 dark:text-purple-400">
                <QrCode className="w-10 h-10" />
              </div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">{tr("Quét Mã QR Thiết Bị Tầng 2")}</h2>
              <p className="text-sm text-slate-600 dark:text-slate-400 max-w-lg">
                {tr("Hỗ trợ Camera quét QR trên thân máy hoặc mở modal QR tại danh sách thiết bị để tra cứu nhanh thông số đo lường Tầng 3.")}
              </p>
              <Button color="primary" variant="solid" className="bg-emerald-600 text-white" onPress={() => setActiveTab('lines')}>
                {tr("Đến Danh Sách Thiết Bị & Mã QR")}
              </Button>
            </CardBody>
          </Card>
        );

      case 'metrics':
      case 'settings':
        if (!isAdmin && userRole !== 'MAINTENANCE') {
          return (
            <Card className="bg-factory-card border border-rose-500/20 p-8 text-center shadow-sm">
              <CardBody className="flex flex-col items-center gap-4">
                <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400">
                  <ShieldAlert className="w-10 h-10" />
                </div>
                <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                  {tr("Không Đủ Quyền Truy Cập (403 Forbidden)")}
                </h2>
                <p className="text-sm text-slate-600 dark:text-slate-400 max-w-lg">
                  {tr("Tài khoản nhân viên vận hành (Operator) không có quyền truy cập hoặc cấu hình Danh mục Thông số. Vui lòng liên hệ Quản trị viên để được hỗ trợ.")}
                </p>
                <Button color="primary" variant="solid" className="bg-emerald-600 text-white" onPress={() => setActiveTab('dashboard')}>
                  {tr("Quay Về Dashboard Tổng Quan")}
                </Button>
              </CardBody>
            </Card>
          );
        }
        return <MetricCatalogView />;

      default:
        return <LineOverviewDashboard />;
    }
  };

  return (
    <MainLayout>
      <ErrorBoundary
        key={activeTab}
        fallbackTitle={tr("Sự cố hiển thị phân hệ giám sát")}
        onReset={() => {
          setActiveTab('dashboard');
          useMonitoringStore.getState().setDashboardViewLevel('factory_layout');
        }}
      >
        <Suspense fallback={<ViewSkeleton />}>{renderTabContent()}</Suspense>
      </ErrorBoundary>
    </MainLayout>
  );
}
