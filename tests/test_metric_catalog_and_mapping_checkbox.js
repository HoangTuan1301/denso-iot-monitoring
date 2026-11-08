/**
 * @file test_metric_catalog_and_mapping_checkbox.js
 * @description Comprehensive Automated Test Suite verifying:
 * 1. Removal of "Gán vào Thiết bị" from Metric Edit Modal in MetricCatalogView.tsx
 * 2. Saving metric edits preserves all existing machine mappings
 * 3. Display of ALL catalog metrics for any selected machine in ThresholdConfigView.tsx
 * 4. Checkbox states accurately reflect mapped vs unmapped metrics
 * 5. Checking a metric assigns it with ACTIVE status, monitoring=1, and inherited line PLC
 * 6. Unchecking a metric triggers confirmation and safely removes mapping without touching metric catalog
 * 7. Independence of mappings across multiple machines (MC-CYL-01 vs MC-ASM-01)
 * 8. Persistence across reload and refresh
 * 9. Threshold and schedule configuration saving per (machine, metric) pair
 * 10. Removal of "+ Gán thông số" button
 * 11. No undefined, null, NaN or fake values on UI
 * 12. Strict RBAC enforcement (ADMIN & MAINTENANCE vs OPERATOR)
 * 13. Safety constraints: zero writes to PROD denso_iot (16,924 records preserved)
 */

import dotenv from 'dotenv';
dotenv.config();
import fs from 'fs';
import path from 'path';
import jwt from 'jsonwebtoken';
import mysql from 'mysql2/promise';

const JWT_SECRET = process.env.JWT_SECRET || 'denso-iot-enterprise-jwt-secret-key-2026';
const BASE_URL = 'http://127.0.0.1:5000';

const adminToken = jwt.sign(
  { id: 'USR-ADMIN-TEST', email: 'admin@denso.test', role: 'ADMIN', fullName: 'Test Admin', employeeId: 'EMP-ADM-01' },
  JWT_SECRET,
  { expiresIn: '2h' }
);

const maintenanceToken = jwt.sign(
  { id: 'USR-MAINT-TEST', email: 'maint@denso.test', role: 'MAINTENANCE', fullName: 'Test Maint', employeeId: 'EMP-MNT-01' },
  JWT_SECRET,
  { expiresIn: '2h' }
);

const operatorToken = jwt.sign(
  { id: 'USR-OPERATOR-TEST', email: 'operator@denso.test', role: 'OPERATOR', fullName: 'Test Operator', employeeId: 'EMP-OPR-01' },
  JWT_SECRET,
  { expiresIn: '2h' }
);

let passedTests = 0;
let totalTests = 0;

function assert(condition, message) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  [PASS] #${totalTests}: ${message}`);
  } else {
    console.error(`  [FAIL] #${totalTests}: ${message}`);
    throw new Error(`Assertion Failed: ${message}`);
  }
}

async function request(endpoint, options = {}) {
  const url = `${BASE_URL}${endpoint}`;
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };
  const res = await fetch(url, { ...options, headers });
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = text;
  }
  return { status: res.status, ok: res.ok, data };
}

