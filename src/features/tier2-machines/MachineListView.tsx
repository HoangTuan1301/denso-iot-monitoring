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
import { tr } from '../../i18n/tr';
import { useProductionOverview } from '../dashboard/production/useProduction';
import { OEE_CARD, OEE_COLOR, oeeLevel } from '../dashboard/production/oeeTone';
import { lineDisplayName } from '../../config/lineDisplayName';

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
  // OEE ca hiện tại của từng line (cùng nguồn với Dashboard) thay cho "điểm an toàn" luôn 100%
  const production = useProductionOverview();
  const lineOee = new Map<string, { oee: number; productionStatus: string; stopped?: boolean }>();
  for (const st of production.data?.lineStates || []) {
    lineOee.set(st.lineId, st);
    lineOee.set(st.lineCode, st);
  }
  const currentLine: ProductionLine = lines.find((l) => l.id === currentLineId) || lines[0] || {
    id: 'LINE-01',
    name: tr("Đang tải luồng..."),
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
            {activeNavGroup === 'monitoring' ? tr("Giám sát Thiết bị") : tr("Dây chuyền & Thiết bị")}
            {(isLoadingLines || isLoadingMachines) && (
              <Loader2 className="w-4 h-4 animate-spin text-emerald-600 dark:text-emerald-400" />
            )}
          </h1>
          <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
            {tr("Danh mục")} {lines.length} {tr("dây chuyền sản xuất và các thiết bị máy móc kỹ thuật trực thuộc CSDL TEST.")}
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
            {tr("Làm mới")}
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
              {tr("Thêm thiết bị")}
            </Button>
          ) : (
            <Tooltip content={tr("Chỉ quản trị viên (Admin) mới có quyền thêm thiết bị")}>
              <span>
                <Button
                  size="sm"
                  color="default"
                  variant="flat"
                  isDisabled
                  className="text-xs px-3.5 h-9 opacity-60 cursor-not-allowed rounded-xl flex items-center gap-1.5"
                  startContent={<Plus className="w-4 h-4" />}
                >
                  {tr("Thêm thiết bị")}
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
            <span>{tr("Lỗi tải dữ liệu:")} {linesError || machinesError}</span>
          </div>
          <Button size="sm" variant="flat" color="danger" onPress={handleRetry} className="h-7 text-xs">
            {tr("Thử lại")}
          </Button>
        </div>
      )}

      {/* ========================================================================= */}
      {/* THANH PIPELINE CÁC LUỒNG NGANG (TẦNG 1 - LUỒNG / DÂY CHUYỀN)               */}
      {/* ========================================================================= */}
      <div className="bg-factory-card p-4 rounded-2xl border border-factory-border shadow-xs flex flex-col gap-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">{tr('OEE dây chuyền · ca hiện tại')}</h3>
          <span className="text-[11px] text-slate-500 dark:text-slate-400">
            {tr('Xanh ≥ 85% · Cam 80–85% · Đỏ < 80% · cùng số liệu với Dashboard')}
          </span>
        </div>
        <div className="flex gap-2.5 overflow-x-auto pb-1.5 [scrollbar-width:thin]">
          {lines.map((line) => {
            const isSelected = line.id === currentLineId;
            const st = lineOee.get(line.id) || lineOee.get(line.code);
            const oee = st?.oee ?? null;
            const lv = st?.productionStatus === 'ALARM' && st?.stopped ? 'low' : oeeLevel(oee);
            return (
              <button
                type="button"
                key={line.id}
                onClick={() => setSelectedLineId(line.id)}
                aria-pressed={isSelected}
                title={`${line.code} – ${line.name}`}
                className={`shrink-0 w-[124px] px-3 py-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                  isSelected ? 'ring-2 ring-emerald-500/60 border-emerald-500' : 'hover:border-slate-400 dark:hover:border-slate-500'
                } ${OEE_CARD[lv].box}`}
              >
                <span className="flex items-center justify-between gap-1">
                  <strong className="text-[13px] font-extrabold text-slate-900 dark:text-white truncate">{lineDisplayName(line.code, line.code)}</strong>
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ background: OEE_COLOR[lv] }} />
                </span>
                <span className="block font-mono text-[10px] text-slate-500 dark:text-slate-400 truncate">{line.code}</span>
                <span className={`block mt-1.5 font-mono text-lg font-extrabold leading-none ${OEE_CARD[lv].value}`}>
                  {oee === null ? '—' : `${oee.toFixed(1)}%`}
                </span>
                <span className="block mt-1 text-[10px] font-semibold text-slate-600 dark:text-slate-300 truncate">
                  {st?.stopped ? tr('Đang dừng') : oee === null ? tr('Chưa có dữ liệu') : lv === 'ok' ? tr('Đạt mục tiêu') : lv === 'near' ? tr('Sát mục tiêu') : tr('Dưới 80%')}
                </span>
              </button>
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
              {lines.length} {tr("Luồng")}
            </h3>
            <span className="text-xs text-slate-500 dark:text-slate-400 font-mono font-medium">
              {tr("Tổng số")}
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
                    {lineDisplayName(line.code)}
                    {lineDisplayName(line.code) !== line.code && (
                      <span className="ml-1.5 font-mono text-[11px] font-semibold text-slate-500 dark:text-slate-400">{line.code}</span>
                    )}
                  </h4>
                  <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-1 mt-0.5">
                    {line.name}
                  </p>

                  <div className="mt-2 text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-2 font-medium">
                    <span className="h-1.5 w-1.5 rounded-full bg-amber-500 inline-block"></span>
                    <span>{(line.machines || []).length} {tr("thành phần")}</span>
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
                {tr("Thành phần thuộc")} {lineDisplayName(currentLine.code)} · {currentLine.code} ({currentLine.name})
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                {tr("Quản lý trạng thái giám sát, trạm PLC liên kết và chỉ số đo lường")}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder={tr("Tìm máy...")}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8 pr-3 py-1 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-emerald-500 w-36 sm:w-44"
                />
              </div>

              <span className="text-xs font-mono text-slate-500 dark:text-slate-400 font-medium whitespace-nowrap">
                {filteredMachines.length} {tr("máy")}
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
                    {tr("Trạm PLC Dây Chuyền (")}{lineDisplayName(currentLine.code)}):
                  </span>
                  {currentLine.plc ? (
                    <span className="font-semibold text-blue-600 dark:text-blue-400 font-mono">
                      {currentLine.plc.name}
                    </span>
                  ) : (
                    <span className="text-slate-400 dark:text-slate-500 italic">
                      {tr("Chưa cấu hình trạm PLC")}
                    </span>
                  )}
                  {currentLine.plc && (
                    <>
                      {currentLine.plc.isDemo && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/70 dark:text-amber-300">
                          {tr("MÔ PHỎNG / DEMO")}
                        </span>
                      )}
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                        {currentLine.plc.status === 'CONNECTED' ? 'CONNECTED' : tr("CHƯA KẾT NỐI VẬT LÝ (UNKNOWN)")}
                      </span>
                    </>
                  )}
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                  {tr("Tất cả các máy trong dây chuyền này tự động kế thừa trạm PLC từ dây chuyền.")}
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
                    <span>{tr("Đang nạp dữ liệu máy từ MySQL...")}</span>
                  </div>
                ) : (
                  <span>{tr("Không tìm thấy máy nào trong luồng này.")}</span>
                )}
              </div>
            ) : (
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-factory-border text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                    <th className="py-3 px-3 w-[16%]">{tr("MÃ COMPONENT")}</th>
                    <th className="py-3 px-3 w-[26%]">{tr("TÊN THIẾT BỊ")}</th>
                    <th className="py-3 px-3 w-[16%]">{tr("LOẠI")}</th>
                    <th className="py-3 px-3 w-[14%] text-center">{tr("TRẠNG THÁI")}</th>
                    <th className="py-3 px-3 w-[14%]">{tr("VỊ TRÍ")}</th>
                    <th className="py-3 px-2 w-[7%] text-center">{tr("GIÁM SÁT")}</th>
                    <th className="py-3 px-3 w-[7%] text-right">{tr("HÀNH ĐỘNG")}</th>
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
                              title={tr("Xem chi tiết {0}", machine.name)}
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
                            {machine.type || tr("MÁY CÔNG NGHIỆP")}
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
                                  {tr("Nguy hiểm")}
                                </span>
                              );
                            }
                            if (s === 'warning') {
                              return (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30">
                                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                                  {tr("Cảnh báo")}
                                </span>
                              );
                            }
                            if (s === 'normal') {
                              return (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                  {tr("Bình thường")}
                                </span>
                              );
                            }
                            return (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-300 dark:border-slate-700 font-mono">
                                <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                                {tr("Chưa có dữ liệu")}
                              </span>
                            );
                          })()}
                        </td>

                        {/* Cột 5: Vị trí / Object */}
                        <td className="py-3.5 px-3 text-slate-600 dark:text-slate-400 font-mono text-[11px] truncate max-w-[140px]">
                          {(machine.location || tr("Xưởng {0}", currentLine.name)).split(' - ')[0]}
                        </td>

                        {/* Cột 6: Toggle Giám sát */}
                        <td className="py-3.5 px-2 text-center">
                          <div className="flex justify-center">
                            <CustomSwitch
                              isSelected={monitoringStatus[machine.id] ?? true}
                              size="sm"
                              color="success"
                              aria-label={tr("Bật/Tắt giám sát {0}", machine.name)}
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
                            <Tooltip content={tr("Xem chi tiết & Biểu đồ Tầng 3")}>
                              <button
                                onClick={() => handleOpenDetails(machine)}
                                className="p-1.5 rounded-lg bg-slate-100 dark:bg-factory-bg border border-slate-200 dark:border-factory-border text-slate-600 dark:text-gray-400 hover:text-emerald-600 dark:hover:text-emerald-400 hover:border-emerald-500/50 transition-colors cursor-pointer"
                              >
                                <LineChart className="w-3.5 h-3.5" />
                              </button>
                            </Tooltip>

                            {/* Nút Xem mã QR */}
                            <Tooltip content={tr("Mã QR định danh")}>
                              <button
                                onClick={() => handleOpenQR(machine)}
                                className="p-1.5 rounded-lg bg-slate-100 dark:bg-factory-bg border border-slate-200 dark:border-factory-border text-slate-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:border-blue-500/50 transition-colors cursor-pointer"
                              >
                                <QrCode className="w-3.5 h-3.5" />
                              </button>
                            </Tooltip>

                            {/* Nút Chỉnh sửa thông tin thiết bị (Yêu cầu 1) */}
                            <Tooltip content={tr("Chỉnh sửa thông tin thiết bị")}>
                              <button
                                onClick={() => {
                                  setEditingMachine(machine);
                                  setIsEditModalOpen(true);
                                }}
                                className="p-1.5 rounded-lg bg-slate-100 dark:bg-factory-bg border border-slate-200 dark:border-factory-border text-slate-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:border-blue-500/50 transition-colors cursor-pointer"
                                aria-label={tr("Chỉnh sửa thông tin {0}", machine.name)}
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
