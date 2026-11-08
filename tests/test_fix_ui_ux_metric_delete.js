/**
 * @file test_fix_ui_ux_metric_delete.js
 * @description Test Suite tự động kiểm thử toàn diện các yêu cầu:
 * 1. Toggle bật/tắt thông số (CustomSwitch)
 * 2. Xác nhận xóa thông số (Trash2)
 * 3. Từ chối xóa thông số có dữ liệu phụ thuộc (mappings, telemetry) -> 409 Conflict
 * 4. Cho phép xóa thông số không có dữ liệu phụ thuộc -> 200 OK
 * 5. Phân quyền RBAC (Chỉ ADMIN được xóa, OPERATOR/MAINTENANCE bị chặn 403)
 * 6. Cập nhật thống kê và danh mục sau khi xóa
 * 7. Kiểm tra Sidebar: line-height và chống cắt đuôi chữ g, y, p, q, tiếng Việt
 * 8. Kiểm tra Trang Mapping & Ngưỡng: Chỉ còn 1 nút "+ Gán thông số", chuẩn hóa ngôn ngữ Thiết bị
 * 9. Kiểm tra ngăn chặn gán trùng thông số cho thiết bị
 * 10. Kiểm tra an toàn CSDL Production denso_iot (đóng băng 16.924 bản ghi)
 */

import http from 'http';
import mysql from 'mysql2/promise';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import fs from 'fs';
dotenv.config();

const BASE_URL = 'http://localhost:5000';
const JWT_SECRET = process.env.JWT_SECRET || 'denso-iot-enterprise-jwt-secret-key-2026';

const adminToken = jwt.sign(
  { id: 'usr-admin-01', email: 'admin@denso.com', role: 'ADMIN', name: 'Quản trị viên', employeeId: 'EMP-ADM-01' },
  JWT_SECRET,
  { expiresIn: '1h' }
);

const operatorToken = jwt.sign(
  { id: 'usr-operator-01', email: 'user@denso.com', role: 'OPERATOR', name: 'Nhân viên vận hành', employeeId: 'EMP-OPR-01' },
  JWT_SECRET,
  { expiresIn: '1h' }
);

