/**
 * @file test_redesign_metric_catalog_thresholds.js
 * @description Suite kiểm thử tự động cho đợt Redesign Danh mục Thông số & Mapping/Ngưỡng cảnh báo
 * - Kiểm tra 4 thẻ thống kê: Tổng thông số, Đang hoạt động, Đã gán, Chưa gán
 * - Kiểm tra CRUD thông số & Component Assignment sync
 * - Kiểm tra Bố cục 2 cột Mapping: Danh sách máy, đếm metric & rule
 * - Kiểm tra Cấu hình Ngưỡng (Thresholds) Warning/Critical
 * - Kiểm tra Cấu hình Lịch thu thập (Collection Schedules)
 * - Kiểm tra Xóa/Bỏ gán mapping
 * - Kiểm tra CSDL denso_iot (PROD) đóng băng nguyên vẹn 16.924 bản ghi
 */

import http from 'http';
import mysql from 'mysql2/promise';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
dotenv.config();

const BASE_URL = 'http://localhost:5000';
const JWT_SECRET = process.env.JWT_SECRET || 'denso-iot-enterprise-jwt-secret-key-2026';
const authToken = jwt.sign(
  { id: 'usr-admin-01', email: 'admin@denso.com', role: 'ADMIN', name: 'Quản trị viên' },
  JWT_SECRET,
  { expiresIn: '1h' }
);

const DB_CONFIG_TEST = {
  host: 'localhost',
  user: 'root',
  password: process.env.DB_PASSWORD || '123456',
  database: 'denso_iot_phase1_test',
  port: 3306,
};

const DB_CONFIG_PROD = {
  host: 'localhost',
  user: 'root',
  password: process.env.DB_PASSWORD || '123456',
  database: 'denso_iot',
  port: 3306,
};

