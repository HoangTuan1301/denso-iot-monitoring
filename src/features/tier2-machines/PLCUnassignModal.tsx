/**
 * @file PLCUnassignModal.tsx
 * @description Modal Gỡ Trạm PLC khỏi Máy (Tầng 2) kèm cảnh báo an toàn
 */

import { useState } from 'react';
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
  Chip,
} from '@heroui/react';
import {
  Unlink,
  AlertTriangle,
  CheckCircle2,
  XCircle,
} from 'lucide-react';
import { MachineComponent } from '../../types/hierarchy';
import { useMonitoringStore } from '../../stores/useMonitoringStore';

interface PLCUnassignModalProps {
  isOpen: boolean;
  onClose: () => void;
  machine: MachineComponent | null;
  onUnassigned?: () => void;
}

export function PLCUnassignModal({
  isOpen,
  onClose,
  machine,
  onUnassigned,
}: PLCUnassignModalProps) {
  const { unassignMachinePLC } = useMonitoringStore();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  if (!machine) return null;

  const plcName = machine.plc?.name || machine.plcName || machine.plcId || 'Trạm PLC';

  const handleConfirmUnassign = async () => {
    setIsSubmitting(true);
    setError(null);

    try {
      const res = await unassignMachinePLC(machine.id);
      setSuccessMessage(res.message || 'Gỡ trạm PLC khỏi máy thành công!');
      setTimeout(() => {
        onUnassigned?.();
        onClose();
      }, 700);
    } catch (err: any) {
      console.warn('[Unassign PLC Error]:', err);
      setError(err.message || 'Lỗi khi gỡ trạm PLC khỏi máy.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="md"
      backdrop="blur"
      placement="center"
      classNames={{
        base: 'bg-white dark:bg-[#1a202c] border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white',
        header: 'border-b border-slate-200 dark:border-slate-800 pb-3',
        footer: 'border-t border-slate-200 dark:border-slate-800 pt-3',
      }}
    >
      <ModalContent>
        {() => (
          <>
            <ModalHeader className="flex items-center gap-2">
              <div className="p-2 bg-rose-500/10 text-rose-600 dark:text-rose-400 rounded-lg">
                <Unlink className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Gỡ Bỏ Trạm PLC Khỏi Máy
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-normal">
                  Ngắt kết nối trạm PLC với máy sản xuất
                </p>
              </div>
            </ModalHeader>

            <ModalBody className="py-4 space-y-3">
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    Thiết bị mục tiêu
                  </span>
                  <Chip size="sm" variant="flat" color="primary" className="font-mono text-[11px]">
                    {machine.id}
                  </Chip>
                </div>
                <div className="text-sm font-bold text-slate-900 dark:text-white">
                  {machine.name}
                </div>
                <div className="text-xs text-slate-600 dark:text-slate-400 flex items-center gap-2">
                  <span>Trạm PLC đang gắn:</span>
                  <span className="font-semibold text-rose-600 dark:text-rose-400">{plcName}</span>
                </div>
              </div>

              {/* Hộp cảnh báo an toàn */}
              <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800/60 flex items-start gap-2.5 text-xs text-amber-800 dark:text-amber-300">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
                <div>
                  <div className="font-bold">Hành động này sẽ thực hiện trong CSDL:</div>
                  <ul className="list-disc list-inside mt-1 space-y-0.5 text-[11px] text-amber-900 dark:text-amber-200">
                    <li>Giải phóng trạm PLC khỏi máy (<span className="font-mono">plc_stations.machine_id = NULL</span>).</li>
                    <li>Gỡ trạm PLC trên toàn bộ mapping (<span className="font-mono">metric_mappings.plc_id = NULL</span>).</li>
                    <li>Ngắt thu thập tín hiệu (<span className="font-mono">metric_mappings.monitoring_enabled = 0</span>).</li>
                    <li>Chuyển trạng thái mapping về chưa cấu hình (<span className="font-mono">status = 'NOT_CONFIGURED'</span>).</li>
                  </ul>
                </div>
              </div>

              {error && (
                <div className="flex items-center gap-2 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-rose-700 dark:text-rose-400 text-xs font-medium">
                  <XCircle className="w-4 h-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {successMessage && (
                <div className="flex items-center gap-2 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/60 text-emerald-700 dark:text-emerald-400 text-xs font-semibold">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>{successMessage}</span>
                </div>
              )}
            </ModalBody>

            <ModalFooter className="flex items-center justify-between">
              <Button
                size="sm"
                variant="flat"
                color="default"
                onPress={onClose}
                isDisabled={isSubmitting}
                className="text-xs"
              >
                Hủy bỏ
              </Button>

              <Button
                size="sm"
                color="danger"
                variant="solid"
                className="bg-rose-600 hover:bg-rose-700 text-white font-semibold text-xs px-4"
                onPress={handleConfirmUnassign}
                isLoading={isSubmitting}
                startContent={!isSubmitting && <Unlink className="w-3.5 h-3.5" />}
              >
                Xác nhận Gỡ PLC
              </Button>
            </ModalFooter>
          </>
        )}
      </ModalContent>
    </Modal>
  );
}
