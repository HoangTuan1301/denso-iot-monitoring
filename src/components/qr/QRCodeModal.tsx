/**
 * @file QRCodeModal.tsx
 * @description Modal hiển thị và xuất mã QR nhận diện thiết bị công nghiệp (Tầng 2)
 */

import { 
  Modal, 
  ModalContent, 
  ModalHeader, 
  ModalBody, 
  ModalFooter, 
  Button, 
  Chip 
} from '@heroui/react';
import { QRCodeSVG } from 'qrcode.react';
import { Download, Printer, QrCode } from 'lucide-react';
import { MachineComponent } from '../../types/hierarchy';

interface QRCodeModalProps {
  machine: MachineComponent | null;
  isOpen: boolean;
  onClose: () => void;
}

export function QRCodeModal({ machine, isOpen, onClose }: QRCodeModalProps) {
  if (!machine) return null;

  // Dữ liệu payload mã QR chứa mã máy và liên kết truy cập nhanh
  const qrPayload = JSON.stringify({
    machineId: machine.id,
    lineId: machine.lineId,
    code: machine.qrCode,
    system: 'DENSO-IOT-MONITORING',
    timestamp: new Date().toISOString(),
  });

  // Tải mã QR dạng SVG
  const handleDownloadQR = () => {
    const svgElement = document.getElementById(`qr-code-${machine.id}`);
    if (!svgElement) return;

    const svgData = new XMLSerializer().serializeToString(svgElement);
    const blob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `QR_${machine.id}.svg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // In tem nhãn thiết bị
  const handlePrint = () => {
    window.print();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      backdrop="blur"
      size="md"
      classNames={{
        base: 'bg-factory-card border border-factory-border text-foreground',
        header: 'border-b border-factory-border pb-3',
        footer: 'border-t border-factory-border pt-3',
      }}
    >
      <ModalContent>
        {() => (
          <>
            <ModalHeader className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400">
                <QrCode className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Mã QR Định Danh Thiết Bị</h3>
                <p className="text-xs text-gray-400 font-mono">Tầng 2 &bull; {machine.id}</p>
              </div>
            </ModalHeader>

            <ModalBody className="py-6 flex flex-col items-center text-center">
              {/* Khung chứa mã QR thiết kế chuẩn tem nhãn công nghiệp */}
              <div className="bg-white p-5 rounded-2xl shadow-xl border-4 border-blue-500/30 flex flex-col items-center">
                <QRCodeSVG
                  id={`qr-code-${machine.id}`}
                  value={qrPayload}
                  size={200}
                  level="H"
                  includeMargin={true}
                />
                <div className="mt-2 text-center text-gray-900 font-mono">
                  <p className="font-extrabold text-sm tracking-wider">{machine.qrCode}</p>
                  <p className="text-[10px] text-gray-500">DENSO SMART FACTORY</p>
                </div>
              </div>

              {/* Thông tin thiết bị đính kèm */}
              <div className="w-full mt-5 bg-factory-bg/80 p-3.5 rounded-xl border border-factory-border/70 text-left space-y-2 text-xs">
                <div className="flex justify-between items-center">
                  <span className="text-gray-400">Tên thiết bị:</span>
                  <span className="font-semibold text-white">{machine.name}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-400">Model máy:</span>
                  <span className="font-mono text-blue-400 font-medium">{machine.model}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-400">Vị trí lắp đặt:</span>
                  <span className="text-gray-300">{machine.location}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-400">Trạng thái:</span>
                  <Chip
                    size="sm"
                    color={
                      machine.status === 'normal'
                        ? 'success'
                        : machine.status === 'warning'
                        ? 'warning'
                        : 'danger'
                    }
                    variant="flat"
                    className="capitalize text-[10px] font-mono"
                  >
                    {machine.status}
                  </Chip>
                </div>
              </div>
              <p className="text-[11px] text-gray-500 mt-2">
                * Thợ kỹ thuật có thể quét mã QR này bằng camera thiết bị để mở nhanh thông số Tầng 3.
              </p>
            </ModalBody>

            <ModalFooter className="flex justify-between">
              <Button size="sm" variant="light" color="default" onPress={onClose}>
                Đóng
              </Button>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="flat"
                  color="default"
                  startContent={<Printer className="w-4 h-4" />}
                  onPress={handlePrint}
                >
                  In Tem
                </Button>
                <Button
                  size="sm"
                  color="primary"
                  variant="solid"
                  startContent={<Download className="w-4 h-4" />}
                  onPress={handleDownloadQR}
                >
                  Tải Mã SVG
                </Button>
              </div>
            </ModalFooter>
          </>
        )}
      </ModalContent>
    </Modal>
  );
}
