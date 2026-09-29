/**
 * @file LineCard.tsx
 * @description Thẻ Card hiển thị Tầng 1 (Luồng / Dây chuyền sản xuất)
 * Tích hợp Chip màu báo trạng thái, % chỉ số an toàn toàn dây chuyền và liên kết tới Tầng 2
 * Hỗ trợ độ tương phản sắc nét ở cả Light Mode và Dark Mode
 */

import { Card, CardBody, CardHeader, CardFooter, Chip, Progress, Button } from '@heroui/react';
import { 
  ShieldCheck, 
  AlertTriangle, 
  AlertOctagon, 
  Layers, 
  Clock, 
  ArrowRight,
  Activity
} from 'lucide-react';
import { ProductionLine } from '../../types/hierarchy';
import { useMonitoringStore } from '../../stores/useMonitoringStore';

interface LineCardProps {
  line: ProductionLine;
  onViewDetails?: (lineId: string) => void;
}

export function LineCard({ line, onViewDetails }: LineCardProps) {
  const { setSelectedLineId, setActiveTab } = useMonitoringStore();

  const isCritical = line.status === 'critical';
  const isWarning = line.status === 'warning';

  // Định cấu hình màu sắc trạng thái
  const statusColor = isCritical ? 'danger' : isWarning ? 'warning' : 'success';

  const statusLabel = isCritical
    ? 'Nguy hiểm'
    : isWarning
    ? 'Cảnh báo'
    : 'Bình thường';

  const StatusIcon = isCritical
    ? AlertOctagon
    : isWarning
    ? AlertTriangle
    : ShieldCheck;

  // Thống kê trạng thái các máy con (Tầng 2)
  const totalMachines = line.machines.length;
  const normalMachines = line.machines.filter((m) => m.status === 'normal').length;
  const warningMachines = line.machines.filter((m) => m.status === 'warning').length;
  const criticalMachines = line.machines.filter((m) => m.status === 'critical').length;

  const handleDrillDown = () => {
    setSelectedLineId(line.id);
    if (onViewDetails) {
      onViewDetails(line.id);
    } else {
      setActiveTab('lines');
    }
  };

  return (
    <Card
      className={`relative overflow-hidden bg-factory-card border transition-all duration-300 hover:shadow-xl ${
        isCritical
          ? 'border-rose-500/60 shadow-rose-950/20'
          : isWarning
          ? 'border-amber-500/50 shadow-amber-950/10'
          : 'border-factory-border hover:border-slate-400 dark:hover:border-gray-600'
      }`}
    >
      {/* Vạch màu định danh trên cùng của Card */}
      <div
        className={`h-1.5 w-full ${
          isCritical
            ? 'bg-gradient-to-r from-rose-600 to-red-500 animate-alarm-blink'
            : isWarning
            ? 'bg-gradient-to-r from-amber-500 to-yellow-400'
            : 'bg-gradient-to-r from-emerald-500 to-teal-400'
        }`}
      />

      <CardHeader className="flex justify-between items-start p-5 pb-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-slate-100 dark:bg-factory-bg border border-slate-200 dark:border-factory-border text-blue-600 dark:text-blue-400">
              {line.code}
            </span>
            <Chip
              size="sm"
              color={statusColor}
              variant="flat"
              startContent={
                <StatusIcon
                  className={`w-3.5 h-3.5 ${isCritical ? 'animate-alarm-blink text-rose-500' : ''}`}
                />
              }
              className="font-semibold text-xs capitalize"
            >
              {statusLabel}
            </Chip>
          </div>
          <h3 className="text-base font-bold text-slate-900 dark:text-white tracking-wide mt-1.5">
            {line.name}
          </h3>
        </div>

        {/* Biểu tượng phân tầng Tầng 1 */}
        <div className="p-2 rounded-xl bg-slate-100 dark:bg-factory-bg border border-slate-200 dark:border-factory-border/80 text-slate-500 dark:text-gray-400">
          <Activity className="w-5 h-5 text-blue-500 dark:text-blue-400" />
        </div>
      </CardHeader>

      <CardBody className="p-5 pt-1 space-y-4">
        {/* Mô tả dây chuyền: đậm rõ nét ở Light mode */}
        <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-2 leading-relaxed">
          {line.description || 'Dây chuyền sản xuất tự động tích hợp giám sát PLC.'}
        </p>

        {/* Thanh % Chỉ số an toàn toàn dây chuyền (Safety Score) */}
        <div className="space-y-1.5 bg-slate-50 dark:bg-factory-bg/70 p-3 rounded-xl border border-slate-200 dark:border-factory-border/60">
          <div className="flex justify-between items-center text-xs">
            <span className="text-slate-700 dark:text-gray-300 font-semibold">Chỉ số An Toàn Toàn Line</span>
            <span
              className={`font-mono font-bold text-sm ${
                line.safetyScore >= 90
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : line.safetyScore >= 75
                  ? 'text-amber-600 dark:text-amber-400'
                  : 'text-rose-600 dark:text-rose-400'
              }`}
            >
              {line.safetyScore}%
            </span>
          </div>
          <Progress
            size="md"
            radius="full"
            value={line.safetyScore}
            color={statusColor}
            aria-label={`Safety score for ${line.name}`}
            className="w-full"
          />
        </div>

        {/* Phân rã trạng thái các máy thành phần (Card nhỏ THIẾT BỊ & VẬN HÀNH) */}
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="flex items-center gap-2 p-2.5 rounded-lg bg-slate-50 dark:bg-factory-bg/40 border border-slate-200 dark:border-factory-border/50">
            <Layers className="w-4 h-4 text-blue-500 dark:text-blue-400 shrink-0" />
            <div>
              <p className="text-[10px] text-slate-600 dark:text-slate-400 uppercase font-bold tracking-wider">
                Thiết Bị (Tầng 2)
              </p>
              <p className="font-mono font-bold text-slate-900 dark:text-white mt-0.5">
                {totalMachines} Máy
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 p-2.5 rounded-lg bg-slate-50 dark:bg-factory-bg/40 border border-slate-200 dark:border-factory-border/50">
            <Clock className="w-4 h-4 text-emerald-500 dark:text-emerald-400 shrink-0" />
            <div>
              <p className="text-[10px] text-slate-600 dark:text-slate-400 uppercase font-bold tracking-wider">
                Vận Hành
              </p>
              <p className="font-mono font-bold text-slate-900 dark:text-white mt-0.5">
                {line.operatingHours}h liên tục
              </p>
            </div>
          </div>
        </div>

        {/* Preview nhanh các máy con trực thuộc */}
        <div className="space-y-1.5 pt-1">
          <div className="flex justify-between text-[11px] text-slate-600 dark:text-slate-400 font-medium">
            <span>Tình trạng máy:</span>
            <span className="font-mono">
              <span className="text-emerald-600 dark:text-emerald-400 font-bold">{normalMachines} OK</span>
              {warningMachines > 0 && (
                <span className="text-amber-600 dark:text-amber-400 font-bold ml-2">{warningMachines} Cảnh báo</span>
              )}
              {criticalMachines > 0 && (
                <span className="text-rose-600 dark:text-rose-400 font-bold ml-2">{criticalMachines} Nguy hiểm</span>
              )}
            </span>
          </div>

          <div className="flex gap-1.5">
            {line.machines.map((machine) => (
              <div
                key={machine.id}
                className="flex-1 h-2 rounded-full bg-slate-200 dark:bg-factory-bg border border-slate-300 dark:border-factory-border overflow-hidden"
                title={`${machine.name} (${machine.status})`}
              >
                <div
                  className={`h-full w-full ${
                    machine.status === 'critical'
                      ? 'bg-rose-500 animate-pulse'
                      : machine.status === 'warning'
                      ? 'bg-amber-500'
                      : 'bg-emerald-500'
                  }`}
                />
              </div>
            ))}
          </div>
        </div>
      </CardBody>

      <CardFooter className="p-4 pt-0 border-t border-slate-200 dark:border-factory-border/50 flex justify-between items-center">
        <span className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
          ID: {line.id}
        </span>
        <Button
          size="sm"
          color="primary"
          variant="light"
          endContent={<ArrowRight className="w-4 h-4" />}
          className="text-xs font-semibold hover:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
          onPress={handleDrillDown}
        >
          Chi Tiết Máy & Chỉ Số
        </Button>
      </CardFooter>
    </Card>
  );
}
