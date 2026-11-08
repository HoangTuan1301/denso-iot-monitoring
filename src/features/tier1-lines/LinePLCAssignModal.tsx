/**
 * @file LinePLCAssignModal.tsx
 * @description Modal Gán hoặc Chuyển giao Trạm PLC cho Dây chuyền sản xuất (Tầng 1)
 * Kiến trúc DENSO IoT: 1 Dây chuyền gắn tối đa 1 PLC, 1 PLC chỉ thuộc 1 Dây chuyền.
 * Hỗ trợ Dual Confirmation (409 Conflict) và Validation kiểm tra PLC Demo / Vô hiệu hóa (422).
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
import { ProductionLine } from '../../types/hierarchy';
import { apiClient } from '../../services/api';
import { useMonitoringStore } from '../../stores/useMonitoringStore';

interface LinePLCAssignModalProps {
  isOpen: boolean;
  onClose: () => void;
  line: ProductionLine | null;
  onAssigned?: () => void;
}

export function LinePLCAssignModal({
  isOpen,
  onClose,
  line,
  onAssigned,
}: LinePLCAssignModalProps) {
  const { assignLinePLC } = useMonitoringStore();

  const [stations, setStations] = useState<any[]>([]);
  const [isLoadingStations, setIsLoadingStations] = useState(false);
  const [selectedPlcId, setSelectedPlcId] = useState<string>('');

  const [confirmDestReplace, setConfirmDestReplace] = useState(false);
  const [confirmSourceTransfer, setConfirmSourceTransfer] = useState(false);

  const [conflictError, setConflictError] = useState<{
    code: string;
    message: string;
    currentPlcName?: string;
    sourceLineName?: string;
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
          const currentPlcId = line?.plc?.id || line?.plcId;
          if (currentPlcId) {
            setSelectedPlcId(currentPlcId);
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
  }, [isOpen, line]);

  if (!line) return null;

  const currentPlcId = line.plc?.id || line.plcId;
  const selectedPlc = stations.find((s) => s.id === selectedPlcId);
  const isTargetAlreadyHasPlc = Boolean(currentPlcId && currentPlcId !== selectedPlcId);
  const isSelectedPlcBelongsToOther = Boolean(
    selectedPlc?.line_id && selectedPlc.line_id !== line.id
  );

  const isDemoPLC = Boolean(selectedPlc?.is_demo);
  const isDisabledPLC = selectedPlc && selectedPlc.enabled === 0;

  const handleSubmit = async () => {
    if (!selectedPlcId) {
      setGeneralError('Vui lòng chọn một trạm PLC.');
      return;
    }

    if (isDemoPLC) {
      setGeneralError('Không được phép gán trạm PLC Demo cho dây chuyền sản xuất thực tế.');
      return;
    }

    if (isDisabledPLC) {
      setGeneralError('Trạm PLC này đang bị vô hiệu hóa, không được phép gán vận hành.');
      return;
    }

    setIsSubmitting(true);
    setGeneralError(null);
    setConflictError(null);

    try {
      const res = await assignLinePLC(line.id, selectedPlcId, {
        confirmDestReplace,
        confirmSourceTransfer,
      });

      setSuccessMessage(res.message || 'Gán trạm PLC cho dây chuyền thành công!');
      setTimeout(() => {
        onAssigned?.();
        onClose();
      }, 700);
    } catch (err: any) {
      console.warn('[Assign Line PLC Error]:', err);
      if (err.status === 409 || err.errorCode) {
        setConflictError({
          code: err.errorCode || 'CONFLICT',
          message: err.message || 'Xung đột khi gán trạm PLC.',
          currentPlcName: err.currentPlcName,
          sourceLineName: err.sourceLineName,
        });

        if (err.errorCode === 'DUAL_CONFIRMATION_REQUIRED') {
          // Người dùng cần tick cả 2
        } else if (err.errorCode === 'DEST_LINE_HAS_PLC') {
          setConfirmDestReplace(true);
        } else if (err.errorCode === 'PLC_BELONGS_TO_ANOTHER_LINE') {
          setConfirmSourceTransfer(true);
        }
      } else {
        setGeneralError(err.message || 'Có lỗi xảy ra khi gán trạm PLC cho dây chuyền.');
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
              <div className="p-2 bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-lg">
                <Cpu className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Gán / Chuyển Giao Trạm PLC Cho Dây Chuyền
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-normal">
                  Dây chuyền: <span className="font-semibold text-slate-700 dark:text-slate-300">{line.name}</span> ({line.code})
                </p>
              </div>
            </ModalHeader>

            <ModalBody className="py-4 space-y-4 max-h-[70vh] overflow-y-auto">
              {/* Thông tin hiện tại của Dây chuyền */}
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    Trạng Thái Trạm PLC Hiện Tại Của Dây Chuyền
                  </span>
                  {currentPlcId ? (
                    <Chip size="sm" color="success" variant="flat" className="font-semibold">
                      Đã gán PLC
                    </Chip>
                  ) : (
                    <Chip size="sm" color="default" variant="flat" className="text-slate-500 font-semibold">
                      Chưa gán PLC
                    </Chip>
                  )}
                </div>

                {currentPlcId ? (
                  <div className="flex items-center justify-between text-xs pt-1">
                    <span className="font-medium text-slate-700 dark:text-slate-300">
                      {line.plc?.name || line.plcName || currentPlcId}
                    </span>
                    <span className="font-mono text-slate-500">{currentPlcId}</span>
                  </div>
                ) : (
                  <p className="text-xs text-slate-500 italic">
                    Dây chuyền chưa được liên kết với bất kỳ trạm PLC nào. Các máy trong dây chuyền hiện chưa có nguồn PLC.
                  </p>
                )}
              </div>

              {/* Lựa chọn trạm PLC */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                  <span>Chọn Trạm PLC Liên Kết:</span>
                  {isLoadingStations && (
                    <span className="text-[11px] text-blue-500 flex items-center gap-1">
                      <Loader2 className="w-3 h-3 animate-spin" /> Đang tải danh sách...
                    </span>
                  )}
                </label>

                <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                  {stations.length === 0 && !isLoadingStations && (
                    <div className="text-center py-6 text-xs text-slate-500 border border-dashed rounded-xl">
                      Không có trạm PLC nào trong hệ thống.
                    </div>
                  )}

                  {stations.map((st) => {
                    const isSelected = st.id === selectedPlcId;
                    const isCurDemo = Boolean(st.is_demo);
                    const isCurDisabled = st.enabled === 0;
                    const isCurAssignedToOther = st.line_id && st.line_id !== line.id;
                    const isCurAssignedToThis = st.line_id === line.id;

                    return (
                      <div
                        key={st.id}
                        onClick={() => setSelectedPlcId(st.id)}
                        className={`p-3 rounded-xl border text-xs cursor-pointer transition-all ${
                          isSelected
                            ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-950/30 shadow-xs'
                            : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-white dark:bg-slate-900/30'
                        } ${isCurDemo || isCurDisabled ? 'opacity-80' : ''}`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-slate-900 dark:text-white">
                                {st.name}
                              </span>
                              {isCurDemo && (
                                <Chip size="sm" color="warning" variant="flat" className="text-[10px] h-5">
                                  PLC Demo
                                </Chip>
                              )}
                              {isCurDisabled && (
                                <Chip size="sm" color="danger" variant="flat" className="text-[10px] h-5">
                                  Vô hiệu hóa
                                </Chip>
                              )}
                              {isCurAssignedToThis && (
                                <Chip size="sm" color="success" variant="flat" className="text-[10px] h-5">
                                  Đang gắn dây chuyền này
                                </Chip>
                              )}
                            </div>
                            <div className="flex items-center gap-3 text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                              <span>Mã: {st.id}</span>
                              <span>Giao thức: {st.protocol}</span>
                              <span>IP: {st.ipAddress}:{st.port}</span>
                            </div>
                          </div>

                          <div className="shrink-0 flex items-center">
                            <input
                              type="radio"
                              name="plc_station_line_select"
                              checked={isSelected}
                              onChange={() => setSelectedPlcId(st.id)}
                              className="text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer"
                            />
                          </div>
                        </div>

                        {isCurAssignedToOther && (
                          <div className="mt-2 text-[11px] text-amber-600 dark:text-amber-400 flex items-center gap-1.5 pt-1.5 border-t border-slate-100 dark:border-slate-800/80">
                            <ArrowRightLeft className="w-3.5 h-3.5 shrink-0" />
                            <span>Đang thuộc dây chuyền khác: <span className="font-semibold">{st.line_id}</span></span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Cảnh báo an toàn nếu chọn PLC Demo hoặc PLC bị vô hiệu hóa */}
              {isDemoPLC && (
                <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-400 text-xs flex items-start gap-2.5">
                  <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold">Không được phép gán trạm PLC Demo</p>
                    <p className="mt-0.5 text-[11px] opacity-90">
                      Chính sách an toàn DENSO nghiêm cấm gắn trạm PLC Demo vào dây chuyền sản xuất thật. Vui lòng chọn một trạm PLC công nghiệp hợp lệ.
                    </p>
                  </div>
                </div>
              )}

              {isDisabledPLC && (
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-700 dark:text-rose-400 text-xs flex items-start gap-2.5">
                  <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold">Trạm PLC đang bị vô hiệu hóa</p>
                    <p className="mt-0.5 text-[11px] opacity-90">
                      Không thể kích hoạt kết nối với trạm PLC bị vô hiệu hóa. Vui lòng bật kích hoạt trạm PLC trong phần Quản lý Trạm PLC trước.
                    </p>
                  </div>
                </div>
              )}

              {/* Khối xử lý Dual Confirmation (409 Conflict) */}
              {(isTargetAlreadyHasPlc || isSelectedPlcBelongsToOther || conflictError) && (
                <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-800 dark:text-amber-300 text-xs space-y-3">
                  <div className="flex items-start gap-2 font-bold">
                    <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
                    <span>Yêu Cầu Xác Nhận Thay Thế & Chuyển Giao Trạm PLC:</span>
                  </div>

                  {conflictError && (
                    <p className="text-[11px] text-rose-600 dark:text-rose-400 font-semibold bg-rose-50 dark:bg-rose-950/40 p-2 rounded-lg border border-rose-200 dark:border-rose-900">
                      {conflictError.message}
                    </p>
                  )}

                  <div className="space-y-2 pt-1">
                    {(isTargetAlreadyHasPlc || conflictError?.code === 'DEST_LINE_HAS_PLC' || conflictError?.code === 'DUAL_CONFIRMATION_REQUIRED') && (
                      <label className="flex items-start gap-2 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={confirmDestReplace}
                          onChange={(e) => setConfirmDestReplace(e.target.checked)}
                          className="mt-0.5 rounded text-amber-600 focus:ring-amber-500"
                        />
                        <span className="text-[11px] leading-snug">
                          <strong>Xác nhận thay thế trạm PLC hiện tại của Dây chuyền</strong>: Đồng ý gỡ bỏ trạm PLC cũ khỏi dây chuyền này. Các kênh đo lường liên kết của các máy trong dây chuyền sẽ được ngắt kết nối an toàn.
                        </span>
                      </label>
                    )}

                    {(isSelectedPlcBelongsToOther || conflictError?.code === 'PLC_BELONGS_TO_ANOTHER_LINE' || conflictError?.code === 'DUAL_CONFIRMATION_REQUIRED') && (
                      <label className="flex items-start gap-2 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={confirmSourceTransfer}
                          onChange={(e) => setConfirmSourceTransfer(e.target.checked)}
                          className="mt-0.5 rounded text-amber-600 focus:ring-amber-500"
                        />
                        <span className="text-[11px] leading-snug">
                          <strong>Xác nhận chuyển giao trạm PLC từ Dây chuyền khác</strong>: Đồng ý ngắt trạm PLC khỏi dây chuyền nguồn ({selectedPlc?.line_id || conflictError?.sourceLineName}) để chuyển giao sang dây chuyền này.
                        </span>
                      </label>
                    )}
                  </div>
                </div>
              )}

              {/* Thông báo lỗi chung */}
              {generalError && (
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400 text-xs flex items-center gap-2">
                  <XCircle className="w-4 h-4 shrink-0" />
                  <span>{generalError}</span>
                </div>
              )}

              {/* Thông báo thành công */}
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
                Đóng
              </Button>
              <Button
                size="sm"
                color="primary"
                onClick={handleSubmit}
                isLoading={isSubmitting}
                disabled={isSubmitting || !selectedPlcId || isDemoPLC || isDisabledPLC}
                className="font-bold bg-blue-600 hover:bg-blue-700 text-white"
              >
                Xác Nhận Gán PLC
              </Button>
            </ModalFooter>
          </>
        )}
      </ModalContent>
    </Modal>
  );
}
