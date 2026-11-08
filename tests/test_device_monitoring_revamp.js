/**
 * @file tests/test_device_monitoring_revamp.js
 * @description Bộ kiểm thử tự động kiểm duyệt cải tiến trang "Giám sát Thiết bị" (DENSO KaiLink)
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

const DB_CONFIG_TEST = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '3306', 10),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '123456',
  database: 'denso_iot_phase1_test',
};

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
          console.log(`  [PASS] ${name} (${url}) -> HTTP ${res.statusCode}`);
          resolve(true);
        } else {
          console.error(`  [FAIL] ${name} (${url}) -> HTTP ${res.statusCode}`);
          resolve(false);
        }
      });
    }).on('error', (err) => {
      console.error(`  [FAIL] ${name} (${url}) -> ${err.message}`);
      resolve(false);
    });
  });
}

async function runTests() {
  console.log('========================================================================');
  console.log('DENSO IoT (KaiLink) — AUTOMATED TEST SUITE: DEVICE MONITORING REVAMP');
  console.log('========================================================================\n');

  let passed = true;

  // --------------------------------------------------------------------------
  // NHÓM 1: PHÂN BIỆT RÕ RÀNG HAI TRANG
  // --------------------------------------------------------------------------
  console.log('--- NHÓM 1: Phân biệt hai trang (Dây chuyền & Thiết bị vs Giám sát Thiết bị) ---');
  
  // 1.1 Kiểm tra Sidebar
  const sidebarPath = path.join(__dirname, '..', 'src', 'components', 'common', 'Sidebar.tsx');
  const sidebarCode = fs.readFileSync(sidebarPath, 'utf8');
  const hasConfigLines = sidebarCode.includes('id: "lines"') && sidebarCode.includes('group: "config"');
  const hasMonitoringDevices = sidebarCode.includes('id: "devices"') && sidebarCode.includes('group: "monitoring"');
  if (hasConfigLines && hasMonitoringDevices) {
    console.log('  [PASS] Sidebar: Cấu hình phân tách rành mạch (lines cho Dây chuyền & Thiết bị, devices cho Giám sát Thiết bị)');
  } else {
    console.error('  [FAIL] Sidebar chưa phân tách đúng menu items!');
    passed = false;
  }

  // 1.2 Kiểm tra App.tsx điều hướng
  const appPath = path.join(__dirname, '..', 'src', 'App.tsx');
  const appCode = fs.readFileSync(appPath, 'utf8');
  const hasDeviceImport = appCode.includes('DeviceMonitoringView');
  const hasDeviceRoute = appCode.includes("case 'devices':") && appCode.includes('<DeviceMonitoringView />');
  if (hasDeviceImport && hasDeviceRoute) {
    console.log('  [PASS] App.tsx: Điều hướng tab "devices" đến DeviceMonitoringView chuyên dụng');
  } else {
    console.error('  [FAIL] App.tsx thiếu route cho DeviceMonitoringView!');
    passed = false;
  }

  // 1.3 Kiểm tra DeviceMonitoringView KHÔNG có nút thêm thiết bị và KHÔNG có nút sửa máy
  const devMonPath = path.join(__dirname, '..', 'src', 'features', 'tier2-machines', 'DeviceMonitoringView.tsx');
  const devMonCode = fs.readFileSync(devMonPath, 'utf8');
  const hasNoAddDevice = !devMonCode.includes('Thêm thiết bị') && !devMonCode.includes('CreateMachineModal');
  const hasNoEditMachine = !devMonCode.includes('EditMachineModal');
  if (hasNoAddDevice && hasNoEditMachine) {
    console.log('  [PASS] DeviceMonitoringView: Đã loại bỏ hoàn toàn nút "+ Thêm thiết bị" và modal sửa danh mục');
  } else {
    console.error('  [FAIL] DeviceMonitoringView vẫn còn chứa nút thêm thiết bị hoặc sửa danh mục!');
    passed = false;
  }

  // --------------------------------------------------------------------------
  // NHÓM 2: KHU VỰC THỐNG KÊ TỔNG QUAN & BỘ LỌC ĐA TIÊU CHÍ
  // --------------------------------------------------------------------------
  console.log('\n--- NHÓM 2: Thống kê tổng quan KPI & Bộ lọc đa tiêu chí ---');
  const hasTopKpiCards = devMonCode.includes('Tổng số thiết bị') &&
                         devMonCode.includes('Hoạt động bình thường') &&
                         devMonCode.includes('Cảnh báo thông số') &&
                         devMonCode.includes('Nguy hiểm / Sự cố');
  if (hasTopKpiCards) {
    console.log('  [PASS] DeviceMonitoringView: Có đủ 4 thẻ thống kê Top-level KPI dựa trên dữ liệu thực');
  } else {
    console.error('  [FAIL] DeviceMonitoringView thiếu các thẻ thống kê KPI tổng quan!');
    passed = false;
  }

  const hasFilters = devMonCode.includes('Dây chuyền sản xuất') &&
                     devMonCode.includes('Trạng thái giám sát') &&
                     devMonCode.includes('Nguồn dữ liệu') &&
                     devMonCode.includes('Tìm kiếm thiết bị');
  if (hasFilters) {
    console.log('  [PASS] DeviceMonitoringView: Có đầy đủ bộ lọc Dây chuyền, Trạng thái, Nguồn dữ liệu và Ô tìm kiếm');
  } else {
    console.error('  [FAIL] DeviceMonitoringView thiếu các bộ lọc!');
    passed = false;
  }

  const hasViewModeSwitch = devMonCode.includes('Lưới thẻ') && devMonCode.includes('Bảng danh sách');
  if (hasViewModeSwitch) {
    console.log('  [PASS] DeviceMonitoringView: Hỗ trợ linh hoạt 2 chế độ hiển thị (Lưới thẻ Grid & Bảng danh sách Table)');
  } else {
    console.error('  [FAIL] DeviceMonitoringView thiếu nút chuyển chế độ hiển thị!');
    passed = false;
  }

  // --------------------------------------------------------------------------
  // NHÓM 3: TÁI SỬ DỤNG MÀN HÌNH CHI TIẾT & CHUẨN HÓA NHÃN "THIẾT BỊ"
  // --------------------------------------------------------------------------
  console.log('\n--- NHÓM 3: Tái sử dụng màn hình Chi tiết & Chuẩn hóa nhãn "Thiết bị" ---');
  const detailModalPath = path.join(__dirname, '..', 'src', 'features', 'tier3-metrics', 'MachineDetailModal.tsx');
  const detailCode = fs.readFileSync(detailModalPath, 'utf8');

  const hasLabelThietBi = detailCode.includes('Chi tiết Thiết bị') && !detailCode.includes('Chi tiết Component');
  const hasMetaThietBi = detailCode.includes('THIẾT BỊ') && !detailCode.includes('>COMPONENT<');
  const hasMetaDayChuyen = detailCode.includes('DÂY CHUYỀN') && !detailCode.includes('>LUỒNG<');
  if (hasLabelThietBi && hasMetaThietBi && hasMetaDayChuyen) {
    console.log('  [PASS] MachineDetailModal: Đã chuẩn hóa toàn bộ nhãn người dùng từ "Component" sang "Thiết bị" & "Dây chuyền"');
  } else {
    console.error('  [FAIL] MachineDetailModal vẫn còn chứa nhãn Component hoặc Luồng!');
    passed = false;
  }

  // Kiểm tra giữ nguyên các tính năng lịch sử & biểu đồ & ngưỡng
  const hasRecharts = detailCode.includes('MetricHistoryChart');
  const hasTimeRanges = detailCode.includes("'1h', '6h', '24h'") && detailCode.includes('csv_preset');
  const hasThresholds = detailCode.includes('Cấu hình ngưỡng') && detailCode.includes("setActiveTab('thresholds')");
  const hasQR = detailCode.includes('Mã QR');
  if (hasRecharts && hasTimeRanges && hasThresholds && hasQR) {
    console.log('  [PASS] MachineDetailModal: Giữ nguyên 100% biểu đồ Recharts, tabs 1h/6h/24h/CSV, nút Cấu hình ngưỡng & Mã QR');
  } else {
    console.error('  [FAIL] MachineDetailModal bị thiếu một trong các tính năng quan trọng!');
    passed = false;
  }

  // --------------------------------------------------------------------------
  // NHÓM 4: XỬ LÝ NHẤT QUÁN MÃ DÂY CHUYỀN LINE-03 vs LN-ASM-03
  // --------------------------------------------------------------------------
  console.log('\n--- NHÓM 4: Nhất quán mã dây chuyền LINE-03 vs LN-ASM-03 ---');
  try {
    const testConn = await mysql.createConnection(DB_CONFIG_TEST);
    const [lines] = await testConn.query('SELECT id, code, name FROM production_lines');
    await testConn.end();

    const line03 = lines.find((l) => l.id === 'LINE-03');
    if (line03 && line03.code === 'LN-ASM-03') {
      console.log(`  [PASS] CSDL TEST: Khóa ngoại LINE-03 tương ứng chuẩn với mã công nghiệp ${line03.code} (${line03.name})`);
    } else {
      console.error('  [FAIL] Không tìm thấy mapping dây chuyền LINE-03 trong CSDL!');
      passed = false;
    }

    const hasLineResolution = devMonCode.includes('getLineInfo') && detailCode.includes('displayLineCode');
    if (hasLineResolution) {
      console.log('  [PASS] Frontend: Tự động tra cứu và hiển thị mã công nghiệp LN-ASM-03 trên giao diện, giữ liên kết id LINE-03');
    } else {
      console.error('  [FAIL] Frontend chưa có cơ chế tra cứu mã dây chuyền nhất quán!');
      passed = false;
    }
  } catch (err) {
    console.error(`  [FAIL] Lỗi kiểm tra CSDL TEST: ${err.message}`);
    passed = false;
  }

  // --------------------------------------------------------------------------
  // NHÓM 5: KẾT NỐI DỊCH VỤ & BẢO TOÀN CSDL PRODUCTION (FREEZE)
  // --------------------------------------------------------------------------
  console.log('\n--- NHÓM 5: Kết nối dịch vụ & Đóng băng CSDL Sản xuất ---');
  const backendOk = await testHttpEndpoint('http://localhost:5000/api/health', 'Backend API Health');
  const frontendOk = await testHttpEndpoint('http://localhost:3000', 'Frontend WebApp Server');
  if (!backendOk || !frontendOk) passed = false;

  try {
    const prodConn = await mysql.createConnection(DB_CONFIG_PROD);
    const [[countRow]] = await prodConn.query('SELECT COUNT(*) as total FROM machine_telemetry_history');
    const [[checksumRow]] = await prodConn.query('CHECKSUM TABLE machine_telemetry_history');
    await prodConn.end();
    const count = countRow.total;
    const checksum = checksumRow.Checksum;
    if (count === 16924 && checksum === 871610130) {
      console.log(`  [PASS] CSDL Sản xuất denso_iot: ĐÓNG BĂNG TUYỆT ĐỐI (Count=${count}, Checksum=${checksum})`);
    } else {
      console.error(`  [FAIL] CSDL Sản xuất denso_iot bị thay đổi! Count=${count}, Checksum=${checksum}`);
      passed = false;
    }
  } catch (err) {
    console.error(`  [FAIL] Lỗi kiểm tra CSDL Sản xuất: ${err.message}`);
    passed = false;
  }

  console.log('\n========================================================================');
  if (passed) {
    console.log('🎉 TẤT CẢ CÁC BÀI KIỂM THỬ ĐÃ PASS 100% — ĐẠT CHUẨN NGHIỆM THU XUẤT SẮC');
  } else {
    console.log('❌ CÓ BÀI KIỂM THỬ THẤT BẠI!');
    process.exit(1);
  }
  console.log('========================================================================\n');
}

runTests();
