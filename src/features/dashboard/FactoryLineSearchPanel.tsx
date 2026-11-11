/**
 * @file FactoryLineSearchPanel.tsx
 * @description Thanh tìm kiếm và danh sách dây chuyền nhỏ gọn (180–220px) bên phải bản đồ mặt bằng
 * - Thiết kế chính xác theo ảnh tham chiếu Dashboard Tổng quan DENSO Smart Factory
 * - Tìm kiếm nhanh theo tên hoặc mã dây chuyền
 * - Hiển thị trạng thái an toàn / cảnh báo của 3 dây chuyền
 * - Card thông tin khu vực được chọn kèm nút "Xem chi tiết dây chuyền >"
 */

import { useState, useMemo } from 'react';
import { Search, ChevronRight, ArrowRight } from 'lucide-react';
import { ProductionLine } from '../../types/hierarchy';
import { FactoryZone } from './factoryMapConfig';
import { resolveLineMonitoringState } from '../../utils/machineStatusResolver';

interface FactoryLineSearchPanelProps {
  lines: ProductionLine[];
  selectedZone: FactoryZone | null;
  onSelectZone: (zoneId: string) => void;
  onOpenLineOverview: (lineId: string) => void;
}

export function FactoryLineSearchPanel({
  lines,
  selectedZone,
  onSelectZone,
  onOpenLineOverview,
}: FactoryLineSearchPanelProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterMode, setFilterMode] = useState<'all' | 'lines'>('lines');

  // Lọc danh sách 3 dây chuyền
  const filteredLines = useMemo(() => {
    return lines.filter((l) => {
      const matchSearch =
        l.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
        l.name.toLowerCase().includes(searchTerm.toLowerCase());
      return matchSearch;
    });
  }, [lines, searchTerm]);

  // Tìm dây chuyền tương ứng với khu vực đang chọn (nếu có)
  const activeLine = useMemo(() => {
    if (!selectedZone || !selectedZone.mappedLineId) return null;
    return lines.find((l) => l.id === selectedZone.mappedLineId || l.code === selectedZone.mappedLineId) || null;
  }, [selectedZone, lines]);

  const resLine = useMemo(() => {
    return activeLine ? resolveLineMonitoringState(activeLine) : null;
  }, [activeLine]);

  return (
    <aside className="w-full lg:w-[220px] shrink-0 flex flex-col gap-3">
      {/* 1. Ô tìm kiếm nhỏ gọn */}
      <div className="relative">
        <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Tìm dây chuyền..."
          className="w-full pl-8 pr-2.5 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-factory-border bg-white dark:bg-factory-card text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-emerald-500 transition-all shadow-2xs"
        />
      </div>

      {/* 2. Tabs bộ lọc nhỏ gọn */}
      <div className="flex items-center gap-1.5 p-0.5 bg-slate-100 dark:bg-factory-surface rounded-lg text-[11px] font-semibold">
        <button
          type="button"
          onClick={() => setFilterMode('all')}
          className={`flex-1 py-1 rounded-md transition-colors cursor-pointer ${
            filterMode === 'all'
              ? 'bg-white dark:bg-factory-card text-slate-900 dark:text-white shadow-2xs'
              : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          Tất cả
        </button>
        <button
          type="button"
          onClick={() => setFilterMode('lines')}
          className={`flex-1 py-1 rounded-md transition-colors cursor-pointer ${
            filterMode === 'lines'
              ? 'bg-blue-600 text-white shadow-2xs font-bold'
              : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          Dây chuyền ({lines.length})
        </button>
      </div>

      {/* 3. Danh sách dây chuyền giám sát */}
      <div className="flex flex-col gap-1.5">
        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 px-1">
          Dây chuyền giám sát
        </p>

        {filteredLines.map((line) => {
          const isSelected = selectedZone?.mappedLineId === line.id || selectedZone?.mappedLineId === line.code;
          const score = line.safetyScore ?? 96.8;
          const isGood = score >= 90;

          return (
            <button
              key={line.id}
              onClick={() => {
                // Ánh xạ sang zone ID
                if (line.id === 'LN-PRS-01' || line.code.includes('PRS')) onSelectZone('CVT');
                else if (line.id === 'LN-PNT-02' || line.code.includes('PNT')) onSelectZone('APM');
                else if (line.id === 'LN-ASM-03' || line.code.includes('ASM')) onSelectZone('CVT_MID');
              }}
              className={`w-full flex items-center justify-between p-2 rounded-xl text-left transition-all border cursor-pointer ${
                isSelected
                  ? 'border-blue-500 bg-blue-50/60 dark:bg-blue-950/20 shadow-xs'
                  : 'border-slate-200/90 dark:border-factory-border bg-white dark:bg-factory-card hover:bg-slate-50 dark:hover:bg-white/5'
              }`}
            >
              <div className="min-w-0 pr-1">
                <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                  {line.code || line.id}
                </p>
                <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                  {line.name.replace(/^Dây chuyền\s*/i, '')}
                </p>
              </div>

              <div className="flex items-center gap-1 shrink-0">
                <span
                  className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold ${
                    isGood
                      ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400'
                      : 'bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400'
                  }`}
                >
                  {score.toFixed(1)}%
                </span>
                <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
              </div>
            </button>
          );
        })}
      </div>

      {/* 4. Thông tin khu vực đang chọn */}
      <div className="mt-auto p-3 rounded-xl border border-slate-200 dark:border-factory-border bg-white dark:bg-factory-card shadow-xs flex flex-col gap-2.5">
        <div>
          <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
            Thông tin khu vực đang chọn
          </span>
          <div className="flex items-center justify-between gap-1.5 mt-0.5">
            <h4 className="text-xs font-bold text-slate-900 dark:text-white truncate">
              {activeLine
                ? `${activeLine.code} – ${activeLine.name.replace(/^Dây chuyền\s*/i, '')}`
                : selectedZone
                ? selectedZone.name
                : 'Chưa chọn khu vực'}
            </h4>
            {resLine ? (
              <span
                className={`text-[9px] px-1.5 py-0.2 rounded font-bold shrink-0 ${
                  resLine.operatingStatus === 'STOPPED'
                    ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-400'
                    : resLine.alarmSeverity === 'CRITICAL'
                    ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-400'
                    : resLine.alarmSeverity === 'WARNING'
                    ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400'
                    : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400'
                }`}
              >
                {resLine.operatingStatus === 'STOPPED'
                  ? 'Tạm dừng'
                  : resLine.alarmSeverity === 'CRITICAL'
                  ? '⚠️ Nguy hiểm'
                  : resLine.alarmSeverity === 'WARNING'
                  ? 'Cần theo dõi'
                  : 'Đang hoạt động'}
              </span>
            ) : selectedZone && (
              <span className="text-[9px] px-1.5 py-0.2 rounded font-bold shrink-0 bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                {selectedZone.defaultSafetyScore != null ? 'Chờ giám sát' : 'N/A'}
              </span>
            )}
          </div>
        </div>

        {/* 3 chỉ số tóm tắt */}
        <div className="grid grid-cols-3 gap-1 pt-1 border-t border-slate-100 dark:border-factory-border text-center">
          <div>
            <p className="text-[9px] text-slate-400">Mức an toàn</p>
            <p
              className="text-xs font-mono font-bold mt-0.5"
              style={{ color: resLine ? resLine.healthColor : '#94A3B8' }}
            >
              {resLine && resLine.safetyScore != null
                ? `${resLine.safetyScore.toFixed(1)}%`
                : selectedZone?.defaultSafetyScore != null
                ? `${selectedZone.defaultSafetyScore.toFixed(1)}%`
                : 'N/A'}
            </p>
          </div>
          <div>
            <p className="text-[9px] text-slate-400">Thiết bị</p>
            <p className="text-xs font-mono font-bold text-slate-800 dark:text-slate-200 mt-0.5">
              {resLine ? (resLine.totalMachines || activeLine?.machines?.length || 6) : selectedZone?.isConfiguredLine ? 2 : '--'}
            </p>
          </div>
          <div>
            <p className="text-[9px] text-slate-400">Cảnh báo</p>
            <p className={`text-xs font-mono font-bold mt-0.5 ${resLine && (resLine.criticalCount + resLine.warningCount > 0) ? 'text-rose-600' : 'text-slate-800 dark:text-slate-200'}`}>
              {resLine ? (resLine.criticalCount + resLine.warningCount) : 0}
            </p>
          </div>
        </div>

        {/* Nút Xem chi tiết dây chuyền */}
        {activeLine ? (
          <button
            type="button"
            onClick={() => onOpenLineOverview(activeLine.id)}
            className="w-full flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-sm transition-all cursor-pointer active:scale-98 mt-1"
          >
            <span>Xem chi tiết dây chuyền</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        ) : (
          <div className="text-[10px] text-slate-400 text-center py-1">
            {selectedZone ? 'Khu vực chưa cấu hình giám sát chi tiết' : 'Nhấp vào dây chuyền trên bản đồ để xem'}
          </div>
        )}
      </div>
    </aside>
  );
}