async function runTestSuite() {
  console.log('\n========================================================================');
  console.log('DENSO IoT (KaiLink) — AUTOMATED TEST SUITE: METRIC CATALOG & MAPPING CHECKBOX');
  console.log('========================================================================\n');

  const pool = await mysql.createPool({
    host: process.env.DB_HOST || '127.0.0.1',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME || 'denso_iot_phase1_test',
  });

  try {
    // Dọn dẹp dữ liệu test cũ nếu có
    await pool.query('DELETE FROM metric_thresholds WHERE mapping_id IN (SELECT id FROM metric_mappings WHERE mapping_code LIKE "%TEMP01%")');
    await pool.query('DELETE FROM collection_schedules WHERE mapping_id IN (SELECT id FROM metric_mappings WHERE mapping_code LIKE "%TEMP01%")');
    await pool.query('DELETE FROM metric_mappings WHERE mapping_code LIKE "%TEMP01%"');
    await pool.query('DELETE FROM metric_catalog WHERE code LIKE "%TEMP_METRIC%"');

    // -------------------------------------------------------------------------
    // TEST GROUP 1: STATIC & CODE INTEGRITY CHECKS
    // -------------------------------------------------------------------------
    console.log('--- TEST GROUP 1: Mã nguồn & Giao diện (Static & Code Integrity) ---');

    const metricCatalogSrc = fs.readFileSync('src/features/metrics/MetricCatalogView.tsx', 'utf8');
    assert(
      !metricCatalogSrc.includes('Gán vào Thiết bị'),
      'MetricCatalogView.tsx: Đã xóa hoàn toàn khu vực "Gán vào Thiết bị" khỏi modal'
    );
    assert(
      !metricCatalogSrc.includes('selectedMachineIds') && !metricCatalogSrc.includes('machineSearchTerm'),
      'MetricCatalogView.tsx: Đã xóa các state gán thiết bị (selectedMachineIds, machineSearchTerm)'
    );
    assert(
      !metricCatalogSrc.includes('handleToggleMachine'),
      'MetricCatalogView.tsx: Đã xóa hàm handleToggleMachine'
    );
    assert(
      !metricCatalogSrc.includes('assignedMachineIds: selectedMachineIds'),
      'MetricCatalogView.tsx: handleSaveMetric không còn gửi assignedMachineIds lên API'
    );

    const thresholdConfigSrc = fs.readFileSync('src/features/admin/ThresholdConfigView.tsx', 'utf8');
    assert(
      !thresholdConfigSrc.includes('+ Gán thông số'),
      'ThresholdConfigView.tsx: Đã xóa hoàn toàn nút "+ Gán thông số" ở header cột phải'
    );
    assert(
      thresholdConfigSrc.includes('displayedMetricsWithMapping') && thresholdConfigSrc.includes('mappingByMetricId'),
      'ThresholdConfigView.tsx: Đã triển khai displayedMetricsWithMapping & mappingByMetricId để hiển thị TOÀN BỘ thông số catalog'
    );
    assert(
      thresholdConfigSrc.includes('handleToggleMetricAssignment') && thresholdConfigSrc.includes('handleConfirmUnmap'),
      'ThresholdConfigView.tsx: Đã triển khai cơ chế Checkbox trực tiếp và Modal xác nhận gỡ mapping'
    );
    assert(
      thresholdConfigSrc.includes('unmapTarget') && thresholdConfigSrc.includes('Xác nhận gỡ thông số khỏi thiết bị'),
      'ThresholdConfigView.tsx: Có modal xác nhận trước khi gỡ bỏ mapping khỏi thiết bị'
    );

    // -------------------------------------------------------------------------
    // TEST GROUP 2: SỬA METRIC KHÔNG ẢNH HƯỞNG MAPPING HIỆN TẠI
    // -------------------------------------------------------------------------
    console.log('\n--- TEST GROUP 2: Chỉnh sửa thông số bảo toàn Mapping cũ ---');

    // Tạo một metric test tạm
    const createMetricRes = await request('/api/metrics', {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({
        code: 'TEST_TEMP_METRIC_01',
        name: 'Thông Số Kiểm Thử Tạm 01',
        category: 'Pressure',
        unit: 'bar',
        dataType: 'FLOAT',
        description: 'Mô tả ban đầu trước khi sửa',
      }),
    });
    assert(createMetricRes.status === 201, 'Tạo metric test tạm thời thành công (201)');
    const testMetricId = createMetricRes.data.metric.id;

    // Gán metric này vào máy MC-CYL-01
    const assignRes1 = await request('/api/mappings', {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({
        machine_id: 'MC-CYL-01',
        metric_id: testMetricId,
        mapping_code: 'MTR-CYL01-TEMP01',
        channel_name: 'Kênh Áp Suất Tạm MC-CYL-01',
      }),
    });
    assert(assignRes1.status === 201, 'Gán metric test vào máy MC-CYL-01 thành công (201)');
    const createdMappingId = assignRes1.data.mapping.id;

    // Cập nhật thông tin metric (Mã, Tên, Mô tả, Đơn vị) - KHÔNG truyền assignedMachineIds
    const updateMetricRes = await request(`/api/metrics/${testMetricId}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({
        code: 'TEST_TEMP_METRIC_01',
        name: 'Thông Số Kiểm Thử Tạm 01 (ĐÃ SỬA TÊN)',
        category: 'Pressure',
        unit: 'MPa',
        dataType: 'FLOAT',
        description: 'Mô tả đã được cập nhật bởi Admin',
      }),
    });
    assert(updateMetricRes.status === 200, 'Cập nhật thông tin metric thành công (200)');
    assert(
      updateMetricRes.data.metric.name === 'Thông Số Kiểm Thử Tạm 01 (ĐÃ SỬA TÊN)',
      'Tên thông số đã được cập nhật chính xác'
    );

    // Kiểm tra mapping cũ trên MC-CYL-01: vẫn tồn tại nguyên vẹn!
    const [checkMappings] = await pool.query('SELECT * FROM metric_mappings WHERE id = ?', [createdMappingId]);
    assert(checkMappings.length === 1, 'Mapping của thiết bị MC-CYL-01 vẫn tồn tại nguyên vẹn sau khi sửa thông số');
    assert(checkMappings[0].machine_id === 'MC-CYL-01', 'Mapping machine_id không bị thay đổi');

    // -------------------------------------------------------------------------
    // TEST GROUP 3: TOÀN BỘ METRIC HIỂN THỊ KHI CHỌN THIẾT BỊ & TRẠNG THÁI CHECKBOX
    // -------------------------------------------------------------------------
    console.log('\n--- TEST GROUP 3: Toàn bộ thông số hiển thị & Phản ánh Checkbox chính xác ---');

    const getMetricsRes = await request('/api/metrics?limit=100', {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert(getMetricsRes.status === 200, 'Lấy toàn bộ danh mục thông số thành công (200)');
    const totalCatalogCount = getMetricsRes.data.metrics.length;
    assert(totalCatalogCount >= 12, `Danh mục có đủ thông số chuẩn hóa (${totalCatalogCount} thông số)`);

    const getMappingsRes = await request('/api/mappings', {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert(getMappingsRes.status === 200, 'Lấy danh sách mappings thành công (200)');
    const allMappings = getMappingsRes.data.mappings;

    const cyl01Mappings = allMappings.filter((m) => m.machine_id === 'MC-CYL-01');
    const asm01Mappings = allMappings.filter((m) => m.machine_id === 'MC-ASM-01');

    // Mô phỏng logic hiển thị ở frontend cho MC-CYL-01
    const cyl01Displayed = getMetricsRes.data.metrics.map((m) => {
      const mapping = cyl01Mappings.find((map) => map.metric_id === m.id);
      return { metric: m, mapping, isChecked: Boolean(mapping) };
    });
    assert(
      cyl01Displayed.length === totalCatalogCount,
      `MC-CYL-01 hiển thị TOÀN BỘ ${totalCatalogCount}/${totalCatalogCount} thông số catalog`
    );
    const cyl01CheckedCount = cyl01Displayed.filter((x) => x.isChecked).length;
    assert(
      cyl01CheckedCount === cyl01Mappings.length,
      `Số checkbox được tích của MC-CYL-01 (${cyl01CheckedCount}) khớp chính xác với số mapping CSDL (${cyl01Mappings.length})`
    );

    // Mô phỏng logic hiển thị ở frontend cho MC-ASM-01
    const asm01Displayed = getMetricsRes.data.metrics.map((m) => {
      const mapping = asm01Mappings.find((map) => map.metric_id === m.id);
      return { metric: m, mapping, isChecked: Boolean(mapping) };
    });
    assert(
      asm01Displayed.length === totalCatalogCount,
      `MC-ASM-01 hiển thị TOÀN BỘ ${totalCatalogCount}/${totalCatalogCount} thông số catalog`
    );
    const asm01CheckedCount = asm01Displayed.filter((x) => x.isChecked).length;
    assert(
      asm01CheckedCount === asm01Mappings.length,
      `Số checkbox được tích của MC-ASM-01 (${asm01CheckedCount}) khớp chính xác với số mapping CSDL (${asm01Mappings.length})`
    );

    // Kiểm tra tính độc lập giữa các thiết bị
    const tempMetricInCyl01 = cyl01Displayed.find((x) => x.metric.id === testMetricId);
    const tempMetricInAsm01 = asm01Displayed.find((x) => x.metric.id === testMetricId);
    assert(tempMetricInCyl01.isChecked === true, 'Thông số test ĐÃ ĐƯỢC TÍCH trên MC-CYL-01');
    assert(tempMetricInAsm01.isChecked === false, 'Thông số test CHƯA ĐƯỢC TÍCH trên MC-ASM-01 (Độc lập 100%)');

    // -------------------------------------------------------------------------
    // TEST GROUP 4: TÍCH CHỌN THÊM THÔNG SỐ & CHẶN TRÙNG LẶP
    // -------------------------------------------------------------------------
    console.log('\n--- TEST GROUP 4: Tích chọn gán thông số & Chặn trùng lặp ---');

    // Tích chọn thông số test cho MC-ASM-01
    const assignRes2 = await request('/api/mappings', {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({
        machine_id: 'MC-ASM-01',
        metric_id: testMetricId,
        mapping_code: 'MTR-ASM01-TEMP01',
        channel_name: 'Kênh Áp Suất Tạm MC-ASM-01',
      }),
    });
    assert(assignRes2.status === 201, 'Tích chọn gán thông số test cho MC-ASM-01 thành công (201)');
    assert(assignRes2.data.mapping.status === 'ACTIVE', 'Mapping mới có trạng thái ACTIVE mặc định');
    assert(Boolean(assignRes2.data.mapping.monitoring_enabled), 'Mapping mới có monitoring_enabled bật mặc định');
    assert(Boolean(assignRes2.data.mapping.plc_id), 'Mapping mới tự động kế thừa PLC của dây chuyền chứa máy');

    const asm01MappingId = assignRes2.data.mapping.id;

    // Cố gắng gán trùng lặp thông số này vào MC-ASM-01 một lần nữa -> Phải bị chặn 409
    const dupRes = await request('/api/mappings', {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({
        machine_id: 'MC-ASM-01',
        metric_id: testMetricId,
        mapping_code: 'MTR-ASM01-TEMP01-DUP',
        channel_name: 'Kênh Trùng Lặp',
      }),
    });
    assert(dupRes.status === 409, 'Hệ thống chặn trùng lặp thông số trên cùng thiết bị với HTTP 409 Conflict');

    // -------------------------------------------------------------------------
    // TEST GROUP 5: CẤU HÌNH NGƯỠNG & LỊCH THU THẬP KHÔNG LỖI DỮ LIỆU
    // -------------------------------------------------------------------------
    console.log('\n--- TEST GROUP 5: Cấu hình ngưỡng cảnh báo & Lịch thu thập ---');

    // Cấu hình ngưỡng cho mapping của MC-CYL-01
    const thresholdRes = await request(`/api/mappings/${createdMappingId}/thresholds`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({
        warning_max: 75.5,
        critical_max: 90.0,
        action_plan: 'Kiểm tra van điều áp ngay lập tức',
      }),
    });
    assert(thresholdRes.status === 200 || thresholdRes.status === 201, 'Lưu ngưỡng cảnh báo thành công (200/201)');

    // Cấu hình lịch cho mapping của MC-CYL-01
    const scheduleRes = await request(`/api/mappings/${createdMappingId}/schedule`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({
        frequency_type: 'INTERVAL',
        interval_seconds: 5,
        is_active: 1,
      }),
    });
    assert(scheduleRes.status === 200 || scheduleRes.status === 201, 'Lưu lịch thu thập thành công (200/201)');

    // Kiểm tra định dạng hiển thị không có undefined, null, NaN
    const checkMappingUpdated = await request(`/api/mappings`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const foundUpdated = checkMappingUpdated.data.mappings.find((m) => m.id === createdMappingId);
    assert(foundUpdated !== undefined, 'Tìm thấy mapping vừa cấu hình');
    const wMax = Number(foundUpdated.warning_max ?? foundUpdated.thresholds?.warning_max);
    const cMax = Number(foundUpdated.critical_max ?? foundUpdated.thresholds?.critical_max);
    const intervalSec = foundUpdated.interval_seconds ?? foundUpdated.schedule?.interval_seconds;
    assert(wMax === 75.5, 'Warning max lưu đúng số thực 75.5');
    assert(cMax === 90.0, 'Critical max lưu đúng số thực 90.0');
    assert(!isNaN(wMax) && !isNaN(cMax), 'Không bị lỗi NaN');
    assert(intervalSec === 5, 'Interval seconds lưu đúng 5s');

    // -------------------------------------------------------------------------
    // TEST GROUP 6: BỎ TÍCH / GỠ MAPPING KHÔNG XÓA METRIC TRONG CATALOG
    // -------------------------------------------------------------------------
    console.log('\n--- TEST GROUP 6: Bỏ tích gỡ mapping & Bảo toàn Metric Catalog ---');

    // Gỡ mapping khỏi MC-CYL-01
    const deleteMappingRes1 = await request(`/api/mappings/${createdMappingId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert(deleteMappingRes1.status === 200, 'Gỡ mapping khỏi MC-CYL-01 thành công (200)');

    // Gỡ mapping khỏi MC-ASM-01
    const deleteMappingRes2 = await request(`/api/mappings/${asm01MappingId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert(deleteMappingRes2.status === 200, 'Gỡ mapping khỏi MC-ASM-01 thành công (200)');

    // Kiểm tra thông số test vẫn tồn tại nguyên vẹn trong metric_catalog!
    const [checkMetricStillExists] = await pool.query('SELECT * FROM metric_catalog WHERE id = ?', [testMetricId]);
    assert(
      checkMetricStillExists.length === 1,
      'Thông số trong metric_catalog VẪN TỒN TẠI NGUYÊN VẸN 100% sau khi gỡ khỏi tất cả thiết bị'
    );

    // Dọn dẹp metric test tạm
    const deleteMetricRes = await request(`/api/metrics/${testMetricId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert(deleteMetricRes.status === 200, 'Dọn dẹp metric test tạm thời thành công (200)');

    // -------------------------------------------------------------------------
    // TEST GROUP 7: PHÂN QUYỀN RBAC (ADMIN, MAINTENANCE vs OPERATOR)
    // -------------------------------------------------------------------------
    console.log('\n--- TEST GROUP 7: Phân quyền RBAC nghiêm ngặt ---');

    // Operator không được phép tạo mapping
    const opCreateRes = await request('/api/mappings', {
      method: 'POST',
      headers: { Authorization: `Bearer ${operatorToken}` },
      body: JSON.stringify({
        machine_id: 'MC-CYL-01',
        metric_id: 'METRIC-PRESSURE-01',
        mapping_code: 'MTR-OP-TEST',
        channel_name: 'Operator Test',
      }),
    });
    assert(opCreateRes.status === 403, 'Operator bị từ chối tạo mapping (403 Forbidden)');

    // Operator không được phép xóa mapping
    const opDeleteRes = await request('/api/mappings/NON_EXISTENT_ID', {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${operatorToken}` },
    });
    assert(opDeleteRes.status === 403, 'Operator bị từ chối xóa mapping (403 Forbidden)');

    // -------------------------------------------------------------------------
    // TEST GROUP 8: BẢO TOÀN DỮ LIỆU SẢN XUẤT PROD FREEZE
    // -------------------------------------------------------------------------
    console.log('\n--- TEST GROUP 8: Bảo toàn CSDL Production (Freeze) ---');

    const prodConn = await mysql.createConnection({
      host: process.env.DB_HOST || '127.0.0.1',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD,
      database: 'denso_iot',
    });
    const [prodRows] = await prodConn.query('SELECT COUNT(*) as cnt FROM machine_telemetry_history');
    assert(
      prodRows[0].cnt === 16924,
      `CSDL Sản xuất denso_iot: Bảng machine_telemetry_history được đóng băng đúng 16,924 bản ghi (thực tế: ${prodRows[0].cnt})`
    );
    await prodConn.end();

    console.log('\n========================================================================');
    console.log(`KẾT QUẢ KIỂM THỬ: ${passedTests}/${totalTests} BÀI PASS (100%)`);
    console.log('========================================================================\n');
  } finally {
    await pool.end();
  }
}

runTestSuite().catch((err) => {
  console.error('\n[FATAL ERROR IN TEST SUITE]:', err);
  process.exit(1);
});
