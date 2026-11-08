/**
 * @file PLCAssignModal.tsx
 * @description Modal Gán hoặc Chuyển giao Trạm PLC cho Máy (Tầng 2)
 * Hỗ trợ Dual Confirmation (409 Conflict) và Validation kiểm tra PLC Demo / Vô hiệu hóa (422)
 */

import { useState, useEffect } from 'react';
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
  Cpu,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Loader2,
  ArrowRightLeft,
  ShieldAlert,
} from 'lucide-react';
import { MachineComponent } from '../../types/hierarchy';
import { apiClient } from '../../services/api';
import { useMonitoringStore } from '../../stores/useMonitoringStore';

interface PLCAssignModalProps {
  isOpen: boolean;
  onClose: () => void;
  machine: MachineComponent | null;
  onAssigned?: () => void;
}

export function PLCAssignModal({
  isOpen,
  onClose,
  machine,
  onAssigned,
}: PLCAssignModalProps) {
  const { assignMachinePLC } = useMonitoringStore();

  const [stations, setStations] = useState<any[]>([]);
  const [isLoadingStations, setIsLoadingStations] = useState(false);
  const [selectedPlcId, setSelectedPlcId] = useState<string>('');

  const [confirmDestReplace, setConfirmDestReplace] = useState(false);
  const [confirmSourceTransfer, setConfirmSourceTransfer] = useState(false);

  const [conflictError, setConflictError] = useState<{
    code: string;
    message: string;
    currentPlcName?: string;
    sourceMachineName?: string;
  } | null>(null);

  const [generalError, setGeneralError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Nạp danh sách trạm PLC khi mở modal
  useEffect(() => {
    if (isOpen) {
      setConflictError(null);
      setGeneralError(null);
      setSuccessMessage(null);
      setConfirmDestReplace(false);
      setConfirmSourceTransfer(false);

      setIsLoadingStations(true);
      apiClient
        .getPLCStations()
        .then((res) => {
          const list = res.stations || [];
          setStations(list);
          if (machine?.plcId) {
            setSelectedPlcId(machine.plcId);
          } else if (list.length > 0) {
            setSelectedPlcId(list[0].id);
          }
        })
        .catch((err) => {
          setGeneralError(err.message || 'Không thể tải danh sách trạm PLC');
        })
        .finally(() => {
          setIsLoadingStations(false);
        });
    }
  }, [isOpen, machine]);

  if (!machine) return null;

  const selectedPlc = stations.find((s) => s.id === selectedPlcId);
  const isTargetAlreadyHasPlc = Boolean(machine.plcId && machine.plcId !== selectedPlcId);
  const isSelectedPlcBelongsToOther = Boolean(
    selectedPlc?.machine_id && selectedPlc.machine_id !== machine.id
  );

  const handleSubmit = async () => {
    if (!selectedPlcId) {
      setGeneralError('Vui lòng chọn một trạm PLC.');
      return;
    }

    setIsSubmitting(true);
    setGeneralError(null);

    try {
      const res = await assignMachinePLC(machine.id, selectedPlcId, {
        confirmDestReplace,
        confirmSourceTransfer,
      });

      setSuccessMessage(res.message || 'Gán trạm PLC thành công!');
      setTimeout(() => {
        onAssigned?.();
        onClose();
      }, 700);
    } catch (err: any) {
      console.warn('[Assign PLC Error]:', err);
      const code = err.errorCode || err.code;

      if (
        code === 'DUAL_CONFIRMATION_REQUIRED' ||
        code === 'DEST_MACHINE_HAS_PLC' ||
        code === 'PLC_BELONGS_TO_ANOTHER_MACHINE'
      ) {
        setConflictError({
          code,
          message: err.message,
          currentPlcName: err.currentPlcName,
          sourceMachineName: err.sourceMachineName,
        });
      } else {
        setGeneralError(err.message || 'Lỗi khi gán trạm PLC.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="2xl"
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
              <div className="p-2 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-lg">
                <Cpu className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Gán / Chuyển giao Trạm PLC
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-normal">
                  Liên kết trạm PLC điều khiển với máy công nghiệp (Tầng 2)
                </p>
              </div>
            </ModalHeader>

            <ModalBody className="py-4 space-y-4">
              {/* Thẻ tóm tắt Máy Đích */}
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    Máy đích
                  </span>
                  <Chip size="sm" variant="flat" color="primary" className="font-mono text-[11px]">
                    {machine.id}
                  </Chip>
                </div>
                <div className="text-sm font-bold text-slate-900 dark:text-white">
                  {machine.name}
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
                  <span>Trạm PLC hiện tại:</span>
                  {machine.plc || machine.plcId ? (
                    <Chip size="sm" variant="dot" color="success">
                      {machine.plc?.name || machine.plcName || machine.plcId} ({machine.plc?.protocol || machine.plcProtocol || 'Modbus/TCP'})
                    </Chip>
                  ) : (
                    <Chip size="sm" variant="flat" color="warning">
                      Chưa gán trạm PLC
                    </Chip>
                  )}
                </div>
              </div>

              {/* Lựa chọn trạm PLC mục tiêu */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                  <span>Chọn Trạm PLC mục tiêu:</span>
                  {isLoadingStations && (
                    <span className="flex items-center gap-1 text-[11px] text-slate-400">
                      <Loader2 className="w-3 h-3 animate-spin" /> Đang tải trạm...
                    </span>
                  )}
                </label>

                <select
                  value={selectedPlcId}
                  onChange={(e) => {
                    setSelectedPlcId(e.target.value);
                    setConflictError(null);
                    setGeneralError(null);
                  }}
                  disabled={isLoadingStations || isSubmitting}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="" disabled>-- Chọn Trạm PLC --</option>
                  {stations.map((st) => {
                    const isAssigned = Boolean(st.machine_id);
                    const isThisMachine = st.machine_id === machine.id;
                    const isDemo = st.is_demo === 1 || st.is_demo === true;
                    const isDisabled = st.enabled === 0 || st.enabled === false;

                    let tag = '';
                    if (isThisMachine) tag = ' [Đang gán máy này]';
                    else if (isAssigned) tag = ` [Gán cho: ${st.machine_id}]`;
                    if (isDemo) tag += ' [DEMO]';
                    if (isDisabled) tag += ' [VÔ HIỆU HÓA]';

                    return (
                      <option key={st.id} value={st.id}>
                        {st.id} - {st.name} ({st.protocol || 'Modbus/TCP'}, {st.ipAddress}:{st.port}){tag}
                      </option>
                    );
                  })}
                </select>
              </div>

              {/* Thông tin chi tiết trạm PLC được chọn */}
              {selectedPlc && (
                <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 text-xs space-y-1.5 font-mono">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Giao thức:</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">{selectedPlc.protocol || 'Modbus/TCP'}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">IP & Port:</span>
                    <span className="text-slate-800 dark:text-slate-200">{selectedPlc.ipAddress}:{selectedPlc.port}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Trạng thái kỹ thuật:</span>
                    <div className="flex gap-1.5">
                      {selectedPlc.enabled ? (
                        <span className="text-emerald-600 dark:text-emerald-400 font-bold">Kích hoạt</span>
                      ) : (
                        <span className="text-rose-600 dark:text-rose-400 font-bold">Vô hiệu hóa</span>
                      )}
                      <span>&bull;</span>
                      {selectedPlc.is_demo ? (
                        <span className="text-amber-600 dark:text-amber-400 font-bold">Demo Mô phỏng</span>
                      ) : (
                        <span className="text-blue-600 dark:text-blue-400 font-bold">PLC Vật lý</span>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Cảnh báo trước khi bấm (Proactive Notice) */}
              {isTargetAlreadyHasPlc && !conflictError && (
                <div className="flex items-center gap-1.5 p-2 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/40 text-[11px] text-amber-700 dark:text-amber-400">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                  <span>Máy đích đang có trạm PLC. Việc gán sẽ yêu cầu xác nhận thay thế trạm hiện tại.</span>
                </div>
              )}

              {isSelectedPlcBelongsToOther && !conflictError && (
                <div className="flex items-center gap-1.5 p-2 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/40 text-[11px] text-blue-700 dark:text-blue-400">
                  <ArrowRightLeft className="w-3.5 h-3.5 shrink-0" />
                  <span>Trạm PLC này đang thuộc máy {selectedPlc?.machine_id}. Việc gán sẽ yêu cầu xác nhận chuyển giao.</span>
                </div>
              )}

              {selectedPlc?.is_demo === 1 && (
                <div className="flex items-start gap-2 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-rose-700 dark:text-rose-400 text-xs">
                  <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold">Lưu ý an toàn:</span> Trạm PLC này là PLC Demo mô phỏng. Theo quy chuẩn an toàn, Backend sẽ từ chối gán PLC Demo cho máy sản xuất (Mã 422).
                  </div>
                </div>
              )}

              {/* Xử lý xung đột 409 (Dual Confirmation / Transfer Conflict) */}
              {conflictError && (
                <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800/60 text-xs space-y-3">
                  <div className="flex items-start gap-2 text-amber-800 dark:text-amber-300">
                    <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
                    <div>
                      <div className="font-bold">Xác nhận chuyển giao / thay thế trạm PLC:</div>
                      <div className="text-[11px] mt-0.5">{conflictError.message}</div>
                    </div>
                  </div>

                  <div className="space-y-2 pt-1 border-t border-amber-200 dark:border-amber-900/50">
                    {(conflictError.code === 'DEST_MACHINE_HAS_PLC' ||
                      conflictError.code === 'DUAL_CONFIRMATION_REQUIRED') && (
                      <label className="flex items-center gap-2 cursor-pointer font-medium text-amber-950 dark:text-amber-200">
                        <input
                          type="checkbox"
                          checked={confirmDestReplace}
                          onChange={(e) => setConfirmDestReplace(e.target.checked)}
                          className="rounded border-amber-400 text-emerald-600 focus:ring-emerald-500 w-4 h-4"
                        />
                        <span>
                          Tôi xác nhận thay thế trạm PLC hiện tại của máy đích ({conflictError.currentPlcName || machine.plcId})
                        </span>
                      </label>
                    )}

                    {(conflictError.code === 'PLC_BELONGS_TO_ANOTHER_MACHINE' ||
                      conflictError.code === 'DUAL_CONFIRMATION_REQUIRED') && (
                      <label className="flex items-center gap-2 cursor-pointer font-medium text-amber-950 dark:text-amber-200">
                        <input
                          type="checkbox"
                          checked={confirmSourceTransfer}
                          onChange={(e) => setConfirmSourceTransfer(e.target.checked)}
                          className="rounded border-amber-400 text-emerald-600 focus:ring-emerald-500 w-4 h-4"
                        />
                        <span>
                          Tôi xác nhận chuyển giao trạm PLC từ máy nguồn ({conflictError.sourceMachineName || selectedPlc?.machine_id}) sang máy đích
                        </span>
                      </label>
                    )}
                  </div>
                </div>
              )}

              {/* Lỗi chung (General Error) */}
              {generalError && (
                <div className="flex items-center gap-2 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-rose-700 dark:text-rose-400 text-xs font-medium">
                  <XCircle className="w-4 h-4 shrink-0" />
                  <span>{generalError}</span>
                </div>
              )}

              {/* Thông báo thành công */}
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
                color="primary"
                variant="solid"
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs px-4"
                onPress={handleSubmit}
                isLoading={isSubmitting}
                isDisabled={
                  !selectedPlcId ||
                  Boolean(
                    conflictError &&
                      ((conflictError.code === 'DEST_MACHINE_HAS_PLC' && !confirmDestReplace) ||
                        (conflictError.code === 'PLC_BELONGS_TO_ANOTHER_MACHINE' && !confirmSourceTransfer) ||
                        (conflictError.code === 'DUAL_CONFIRMATION_REQUIRED' &&
                          (!confirmDestReplace || !confirmSourceTransfer)))
                  )
                }
                startContent={!isSubmitting && <ArrowRightLeft className="w-3.5 h-3.5" />}
              >
                {conflictError ? 'Xác nhận Chuyển giao / Thay thế' : 'Xác nhận Gán Trạm PLC'}
              </Button>
            </ModalFooter>
          </>
        )}
      </ModalContent>
    </Modal>
  );
}
