/**
 * @file MachineListView.tsx
 * @description Màn hình Luồng & Thành phần (Chuẩn giao diện Algo/Admin Monitoring theo ảnh mẫu)
 * Tích hợp thanh luồng ngang Tầng 1, danh mục Luồng bên trái và Bảng Thành phần máy bên phải
 * Tích hợp REST API MySQL (Bước 2B / 2F-1) và đồng bộ thời gian thực qua WebSocket
 * Hỗ trợ Gán/Chuyển giao PLC (Dual Confirmation 409) và Gỡ trạm PLC an toàn theo phân quyền RBAC
 */

import { useState, useEffect } from 'react';
import { Button } from '@heroui/react';
import { Tooltip } from '../../components/common/Tooltip';
import { CustomSwitch } from '../../components/common/CustomSwitch';
import { 
  Plus, 
  LineChart, 
  QrCode, 
  ArrowRight, 
  Edit3,
  Cpu,
  RefreshCw,
  AlertCircle,
  Loader2,
  Layers,
  Search,
} from 'lucide-react';
import { useMonitoringStore } from '../../stores/useMonitoringStore';
import { useAuthStore } from '../../stores/useAuthStore';
import { socketClient } from '../../services/socket';
import { MachineComponent, ProductionLine } from '../../types/hierarchy';
import { MachineDetailModal } from '../tier3-metrics/MachineDetailModal';
import { QRCodeModal } from '../../components/qr/QRCodeModal';
import { CreateMachineModal } from './CreateMachineModal';
import { EditMachineModal } from './EditMachineModal';
import { MachineImage } from '../../config/machineImages';

