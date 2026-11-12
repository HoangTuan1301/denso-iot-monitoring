/**
 * @file FactorySchematic2D3D.tsx
 * @description Sơ đồ Bố trí Thiết bị Nhà máy (Factory Equipment Map) chuẩn 2D/2.5D
 * 
 * ĐÁP ỨNG TOÀN DIỆN YÊU CẦU V2.1:
 * 1. Chiếm toàn bộ chiều rộng (Full-width row) trên dashboard desktop.
 * 2. Hiển thị rõ ràng 3 phân xưởng/dây chuyền sản xuất DENSO (LINE-01, LINE-02, LINE-03).
 * 3. Hiển thị đầy đủ từng máy (Equipment Card/Node) với Machine Code, Tên máy, Trạng thái, Điểm sức khỏe và Thông số đo.
 * 4. Màu trạng thái độc lập theo máy: SAFE (xanh lá), WARNING (vàng/cam), CRITICAL (đỏ), NO_DATA (xám).
 * 5. Khi Giả lập Sự cố, CHỈ máy có sự cố chuyển CRITICAL, các máy khác trong dây chuyền vẫn giữ nguyên trạng thái thực.
 * 6. Tương tác mượt mà: Hover xem thông tin chi tiết, Click máy để điều hướng trực tiếp đến phân tích Z-score.
 */

import React, { useState } from 'react';
import {
  Network,
  AlertOctagon,
  CheckCircle2,
  Activity,
} from 'lucide-react';
import { ProductionLine } from '../../../types/hierarchy';
import { AIProcessedMachine } from '../adapters/aiTelemetryAdapter';

interface FactorySchematic2D3DProps {
  lines: ProductionLine[];
  allMachines: AIProcessedMachine[];
  activeEmergencyLineId?: string | null;
  onSelectMachine?: (machineId: string) => void;
  onSelectLine?: (lineId: string) => void;
}

