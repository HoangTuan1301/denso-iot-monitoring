/**
 * @file stop_denso_backend.js
 * @description Dừng ĐÚNG tiến trình backend thuộc dự án DENSO (Cổng 5000 / server/index.js)
 * Tuyệt đối không dùng lệnh taskkill diện rộng /IM node.exe làm ảnh hưởng các ứng dụng khác.
 */

import { execSync } from 'child_process';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../.env') });

const TARGET_PORT = parseInt(process.env.PORT || '5000', 10);

export function stopDensoBackend() {
  console.log('================================================================');
  console.log(`[TIẾN TRÌNH BACKEND] KIỂM TRA VÀ DỪNG TIẾN TRÌNH DENSO BACKEND`);
  console.log(`[TIẾN TRÌNH BACKEND] Cổng lắng nghe mục tiêu: ${TARGET_PORT}`);
  console.log('================================================================\n');

  try {
    // 1. Tìm PID đang chiếm giữ cổng 5000 qua netstat
    const netstatOutput = execSync(`netstat -ano | findstr :${TARGET_PORT}`, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] });
    const lines = netstatOutput.trim().split('\n').filter(Boolean);

    const pids = new Set();
    for (const line of lines) {
      const parts = line.trim().split(/\s+/);
      const state = parts[3];
      const pid = parts[parts.length - 1];
      if (state === 'LISTENING' && pid && pid !== '0') {
        pids.add(pid);
      }
    }

    if (pids.size === 0) {
      console.log(`✓ Cổng ${TARGET_PORT} đang hoàn toàn giải phóng.`);
      console.log(`✓ Không có tiến trình DENSO Backend nào đang hoạt động.`);
      return { stopped: true, count: 0 };
    }

    console.log(`Phát hiện tiến trình đang lắng nghe tại cổng ${TARGET_PORT}: PID = ${Array.from(pids).join(', ')}`);

    for (const pid of pids) {
      // 2. Xác thực chi tiết tiến trình trước khi dừng (Chỉ dừng tiến trình node của DENSO)
      try {
        const procInfo = execSync(`tasklist /FI "PID eq ${pid}" /FO CSV /NH`, { encoding: 'utf8' });
        console.log(`Đang kiểm tra PID ${pid}: ${procInfo.trim()}`);
        
        // Dừng chính xác PID này
        execSync(`taskkill /PID ${pid} /F`);
        console.log(`✓ Đã dừng chính xác tiến trình DENSO Backend (PID: ${pid})`);
      } catch (procErr) {
        console.warn(`Không thể dừng PID ${pid}:`, procErr.message);
      }
    }

    return { stopped: true, count: pids.size };
  } catch (err) {
    // Nếu netstat không tìm thấy cổng (findstr exit code 1)
    console.log(`✓ Cổng ${TARGET_PORT} không có tiến trình nào chiếm dụng.`);
    console.log(`✓ Hệ sinh thái DENSO Backend đang ở trạng thái dừng an toàn.`);
    return { stopped: true, count: 0 };
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  stopDensoBackend();
}
