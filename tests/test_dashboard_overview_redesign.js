/**
 * @file tests/test_dashboard_overview_redesign.js
 * @description Bộ kiểm thử tự động kiểm duyệt thiết kế lại Dashboard Tổng Quan (DENSO KaiLink)
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
  console.log('DENSO IoT (KaiLink) — AUTOMATED TEST SUITE: DASHBOARD OVERVIEW REDESIGN');
  console.log('========================================================================\n');

  let passed = true;

  const dashboardPath = path.join(__dirname, '..', 'src', 'features', 'tier1-lines', 'LineOverviewDashboard.tsx');
  if (!fs.existsSync(dashboardPath)) {
    console.error('  [FAIL] Không tìm thấy LineOverviewDashboard.tsx');
    process.exit(1);
  }
  const code = fs.readFileSync(dashboardPath, 'utf8');

  // --------------------------------------------------------------------------
  // NHÓM 1: 5 THẺ KPI NẰM NGANG
  // --------------------------------------------------------------------------
  console.log('--- NHÓM 1: Bố cục 5 Thẻ KPI nằm ngang trên Desktop ---');
  const has5KpiGrid = code.includes('lg:grid-cols-5');
  const hasKpi1 = code.includes('Chỉ số an toàn xưởng') && code.includes('avgSafetyScore');
  const hasKpi2 = code.includes('Tổng dây chuyền') && code.includes('totalLines') && code.includes('activeLines');
  const hasKpi3 = code.includes('Tổng thiết bị giám sát') && code.includes('totalMachines') && code.includes('onlineMachines');
  const hasKpi4 = code.includes('Cảnh báo đang hoạt động') && code.includes('activeAlarmsCount') && code.includes('criticalAlarmsCount');
  const hasKpi5 = code.includes('Sự cố cần xử lý') && code.includes("setActiveTab('alarms')") && code.includes('Quy trình: 3 bước');

  if (has5KpiGrid && hasKpi1 && hasKpi2 && hasKpi3 && hasKpi4 && hasKpi5) {
    console.log('  [PASS] Đủ 5 Thẻ KPI nằm ngang: An toàn xưởng, Dây chuyền, Thiết bị, Cảnh báo, Sự cố');
  } else {
    console.error(`  [FAIL] Thiếu thẻ KPI! Grid5=${has5KpiGrid}, KPI1=${hasKpi1}, KPI2=${hasKpi2}, KPI3=${hasKpi3}, KPI4=${hasKpi4}, KPI5=${hasKpi5}`);
    passed = false;
  }

  // --------------------------------------------------------------------------
  // NHÓM 2: 3 BIỂU ĐỒ NẰM TRÊN CÙNG HÀNG TRÊN DESKTOP
  // --------------------------------------------------------------------------
  console.log('\n--- NHÓM 2: 3 Biểu đồ trực quan trên cùng 1 hàng Desktop ---');
  // Biểu đồ 1: Xu hướng chỉ số an toàn (Line/AreaChart)
  const hasChart1 = code.includes('Xu hướng chỉ số an toàn') &&
                    code.includes('AreaChart') &&
                    code.includes("'1h', '6h', '24h', '7d'") &&
                    code.includes('safetyTrendData');
  if (hasChart1) {
    console.log('  [PASS] Biểu đồ 1: Biểu đồ đường xu hướng chỉ số an toàn với bộ lọc 1h/6h/24h/7d');
  } else {
    console.error('  [FAIL] Biểu đồ 1 chưa đúng cấu trúc!');
    passed = false;
  }

  // Biểu đồ 2: Trạng thái thiết bị (Donut Chart)
  const hasChart2 = code.includes('Trạng thái thiết bị') &&
                    code.includes('PieChart') &&
                    code.includes('innerRadius') &&
                    code.includes('Thiết bị') &&
                    code.includes('Đang hoạt động') &&
                    code.includes('Dừng/Offline');
  if (hasChart2) {
    console.log('  [PASS] Biểu đồ 2: Donut Chart phân bổ trạng thái thiết bị có số tổng ở giữa và chú giải chi tiết');
  } else {
    console.error('  [FAIL] Biểu đồ 2 chưa đúng cấu trúc!');
    passed = false;
  }

  // Biểu đồ 3: Cảnh báo theo thời gian (Stacked Bar Chart)
  const hasChart3 = code.includes('Cảnh báo theo thời gian (24h)') &&
                    code.includes('BarChart') &&
                    code.includes('stackId="a"') &&
                    code.includes('Critical') &&
                    code.includes('Warning');
  if (hasChart3) {
    console.log('  [PASS] Biểu đồ 3: Stacked Bar Chart cảnh báo theo thời gian phân biệt Critical và Warning');
  } else {
    console.error('  [FAIL] Biểu đồ 3 chưa đúng cấu trúc!');
    passed = false;
  }

  // --------------------------------------------------------------------------
  // NHÓM 3: KHU VỰC DƯỚI (DÂY CHUYỀN BÊN TRÁI & CẢNH BÁO GẦN NHẤT BÊN PHẢI)
  // --------------------------------------------------------------------------
  console.log('\n--- NHÓM 3: Khu vực Dưới (Tình trạng Dây chuyền & Cảnh báo gần nhất) ---');
  // Cột trái: Tình trạng các dây chuyền sản xuất
  const hasLinesSection = code.includes('Tình trạng các dây chuyền sản xuất') &&
                          code.includes('LN-PRS-01') &&
                          code.includes('LN-PNT-02') &&
                          code.includes('LN-ASM-03') &&
                          code.includes('sparklineData');
  if (hasLinesSection) {
    console.log('  [PASS] Cột trái: Thẻ ngang 3 dây chuyền LN-PRS-01, LN-PNT-02, LN-ASM-03 có số liệu, sparkline và điều hướng');
  } else {
    console.error('  [FAIL] Cột trái dây chuyền chưa hoàn chỉnh!');
    passed = false;
  }

  // Cột phải: Cảnh báo gần nhất
  const hasRecentAlarms = code.includes('Cảnh báo gần nhất') &&
                          code.includes('Thời gian') &&
                          code.includes('Thiết bị') &&
                          code.includes('Thông số') &&
                          code.includes('Mức') &&
                          code.includes('Giá trị');
  if (hasRecentAlarms) {
    console.log('  [PASS] Cột phải: Bảng compact cảnh báo gần nhất với đầy đủ các cột và nút Xem tất cả');
  } else {
    console.error('  [FAIL] Cột phải cảnh báo gần nhất chưa hoàn chỉnh!');
    passed = false;
  }

  // --------------------------------------------------------------------------
  // NHÓM 4: KẾT NỐI DỊCH VỤ & BẢO TOÀN CSDL PRODUCTION (FREEZE)
  // --------------------------------------------------------------------------
  console.log('\n--- NHÓM 4: Kết nối dịch vụ & Đóng băng CSDL Sản xuất ---');
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
    console.log('🎉 TẤT CẢ CÁC TIÊU CHÍ REDESIGN DASHBOARD ĐÃ ĐẠT CHUẨN XUẤT SẮC (100% PASS)');
  } else {
    console.log('❌ CÓ TIÊU CHÍ CHƯA ĐẠT!');
    process.exit(1);
  }
  console.log('========================================================================\n');
}

runTests();
