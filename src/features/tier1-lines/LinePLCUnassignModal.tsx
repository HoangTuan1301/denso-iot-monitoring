/**
 * @file LinePLCUnassignModal.tsx
 * @description Modal Gỡ Trạm PLC khỏi Dây chuyền sản xuất (Tầng 1) kèm cảnh báo an toàn
 * Kiến trúc DENSO IoT: 1 Dây chuyền gắn tối đa 1 PLC, 1 PLC chỉ thuộc 1 Dây chuyền.
 */

import { useState } from 'react';
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
} from '@heroui/react';
import {
  Unlink,
  AlertTriangle,
  CheckCircle2,
  XCircle,
} from 'lucide-react';
import { ProductionLine } from '../../types/hierarchy';
import { useMonitoringStore } from '../../stores/useMonitoringStore';

interface LinePLCUnassignModalProps {
  isOpen: boolean;
  onClose: () => void;
  line: ProductionLine | null;
  onUnassigned?: () => void;
}

export function LinePLCUnassignModal({
  isOpen,
  onClose,
  line,
  onUnassigned,
}: LinePLCUnassignModalProps) {
  const { unassignLinePLC } = useMonitoringStore();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  if (!line) return null;

  const currentPlcId = line.plc?.id || line.plcId;
  const plcName = line.plc?.name || line.plcName || currentPlcId || 'Trạm PLC';

  const handleConfirmUnassign = async () => {
    setIsSubmitting(true);
    setError(null);

    try {
      const res = await unassignLinePLC(line.id);
      setSuccessMessage(res.message || 'Gỡ trạm PLC khỏi dây chuyền thành công!');
      setTimeout(() => {
        onUnassigned?.();
        onClose();
      }, 700);
    } catch (err: any) {
      console.warn('[Unassign Line PLC Error]:', err);
      setError(err.message || 'Lỗi khi gỡ trạm PLC khỏi dây chuyền.');
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
                  Gỡ Bỏ Trạm PLC Khỏi Dây Chuyền
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-normal">
                  Ngắt kết nối trạm PLC khỏi dây chuyền sản xuất
                </p>
              </div>
            </ModalHeader>

            <ModalBody className="py-4 space-y-3">
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    Dây Chuyền Sản Xuất
                  </span>
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                    {line.name}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-200 dark:border-slate-800">
                  <span className="text-slate-500 dark:text-slate-400">Trạm PLC đang gắn:</span>
                  <span className="font-bold text-rose-600 dark:text-rose-400">
                    {plcName}
                  </span>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-800 dark:text-amber-300 text-xs flex items-start gap-2.5">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
                <div className="space-y-1">
                  <p className="font-bold">Lưu ý an toàn kỹ thuật:</p>
                  <p className="text-[11px] leading-relaxed">
                    Sau khi gỡ bỏ, tất cả các máy trực thuộc dây chuyền này (<span className="font-semibold">{line.machines?.length || 0} máy</span>) sẽ không còn kế thừa trạm PLC, và mọi cấu hình giám sát trực tiếp từ PLC sẽ bị ngắt kết nối an toàn.
                  </p>
                </div>
              </div>

              {error && (
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400 text-xs flex items-center gap-2">
                  <XCircle className="w-4 h-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {successMessage && (
                <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-xs flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>{successMessage}</span>
                </div>
              )}
            </ModalBody>

            <ModalFooter>
              <Button
                size="sm"
                variant="flat"
                color="default"
                onClick={onClose}
                disabled={isSubmitting}
                className="font-medium"
              >
                Hủy Bỏ
              </Button>
              <Button
                size="sm"
                color="danger"
                onClick={handleConfirmUnassign}
                isLoading={isSubmitting}
                disabled={isSubmitting}
                className="font-bold bg-rose-600 hover:bg-rose-700 text-white"
              >
                Xác Nhận Gỡ PLC
              </Button>
            </ModalFooter>
          </>
        )}
      </ModalContent>
    </Modal>
  );
}