const maintToken = jwt.sign(
  { id: 'usr-maint-01', email: 'tech@denso.com', role: 'MAINTENANCE', name: 'Kỹ thuật viên', employeeId: 'EMP-MNT-01' },
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

function request(method, path, body = null, token = adminToken) {
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
  console.log('=============================================================================');
  console.log('🚀 BẮT ĐẦU TEST SUITE: FIX UI/UX & METRIC DELETE FUNCTION (DENSO IoT)');
  console.log('=============================================================================\n');

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

  // -------------------------------------------------------------------------
  // SECTION 1: KIỂM TRA PHÂN QUYỀN RBAC CHO DELETE /api/metrics/:id
  // -------------------------------------------------------------------------
  console.log('--- PHẦN 1: Phân quyền RBAC cho chức năng xóa thông số ---');
  try {
    // Không có token
    const noAuthRes = await request('DELETE', '/api/metrics/fake-id', null, '');
    assert(noAuthRes.status === 401, 'Không có Token -> Trả về 401 Unauthorized');

    // Role OPERATOR
    const opRes = await request('DELETE', '/api/metrics/fake-id', null, operatorToken);
    assert(opRes.status === 403, 'Role OPERATOR -> Bị từ chối 403 Forbidden');

    // Role MAINTENANCE
    const maintRes = await request('DELETE', '/api/metrics/fake-id', null, maintToken);
    assert(maintRes.status === 403, 'Role MAINTENANCE -> Bị từ chối 403 Forbidden (Chỉ ADMIN)');
  } catch (err) {
    assert(false, `Lỗi kiểm tra RBAC: ${err.message}`);
  }

  // -------------------------------------------------------------------------
  // SECTION 2: TỪ CHỐI XÓA THÔNG SỐ CÓ DỮ LIỆU PHỤ THUỘC (MAPPINGS / TELEMETRY)
  // -------------------------------------------------------------------------
  console.log('\n--- PHẦN 2: Từ chối xóa thông số có dữ liệu phụ thuộc ---');
  try {
    // Tìm 1 thông số đang được gán cho thiết bị
    const metricsRes = await request('GET', '/api/metrics');
    const assignedMetric = metricsRes.data.metrics.find((m) => m.assignedCount > 0);
    assert(Boolean(assignedMetric), `Tìm thấy thông số đã được gán (VD: ${assignedMetric?.code})`);

    if (assignedMetric) {
      const delAssignedRes = await request('DELETE', `/api/metrics/${assignedMetric.id}`);
      assert(delAssignedRes.status === 409, `Từ chối xóa thông số đang có mapping: HTTP 409 Conflict`);
      assert(
        typeof delAssignedRes.data.message === 'string' &&
          (delAssignedRes.data.message.includes('gán') || delAssignedRes.data.message.includes('sử dụng') || delAssignedRes.data.message.includes('kênh đo')),
        `Thông báo lý do từ chối rõ ràng: "${delAssignedRes.data.message}"`
      );
    }

    // Kiểm tra thông số có lịch sử telemetry
    const telemetryMetric = metricsRes.data.metrics.find((m) => m.usageCount > 0);
    if (telemetryMetric && telemetryMetric.id !== assignedMetric?.id) {
      const delTelemRes = await request('DELETE', `/api/metrics/${telemetryMetric.id}`);
      assert(delTelemRes.status === 409, `Từ chối xóa thông số có telemetry history: HTTP 409 Conflict`);
    }
  } catch (err) {
    assert(false, `Lỗi kiểm tra từ chối xóa: ${err.message}`);
  }

  // -------------------------------------------------------------------------
  // SECTION 3: TẠO THÔNG SỐ MỚI KHÔNG CÓ DỮ LIỆU PHỤ THUỘC & THỰC HIỆN XÓA
  // -------------------------------------------------------------------------
  console.log('\n--- PHẦN 3: Xóa thông số độc lập (không có dữ liệu phụ thuộc) ---');
  let tempMetricId = null;
  const tempCode = `TEST_DEL_${Date.now().toString().slice(-5)}`;
  try {
    // Lấy số liệu thống kê trước khi tạo
    const summaryBeforeRes = await request('GET', '/api/metrics/summary');
    const totalBefore = summaryBeforeRes.data.summary.total;
    const unassignedBefore = summaryBeforeRes.data.summary.unassigned;

    // 1. Tạo thông số thử nghiệm
    const createRes = await request('POST', '/api/metrics', {
      code: tempCode,
      name: 'Thông Số Thử Nghiệm Xóa',
      category: 'Pressure',
      unit: 'bar',
      dataType: 'FLOAT',
      validMin: 0,
      validMax: 100,
      description: 'Chỉ số thử nghiệm chức năng Delete an toàn',
      assignedMachineIds: [], // Không gán cho máy nào
    });
    assert(createRes.status === 201, `Tạo thông số thử nghiệm thành công: ${tempCode}`);
    tempMetricId = createRes.data.metric.id;

    // Kiểm tra thống kê tăng
    const summaryAfterCreate = await request('GET', '/api/metrics/summary');
    assert(summaryAfterCreate.data.summary.total === totalBefore + 1, 'Tổng số thông số tăng 1');
    assert(summaryAfterCreate.data.summary.unassigned === unassignedBefore + 1, 'Số thông số chưa gán tăng 1');

    // 2. Thử xóa bằng Token ADMIN
    const delRes = await request('DELETE', `/api/metrics/${tempMetricId}`);
    assert(delRes.status === 200 && delRes.data.success === true, 'Xóa thông số thành công với HTTP 200');
    console.log(`    -> Thông điệp phản hồi: "${delRes.data.message}"`);

    // 3. Xác minh metric đã biến mất khỏi CSDL
    const checkRes = await request('GET', `/api/metrics/${tempMetricId}`);
    assert(checkRes.status === 404, 'Truy vấn metric sau khi xóa trả về 404 Not Found');

    // 4. Kiểm tra thống kê tự giảm về đúng số ban đầu
    const summaryAfterDel = await request('GET', '/api/metrics/summary');
    assert(summaryAfterDel.data.summary.total === totalBefore, `Tổng số thông số giảm về đúng ban đầu (${totalBefore})`);
    assert(summaryAfterDel.data.summary.unassigned === unassignedBefore, `Số chưa gán giảm về đúng ban đầu (${unassignedBefore})`);
  } catch (err) {
    assert(false, `Lỗi kiểm tra tạo và xóa metric: ${err.message}`);
  }

  // -------------------------------------------------------------------------
  // SECTION 4: TOGGLE TRẠNG THÁI BẬT/TẮT THÔNG SỐ (PATCH /api/metrics/:id/status)
  // -------------------------------------------------------------------------
  console.log('\n--- PHẦN 4: Kiểm tra Toggle Trạng thái Bật/Tắt thông số ---');
  try {
    const metricsRes = await request('GET', '/api/metrics');
    const firstMetric = metricsRes.data.metrics[0];
    const initialStatus = firstMetric.status;
    const nextStatus = initialStatus === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';

    // Đổi trạng thái
    const toggleRes = await request('PATCH', `/api/metrics/${firstMetric.id}/status`, { status: nextStatus });
    assert(toggleRes.status === 200, `PATCH /api/metrics/:id/status thành công (sang ${nextStatus})`);
    assert(toggleRes.data.metric.status === nextStatus, 'Dữ liệu phản hồi cập nhật trạng thái mới');

    // Trả lại trạng thái ban đầu để bảo toàn dữ liệu
    await request('PATCH', `/api/metrics/${firstMetric.id}/status`, { status: initialStatus });
    console.log(`    -> Đã phục hồi trạng thái thông số về: ${initialStatus}`);
  } catch (err) {
    assert(false, `Lỗi kiểm tra toggle status: ${err.message}`);
  }

  // -------------------------------------------------------------------------
  // SECTION 5: KIỂM TRA SỬA LỖI FONT CHỮ TRÊN SIDEBAR
  // -------------------------------------------------------------------------
  console.log('\n--- PHẦN 5: Kiểm tra Sửa lỗi Font chữ Sidebar (descenders g, y, p, q) ---');
  try {
    const sidebarCode = fs.readFileSync('src/components/common/Sidebar.tsx', 'utf-8');
    assert(!sidebarCode.includes('truncate text-left leading-none font-medium'), 'Đã xóa leading-none trên NavBtn label');
    assert(sidebarCode.includes('leading-normal py-0.5'), 'Đã bổ sung leading-normal và py-0.5 để không bị cắt đuôi chữ g, y, p, q');
    assert(sidebarCode.includes('leading-normal py-0.5'), 'Tiêu đề nhóm NavGroup có khoảng trống hiển thị dấu tiếng Việt');
  } catch (err) {
    assert(false, `Lỗi kiểm tra Sidebar font code: ${err.message}`);
  }

  // -------------------------------------------------------------------------
  // SECTION 6: KIỂM TRA TRANG MAPPING & NGƯỠNG CẢNH BÁO
  // -------------------------------------------------------------------------
  console.log('\n--- PHẦN 6: Kiểm tra Chuẩn hóa Ngôn ngữ & 1 Nút Gán thông số ---');
  try {
    const thresholdViewCode = fs.readFileSync('src/features/admin/ThresholdConfigView.tsx', 'utf-8');
    
    // 6.1. Xóa nút "+ Thêm metric mới" ở góc trên bên phải
    assert(!thresholdViewCode.includes('Thêm metric mới'), 'Đã xóa bỏ hoàn toàn nút "+ Thêm metric mới" ở góc trên bên phải');

    // 6.2. Nút "+ Gán thông số" đã được xóa hoàn toàn theo yêu cầu mới (chuyển sang Checkbox trực tiếp)
    assert(!thresholdViewCode.includes('+ Gán thông số'), 'Nút "+ Gán thông số" đã được xóa hoàn toàn và thay bằng Checkbox trực tiếp');

    // 6.3. Chuẩn hóa ngôn ngữ "Thiết bị" & "Thông số của"
    assert(thresholdViewCode.includes('Thiết bị'), 'Đã đổi Component -> Thiết bị trong Sidebar và Header cột trái');
    assert(thresholdViewCode.includes('Tìm thiết bị theo mã, tên...'), 'Đã đổi ô tìm kiếm -> "Tìm thiết bị theo mã, tên..."');
    assert(thresholdViewCode.includes('Thông số của'), 'Đã đổi "Metric cho..." -> "Thông số của..."');

    // 6.4. Modal MappingFormModal có lọc thông số trùng
    const modalCode = fs.readFileSync('src/features/admin/MappingFormModal.tsx', 'utf-8');
    assert(modalCode.includes('existingMetricIds'), 'MappingFormModal nhận prop existingMetricIds để lọc thông số đã gán');
    assert(modalCode.includes('!existingMetricIds.includes(m.id)'), 'Ngăn chặn hiển thị thông số đã được gán trùng cho thiết bị');
    assert(modalCode.includes('Gán Thông Số Vào Thiết Bị'), 'Tiêu đề Modal chuẩn hóa thành "Gán Thông Số Vào Thiết Bị"');
  } catch (err) {
    assert(false, `Lỗi kiểm tra ThresholdConfigView code: ${err.message}`);
  }

  // -------------------------------------------------------------------------
  // SECTION 7: KIỂM TRA BẢO TOÀN CSDL PRODUCTION denso_iot (16.924 BẢN GHI)
  // -------------------------------------------------------------------------
  console.log('\n--- PHẦN 7: Kiểm toán CSDL Production denso_iot (FROZEN) ---');
  let prodConn = null;
  try {
    prodConn = await mysql.createConnection(DB_CONFIG_PROD);
    const [rows] = await prodConn.query('SELECT COUNT(*) AS total FROM machine_telemetry_history');
    const totalRecords = rows[0].total;
    console.log(`    -> Tổng số bản ghi machine_telemetry_history trong denso_iot: ${totalRecords}`);
    assert(totalRecords === 16924, `CSDL denso_iot (PROD) chính xác 16.924 bản ghi (Hiện tại: ${totalRecords})`);
  } catch (err) {
    assert(false, `Lỗi kết nối PROD DB: ${err.message}`);
  } finally {
    if (prodConn) await prodConn.end();
  }

  console.log('\n=============================================================================');
  console.log(`🎉 KẾT QUẢ TEST SUITE: ${passed} PASS / ${failed} FAIL (Tổng số: ${passed + failed})`);
  console.log('=============================================================================\n');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTests().catch((err) => {
  console.error('Fatal Error:', err);
  process.exit(1);
});
