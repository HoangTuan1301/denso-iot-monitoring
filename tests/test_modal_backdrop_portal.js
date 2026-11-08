/**
 * @file test_modal_backdrop_portal.js
 * @description Kiểm thử kiểm duyệt toàn diện giải pháp Modal Backdrop Portal trên DENSO KaiLink
 */

import fs from 'fs';
import path from 'path';
import http from 'http';
import { fileURLToPath } from 'url';
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DB_CONFIG_PROD = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '3306', 10),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '123456',
  database: 'denso_iot',
};

async function testHttpEndpoint(url, name) {
  return new Promise((resolve) => {
    http.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 400) {
          console.log(`[PASS] ${name} (${url}) -> HTTP ${res.statusCode}`);
          resolve(true);
        } else {
          console.error(`[FAIL] ${name} (${url}) -> HTTP ${res.statusCode}`);
          resolve(false);
        }
      });
    }).on('error', (err) => {
      console.error(`[FAIL] ${name} (${url}) -> ${err.message}`);
      resolve(false);
    });
  });
}

async function runAudit() {
  console.log('================================================================');
  console.log('AUDIT & VERIFICATION: MODAL BACKDROP PORTAL SOLUTION (DENSO IOT)');
  console.log('================================================================\n');

  let passed = true;

  // 1. Kiểm tra ModalPortal.tsx
  const portalPath = path.join(__dirname, '..', 'src', 'components', 'common', 'ModalPortal.tsx');
  if (fs.existsSync(portalPath)) {
    const portalCode = fs.readFileSync(portalPath, 'utf8');
    const hasCreatePortal = portalCode.includes('createPortal(');
    const hasDocumentBody = portalCode.includes('document.body');
    const hasZIndex = portalCode.includes('z-[9999]');
    const hasScrollLock = portalCode.includes('overflow = \'hidden\'');
    const hasEscape = portalCode.includes('Escape');

    if (hasCreatePortal && hasDocumentBody && hasZIndex && hasScrollLock && hasEscape) {
      console.log('[PASS] ModalPortal.tsx: Triển khai createPortal ra document.body với z-[9999], scroll lock, escape listener');
    } else {
      console.error('[FAIL] ModalPortal.tsx thiếu các tính năng bảo đảm!');
      passed = false;
    }
  } else {
    console.error('[FAIL] Không tìm thấy src/components/common/ModalPortal.tsx');
    passed = false;
  }

  // 2. Kiểm tra các modal nghiệp vụ đã tích hợp ModalPortal
  const targets = [
    {
      file: 'src/features/metrics/MetricCatalogView.tsx',
      name: 'MetricCatalogView (Form Modal, Status Modal, Delete Modal)',
      minCount: 3,
    },
    {
      file: 'src/features/admin/ThresholdConfigModal.tsx',
      name: 'ThresholdConfigModal (Cấu hình ngưỡng cảnh báo)',
      minCount: 1,
    },
    {
      file: 'src/features/admin/ScheduleConfigModal.tsx',
      name: 'ScheduleConfigModal (Lịch thu thập telemetry)',
      minCount: 1,
    },
    {
      file: 'src/features/admin/ThresholdConfigView.tsx',
      name: 'ThresholdConfigView (Xác nhận gỡ thông số khỏi thiết bị)',
      minCount: 1,
    },
    {
      file: 'src/features/tier2-machines/CreateMachineModal.tsx',
      name: 'CreateMachineModal (Thêm thiết bị mới)',
      minCount: 1,
    },
    {
      file: 'src/features/tier2-machines/EditMachineModal.tsx',
      name: 'EditMachineModal (Thông tin & Chỉnh sửa thiết bị)',
      minCount: 1,
    },
    {
      file: 'src/features/admin/UserManagementView.tsx',
      name: 'UserManagementView (Thêm/Sửa người dùng)',
      minCount: 1,
    },
    {
      file: 'src/features/alarms/AlarmLogView.tsx',
      name: 'AlarmLogView (Xác nhận hoàn thành sự cố)',
      minCount: 1,
    },
  ];

  for (const t of targets) {
    const filePath = path.join(__dirname, '..', t.file);
    if (fs.existsSync(filePath)) {
      const code = fs.readFileSync(filePath, 'utf8');
      const hasImport = code.includes('ModalPortal');
      const count = (code.match(/<ModalPortal/g) || []).length;
      if (hasImport && count >= t.minCount) {
        console.log(`[PASS] ${t.name}: Import ModalPortal và có ${count} thẻ <ModalPortal>`);
      } else {
        console.error(`[FAIL] ${t.name}: Import=${hasImport}, Count=${count} (yêu cầu >= ${t.minCount})`);
        passed = false;
      }
    } else {
      console.error(`[FAIL] Không tìm thấy ${t.file}`);
      passed = false;
    }
  }

  // 3. Kiểm tra HeroUI Modal backdrop CSS trong src/index.css
  const cssPath = path.join(__dirname, '..', 'src', 'index.css');
  if (fs.existsSync(cssPath)) {
    const cssCode = fs.readFileSync(cssPath, 'utf8');
    const hasBackdropSlot = cssCode.includes('div[data-slot="backdrop"]');
    const hasWrapperSlot = cssCode.includes('div[data-slot="wrapper"]');
    const hasZ9998 = cssCode.includes('9998');
    const hasZ9999 = cssCode.includes('9999');

    if (hasBackdropSlot && hasWrapperSlot && hasZ9998 && hasZ9999) {
      console.log('[PASS] src/index.css: Cấu hình z-index 9998/9999 và backdrop blur cho toàn bộ HeroUI Modals');
    } else {
      console.error('[FAIL] src/index.css thiếu CSS override cho HeroUI backdrop/wrapper');
      passed = false;
    }
  }

  // 4. Kiểm tra Backend & Frontend Health
  console.log('\n--- Kiểm tra kết nối dịch vụ ---');
  const backendOk = await testHttpEndpoint('http://localhost:5000/api/health', 'Backend Health');
  const frontendOk = await testHttpEndpoint('http://localhost:3000', 'Frontend WebApp');
  if (!backendOk || !frontendOk) passed = false;

  // 5. Kiểm tra CSDL PROD đóng băng
  console.log('\n--- Kiểm tra đóng băng CSDL PROD denso_iot ---');
  try {
    const conn = await mysql.createConnection(DB_CONFIG_PROD);
    const [[countRow]] = await conn.query('SELECT COUNT(*) as total FROM machine_telemetry_history');
    const [[checksumRow]] = await conn.query('CHECKSUM TABLE machine_telemetry_history');
    await conn.end();
    const count = countRow.total;
    const checksum = checksumRow.Checksum;
    if (count === 16924 && checksum === 871610130) {
      console.log(`[PASS] CSDL PROD denso_iot.machine_telemetry_history: ${count} bản ghi, Checksum ${checksum} (ĐÓNG BĂNG TUYỆT ĐỐI)`);
    } else {
      console.error(`[FAIL] CSDL PROD denso_iot bị thay đổi! Count=${count} (kỳ vọng 16924), Checksum=${checksum} (kỳ vọng 871610130)`);
      passed = false;
    }
  } catch (err) {
    console.error(`[FAIL] Lỗi kiểm tra CSDL PROD: ${err.message}`);
    passed = false;
  }

  console.log('\n================================================================');
  if (passed) {
    console.log('KẾT QUẢ KIỂM DUYỆT: TẤT CẢ TIÊU CHÍ ĐỀU ĐẠT CHUẨN XUẤT SẮC (100% PASS)');
  } else {
    console.log('KẾT QUẢ KIỂM DUYỆT: CÓ MỘT SỐ TIÊU CHÍ CHƯA ĐẠT');
    process.exit(1);
  }
  console.log('================================================================');
}

runAudit();