export const FactorySchematic2D3D: React.FC<FactorySchematic2D3DProps> = ({
  lines,
  allMachines,
  onSelectMachine,
  onSelectLine,
}) => {
  const [viewMode, setViewMode] = useState<'2D' | '2.5D'>('2D');
  const [hoveredMachineId, setHoveredMachineId] = useState<string | null>(null);

  // Metadata 3 dây chuyền chuẩn nhà máy DENSO
  const lineConfigs = [
    {
      id: 'LINE-01',
      code: 'LN-PRS-01',
      name: 'Dây chuyền 1: Dập & Hàn Khung Gầm',
      desc: 'Pressing, Stamping & Robotic Spot Welding',
      oee: '92.1%',
      expectedCount: 6,
    },
    {
      id: 'LINE-02',
      code: 'LN-PNT-02',
      name: 'Dây chuyền 2: Gia Công Cơ Khí & Sơn',
      desc: 'Precision CNC Machining & Electrostatic Paint',
      oee: '89.3%',
      expectedCount: 4,
    },
    {
      id: 'LINE-03',
      code: 'LN-ASY-03',
      name: 'Dây chuyền 3: Lắp Ráp & Hoàn Thiện',
      desc: 'Final Tightening, Inspection & End-of-Line Testing',
      oee: '81.7%',
      expectedCount: 4,
    },
  ];

  // Máy đang có sự cố khẩn cấp (nếu có)
  const criticalMachine = allMachines.find((m) => m.hasActiveSpike || m.riskLevel === 'CRITICAL');

  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 sm:p-5 border border-slate-200/90 dark:border-slate-700/80 shadow-xs flex flex-col gap-4">
      {/* ========================================================================= */}
      {/* 1. HEADER SƠ ĐỒ NHÀ MÁY (FULL WIDTH)                                      */}
      {/* ========================================================================= */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-700/80">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center border border-emerald-200 dark:border-emerald-800 shrink-0">
            <Network className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                Sơ đồ Nhà máy &amp; Trạng thái Thiết bị (Factory Equipment Map)
              </h3>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                {allMachines.length} Thiết bị • 3 Dây chuyền
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Giám sát sơ đồ phân bổ thiết bị, điểm sức khỏe AI và trạng thái vận hành thời gian thực
            </p>
          </div>
        </div>

        {/* Chế độ xem & Cảnh báo khẩn cấp */}
        <div className="flex items-center gap-2.5 shrink-0">
          {criticalMachine ? (
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-800 text-xs font-bold animate-pulse">
              <AlertOctagon className="w-3.5 h-3.5 text-rose-600" />
              <span>Sự cố: {criticalMachine.machineCode}</span>
            </div>
          ) : (
            <div className="hidden md:flex items-center gap-1.5 px-3 py-1 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 text-xs font-semibold">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              <span>Toàn bộ dây chuyền ổn định</span>
            </div>
          )}

          {/* Nút chuyển chế độ 2D Sơ đồ Logic / 2.5D Phối cảnh */}
          <div className="flex items-center p-0.5 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setViewMode('2D')}
              className={`px-3 py-1 text-xs font-bold rounded-lg transition-all ${
                viewMode === '2D'
                  ? 'bg-white dark:bg-slate-800 text-emerald-600 dark:text-emerald-400 shadow-2xs'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              2D Logic
            </button>
            <button
              type="button"
              onClick={() => setViewMode('2.5D')}
              className={`px-3 py-1 text-xs font-bold rounded-lg transition-all ${
                viewMode === '2.5D'
                  ? 'bg-emerald-600 text-white shadow-2xs'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              2.5D Isometric
            </button>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. KHU VỰC 3 DÂY CHUYỀN SẢN XUẤT (3 LINE SECTIONS)                         */}
      {/* ========================================================================= */}
      <div className="space-y-4">
        {lineConfigs.map((lineConfig) => {
          // Lấy danh sách máy và thông tin dây chuyền thực tế
          const storeLine = lines.find((l) => l.id === lineConfig.id);
          const lineName = storeLine?.name || lineConfig.name;
          const lineMachines = allMachines.filter((m) => m.lineId === lineConfig.id);
          const hasCritMachine = lineMachines.some((m) => m.hasActiveSpike || m.riskLevel === 'CRITICAL');
          const hasWarnMachine = lineMachines.some((m) => m.riskLevel === 'HIGH');
          const safeCount = lineMachines.filter((m) => !m.isNoData && m.riskLevel === 'LOW').length;
          const noDataCount = lineMachines.filter((m) => m.isNoData).length;

          return (
            <div
              key={lineConfig.id}
              className={`rounded-2xl p-3 sm:p-4 border transition-all duration-200 ${
                hasCritMachine
                  ? 'bg-rose-50/20 dark:bg-rose-950/15 border-rose-300 dark:border-rose-900/60 shadow-xs ring-1 ring-rose-500/20'
                  : 'bg-slate-50/60 dark:bg-slate-850/60 border-slate-200/80 dark:border-slate-700/60'
              }`}
            >
              {/* Header của từng Dây chuyền */}
              <div
                onClick={() => onSelectLine && onSelectLine(lineConfig.id)}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3 pb-2 border-b border-slate-200/60 dark:border-slate-700/50 cursor-pointer group"
                title={`Nhấn để tập trung vào ${lineName}`}
              >
                <div className="flex items-center gap-2.5">
                  <span
                    className={`w-2.5 h-2.5 rounded-full ${
                      hasCritMachine
                        ? 'bg-rose-500 animate-ping'
                        : hasWarnMachine
                        ? 'bg-amber-400'
                        : 'bg-emerald-500'
                    }`}
                  />
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100 group-hover:text-emerald-600 transition-colors">
                        {lineName}
                      </h4>
                      <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-200/70 dark:bg-slate-700 text-slate-700 dark:text-slate-300 font-semibold">
                        {lineConfig.code}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      {lineConfig.desc}
                    </p>
                  </div>
                </div>

                {/* Thống kê nhanh cấp dây chuyền */}
                <div className="flex flex-wrap items-center gap-2 text-[11px]">
                  <span className="px-2 py-0.5 rounded-md bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-semibold text-slate-700 dark:text-slate-300">
                    OEE: <strong className="text-emerald-600 dark:text-emerald-400">{lineConfig.oee}</strong>
                  </span>
                  <span className="px-2 py-0.5 rounded-md bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400">
                    {lineMachines.length} máy ({safeCount} An toàn • {noDataCount} Chưa kết nối)
                  </span>
                  {hasCritMachine && (
                    <span className="px-2 py-0.5 rounded-md bg-rose-500 text-white font-bold animate-pulse text-[10px]">
                      CẢNH BÁO KHẨN
                    </span>
                  )}
                </div>
              </div>

              {/* Lưới các Equipment Cards của Dây chuyền này */}
              <div
                className={`grid gap-2.5 ${
                  lineConfig.id === 'LINE-01'
                    ? 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-6'
                    : 'grid-cols-2 sm:grid-cols-4'
                }`}
              >
                {lineMachines.map((machine) => {
                  const isCrit = machine.hasActiveSpike || machine.riskLevel === 'CRITICAL';
                  const isWarn = machine.riskLevel === 'HIGH';
                  const isNoData = machine.isNoData;
                  const isHovered = hoveredMachineId === machine.machineId;

                  // Màu thẻ máy độc lập
                  let cardBorderBg = 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:border-emerald-500';
                  let statusBadge = (
                    <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                      SAFE
                    </span>
                  );

                  if (isCrit) {
                    cardBorderBg = 'bg-rose-50/80 dark:bg-rose-950/40 border-rose-500 dark:border-rose-700 shadow-md shadow-rose-950/20 ring-2 ring-rose-500/40 animate-pulse';
                    statusBadge = (
                      <span className="text-[9px] font-black px-1.5 py-0.2 rounded bg-rose-600 text-white animate-bounce">
                        CRITICAL
                      </span>
                    );
                  } else if (isWarn) {
                    cardBorderBg = 'bg-amber-50/70 dark:bg-amber-950/30 border-amber-400 dark:border-amber-700 shadow-xs';
                    statusBadge = (
                      <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-amber-500 text-white">
                        WARNING
                      </span>
                    );
                  } else if (isNoData) {
                    cardBorderBg = 'bg-slate-100/60 dark:bg-slate-900/40 border-slate-200 dark:border-slate-800 opacity-80';
                    statusBadge = (
                      <span className="text-[9px] font-medium px-1.5 py-0.2 rounded bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300">
                        NO DATA
                      </span>
                    );
                  }

                  return (
                    <div
                      key={machine.machineId}
                      onMouseEnter={() => setHoveredMachineId(machine.machineId)}
                      onMouseLeave={() => setHoveredMachineId(null)}
                      onClick={() => onSelectMachine && onSelectMachine(machine.machineId)}
                      className={`p-2.5 rounded-xl border transition-all duration-200 flex flex-col justify-between cursor-pointer group select-none min-h-[92px] ${cardBorderBg} ${
                        isHovered ? 'scale-[1.02] shadow-md' : 'shadow-2xs'
                      }`}
                      title={`${machine.machineCode} — ${machine.machineName}\nDây chuyền: ${lineConfig.name}\nĐiểm sức khỏe: ${
                        machine.healthScore != null ? `${machine.healthScore}/100` : 'Chưa có dữ liệu'
                      }\nThông số: ${machine.keyMetricName} = ${machine.keyMetricValue} ${machine.keyMetricUnit}\nNhấn để phân tích chi tiết.`}
                    >
                      {/* Dòng 1: Mã máy & Badge trạng thái */}
                      <div className="flex items-center justify-between gap-1">
                        <span className="font-bold text-[11px] text-slate-900 dark:text-slate-100 tracking-tight group-hover:text-emerald-600 transition-colors">
                          {machine.machineCode}
                        </span>
                        {statusBadge}
                      </div>

                      {/* Dòng 2: Tên máy rút gọn có tooltip */}
                      <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate mt-1">
                        {machine.machineName}
                      </p>

                      {/* Dòng 3: Điểm sức khỏe & Thông số đo lường */}
                      <div className="mt-2 pt-1.5 border-t border-slate-100 dark:border-slate-700/60 flex items-center justify-between text-[10px]">
                        <span
                          className={`font-black ${
                            isCrit
                              ? 'text-rose-600 dark:text-rose-400'
                              : isWarn
                              ? 'text-amber-500'
                              : isNoData
                              ? 'text-slate-400'
                              : 'text-emerald-600 dark:text-emerald-400'
                          }`}
                        >
                          {machine.healthScore != null ? `${machine.healthScore}đ` : 'N/A'}
                        </span>

                        <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono truncate max-w-[90px] text-right">
                          {isNoData ? (
                            'Chưa nối PLC'
                          ) : isCrit ? (
                            <strong className="text-rose-600">{machine.keyMetricValue} {machine.keyMetricUnit}</strong>
                          ) : (
                            `${machine.keyMetricValue} ${machine.keyMetricUnit}`
                          )}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* ========================================================================= */}
      {/* 3. CHÚ GIẢI TRẠNG THÁI & HƯỚNG DẪN THAO TÁC                                 */}
      {/* ========================================================================= */}
      <div className="pt-2 border-t border-slate-100 dark:border-slate-700/60 flex flex-wrap items-center justify-between gap-3 text-[11px] text-slate-500 dark:text-slate-400">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
            <span className="font-medium text-slate-700 dark:text-slate-300">An toàn (SAFE)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
            <span className="font-medium text-slate-700 dark:text-slate-300">Cảnh báo (WARNING)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
            <span className="font-medium text-slate-700 dark:text-slate-300">Nguy hiểm (CRITICAL)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-slate-300 dark:bg-slate-600" />
            <span className="font-medium text-slate-700 dark:text-slate-300">Chưa có DL (NO DATA)</span>
          </div>
        </div>

        <div className="flex items-center gap-1 text-[10px] text-slate-400">
          <Activity className="w-3.5 h-3.5 text-emerald-500" />
          <span>Nhấn vào thiết bị để phân tích chi tiết Z-score và mở phiếu bảo trì dự đoán</span>
        </div>
      </div>
    </div>
  );
};
