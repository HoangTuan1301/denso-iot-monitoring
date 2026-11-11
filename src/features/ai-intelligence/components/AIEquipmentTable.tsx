/**
 * @file AIEquipmentTable.tsx
 * @description Bảng hiển thị danh sách thiết bị kèm Điểm sức khỏe AI, Mức độ rủi ro và Thông số chính.
 */

import React, { useState, useMemo } from 'react';
import {
  Search,
  TrendingUp,
  TrendingDown,
  Minus,
  AlertTriangle,
  CheckCircle2,
  AlertOctagon,
  Eye,
  SlidersHorizontal,
} from 'lucide-react';
import { EquipmentHealthItem, AIRiskLevel } from '../types/ai';

interface AIEquipmentTableProps {
  equipmentList: EquipmentHealthItem[];
  selectedMachineId: string;
  onSelectMachine: (machineId: string) => void;
  onInspectDetails?: (machineId: string) => void;
}

export const AIEquipmentTable: React.FC<AIEquipmentTableProps> = ({
  equipmentList,
  selectedMachineId,
  onSelectMachine,
  onInspectDetails,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterRisk, setFilterRisk] = useState<'ALL' | AIRiskLevel>('ALL');

  const filteredList = useMemo(() => {
    return equipmentList.filter((item) => {
      const matchSearch =
        item.machineCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.machineName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.lineName.toLowerCase().includes(searchTerm.toLowerCase());
      const matchRisk = filterRisk === 'ALL' || item.riskLevel === filterRisk;
      return matchSearch && matchRisk;
    });
  }, [equipmentList, searchTerm, filterRisk]);

  const getScoreColor = (score: number) => {
    if (score >= 85) return 'text-emerald-600 dark:text-emerald-400 bg-emerald-500';
    if (score >= 65) return 'text-amber-600 dark:text-amber-400 bg-amber-500';
    return 'text-rose-600 dark:text-rose-400 bg-rose-500';
  };

  const getRiskBadge = (risk: AIRiskLevel) => {
    switch (risk) {
      case 'CRITICAL':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-rose-100 text-rose-700 dark:bg-rose-950/70 dark:text-rose-400 border border-rose-200 dark:border-rose-800">
            <AlertOctagon className="w-3 h-3" /> NGUY CẤP
          </span>
        );
      case 'HIGH':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/70 dark:text-amber-400 border border-amber-200 dark:border-amber-800">
            <AlertTriangle className="w-3 h-3" /> CAO
          </span>
        );
      case 'MEDIUM':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-blue-100 text-blue-800 dark:bg-blue-950/70 dark:text-blue-400 border border-blue-200 dark:border-blue-800">
            TRUNG BÌNH
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
            <CheckCircle2 className="w-3 h-3" /> AN TOÀN
          </span>
        );
    }
  };

  const getStatusBadge = (status: string) => {
    if (status === 'ANOMALOUS') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-rose-50 text-rose-600 dark:bg-rose-900/30 dark:text-rose-400">
          <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-ping" />
          Bất thường
        </span>
      );
    }
    if (status === 'WARNING') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
          Cảnh báo
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
        Bình thường
      </span>
    );
  };

  const renderTrendIcon = (direction: 'up' | 'down' | 'stable') => {
    if (direction === 'up') {
      return (
        <span title="Xu hướng cải thiện">
          <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />
        </span>
      );
    }
    if (direction === 'down') {
      return (
        <span title="Xu hướng suy giảm">
          <TrendingDown className="w-3.5 h-3.5 text-rose-500" />
        </span>
      );
    }
    return (
      <span title="Ổn định">
        <Minus className="w-3.5 h-3.5 text-slate-400" />
      </span>
    );
  };

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700/70 overflow-hidden shadow-xs">
      {/* Table header toolbar */}
      <div className="p-4 border-b border-slate-200 dark:border-slate-700/70 flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="w-4 h-4 text-slate-500" />
          <h4 className="text-sm font-bold text-slate-800 dark:text-slate-100">
            Chỉ số Sức khỏe AI 6 Thiết bị Nhà máy
          </h4>
          <span className="px-2 py-0.5 text-xs rounded-full bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 font-medium">
            {filteredList.length} thiết bị
          </span>
        </div>

        <div className="flex items-center gap-2.5 w-full sm:w-auto">
          {/* Search Input */}
          <div className="relative flex-1 sm:w-48">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Tìm mã hoặc tên..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-[#E60012]"
            />
          </div>

          {/* Risk Filter */}
          <div className="relative">
            <select
              aria-label="Lọc theo mức rủi ro AI"
              value={filterRisk}
              onChange={(e) => setFilterRisk(e.target.value as any)}
              className="text-xs font-medium px-2.5 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 focus:outline-none cursor-pointer"
            >
              <option value="ALL">Mọi mức rủi ro</option>
              <option value="CRITICAL">Nguy cấp (Critical)</option>
              <option value="HIGH">Rủi ro cao (High)</option>
              <option value="MEDIUM">Trung bình (Medium)</option>
              <option value="LOW">An toàn (Low)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Table content */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="bg-slate-50/75 dark:bg-slate-900/50 text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700/60 font-semibold">
              <th className="py-3 px-4">Thiết bị & Chủng loại</th>
              <th className="py-3 px-3">Dây chuyền</th>
              <th className="py-3 px-4 w-44">Điểm Sức khỏe AI</th>
              <th className="py-3 px-3">Mức rủi ro</th>
              <th className="py-3 px-3">Thông số then chốt</th>
              <th className="py-3 px-3">Đánh giá AI</th>
              <th className="py-3 px-3 text-right">Chi tiết</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-700/40">
            {filteredList.map((item) => {
              const isSelected = item.machineId === selectedMachineId;
              const scoreColorClass = getScoreColor(item.healthScore);

              return (
                <tr
                  key={item.machineId}
                  onClick={() => onSelectMachine(item.machineId)}
                  className={`cursor-pointer transition-colors ${
                    isSelected
                      ? 'bg-red-50/60 dark:bg-red-950/20 font-medium'
                      : 'hover:bg-slate-50/60 dark:hover:bg-slate-700/30'
                  }`}
                >
                  {/* Code & Name */}
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2">
                      <div
                        className={`w-2 h-2 rounded-full ${
                          isSelected ? 'bg-[#E60012]' : 'bg-transparent'
                        }`}
                      />
                      <div>
                        <div className="font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                          <span>{item.machineCode}</span>
                          <span className="text-[10px] font-normal px-1.5 py-0.2 rounded bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                            {item.type}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate max-w-[200px]" title={item.machineName}>
                          {item.machineName}
                        </div>
                      </div>
                    </div>
                  </td>

                  {/* Line */}
                  <td className="py-3 px-3 text-slate-600 dark:text-slate-300">
                    {item.lineName}
                  </td>

                  {/* Health Score + Progress Bar */}
                  <td className="py-3 px-4">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-1">
                        <span className={`text-sm font-extrabold ${scoreColorClass.split(' ')[0]}`}>
                          {item.healthScore}
                        </span>
                        <span className="text-[10px] text-slate-400">/100</span>
                      </div>
                      <div className="flex items-center gap-1">
                        {renderTrendIcon(item.trendDirection)}
                      </div>
                    </div>
                    {/* Bar */}
                    <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${scoreColorClass.split(' ')[1]}`}
                        style={{ width: `${item.healthScore}%` }}
                      />
                    </div>
                  </td>

                  {/* Risk Level */}
                  <td className="py-3 px-3">{getRiskBadge(item.riskLevel)}</td>

                  {/* Key Metric */}
                  <td className="py-3 px-3">
                    <div className="text-slate-700 dark:text-slate-200 font-medium">
                      {item.keyMetricValue} {item.keyMetricUnit}
                    </div>
                    <div className="text-[10px] text-slate-400">
                      {item.keyMetricName}
                    </div>
                  </td>

                  {/* AI Status */}
                  <td className="py-3 px-3">{getStatusBadge(item.status)}</td>

                  {/* Action */}
                  <td className="py-3 px-3 text-right">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectMachine(item.machineId);
                        if (onInspectDetails) onInspectDetails(item.machineId);
                      }}
                      className="p-1.5 rounded-md hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-600 dark:text-slate-300 transition-colors"
                      title="Phân tích chi tiết AI"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              );
            })}

            {filteredList.length === 0 && (
              <tr>
                <td colSpan={7} className="py-8 text-center text-slate-400">
                  Không tìm thấy thiết bị nào phù hợp với bộ lọc hiện tại.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