function request(method, path, body = null, token = authToken) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const req = http.request(
      url,
      { method, headers, timeout: 5000 },
      (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          let parsed;
          try {
            parsed = JSON.parse(data);
          } catch {
            parsed = data;
          }
          resolve({ status: res.statusCode, data: parsed });
        });
      }
    );

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error(`Timeout ${method} ${path}`));
    });

    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function runTests() {
  console.log('================================================================');
  console.log('🚀 BẮT ĐẦU TEST SUITE: REDESIGN METRIC CATALOG & THRESHOLDS');
  console.log('================================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  ✅ PASS: ${message}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${message}`);
      failed++;
    }
  }

  // 1. Xác thực Token ADMIN
  console.log('--- TEST 1: Xác thực Token ADMIN ---');
  assert(Boolean(authToken), 'Khởi tạo ADMIN Token hợp lệ với JWT_SECRET');

  // 2. Kiểm tra API tóm tắt 4 thẻ thống kê
  console.log('\n--- TEST 2: Kiểm tra 4 thẻ thống kê Danh mục Thông số (Summary API) ---');
  try {
    const summaryRes = await request('GET', '/api/metrics/summary');
    assert(summaryRes.status === 200, 'GET /api/metrics/summary trả về HTTP 200');
    const { total, active, assigned, unassigned } = summaryRes.data.summary;
    console.log(`    -> Tổng số: ${total}, Đang hoạt động: ${active}, Đã gán: ${assigned}, Chưa gán: ${unassigned}`);
    assert(typeof total === 'number' && total >= 10, `Tổng số metric hợp lệ (${total})`);
    assert(typeof active === 'number' && active >= 10, `Số metric hoạt động hợp lệ (${active})`);
    assert(typeof assigned === 'number' && assigned >= 1, `Số metric đã gán hợp lệ (${assigned})`);
    assert(typeof unassigned === 'number' && unassigned >= 1, `Số metric chưa gán hợp lệ (${unassigned})`);
    assert(assigned + unassigned === total, 'Công thức tổng: assigned + unassigned === total');
  } catch (err) {
    assert(false, `Lỗi kiểm tra Summary API: ${err.message}`);
  }

  // 3. Kiểm tra Danh mục Metric có kèm thông tin assignedCount & assignedMachineIds
  console.log('\n--- TEST 3: Kiểm tra trường assignedCount & assignedMachineIds trong danh mục ---');
  let testMetricId = null;
  let sampleMachineId = null;
  try {
    const metricsRes = await request('GET', '/api/metrics');
    assert(metricsRes.status === 200, 'GET /api/metrics trả về HTTP 200');
    assert(Array.isArray(metricsRes.data.metrics), 'Dữ liệu metrics là mảng');
    const mWithAssignments = metricsRes.data.metrics.find((m) => m.assignedCount > 0);
    assert(mWithAssignments !== undefined, `Tìm thấy metric đã được gán (VD: ${mWithAssignments?.code} gán vào ${mWithAssignments?.assignedCount} máy)`);
    if (mWithAssignments) {
      assert(Array.isArray(mWithAssignments.assignedMachineIds) && mWithAssignments.assignedMachineIds.length > 0, 'assignedMachineIds là mảng chứa các machine ID');
      sampleMachineId = mWithAssignments.assignedMachineIds[0];
    }
  } catch (err) {
    assert(false, `Lỗi kiểm tra metrics assignment: ${err.message}`);
  }

  // 4. Tạo Metric mới kèm gán Component ngay lúc tạo
  console.log('\n--- TEST 4: Tạo Metric mới kèm Component Assignment (Gán vào thiết bị) ---');
  const tempMetricCode = `TEST_METRIC_${Date.now().toString().slice(-5)}`;
  try {
    const createRes = await request('POST', '/api/metrics', {
      code: tempMetricCode,
      name: 'Áp Suất Kiểm Thử Tự Động',
      category: 'Pressure',
      unit: 'bar',
      dataType: 'FLOAT',
      validMin: 0,
      validMax: 300,
      description: 'Chỉ số kiểm thử tự động cho Giai đoạn Redesign UI',
      assignedMachineIds: sampleMachineId ? [sampleMachineId] : [],
    });

    assert(createRes.status === 201, `Tạo metric mới trả về HTTP 201 (${tempMetricCode})`);
    testMetricId = createRes.data.metric.id;

    // Kiểm tra metric vừa tạo đã được tự động gán vào machine
    const verifyMetricRes = await request('GET', `/api/metrics/${testMetricId}`);
    assert(verifyMetricRes.status === 200, 'GET metric vừa tạo thành công');
    if (sampleMachineId) {
      assert(verifyMetricRes.data.metric.assignedCount === 1, 'assignedCount cập nhật ngay thành 1');
      assert(verifyMetricRes.data.metric.assignedMachineIds.includes(sampleMachineId), 'assignedMachineIds chứa đúng machineId đã chọn');
    }
  } catch (err) {
    assert(false, `Lỗi tạo metric kèm assignment: ${err.message}`);
  }

  // 5. Kiểm tra Mapping vừa được sinh ra & Cấu hình Ngưỡng (Thresholds)
  console.log('\n--- TEST 5: Cấu hình Ngưỡng (Thresholds) Warning/Critical ---');
  let testMappingId = null;
  try {
    if (testMetricId && sampleMachineId) {
      const mappingsRes = await request('GET', `/api/mappings?metricId=${testMetricId}&machineId=${sampleMachineId}`);
      assert(mappingsRes.status === 200, 'Tìm mapping vừa tạo qua API mappings');
      assert(mappingsRes.data.mappings.length > 0, 'Tìm thấy mapping tự động cho metric');
      testMappingId = mappingsRes.data.mappings[0].id;

      // Cập nhật cấu hình ngưỡng
      const thresholdPayload = {
        warning_min: 20.0,
        warning_max: 80.0,
        critical_min: 10.0,
        critical_max: 95.0,
        action_plan: 'Kế hoạch xử lý cảnh báo tự động',
      };
      const putThresRes = await request('PUT', `/api/mappings/${testMappingId}/thresholds`, thresholdPayload);
      assert(putThresRes.status === 200, 'PUT /api/mappings/:id/thresholds trả về HTTP 200');

      // Đọc lại cấu hình ngưỡng
      const getThresRes = await request('GET', `/api/mappings/${testMappingId}/thresholds`);
      assert(getThresRes.status === 200, 'GET /api/mappings/:id/thresholds trả về HTTP 200');
      assert(Number(getThresRes.data.thresholds.warning_max) === 80.0, 'warning_max lưu chính xác 80.0');
      assert(Number(getThresRes.data.thresholds.critical_max) === 95.0, 'critical_max lưu chính xác 95.0');
    }
  } catch (err) {
    assert(false, `Lỗi cấu hình ngưỡng: ${err.message}`);
  }

  // 6. Cấu hình Lịch thu thập (Collection Schedules)
  console.log('\n--- TEST 6: Cấu hình Lịch thu thập (Collection Schedules) ---');
  try {
    if (testMappingId) {
      const schedulePayload = {
        frequency_type: 'INTERVAL',
        interval_seconds: 5,
        cron_expression: null,
        is_active: 1,
      };
      const putSchedRes = await request('PUT', `/api/mappings/${testMappingId}/schedule`, schedulePayload);
      assert(putSchedRes.status === 200, 'PUT /api/mappings/:id/schedule trả về HTTP 200');

      // Đọc lại cấu hình lịch
      const getSchedRes = await request('GET', `/api/mappings/${testMappingId}/schedule`);
      assert(getSchedRes.status === 200, 'GET /api/mappings/:id/schedule trả về HTTP 200');
      assert(getSchedRes.data.schedule.interval_seconds === 5, 'interval_seconds lưu chính xác 5 giây');
      assert(getSchedRes.data.schedule.frequency_type === 'INTERVAL', 'frequency_type lưu chính xác INTERVAL');
    }
  } catch (err) {
    assert(false, `Lỗi cấu hình lịch thu thập: ${err.message}`);
  }

  // 7. Xóa / Bỏ gán Mapping
  console.log('\n--- TEST 7: Xóa / Bỏ gán Mapping (DELETE /api/mappings/:id) ---');
  try {
    if (testMappingId) {
      const delRes = await request('DELETE', `/api/mappings/${testMappingId}`);
      assert(delRes.status === 200, 'DELETE /api/mappings/:id trả về HTTP 200');

      // Xác minh mapping đã bị xóa
      const checkRes = await request('GET', `/api/mappings/${testMappingId}`);
      assert(checkRes.status === 404, 'Mapping đã bị xóa, trả về HTTP 404');

      // Dọn dẹp metric test
      await request('DELETE', `/api/metrics/${testMetricId}`);
    }
  } catch (err) {
    assert(false, `Lỗi xóa mapping: ${err.message}`);
  }

  // 8. Kiểm tra tính toàn vẹn CSDL PROD denso_iot
  console.log('\n--- TEST 8: Kiểm tra CSDL PROD denso_iot đóng băng ở 16.924 bản ghi ---');
  let prodConnection = null;
  try {
    prodConnection = await mysql.createConnection(DB_CONFIG_PROD);
    const [rows] = await prodConnection.query('SELECT COUNT(*) AS total FROM machine_telemetry_history');
    const totalRecords = rows[0].total;
    console.log(`    -> Tổng số bản ghi machine_telemetry_history trong denso_iot (PROD): ${totalRecords}`);
    assert(totalRecords === 16924, `denso_iot (PROD) chính xác 16.924 bản ghi (Hiện tại: ${totalRecords})`);
  } catch (err) {
    assert(false, `Lỗi kết nối PROD DB: ${err.message}`);
  } finally {
    if (prodConnection) await prodConnection.end();
  }

  console.log('\n================================================================');
  console.log(`🎉 KẾT QUẢ TEST SUITE: ${passed} PASS / ${failed} FAIL`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTests().catch((err) => {
  console.error('Fatal Test Error:', err);
  process.exit(1);
});
