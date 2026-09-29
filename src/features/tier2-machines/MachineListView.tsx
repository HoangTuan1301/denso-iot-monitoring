/**
 * @file MachineListView.tsx
 * @description Màn hình Luồng & Thành phần (Chuẩn giao diện Algo/Admin Monitoring theo ảnh mẫu)
 * Tích hợp thanh luồng ngang Tầng 1, danh mục Luồng bên trái và Bảng Thành phần máy bên phải
 * Tối ưu màu sắc và độ tương phản cao cho cả Light Mode và Dark Mode
 */

import { useState } from 'react';
import { Button } from '@heroui/react';
import { CustomSwitch } from '../../components/common/CustomSwitch';
import { 
  Plus, 
  LineChart, 
  QrCode, 
  ArrowRight, 
  Edit3
} from 'lucide-react';
import { useMonitoringStore } from '../../stores/useMonitoringStore';
import { MachineComponent } from '../../types/hierarchy';
import { MachineDetailModal } from '../tier3-metrics/MachineDetailModal';
import { QRCodeModal } from '../../components/qr/QRCodeModal';

export function MachineListView() {
  const { lines, selectedLineId, setSelectedLineId, setActiveTab } = useMonitoringStore();

  // Dây chuyền đang được chọn để hiển thị danh sách máy (mặc định lấy line đầu tiên hoặc selectedLineId)
  const currentLineId = selectedLineId || lines[0]?.id || 'LINE-01';
  const currentLine = lines.find((l) => l.id === currentLineId) || lines[0];

  // Trạng thái modal
  const [selectedMachine, setSelectedMachine] = useState<MachineComponent | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isQRModalOpen, setIsQRModalOpen] = useState(false);
  const [monitoringStatus, setMonitoringStatus] = useState<Record<string, boolean>>({});

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

  return (
    <div className="space-y-6">
      {/* ========================================================================= */}
      {/* TIÊU ĐỀ TRANG & NÚT THÊM THÀNH PHẦN                                       */}
      {/* ========================================================================= */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">
            Luồng & Thành phần
          </h1>
          <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
            Danh mục {lines.length} luồng dữ liệu dây chuyền và các thiết bị máy móc kỹ thuật thuộc từng luồng.
          </p>
        </div>

        <Button
          size="sm"
          color="primary"
          variant="solid"
          className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs px-4 h-9 shadow-md shadow-emerald-600/20"
          startContent={<Plus className="w-4 h-4" />}
          onPress={() => setActiveTab('thresholds')}
        >
          Thêm thành phần
        </Button>
      </div>

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
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
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
                    <span>{line.machines.length} thành phần</span>
                    <span>&bull;</span>
                    <span>{line.machines.reduce((acc, m) => acc + m.metrics.length, 0)} metric</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* CỘT PHẢI (8 CỘT): BẢNG THÀNH PHẦN THUỘC LUỒNG ĐANG CHỌN */}
        <div className="lg:col-span-8 bg-factory-card rounded-2xl border border-factory-border p-5 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-factory-border pb-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Thành phần thuộc {currentLine.code} ({currentLine.name})
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                Quản lý trạng thái giám sát và chỉ số đo lường chi tiết
              </p>
            </div>
            <span className="text-xs font-mono text-slate-500 dark:text-slate-400 font-medium">
              {currentLine.machines.length} bản ghi
            </span>
          </div>

          {/* Bảng danh sách thành phần máy */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-factory-border text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                  <th className="py-3 px-2">MÃ COMPONENT</th>
                  <th className="py-3 px-2">TÊN HIỂN THỊ</th>
                  <th className="py-3 px-2">LOẠI</th>
                  <th className="py-3 px-2">NGUỒN</th>
                  <th className="py-3 px-2">VỊ TRÍ</th>
                  <th className="py-3 px-2 text-center">GIÁM SÁT</th>
                  <th className="py-3 px-2 text-right">HÀNH ĐỘNG</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-factory-border">
                {currentLine.machines.map((machine) => {
                  return (
                    <tr
                      key={machine.id}
                      className="hover:bg-slate-100/70 dark:hover:bg-white/5 transition-colors"
                    >
                      {/* Cột 1: Mã Component */}
                      <td className="py-3.5 px-2 font-mono font-bold text-slate-900 dark:text-white">
                        <span 
                          className="hover:text-emerald-600 dark:hover:text-emerald-400 cursor-pointer" 
                          onClick={() => handleOpenDetails(machine)}
                        >
                          {machine.id}
                        </span>
                      </td>

                      {/* Cột 2: Tên hiển thị */}
                      <td className="py-3.5 px-2 font-semibold text-slate-900 dark:text-white max-w-[160px] truncate">
                        {machine.name}
                      </td>

                      {/* Cột 3: Loại */}
                      <td className="py-3.5 px-2">
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-slate-100 dark:bg-factory-bg border border-slate-200 dark:border-factory-border text-slate-700 dark:text-gray-300">
                          PLC/ADC
                        </span>
                      </td>

                      {/* Cột 4: Nguồn */}
                      <td className="py-3.5 px-2 text-slate-600 dark:text-slate-400 font-mono text-[11px]">
                        MODBUS / TCP
                      </td>

                      {/* Cột 5: Vị trí / Object */}
                      <td className="py-3.5 px-2 text-slate-600 dark:text-slate-400 font-mono text-[11px] truncate max-w-[120px]">
                        {machine.location.split(' - ')[0]}
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
                      <td className="py-3.5 px-2 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Nút Xem biểu đồ chi tiết Tầng 3 */}
                          <button
                            onClick={() => handleOpenDetails(machine)}
                            className="p-1.5 rounded-lg bg-slate-100 dark:bg-factory-bg border border-slate-200 dark:border-factory-border text-slate-600 dark:text-gray-400 hover:text-emerald-600 dark:hover:text-emerald-400 hover:border-emerald-500/50 transition-colors cursor-pointer"
                            title="Xem chi tiết & Biểu đồ Tầng 3"
                          >
                            <LineChart className="w-3.5 h-3.5" />
                          </button>

                          {/* Nút Xem mã QR */}
                          <button
                            onClick={() => handleOpenQR(machine)}
                            className="p-1.5 rounded-lg bg-slate-100 dark:bg-factory-bg border border-slate-200 dark:border-factory-border text-slate-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:border-blue-500/50 transition-colors cursor-pointer"
                            title="Mã QR định danh"
                          >
                            <QrCode className="w-3.5 h-3.5" />
                          </button>

                          {/* Nút Chỉnh sửa */}
                          <button
                            onClick={() => setActiveTab('thresholds')}
                            className="p-1.5 rounded-lg bg-slate-100 dark:bg-factory-bg border border-slate-200 dark:border-factory-border text-slate-600 dark:text-gray-400 hover:text-amber-600 dark:hover:text-amber-400 hover:border-amber-500/50 transition-colors cursor-pointer"
                            title="Cấu hình ngưỡng"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
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
    </div>
  );
}
