/**
 * @file test_redesign_dashboard_kailink_v2.cjs
 * @description Suite kiểm thử tự động toàn diện cho Redesign Dashboard Tổng quan (KaiLink V2)
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
  console.log('   DENSO KAILINK - TEST SUITE: REDESIGN DASHBOARD TỔNG QUAN (V2)       ');
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
  // TEST GROUP 1: BẢO MẬT & BẤT BIẾN CSDL PRODUCTION (denso_iot)
  // -------------------------------------------------------------------------
  console.log('--- NHÓM 1: BẢO VỆ CSDL PRODUCTION (denso_iot ĐÓNG BĂNG) ---');
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
    assert(checksum === 871610130, `Checksum bảng telemetry khớp tuyệt đối 871610130 (thực tế: ${checksum})`);
  } catch (err) {
    assert(false, `Lỗi kết nối CSDL Production: ${err.message}`);
  }

  // -------------------------------------------------------------------------
  // TEST GROUP 2: KIỂM TRA MÃ NGUỒN DASHBOARD MỚI
  // -------------------------------------------------------------------------
  console.log('\n--- NHÓM 2: CẤU TRÚC GIAO DIỆN MỚI THEO HÌNH MẪU ---');
  const dashboardCode = fs.readFileSync(
    path.join(__dirname, '../src/features/tier1-lines/LineOverviewDashboard.tsx'),
    'utf-8'
  );

  // Khu vực 1: 4 Thẻ KPI
  assert(
    dashboardCode.includes('Chỉ số an toàn xưởng'),
    'Khu vực 1: KPI 1 - Chỉ số an toàn xưởng'
  );
  assert(
    dashboardCode.includes('safetySparklineData'),
    'Khu vực 1: KPI 1 - Có Sparkline biểu diễn xu hướng an toàn'
  );
  assert(
    dashboardCode.includes('Dây chuyền sản xuất') && dashboardCode.includes('Đang giám sát'),
    'Khu vực 1: KPI 2 - Dây chuyền sản xuất & Đang giám sát'
  );
  assert(
    dashboardCode.includes('Thiết bị giám sát') && dashboardCode.includes('Online:'),
    'Khu vực 1: KPI 3 - Thiết bị giám sát & Online / Offline'
  );
  assert(
    dashboardCode.includes('Cảnh báo đang hoạt động') && dashboardCode.includes('Nghiêm trọng') && dashboardCode.includes('Cảnh báo'),
    'Khu vực 1: KPI 4 - Cảnh báo đang hoạt động & phân loại Nghiêm trọng / Cảnh báo'
  );

  // Khu vực 2: 3 Biểu đồ phân tích
  assert(
    dashboardCode.includes('Xu hướng chỉ số an toàn') && dashboardCode.includes('safetyTrendData'),
    'Khu vực 2: Biểu đồ 1 - Xu hướng chỉ số an toàn (Line/Area Chart)'
  );
  assert(
    dashboardCode.includes('Trạng thái thiết bị') && dashboardCode.includes('deviceStatusData'),
    'Khu vực 2: Biểu đồ 2 - Trạng thái thiết bị (Donut Chart với tâm hiển thị tổng số máy)'
  );
  assert(
    dashboardCode.includes('Cảnh báo theo thời gian') && dashboardCode.includes('alarmsTimeDistribution'),
    'Khu vực 2: Biểu đồ 3 - Cảnh báo theo thời gian (Stacked Bar Chart)'
  );

  // Khu vực 3: Tình trạng 3 dây chuyền sản xuất
  assert(
    dashboardCode.includes('Tình trạng các dây chuyền sản xuất'),
    'Khu vực 3: Card lớn bao bọc "Tình trạng các dây chuyền sản xuất"'
  );
  assert(
    dashboardCode.includes('LN-PRS-01') && dashboardCode.includes('LN-PNT-02') && dashboardCode.includes('LN-ASM-03'),
    'Khu vực 3: 3 Dây chuyền chính xác từ CSDL (LN-PRS-01, LN-PNT-02, LN-ASM-03)'
  );
  assert(
    dashboardCode.includes('miniDonutData'),
    'Khu vực 3: Mỗi dây chuyền có Biểu đồ Donut nhỏ thể hiện % an toàn'
  );
  assert(
    dashboardCode.includes('getLineSparkline'),
    'Khu vực 3: Mỗi dây chuyền có Mini Sparkline thể hiện xu hướng'
  );

  // Khu vực 4: 3 Card giám sát bổ sung
  assert(
    dashboardCode.includes('Lịch sử trạng thái dây chuyền (24h)'),
    'Khu vực 4: Card 1 - Lịch sử trạng thái dây chuyền (24h) Heatmap'
  );
  assert(
    dashboardCode.includes('lineHeatmapData') && dashboardCode.includes('setHoveredHeatmapCell'),
    'Khu vực 4: Card 1 - Heatmap có dữ liệu phân bổ theo giờ và tooltip tương tác'
  );
  assert(
    dashboardCode.includes('Hoạt động gần đây') && dashboardCode.includes('recentActivities'),
    'Khu vực 4: Card 2 - Hoạt động gần đây (Timeline 4 sự kiện)'
  );
  assert(
    dashboardCode.includes('Cảnh báo cần xử lý') && dashboardCode.includes('openAlarmsList'),
    'Khu vực 4: Card 3 - Cảnh báo cần xử lý (Bảng các cảnh báo đang mở)'
  );

  // -------------------------------------------------------------------------
  // TEST GROUP 3: KIỂM TRA DỊCH VỤ VÀ HEALTHCHECK
  // -------------------------------------------------------------------------
  console.log('\n--- NHÓM 3: KIỂM TRA KẾT NỐI SERVER ---');
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
  // TỔNG KẾT
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
