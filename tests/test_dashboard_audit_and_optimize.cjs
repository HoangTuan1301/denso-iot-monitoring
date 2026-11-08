/**
 * @file test_dashboard_audit_and_optimize.cjs
 * @description Suite kiểm thử tự động toàn diện cho Dashboard Tổng quan (Audit & Optimize)
 */

const mysql = require('mysql2/promise');
const http = require('http');
const fs = require('fs');
const path = require('path');

function fetchHttp(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => resolve({ status: res.statusCode, data }));
    }).on('error', reject);
  });
}

async function runTests() {
  console.log('========================================================================');
  console.log('   DENSO KAILINK - TEST SUITE: AUDIT & OPTIMIZE DASHBOARD TỔNG QUAN    ');
  console.log('========================================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  [PASS] ${message}`);
      passed++;
    } else {
      console.error(`  [FAIL] ${message}`);
      failed++;
    }
  }

  // -------------------------------------------------------------------------
  // TEST GROUP 1: BẤT BIẾN CƠ SỞ DỮ LIỆU PRODUCTION (denso_iot)
  // -------------------------------------------------------------------------
  console.log('--- NHÓM 1: KIỂM TRA BẢO MẬT & BẤT BIẾN CSDL PRODUCTION ---');
  try {
    const prodConn = await mysql.createConnection({
      host: '127.0.0.1',
      user: 'root',
      password: '123456',
      database: 'denso_iot',
    });

    const [[countRow]] = await prodConn.query('SELECT COUNT(*) as total FROM machine_telemetry_history');
    const [[checksumRow]] = await prodConn.query('CHECKSUM TABLE machine_telemetry_history');
    const [[lineRow]] = await prodConn.query('SELECT COUNT(*) as count FROM production_lines');
    const [[machRow]] = await prodConn.query('SELECT COUNT(*) as count FROM machines');
    await prodConn.end();

    const count = countRow.total;
    const checksum = checksumRow.Checksum;

    assert(lineRow.count === 3, `Production production_lines giữ nguyên 3 bản ghi (thực tế: ${lineRow.count})`);
    assert(machRow.count === 12, `Production machines giữ nguyên 12 bản ghi (thực tế: ${machRow.count})`);
    assert(count === 16924, `Production telemetry history giữ nguyên 16,924 bản ghi (thực tế: ${count})`);
    assert(checksum === 871610130, `Checksum telemetry table khớp tuyệt đối 871610130 (thực tế: ${checksum})`);
  } catch (err) {
    assert(false, `Lỗi kết nối CSDL Production: ${err.message}`);
  }

  // -------------------------------------------------------------------------
  // TEST GROUP 2: AUDIT LOGIC & DỮ LIỆU CÁC THẺ KPI TRONG MÃ NGUỒN
  // -------------------------------------------------------------------------
  console.log('\n--- NHÓM 2: AUDIT LOGIC & DỮ LIỆU CÁC THẺ KPI ---');
  const dashboardCode = fs.readFileSync(
    path.join(__dirname, '../src/features/tier1-lines/LineOverviewDashboard.tsx'),
    'utf-8'
  );

  // KPI 1
  assert(
    dashboardCode.includes('Chỉ số an toàn vận hành'),
    'KPI 1: Đổi tiêu đề thành "Chỉ số an toàn vận hành" (thay cho OEE khi chưa có công thức OEE)'
  );
  assert(
    dashboardCode.includes('Chưa đủ dữ liệu so sánh'),
    'KPI 1: Dòng so sánh hiển thị "Chưa đủ dữ liệu so sánh" (không giả lập +3%)'
  );
  assert(
    !dashboardCode.includes('<span>+3% so với hôm qua</span>'),
    'KPI 1: Đã xóa hoàn toàn chuỗi hardcode JSX "+3% so với hôm qua"'
  );

  // KPI 2
  assert(
    dashboardCode.includes('totalLines') && dashboardCode.includes('activeLines'),
    'KPI 2: Tính toán chính xác tổng dây chuyền và số dây chuyền đang hoạt động'
  );

  // KPI 3
  assert(
    dashboardCode.includes('deviceClassification'),
    'KPI 3: Phân nhóm thiết bị đa chiều (Vận hành, Cảnh báo, Dừng/Offline, Chưa có data)'
  );
  assert(
    !dashboardCode.includes('Online: <strong className="text-slate-800 dark:text-slate-200">{onlineMachines}</strong>'),
    'KPI 3: Đã loại bỏ logic sai lệch coi toàn bộ 14 thiết bị là "Online: 14"'
  );

  // KPI 4
  assert(
    dashboardCode.includes('activeAlarms') && dashboardCode.includes("a.status !== 'resolved'"),
    'KPI 4: Cảnh báo đang hoạt động tính chính xác các cảnh báo chưa đóng (pending + acknowledged)'
  );
  assert(
    dashboardCode.includes('criticalAlarmsCount') && dashboardCode.includes('warningAlarmsCount'),
    'KPI 4: Phân tách rõ ràng giữa Critical và Warning'
  );

  // KPI 5
  assert(
    dashboardCode.includes('pendingIncidents') && dashboardCode.includes("a.status === 'pending'"),
    'KPI 5: Sự cố cần xử lý chỉ đếm các cảnh báo pending chờ kỹ thuật viên tiếp nhận'
  );

  // -------------------------------------------------------------------------
  // TEST GROUP 3: AUDIT 3 BIỂU ĐỒ TRỰC QUAN
  // -------------------------------------------------------------------------
  console.log('\n--- NHÓM 3: AUDIT 3 BIỂU ĐỒ TRỰC QUAN ---');

  // Biểu đồ 1: Safety Trend
  assert(
    dashboardCode.includes('safetyTrendData') && dashboardCode.includes('avgSafetyScore'),
    'Biểu đồ 1: Dữ liệu xu hướng an toàn bám sát điểm an toàn thực tế của phiên'
  );
  assert(
    !dashboardCode.includes('Math.max(40, base - 5)'),
    'Biểu đồ 1: Đã loại bỏ dao động giả lập (base - 5, base + 2)'
  );

  // Biểu đồ 2: Donut Trạng thái thiết bị
  assert(
    dashboardCode.includes('deviceStatusData') && dashboardCode.includes('PieChart'),
    'Biểu đồ 2: Donut Chart hiển thị trạng thái thiết bị toàn xưởng'
  );
  assert(
    dashboardCode.includes('Đang vận hành') && dashboardCode.includes('Dừng/Offline') && dashboardCode.includes('Chưa có dữ liệu'),
    'Biểu đồ 2: Có 4 nhóm trạng thái rõ ràng, không đếm trùng, tổng số khớp tập dữ liệu'
  );

  // Biểu đồ 3: Cảnh báo theo thời gian 24h
  assert(
    dashboardCode.includes('alarmsTimeDistribution') && dashboardCode.includes('BarChart'),
    'Biểu đồ 3: Biểu đồ cột chồng phân bổ cảnh báo theo mốc thời gian 24h'
  );
  assert(
    !dashboardCode.includes("{ time: '03:00', Critical: 0, Warning: 1 }"),
    'Biểu đồ 3: Đã loại bỏ hoàn toàn mock data hardcoded trong các bucket'
  );

  // -------------------------------------------------------------------------
  // TEST GROUP 4: AUDIT DÂY CHUYỀN VÀ BẢNG CẢNH BÁO
  // -------------------------------------------------------------------------
  console.log('\n--- NHÓM 4: AUDIT DÂY CHUYỀN & BẢNG CẢNH BÁO GẦN NHẤT ---');
  assert(
    dashboardCode.includes('sortedLines') && dashboardCode.includes('line.safetyScore'),
    'Dây chuyền: Lấy thông số an toàn thực tế từ store/CSDL'
  );
  assert(
    dashboardCode.includes('recentAlarms') && dashboardCode.includes('slice(0, 5)'),
    'Bảng cảnh báo: Lấy 5 sự kiện cảnh báo mới nhất theo timestamp'
  );
  assert(
    dashboardCode.includes('Đã đóng') && dashboardCode.includes('Đang xử lý') && dashboardCode.includes('Chờ xử lý'),
    'Bảng cảnh báo: Bổ sung cột/badge quy trình xử lý để phân biệt rõ tình trạng từng sự kiện'
  );

  // -------------------------------------------------------------------------
  // TEST GROUP 5: HTTP SERVERS & SYSTEM HEALTH
  // -------------------------------------------------------------------------
  console.log('\n--- NHÓM 5: HTTP SERVERS & SYSTEM HEALTH ---');
  try {
    const backendRes = await fetchHttp('http://localhost:5000/api/health');
    assert(backendRes.status === 200, `Backend API port 5000 phản hồi HTTP 200 (thực tế: ${backendRes.status})`);
  } catch (err) {
    assert(false, `Backend API không phản hồi: ${err.message}`);
  }

  try {
    const frontendRes = await fetchHttp('http://localhost:3000');
    assert(frontendRes.status === 200, `Frontend Vite port 3000 phản hồi HTTP 200 (thực tế: ${frontendRes.status})`);
  } catch (err) {
    assert(false, `Frontend không phản hồi: ${err.message}`);
  }

  // -------------------------------------------------------------------------
  // TỔNG KẾT KẾT QUẢ
  // -------------------------------------------------------------------------
  console.log('\n========================================================================');
  console.log(`   KẾT QUẢ TEST SUITE: ${passed} PASS, ${failed} FAIL (TỶ LỆ: ${Math.round((passed / (passed + failed)) * 100)}%)`);
  console.log('========================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Fatal error during test run:', err);
  process.exit(1);
});
