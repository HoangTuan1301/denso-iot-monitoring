/**
 * @file EquipmentRiskHeatmap.tsx
 * @description Bản đồ Rủi ro Thiết bị (Equipment Risk Heatmap)
 * Chuẩn ma trận rủi ro theo dây chuyền công nghiệp DENSO (DC1..DC3 x M1..M6)
 */

import React, { useState } from 'react';
import { Grid } from 'lucide-react';
import { AIProcessedMachine } from '../adapters/aiTelemetryAdapter';
import { ProductionLine } from '../../../types/hierarchy';

interface EquipmentRiskHeatmapProps {
  lines: ProductionLine[];
  allMachines: AIProcessedMachine[];
  onSelectMachine?: (machineId: string) => void;
}

export const EquipmentRiskHeatmap: React.FC<EquipmentRiskHeatmapProps> = ({
  lines,
  allMachines,
  onSelectMachine,
}) => {
  const [hoveredMachine, setHoveredMachine] = useState<AIProcessedMachine | null>(null);

  // Chuẩn hóa 3 dây chuyền DENSO: DC1, DC2, DC3
  const heatmapRows = [
    { label: 'DC1', lineId: 'LINE-01', name: lines.find((l) => l.id === 'LINE-01')?.name || 'Dập & Hàn' },
    { label: 'DC2', lineId: 'LINE-02', name: lines.find((l) => l.id === 'LINE-02')?.name || 'Sơn & Gia công' },
    { label: 'DC3', lineId: 'LINE-03', name: lines.find((l) => l.id === 'LINE-03')?.name || 'Lắp ráp' },
  ];

  const columns = ['M1', 'M2', 'M3', 'M4', 'M5', 'M6'];

  // Hàm rút gọn mã máy thông minh, không bao giờ bị cắt cụt vô nghĩa
  const getReadableMachineCode = (m: AIProcessedMachine) => {
    const raw = m.machineCode || m.machineId;
    if (raw.includes('PHASE-C') || raw.includes('TEST-C')) return 'PHS-C';
    if (raw.includes('MS-10') || raw.includes('MS10')) return 'MS-10';
    return raw.replace(/^MCH-/, '').replace(/^MC-/, '');
  };
  const getCellColor = (m?: AIProcessedMachine) => {
    if (!m) return 'bg-slate-100 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700/50';
    if (m.isNoData) return 'bg-slate-200 dark:bg-slate-700/80 border-slate-300 dark:border-slate-600';
    if (m.hasActiveSpike || m.riskLevel === 'CRITICAL') return 'bg-rose-500 border-rose-600 animate-pulse text-white';
    if (m.riskLevel === 'HIGH') return 'bg-amber-400 border-amber-500 text-slate-900';
    return 'bg-emerald-500 border-emerald-600 text-white';
  };

  return (
    <div className="h-full flex flex-col justify-between">
      {/* Header */}
      <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100 dark:border-slate-700/60">
        <div className="flex items-center gap-2">
          <Grid className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100">
            Bản đồ Rủi ro Thiết bị (Heatmap)
          </h4>
        </div>

        {/* Hover quick preview info */}
        {hoveredMachine ? (
          <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 truncate max-w-[150px]">
            {hoveredMachine.machineCode} ({hoveredMachine.healthScore ?? 'N/A'}đ)
          </span>
        ) : (
          <span className="text-[10px] text-slate-400">Rê chuột xem chi tiết</span>
        )}
      </div>

      {/* Heatmap Matrix Table (Hỗ trợ cuộn ngang trên màn hình nhỏ để không bao giờ bị cắt chữ) */}
      <div className="flex-1 flex flex-col justify-center my-1 overflow-x-auto">
        <div className="min-w-[340px]">
          {/* Column Header: M1 .. M6 */}
          <div className="grid grid-cols-7 gap-1.5 text-center text-[10px] font-bold text-slate-400 mb-1 pl-7">
            {columns.map((col) => (
              <div key={col}>{col}</div>
            ))}
          </div>

          {/* Rows: DC1, DC2, DC3 */}
          <div className="space-y-1.5">
            {heatmapRows.map((row) => {
              const lineMachines = allMachines.filter((m) => m.lineId === row.lineId);

              return (
                <div key={row.label} className="flex items-center gap-1.5">
                  {/* Row Label (DC1..DC3) */}
                  <div
                    className="w-7 text-[10px] font-bold text-slate-600 dark:text-slate-300 text-right pr-1 shrink-0"
                    title={row.name}
                  >
                    {row.label}
                  </div>

                  {/* 6 Cells per row */}
                  <div className="grid grid-cols-6 gap-1.5 flex-1">
                    {columns.map((_, colIdx) => {
                      const machine = lineMachines[colIdx];

                      return (
                        <div
                          key={colIdx}
                          onMouseEnter={() => machine && setHoveredMachine(machine)}
                          onMouseLeave={() => setHoveredMachine(null)}
                          onClick={() => machine && onSelectMachine && onSelectMachine(machine.machineId)}
                          className={`h-7 px-0.5 rounded-lg border transition-all cursor-pointer flex items-center justify-center text-[10px] font-bold tracking-tight shadow-2xs hover:scale-105 select-none ${getCellColor(
                            machine
                          )}`}
                          title={
                            machine
                              ? `${machine.machineCode} — ${machine.machineName}\nDây chuyền: ${row.name}\nĐiểm sức khỏe: ${
                                  machine.healthScore != null ? `${machine.healthScore}/100` : 'Chưa có dữ liệu'
                                }\nTrạng thái: ${
                                  machine.hasActiveSpike || machine.riskLevel === 'CRITICAL'
                                    ? 'NGUY HIỂM (Critical)'
                                    : machine.riskLevel === 'HIGH'
                                    ? 'CẢNH BÁO (Warning)'
                                    : machine.isNoData
                                    ? 'CHƯA CÓ DL (No Data)'
                                    : 'AN TOÀN (Safe)'
                                }`
                              : 'Vị trí dự phòng mở rộng'
                          }
                        >
                          {machine ? (
                            <span className="whitespace-nowrap">
                              {getReadableMachineCode(machine)}
                            </span>
                          ) : (
                            <span className="opacity-25 text-[9px]">-</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Legend at bottom */}
      <div className="pt-2 border-t border-slate-100 dark:border-slate-700/60 flex items-center justify-between text-[10px] text-slate-500 dark:text-slate-400">
        <div className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-emerald-500" />
          <span>An toàn</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-amber-400" />
          <span>Cảnh báo</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-rose-500" />
          <span>Nguy hiểm</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-slate-300 dark:bg-slate-600" />
          <span>Chưa có DL</span>
        </div>
      </div>
    </div>
  );
};