export function MachineListView() {
  const { 
    lines, 
    selectedLineId, 
    setSelectedLineId, 
    activeNavGroup,
    isLoadingLines,
    linesError,
    isLoadingMachines,
    machinesError,
    fetchLines,
    fetchMachines,
  } = useMonitoringStore();

  const currentUser = useAuthStore((state) => state.currentUser);
  const canAddDevice = currentUser.role === 'ADMIN';

  // Nạp dữ liệu từ Backend khi mount và đăng ký WebSocket đồng bộ
  useEffect(() => {
    fetchLines();
    fetchMachines();

    // Lắng nghe các sự kiện cập nhật cấu hình máy & PLC từ server
    const unsubLinePlcAssigned = socketClient.on('line_plc_assigned', () => {
      fetchLines();
      fetchMachines();
    });
    const unsubLinePlcUnassigned = socketClient.on('line_plc_unassigned', () => {
      fetchLines();
      fetchMachines();
    });
    const unsubPlcAssigned = socketClient.on('plc_assigned', () => {
      fetchLines();
      fetchMachines();
    });
    const unsubPlcUnassigned = socketClient.on('plc_unassigned', () => {
      fetchLines();
      fetchMachines();
    });
    const unsubMachineUpdated = socketClient.on('machine_updated', () => {
      fetchMachines();
    });
    const unsubMachineCreated = socketClient.on('machine_created', () => {
      fetchLines();
      fetchMachines();
    });
    const unsubMachineArchived = socketClient.on('machine_archived', () => {
      fetchLines();
      fetchMachines();
    });

    return () => {
      unsubLinePlcAssigned();
      unsubLinePlcUnassigned();
      unsubPlcAssigned();
      unsubPlcUnassigned();
      unsubMachineUpdated();
      unsubMachineCreated();
      unsubMachineArchived();
    };
  }, [fetchLines, fetchMachines]);

  // Dây chuyền đang được chọn để hiển thị danh sách máy
  const currentLineId = selectedLineId || lines[0]?.id || 'LINE-01';
  const currentLine: ProductionLine = lines.find((l) => l.id === currentLineId) || lines[0] || {
    id: 'LINE-01',
    name: 'Đang tải luồng...',
    code: 'LINE-01',
    status: 'normal',
    safetyScore: 100,
    machines: [],
  };

  // Trạng thái modal
  const [selectedMachine, setSelectedMachine] = useState<MachineComponent | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isQRModalOpen, setIsQRModalOpen] = useState(false);

  // Trạng thái modal Thêm Thiết Bị Mới
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  // Trạng thái modal Chỉnh Sửa Thông Tin Thiết Bị
  const [editingMachine, setEditingMachine] = useState<MachineComponent | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  // Tìm kiếm máy trong bảng
  const [searchTerm, setSearchTerm] = useState('');
  const [monitoringStatus, setMonitoringStatus] = useState<Record<string, boolean>>({});

  // Lọc máy theo tìm kiếm
  const filteredMachines = (currentLine.machines || []).filter((m) => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    return (
      m.name.toLowerCase().includes(term) ||
      m.id.toLowerCase().includes(term) ||
      (m.code && m.code.toLowerCase().includes(term)) ||
      (m.type && m.type.toLowerCase().includes(term)) ||
      (m.plc?.name && m.plc.name.toLowerCase().includes(term)) ||
      (m.plcId && m.plcId.toLowerCase().includes(term))
    );
  });

  // Mở modal chi tiết
  const handleOpenDetails = (machine: MachineComponent) => {
    setSelectedMachine(machine);
    setIsDetailModalOpen(true);
  };

  // Mở modal QR
  const handleOpenQR = (machine: MachineComponent) => {
    setSelectedMachine(machine);
    setIsQRModalOpen(true);
  };

  // Nút Retry khi gặp lỗi nạp dữ liệu
  const handleRetry = () => {
    fetchLines();
    fetchMachines();
  };

  return (
    <div className="space-y-6">
      {/* ========================================================================= */}
      {/* TIÊU ĐỀ TRANG & NÚT THAO TÁC                                              */}
      {/* ========================================================================= */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
            {activeNavGroup === 'monitoring' ? 'Giám sát Thiết bị' : 'Dây chuyền & Thiết bị'}
            {(isLoadingLines || isLoadingMachines) && (
              <Loader2 className="w-4 h-4 animate-spin text-emerald-600 dark:text-emerald-400" />
            )}
          </h1>
          <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
            Danh mục {lines.length} dây chuyền sản xuất và các thiết bị máy móc kỹ thuật trực thuộc CSDL TEST.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="flat"
            className="text-xs h-9 font-medium"
            startContent={<RefreshCw className={`w-3.5 h-3.5 ${isLoadingMachines ? 'animate-spin' : ''}`} />}
            onPress={handleRetry}
            isDisabled={isLoadingMachines}
          >
            Làm mới
          </Button>

          {canAddDevice ? (
            <Button
              size="sm"
              color="primary"
              variant="solid"
              className="bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-semibold text-xs px-3.5 h-9 shadow-md shadow-emerald-600/20 cursor-pointer rounded-xl transition-all flex items-center gap-1.5 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
              startContent={<Plus className="w-4 h-4" />}
              onPress={() => setIsCreateModalOpen(true)}
            >
              Thêm thiết bị
            </Button>
          ) : (
            <Tooltip content="Chỉ quản trị viên (Admin) mới có quyền thêm thiết bị">
              <span>
                <Button
                  size="sm"
                  color="default"
                  variant="flat"
                  isDisabled
                  className="text-xs px-3.5 h-9 opacity-60 cursor-not-allowed rounded-xl flex items-center gap-1.5"
                  startContent={<Plus className="w-4 h-4" />}
                >
                  Thêm thiết bị
                </Button>
              </span>
            </Tooltip>
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* THÔNG BÁO LỖI (NẾU CÓ)                                                    */}
      {/* ========================================================================= */}
      {(linesError || machinesError) && (
        <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 flex items-center justify-between text-xs text-rose-700 dark:text-rose-400">
          <div className="flex items-center gap-2.5">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>Lỗi tải dữ liệu: {linesError || machinesError}</span>
          </div>
          <Button size="sm" variant="flat" color="danger" onPress={handleRetry} className="h-7 text-xs">
            Thử lại
          </Button>
        </div>
      )}

      {/* ========================================================================= */}
      {/* THANH PIPELINE CÁC LUỒNG NGANG (TẦNG 1 - LUỒNG / DÂY CHUYỀN)               */}
      {/* ========================================================================= */}
      <div className="bg-factory-card p-5 rounded-2xl border border-factory-border shadow-xs">
        <div className="flex flex-col lg:flex-row items-center justify-between gap-3 overflow-x-auto pb-1">
          {lines.map((line, index) => {
            const isSelected = line.id === currentLineId;
            const isCrit = line.status === 'critical';
            const isWarn = line.status === 'warning';

            return (
              <div key={line.id} className="flex items-center gap-3 w-full lg:w-auto flex-1">
                {/* Thẻ Card Luồng */}
                <div
                  onClick={() => setSelectedLineId(line.id)}
                  className={`flex-1 p-4 rounded-xl border cursor-pointer transition-all duration-200 text-center select-none ${
                    isSelected
                      ? 'border-emerald-500 bg-emerald-500/10 ring-2 ring-emerald-500/50 shadow-md'
                      : 'bg-factory-card border-factory-border hover:border-slate-400 dark:hover:border-gray-500'
                  }`}
                >
                  {/* % Điểm an toàn lớn trên đỉnh */}
                  <div
                    className={`font-mono text-base font-extrabold mb-1.5 ${
                      isCrit
                        ? 'text-rose-600 dark:text-rose-500'
                        : isWarn
                        ? 'text-amber-600 dark:text-amber-500'
                        : 'text-emerald-600 dark:text-emerald-500'
                    }`}
                  >
                    {line.safetyScore}%
                  </div>

                  {/* Tên mã Luồng */}
                  <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider font-mono">
                    {line.code}
                  </h3>

                  {/* Mô tả ngắn */}
                  <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-0.5 line-clamp-1">
                    {line.name}
                  </p>

                  {/* Nhãn trạng thái */}
                  <div className="mt-2 flex justify-center">
                    {line.status === 'normal' && (
                      <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                        Bình thường
                      </span>
                    )}
                    {line.status === 'warning' && (
                      <span className="text-[11px] font-semibold text-amber-600 dark:text-amber-400">
                        Cảnh báo &bull; 1
                      </span>
                    )}
                    {line.status === 'critical' && (
                      <span className="text-[11px] font-semibold text-rose-600 dark:text-rose-400 animate-pulse">
                        Nghiêm trọng &bull; 1
                      </span>
                    )}
                  </div>
                </div>

                {/* Mũi tên kết nối giữa các luồng */}
                {index < lines.length - 1 && (
                  <div className="hidden lg:flex text-slate-400 dark:text-gray-500 shrink-0">
                    <ArrowRight className="w-4 h-4 opacity-70" />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* KHU VỰC DƯỚI: DANH SÁCH LUỒNG (BÊN TRÁI) & BẢNG THÀNH PHẦN (BÊN PHẢI)     */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* CỘT TRÁI (4 CỘT): DANH SÁCH CÁC LUỒNG */}
        <div className="lg:col-span-4 bg-factory-card rounded-2xl border border-factory-border p-4 shadow-xs space-y-3">
          <div className="flex items-center justify-between border-b border-factory-border pb-3">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
              <Layers className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              {lines.length} Luồng
            </h3>
            <span className="text-xs text-slate-500 dark:text-slate-400 font-mono font-medium">
              Tổng số
            </span>
          </div>

          <div className="space-y-2">
            {lines.map((line, idx) => {
              const isSelected = line.id === currentLineId;
              const isCrit = line.status === 'critical';
              const isWarn = line.status === 'warning';

              return (
                <div
                  key={line.id}
                  onClick={() => setSelectedLineId(line.id)}
                  className={`p-3 rounded-xl border cursor-pointer transition-all ${
                    isSelected
                      ? 'border-emerald-500 bg-emerald-500/10'
                      : 'border-factory-border hover:border-slate-400 dark:hover:border-gray-500 bg-slate-50/60 dark:bg-factory-bg/40'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs text-slate-500 dark:text-slate-400 font-semibold">
                      {String(idx + 1).padStart(2, '0')}
                    </span>
                    <span
                      className={`h-2 w-2 rounded-full ${
                        isCrit
                          ? 'bg-rose-500'
                          : isWarn
                          ? 'bg-amber-500'
                          : 'bg-emerald-500'
                      }`}
                    />
                  </div>

                  <h4 className="text-sm font-bold text-slate-900 dark:text-white mt-1">
                    {line.code}
                  </h4>
                  <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-1 mt-0.5">
                    {line.name}
                  </p>

                  <div className="mt-2 text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-2 font-medium">
                    <span className="h-1.5 w-1.5 rounded-full bg-amber-500 inline-block"></span>
                    <span>{(line.machines || []).length} thành phần</span>
                    <span>&bull;</span>
                    <span>{(line.machines || []).reduce((acc, m) => acc + (m.mappingCount ?? 0), 0)} mapping</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* CỘT PHẢI (8 CỘT): BẢNG THÀNH PHẦN THUỘC LUỒNG ĐANG CHỌN */}
        <div className="lg:col-span-8 bg-factory-card rounded-2xl border border-factory-border p-5 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-factory-border pb-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Thành phần thuộc {currentLine.code} ({currentLine.name})
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                Quản lý trạng thái giám sát, trạm PLC liên kết và chỉ số đo lường
              </p>
            </div>

            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Tìm máy..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8 pr-3 py-1 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-emerald-500 w-36 sm:w-44"
                />
              </div>

              <span className="text-xs font-mono text-slate-500 dark:text-slate-400 font-medium whitespace-nowrap">
                {filteredMachines.length} máy
              </span>
            </div>
          </div>

          {/* BANNER THÔNG TIN TRẠM PLC CỦA DÂY CHUYỀN (KIẾN TRÚC 1 LINE - 1 PLC - GẮN SẴN) */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-xl bg-slate-50 dark:bg-factory-bg/60 border border-slate-200 dark:border-factory-border/70 text-xs">
            <div className="flex items-center gap-2.5 min-w-0 flex-1">
              <div className="p-2 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 shrink-0">
                <Cpu className="w-4 h-4" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-bold text-slate-800 dark:text-slate-200">
                    Trạm PLC Dây Chuyền ({currentLine.code}):
                  </span>
                  {currentLine.plc ? (
                    <span className="font-semibold text-blue-600 dark:text-blue-400 font-mono">
                      {currentLine.plc.name}
                    </span>
                  ) : (
                    <span className="text-slate-400 dark:text-slate-500 italic">
                      Chưa cấu hình trạm PLC
                    </span>
                  )}
                  {currentLine.plc && (
                    <>
                      {currentLine.plc.isDemo && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/70 dark:text-amber-300">
                          MÔ PHỎNG / DEMO
                        </span>
                      )}
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                        {currentLine.plc.status === 'CONNECTED' ? 'CONNECTED' : 'CHƯA KẾT NỐI VẬT LÝ (UNKNOWN)'}
                      </span>
                    </>
                  )}
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                  Tất cả các máy trong dây chuyền này tự động kế thừa trạm PLC từ dây chuyền.
                </p>
              </div>
            </div>
          </div>

          {/* Bảng danh sách thành phần máy */}
          <div className="overflow-x-auto">
            {filteredMachines.length === 0 ? (
              <div className="py-12 text-center text-xs text-slate-500 dark:text-slate-400">
                {isLoadingMachines ? (
                  <div className="flex flex-col items-center justify-center gap-2">
                    <Loader2 className="w-6 h-6 animate-spin text-emerald-600" />
                    <span>Đang nạp dữ liệu máy từ MySQL...</span>
                  </div>
                ) : (
                  <span>Không tìm thấy máy nào trong luồng này.</span>
                )}
              </div>
            ) : (
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-factory-border text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                    <th className="py-3 px-3 w-[16%]">MÃ COMPONENT</th>
                    <th className="py-3 px-3 w-[26%]">TÊN THIẾT BỊ</th>
                    <th className="py-3 px-3 w-[16%]">LOẠI</th>
                    <th className="py-3 px-3 w-[14%] text-center">TRẠNG THÁI</th>
                    <th className="py-3 px-3 w-[14%]">VỊ TRÍ</th>
                    <th className="py-3 px-2 w-[7%] text-center">GIÁM SÁT</th>
                    <th className="py-3 px-3 w-[7%] text-right">HÀNH ĐỘNG</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-factory-border">
                  {filteredMachines.map((machine) => {
                    return (
                      <tr
                        key={machine.id}
                        className="hover:bg-slate-100/70 dark:hover:bg-white/5 transition-colors"
                      >
                        {/* Cột 1: Mã Component & Thumbnail CAD */}
                        <td className="py-3 px-3">
                          <div className="flex items-center gap-2">
                            <div 
                              onClick={() => handleOpenDetails(machine)}
                              className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center shrink-0 p-0.5 overflow-hidden cursor-pointer hover:border-emerald-500 transition-colors"
                              title={`Xem chi tiết ${machine.name}`}
                            >
                              <MachineImage
                                machineId={machine.id}
                                machineCode={machine.code}
                                imageUrl={machine.imageUrl}
                                alt={machine.name}
                                className="max-h-6 w-auto object-contain"
                                fallbackIconClassName="w-3.5 h-3.5 text-emerald-600/70"
                              />
                            </div>
                            <span 
                              className="font-mono font-bold text-slate-900 dark:text-white hover:text-emerald-600 dark:hover:text-emerald-400 cursor-pointer" 
                              onClick={() => handleOpenDetails(machine)}
                            >
                              {machine.id}
                            </span>
                          </div>
                        </td>

                        {/* Cột 2: Tên hiển thị */}
                        <td className="py-3.5 px-3 font-semibold text-slate-900 dark:text-white max-w-[200px] truncate">
                          {machine.name}
                        </td>

                        {/* Cột 3: Loại */}
                        <td className="py-3.5 px-3">
                          <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-slate-100 dark:bg-factory-bg border border-slate-200 dark:border-factory-border text-slate-700 dark:text-gray-300">
                            {machine.type || 'MÁY CÔNG NGHIỆP'}
                          </span>
                        </td>

                        {/* Cột 4: Trạng thái giám sát (Chưa có dữ liệu / Bình thường / Cảnh báo / Nguy hiểm) */}
                        <td className="py-3.5 px-3 text-center">
                          {(() => {
                            const s = (machine.status || '').toLowerCase();
                            if (s === 'critical') {
                              return (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/30">
                                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
                                  Nguy hiểm
                                </span>
                              );
                            }
                            if (s === 'warning') {
                              return (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30">
                                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                                  Cảnh báo
                                </span>
                              );
                            }
                            if (s === 'normal') {
                              return (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                  Bình thường
                                </span>
                              );
                            }
                            return (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-300 dark:border-slate-700 font-mono">
                                <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                                Chưa có dữ liệu
                              </span>
                            );
                          })()}
                        </td>

                        {/* Cột 5: Vị trí / Object */}
                        <td className="py-3.5 px-3 text-slate-600 dark:text-slate-400 font-mono text-[11px] truncate max-w-[140px]">
                          {(machine.location || `Xưởng ${currentLine.name}`).split(' - ')[0]}
                        </td>

                        {/* Cột 6: Toggle Giám sát */}
                        <td className="py-3.5 px-2 text-center">
                          <div className="flex justify-center">
                            <CustomSwitch
                              isSelected={monitoringStatus[machine.id] ?? true}
                              size="sm"
                              color="success"
                              aria-label={`Bật/Tắt giám sát ${machine.name}`}
                              onValueChange={(val) =>
                                setMonitoringStatus((prev) => ({ ...prev, [machine.id]: val }))
                              }
                            />
                          </div>
                        </td>

                        {/* Cột 7: Các nút Hành động */}
                        <td className="py-3.5 px-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {/* Nút Xem biểu đồ chi tiết Tầng 3 */}
                            <Tooltip content="Xem chi tiết & Biểu đồ Tầng 3">
                              <button
                                onClick={() => handleOpenDetails(machine)}
                                className="p-1.5 rounded-lg bg-slate-100 dark:bg-factory-bg border border-slate-200 dark:border-factory-border text-slate-600 dark:text-gray-400 hover:text-emerald-600 dark:hover:text-emerald-400 hover:border-emerald-500/50 transition-colors cursor-pointer"
                              >
                                <LineChart className="w-3.5 h-3.5" />
                              </button>
                            </Tooltip>

                            {/* Nút Xem mã QR */}
                            <Tooltip content="Mã QR định danh">
                              <button
                                onClick={() => handleOpenQR(machine)}
                                className="p-1.5 rounded-lg bg-slate-100 dark:bg-factory-bg border border-slate-200 dark:border-factory-border text-slate-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:border-blue-500/50 transition-colors cursor-pointer"
                              >
                                <QrCode className="w-3.5 h-3.5" />
                              </button>
                            </Tooltip>

                            {/* Nút Chỉnh sửa thông tin thiết bị (Yêu cầu 1) */}
                            <Tooltip content="Chỉnh sửa thông tin thiết bị">
                              <button
                                onClick={() => {
                                  setEditingMachine(machine);
                                  setIsEditModalOpen(true);
                                }}
                                className="p-1.5 rounded-lg bg-slate-100 dark:bg-factory-bg border border-slate-200 dark:border-factory-border text-slate-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:border-blue-500/50 transition-colors cursor-pointer"
                                aria-label={`Chỉnh sửa thông tin ${machine.name}`}
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>
                            </Tooltip>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {/* MODAL CHI TIẾT TẦNG 3 (BIỂU ĐỒ RECHARTS & METRIC) */}
      <MachineDetailModal
        machine={selectedMachine}
        lineName={currentLine.name}
        isOpen={isDetailModalOpen}
        onClose={() => setIsDetailModalOpen(false)}
        onOpenQR={() => {
          setIsDetailModalOpen(false);
          setIsQRModalOpen(true);
        }}
      />

      {/* MODAL QR CODE */}
      <QRCodeModal
        machine={selectedMachine}
        isOpen={isQRModalOpen}
        onClose={() => setIsQRModalOpen(false)}
      />

      {/* MODAL THÊM THIẾT BỊ MỚI */}
      <CreateMachineModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        lines={lines}
        defaultLineId={currentLine.id}
        onCreated={() => {
          fetchLines();
          fetchMachines();
        }}
      />

      {/* MODAL CHỈNH SỬA THÔNG TIN THIẾT BỊ (YÊU CẦU 1) */}
      <EditMachineModal
        isOpen={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false);
          setEditingMachine(null);
        }}
        machine={editingMachine}
        lineName={currentLine.name}
        onUpdated={() => {
          fetchLines();
          fetchMachines();
        }}
      />
    </div>
  );
}
