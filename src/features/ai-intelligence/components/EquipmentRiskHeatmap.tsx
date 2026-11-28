/**
 * @file EquipmentRiskHeatmap.tsx
 * @description Bản đồ Rủi ro Thiết bị (Equipment Risk Heatmap)
 * Ma trận rủi ro: mỗi hàng là 1 dây chuyền có máy (tên hiển thị theo sơ đồ nhà máy), mỗi ô là 1 máy
 */

import React, { useState } from 'react';
import { Grid } from 'lucide-react';
import { AIProcessedMachine } from '../adapters/aiTelemetryAdapter';
import { ProductionLine } from '../../../types/hierarchy';
import { tr } from '../../../i18n/tr';
import { lineDisplayName } from '../../../config/lineDisplayName';

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

  // Tất cả dây chuyền đang có máy, theo thứ tự mã dây chuyền
  const lineIds = [...new Set(allMachines.map((m) => m.lineId).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b, undefined, { numeric: true })
  );
  const heatmapRows = lineIds.map((lineId) => {
    const line = lines.find((l) => l.id === lineId);
    const label = lineDisplayName(line?.code, line?.name || lineId);
    return { label, lineId, name: line?.name || label };
  });

  const maxCols = Math.max(1, ...heatmapRows.map((r) => allMachines.filter((m) => m.lineId === r.lineId).length));
  const columns = Array.from({ length: maxCols }, (_, i) => `M${i + 1}`);

  // Hàm rút gọn mã máy thông minh, không bao giờ bị cắt cụt vô nghĩa
  const getReadableMachineCode = (m: AIProcessedMachine) => {
    const raw = m.machineCode || m.machineId;
    if (raw.includes('PHASE-C') || raw.includes('TEST-C')) return 'PHS-C';
    if (raw.includes('MS-10') || raw.includes('MS10')) return 'MS-10';
    const parts = raw.replace(/^MCH-/, '').replace(/^MC-/, '').split('-');
    // Bỏ tiền tố dây chuyền (VD AT-CNC-01 → CNC-01) để vừa ô
    return parts.length >= 3 ? parts.slice(-2).join('-') : parts.join('-');
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
            {tr("Bản đồ Rủi ro Thiết bị (Heatmap)")}
          </h4>
        </div>

        {/* Hover quick preview info */}
        {hoveredMachine ? (
          <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 truncate max-w-[150px]">
            {hoveredMachine.machineCode} ({hoveredMachine.healthScore ?? 'N/A'}{tr("đ)")}
          </span>
        ) : (
          <span className="text-[10px] text-slate-400">{tr("Rê chuột xem chi tiết")}</span>
        )}
      </div>

      {/* Heatmap Matrix Table (Hỗ trợ cuộn ngang trên màn hình nhỏ để không bao giờ bị cắt chữ) */}
      <div className="flex-1 flex flex-col justify-center my-1 overflow-x-auto">
        <div>
          {/* Column Header: M1 .. M6 */}
          <div className="grid gap-1.5 text-center text-[10px] font-bold text-slate-400 mb-1 pl-[52px]" style={{ gridTemplateColumns: `repeat(${columns.length}, minmax(0, 1fr))` }}>
            {columns.map((col) => (
              <div key={col}>{col}</div>
            ))}
          </div>

          {/* Mỗi hàng 1 dây chuyền; cuộn dọc khi nhiều dây chuyền */}
          <div className="space-y-1 max-h-[300px] overflow-y-auto pr-0.5">
            {heatmapRows.map((row) => {
              const lineMachines = allMachines.filter((m) => m.lineId === row.lineId);

              return (
                <div key={row.label} className="flex items-center gap-1.5">
                  {/* Tên dây chuyền */}
                  <div
                    className="w-[46px] text-[10px] font-bold text-slate-600 dark:text-slate-300 text-right pr-1 shrink-0 truncate"
                    title={row.name}
                  >
                    {row.label}
                  </div>

                  {/* Mỗi ô 1 máy */}
                  <div className="grid gap-1.5 flex-1" style={{ gridTemplateColumns: `repeat(${columns.length}, minmax(0, 1fr))` }}>
                    {columns.map((_, colIdx) => {
                      const machine = lineMachines[colIdx];

                      return (
                        <div
                          key={colIdx}
                          onMouseEnter={() => machine && setHoveredMachine(machine)}
                          onMouseLeave={() => setHoveredMachine(null)}
                          onClick={() => machine && onSelectMachine && onSelectMachine(machine.machineId)}
                          className={`h-6 px-0.5 rounded-md border transition-all cursor-pointer flex items-center justify-center text-[9px] font-bold tracking-tighter overflow-hidden shadow-2xs hover:scale-105 select-none ${getCellColor(
                            machine
                          )}`}
                          title={
                            machine
                              ? tr("{0} — {1}\nDây chuyền: {2}\nĐiểm sức khỏe: {3}\nTrạng thái: {4}", machine.machineCode, machine.machineName, row.name, machine.healthScore != null ? `${machine.healthScore}/100` : tr("Chưa có dữ liệu"), machine.hasActiveSpike || machine.riskLevel === 'CRITICAL'
                                    ? tr("NGUY HIỂM (Critical)")
                                    : machine.riskLevel === 'HIGH'
                                    ? tr("CẢNH BÁO (Warning)")
                                    : machine.isNoData
                                    ? tr("CHƯA CÓ DL (No Data)")
                                    : tr("AN TOÀN (Safe)"))
                              : tr("Vị trí dự phòng mở rộng")
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
          <span>{tr("An toàn")}</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-amber-400" />
          <span>{tr("Cảnh báo")}</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-rose-500" />
          <span>{tr("Nguy hiểm")}</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-slate-300 dark:bg-slate-600" />
          <span>{tr("Chưa có DL")}</span>
        </div>
      </div>
    </div>
  );
};
