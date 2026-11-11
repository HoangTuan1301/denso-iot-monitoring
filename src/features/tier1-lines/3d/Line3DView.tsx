/**
 * @file Line3DView.tsx
 * @description Màn hình điều phối chế độ xem 3D tương tác cho Line 1 (LN-PRS-01).
 * - Bao bọc WebGL Scene với Error Boundary và cơ chế phát hiện WebGL an toàn
 * - Cung cấp thanh công cụ điều khiển: Nút Đặt lại góc nhìn (Reset Camera), Chú giải trạng thái
 * - Cho phép chuyển đổi linh hoạt trở lại 2D mà không làm mất trạng thái
 */

import { useState, useEffect, useRef } from 'react';
import { RotateCcw, AlertTriangle, Box, Layers } from 'lucide-react';
import { Line3DScene } from './Line3DScene';
import { useThemeStore } from '../../../stores/useThemeStore';

interface StationFlowData {
  id: string;
  code: string;
  name: string;
  actualCode: string;
  status: 'OK' | 'WARNING' | 'CRITICAL' | 'STOPPED' | 'OFFLINE';
  statusLabel: string;
  machine?: any;
  resolved?: any;
}

interface Line3DViewProps {
  flowStations: StationFlowData[];
  onSelectMachine: (machineId: string) => void;
  onSwitchTo2D: () => void;
}

/**
 * Kiểm tra xem trình duyệt hiện tại có hỗ trợ WebGL hay không
 */
function isWebGLAvailable(): boolean {
  try {
    const canvas = document.createElement('canvas');
    return !!(
      window.WebGLRenderingContext &&
      (canvas.getContext('webgl') || canvas.getContext('experimental-webgl'))
    );
  } catch {
    return false;
  }
}

export function Line3DView({
  flowStations,
  onSelectMachine,
  onSwitchTo2D,
}: Line3DViewProps) {
  const theme = useThemeStore((state) => state.theme);
  const isDarkMode = theme === 'dark';

  const [hasWebGLError, setHasWebGLError] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Tham chiếu hàm Reset camera từ Scene
  const resetCameraFnRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (!isWebGLAvailable()) {
      setHasWebGLError(true);
      setErrorMessage('Trình duyệt hoặc phần cứng hiện tại không hỗ trợ WebGL tăng tốc đồ họa.');
    }
  }, []);

  const handleResetCamera = () => {
    if (resetCameraFnRef.current) {
      resetCameraFnRef.current();
    }
  };

  // NẾU WEBGL KHÔNG KHẢ DỤNG: Fallback hiển thị thông báo an toàn, không gây crash trang
  if (hasWebGLError) {
    return (
      <div className="p-8 text-center space-y-4 rounded-xl border border-amber-300 dark:border-amber-700/60 bg-amber-50/60 dark:bg-amber-950/20">
        <div className="w-12 h-12 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center mx-auto border border-amber-500/20">
          <AlertTriangle className="w-6 h-6" />
        </div>
        <div>
          <h4 className="text-sm font-bold text-slate-900 dark:text-white">
            Không thể kích hoạt bộ dựng hình 3D WebGL
          </h4>
          <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 max-w-md mx-auto">
            {errorMessage || 'Sự cố tương thích đồ họa. Hệ thống đã tự động bảo vệ dữ liệu giám sát.'}
          </p>
        </div>
        <button
          type="button"
          onClick={onSwitchTo2D}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-all shadow-xs cursor-pointer"
        >
          <Layers className="w-4 h-4" />
          <span>Quay lại Chế độ xem 2D</span>
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {/* 1. THANH CÔNG CỤ TƯƠNG TÁC 3D (Toolbar) */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 px-3 py-2 rounded-xl bg-slate-100/80 dark:bg-factory-surface border border-slate-200/80 dark:border-slate-800 text-xs">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 font-bold text-slate-800 dark:text-slate-200 font-mono text-[11px]">
            <Box className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
            <span>Line 1 Digital Twin (3D Realtime)</span>
          </span>
          <span className="text-[10px] text-slate-400 hidden sm:inline">•</span>
          <span className="text-[11px] text-slate-500 dark:text-slate-400 hidden sm:inline">
            Nhấn vào bất kỳ máy nào để mở Machine Detail & CHECK SHEET
          </span>
        </div>

        {/* Nút hành động Toolbar */}
        <div className="flex items-center gap-2 ml-auto">
          {/* Nút Reset Camera */}
          <button
            type="button"
            onClick={handleResetCamera}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 font-semibold text-[11px] shadow-2xs transition-colors cursor-pointer"
            title="Đặt lại camera về góc nhìn toàn cảnh mặc định"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Đặt lại góc nhìn</span>
          </button>
        </div>
      </div>

      {/* 2. THREE.JS 3D SCENE VIEWPORT */}
      <Line3DScene
        flowStations={flowStations}
        onSelectMachine={onSelectMachine}
        isDarkMode={isDarkMode}
        onResetCameraRef={(fn) => {
          resetCameraFnRef.current = fn;
        }}
      />
    </div>
  );
}
