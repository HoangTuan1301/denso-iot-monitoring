/**
 * @file EditMachineModal.tsx
 * @description Modal Thông tin & Chỉnh sửa thiết bị máy móc (DENSO Smart Factory)
 * Kế thừa toàn bộ giao diện 3 Tab, upload ảnh và thông số kỹ thuật từ MachineFormModal
 */

import { MachineComponent } from '../../types/hierarchy';
import { useMonitoringStore } from '../../stores/useMonitoringStore';
import { MachineFormModal } from './MachineFormModal';

interface EditMachineModalProps {
  isOpen: boolean;
  onClose: () => void;
  machine: MachineComponent | null;
  lineName?: string;
  onUpdated?: () => void;
}

export function EditMachineModal({
  isOpen,
  onClose,
  machine,
  lineName,
  onUpdated,
}: EditMachineModalProps) {
  const { lines } = useMonitoringStore();

  return (
    <MachineFormModal
      isOpen={isOpen}
      onClose={onClose}
      mode="edit"
      machine={machine}
      lines={lines}
      defaultLineId={machine?.lineId}
      lineName={lineName}
      onSuccess={onUpdated}
    />
  );
}
