/**
 * @file MachineCard.tsx
 * @description Thẻ Card hiển thị Thành phần / Máy (Tầng 2)
 * Tích hợp mã QR nhận diện, tóm tắt các chỉ số Tầng 3 và hiệu ứng Visual Alert nhấp nháy
 */

import { Card, CardBody, CardHeader, CardFooter, Chip, Button } from '@heroui/react';
import { 
  Cpu, 
  QrCode, 
  MapPin, 
  ShieldCheck, 
  AlertTriangle, 
  AlertOctagon, 
  LineChart 
} from 'lucide-react';
import { MachineComponent } from '../../types/hierarchy';

interface MachineCardProps {
  machine: MachineComponent;
  lineName?: string;
  onOpenDetails: (machine: MachineComponent) => void;
  onOpenQR: (machine: MachineComponent) => void;
}

export function MachineCard({ machine, lineName, onOpenDetails, onOpenQR }: MachineCardProps) {
  const isCritical = machine.status === 'critical';
  const isWarning = machine.status === 'warning';
  const isNormal = machine.status === 'normal';

  const statusColor = isCritical ? 'danger' : isWarning ? 'warning' : isNormal ? 'success' : 'default';
  const StatusIcon = isCritical ? AlertOctagon : isWarning ? AlertTriangle : isNormal ? ShieldCheck : Cpu;

  return (
    <Card
      className={`bg-factory-card border transition-all duration-200 hover:border-gray-500 flex flex-col justify-between ${
        isCritical
          ? 'border-rose-500/70 shadow-lg shadow-rose-950/30'
          : isWarning
          ? 'border-amber-500/60 shadow-md shadow-amber-950/20'
          : 'border-factory-border'
      }`}
    >
      <div>
        {/* Header Thẻ Máy: Tên, ID và Chip trạng thái */}
        <CardHeader className="flex justify-between items-start p-4 pb-2">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs font-bold text-blue-400 bg-factory-bg px-2 py-0.5 rounded border border-factory-border">
                {machine.id}
              </span>
              <Chip
                size="sm"
                color={statusColor}
                variant="flat"
                startContent={<StatusIcon className={`w-3.5 h-3.5 ${isCritical ? 'animate-alarm-blink text-rose-400' : ''}`} />}
                className="font-semibold text-xs capitalize"
              >
                {isNormal
                  ? 'Bình thường'
                  : isWarning
                  ? 'Cảnh báo'
                  : isCritical
                  ? 'Nguy hiểm'
                  : 'Chưa có dữ liệu'}
              </Chip>
            </div>
            <h3 className="text-sm font-bold text-white mt-1 line-clamp-1">{machine.name}</h3>
            <div className="flex flex-wrap items-center gap-2 mt-1">
              <p className="text-[11px] text-gray-400 font-mono">
                Model: <span className="text-gray-300 font-semibold">{machine.model}</span>
                {lineName && ` • ${lineName}`}
              </p>
              {machine.dataSourceType === 'FILE_INGEST' ? (
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-500/30">
                  FILE INGEST (TEST)
                </span>
              ) : (
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">
                  MODBUS: KHÔNG KẾT NỐI
                </span>
              )}
            </div>
          </div>

          {/* Biểu tượng CPU máy */}
          <div className="p-2 rounded-xl bg-factory-bg border border-factory-border text-gray-400">
            <Cpu className="w-5 h-5 text-indigo-400" />
          </div>
        </CardHeader>

        <CardBody className="p-4 pt-2 space-y-3">
          {/* Thông tin vị trí & mã QR nhận diện */}
          <div className="flex items-center justify-between text-xs text-gray-400 bg-factory-bg/70 px-2.5 py-1.5 rounded-lg border border-factory-border/60">
            <span className="flex items-center gap-1 truncate max-w-[170px]">
              <MapPin className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span className="truncate">{machine.location}</span>
            </span>

            <Button
              size="sm"
              variant="flat"
              color="primary"
              className="text-[11px] h-6 px-2 font-mono"
              startContent={<QrCode className="w-3 h-3" />}
              onPress={() => onOpenQR(machine)}
            >
              QR: {(machine.qrCode || machine.id).split('-').slice(-2).join('-')}
            </Button>
          </div>

          {/* DANH SÁCH CHỈ SỐ TẦNG 3 TÓM TẮT & HIỆU ỨNG BLINK ANIMATION */}
          <div className="space-y-1.5">
            <div className="flex justify-between items-center text-[10px] text-gray-400 font-semibold uppercase tracking-wider">
              <span>Chỉ số đo lường ({machine.metrics.length})</span>
              <span>Giá trị / PLC</span>
            </div>

            {machine.metrics.map((metric) => {
              const isCrit = metric.status === 'critical';
              const isWarn = metric.status === 'warning';
              const quality = metric.quality || 'GOOD';
              const isFile = metric.dataSourceType === 'FILE_INGEST';

              return (
                <div
                  key={metric.id}
                  onClick={() => onOpenDetails(machine)}
                  className={`p-2 rounded-lg border cursor-pointer transition-all flex items-center justify-between text-xs ${
                    isCrit
                      ? 'bg-rose-950/40 border-rose-500 animate-alarm-blink'
                      : isWarn
                      ? 'bg-amber-950/30 border-amber-500'
                      : 'bg-factory-bg/50 border-factory-border/70 hover:border-gray-600'
                  }`}
                >
                  <div className="truncate max-w-[170px]">
                    <div className="flex items-center gap-1.5">
                      {/* Quality dot */}
                      <span
                        className={`w-2 h-2 rounded-full shrink-0 ${
                          quality === 'GOOD'
                            ? 'bg-emerald-400 shadow-xs shadow-emerald-400/50'
                            : quality === 'UNCERTAIN'
                            ? 'bg-amber-400'
                            : 'bg-rose-500'
                        }`}
                        title={`Chất lượng dữ liệu: ${quality}`}
                      />
                      <p className="text-gray-300 font-medium truncate">{metric.name}</p>
                    </div>
                    <div className="flex items-center gap-1.5 mt-0.5 text-[10px] text-gray-400 font-mono">
                      {isFile ? (
                        <span>CSV: {metric.fileTagName || metric.mappingCode || 'log215'}</span>
                      ) : (
                        <span>PLC: {metric.plcMapping?.address || 'N/A'}</span>
                      )}
                      {metric.measuredAt && (
                        <span className="text-gray-500 text-[9px] truncate">
                          &bull; {metric.measuredAt.replace('T', ' ').slice(0, 19)}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <div className="flex items-center justify-end gap-1">
                      {metric.isStale && (
                        <span className="text-[9px] font-mono px-1 py-0.2 rounded bg-amber-950/50 text-amber-400 border border-amber-800/40">
                          STALE
                        </span>
                      )}
                      {isFile && (
                        <span className="text-[9px] font-mono px-1 py-0.2 rounded bg-blue-950/40 text-blue-400 border border-blue-800/40">
                          FILE
                        </span>
                      )}
                      <span
                        className={`font-mono font-bold text-sm ${
                          isCrit
                            ? 'text-rose-400'
                            : isWarn
                            ? 'text-amber-400'
                            : 'text-emerald-400'
                        }`}
                      >
                        {metric.currentValue}
                      </span>
                    </div>
                    <span className="text-[10px] text-gray-400 font-mono">
                      {metric.unit && metric.unit !== 'N/A' && metric.unit !== '-' ? metric.unit : 'raw'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </CardBody>
      </div>

      {/* Footer Card: Nút mở Modal Biểu đồ biến thiên */}
      <CardFooter className="p-3 border-t border-factory-border/60 flex justify-between items-center bg-factory-bg/30">
        <span className="text-[10px] text-gray-500 font-mono">
          {machine.metrics.length} cảm biến
        </span>
        <Button
          size="sm"
          color="primary"
          variant="flat"
          startContent={<LineChart className="w-3.5 h-3.5" />}
          className="text-xs font-semibold"
          onPress={() => onOpenDetails(machine)}
        >
          Biểu Đồ & Chi Tiết Tầng 3
        </Button>
      </CardFooter>
    </Card>
  );
}
