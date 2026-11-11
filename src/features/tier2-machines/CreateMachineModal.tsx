/**
 * @file CreateMachineModal.tsx
 * @description Modal thêm thiết bị máy móc mới (DENSO Smart Factory)
 * Kế thừa toàn bộ giao diện 3 Tab, upload ảnh và thông số kỹ thuật từ MachineFormModal
 */

import { ProductionLine } from '../../types/hierarchy';
import { MachineFormModal } from './MachineFormModal';

interface CreateMachineModalProps {
  isOpen: boolean;
  onClose: () => void;
  lines: ProductionLine[];
  defaultLineId?: string;
  onCreated?: () => void;
}

export function CreateMachineModal({
  isOpen,
  onClose,
  lines,
  defaultLineId,
  onCreated,
}: CreateMachineModalProps) {
  return (
    <MachineFormModal
      isOpen={isOpen}
      onClose={onClose}
      mode="create"
      lines={lines}
      defaultLineId={defaultLineId}
      onSuccess={onCreated}
    />
  );
}
