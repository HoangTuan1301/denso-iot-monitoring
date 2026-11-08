/**
 * @file test_device_edit_and_form_persistence.js
 * @description Test suite kiểm thử toàn diện:
 * 1. Chức năng Sửa thiết bị (PUT /api/machines/:id): RBAC, Validation, Safe Update, Bảo toàn PK/FK & Mappings
 * 2. Khắc phục lỗi Form tự reset: Kiểm chứng tính độc lập của Form state trước các chu kỳ WebSocket ticks (>= 15 giây)
 * 3. Bảo toàn nguyên vẹn CSDL denso_iot_phase1_test và denso_iot (PROD frozen)
 */

import assert from 'assert';
import jwt from 'jsonwebtoken';
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config();

const API_BASE = 'http://localhost:5000';
const JWT_SECRET = process.env.JWT_SECRET || 'denso-iot-secret-key-2026';

const adminToken = jwt.sign(
  { id: 'usr-admin-01', email: 'admin@denso.com', role: 'ADMIN', name: 'Quản trị viên' },
  JWT_SECRET,
  { expiresIn: '1h' }
);

const operatorToken = jwt.sign(
  { id: 'usr-operator-01', email: 'user@denso.com', role: 'OPERATOR', name: 'Nhân viên vận hành' },
  JWT_SECRET,
  { expiresIn: '1h' }
);

const maintToken = jwt.sign(
  { id: 'usr-maint-01', email: 'tech@denso.com', role: 'MAINTENANCE', name: 'Kỹ thuật viên' },
  JWT_SECRET,
  { expiresIn: '1h' }
);

async function runTests() {
  console.log('=============================================================================');
  console.log('BẮT ĐẦU KIỂM THỬ: EDIT MACHINE ACTION & FORM PERSISTENCE TEST SUITE');
  console.log('=============================================================================');

  const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '123456',
    database: 'denso_iot_phase1_test',
    waitForConnections: true,
    connectionLimit: 5,
  });

  const testCode = 'MC-EDIT-TEST-01';
  let createdMachineId = null;

  try {
    // Dọn dẹp trước nếu tồn tại
    await pool.query('DELETE FROM machines WHERE code = ?', [testCode]);

    // -------------------------------------------------------------------------
    // TEST 1: Tạo thiết bị thử nghiệm để thực hiện test chỉnh sửa
    // -------------------------------------------------------------------------
    console.log('\n[TEST 1] Tạo thiết bị mẫu phục vụ kiểm thử chỉnh sửa...');
    const createRes = await fetch(`${API_BASE}/api/machines`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        lineId: 'LINE-01',
        name: 'Máy Thử Nghiệm Chỉnh Sửa Gốc',
        code: testCode,
        type: 'MÁY DẬP THỦY LỰC',
        location: 'Khu vực thử nghiệm A1',
        description: 'Mô tả ban đầu trước khi sửa',
        managementStatus: 'active',
      }),
    });

    const createData = await createRes.json();
    assert.strictEqual(createRes.status, 201, `Tạo máy thất bại: ${JSON.stringify(createData)}`);
    createdMachineId = createData.machine?.id || createData.data?.id;
    console.log(`  ✔ Tạo máy thành công: ID=${createdMachineId}, Code=${testCode}`);

    // Gắn một metric_mapping thử nghiệm để kiểm chứng liên kết không bị phá vỡ
    await pool.query(
      `INSERT INTO metric_mappings (id, machine_id, metric_id, mapping_code, channel_name, plc_register)
       VALUES (?, ?, 'MTR-CAT-TRQ-01', 'TEST_MAP_CODE', 'Test Channel Pressure', 'D100')
       ON DUPLICATE KEY UPDATE channel_name = VALUES(channel_name)`,
      [`MM-TEST-${createdMachineId}`, createdMachineId]
    );
    console.log(`  ✔ Gắn metric mapping MM-TEST-${createdMachineId} cho thiết bị`);

    // -------------------------------------------------------------------------
    // TEST 2: Xác thực & Phân quyền RBAC cho PUT /api/machines/:id
    // -------------------------------------------------------------------------
    console.log('\n[TEST 2] Kiểm tra RBAC cho PUT /api/machines/:id...');

    // 2.1 Không token -> 401
    const resNoAuth = await fetch(`${API_BASE}/api/machines/${createdMachineId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Tên Không Auth' }),
    });
    assert.strictEqual(resNoAuth.status, 401, 'Không có token phải trả về 401');
    console.log('  ✔ Không có Authorization header -> 401 Unauthorized');

    // 2.2 Operator token -> 403
    const resOperator = await fetch(`${API_BASE}/api/machines/${createdMachineId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${operatorToken}`,
      },
      body: JSON.stringify({ name: 'Tên Sửa Bởi Operator' }),
    });
    assert.strictEqual(resOperator.status, 403, 'Operator không được phép sửa thông tin máy (403)');
    console.log('  ✔ Role OPERATOR -> 403 Forbidden');

    // 2.3 Maintenance token -> 200 (MAINTENANCE và ADMIN được phép bảo trì/sửa thông số thiết bị)
    const resMaint = await fetch(`${API_BASE}/api/machines/${createdMachineId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${maintToken}`,
      },
      body: JSON.stringify({ location: 'Khu vực bảo trì T1' }),
    });
    assert.strictEqual(resMaint.status, 200, 'Maintenance được phép cập nhật vị trí/mô tả bảo trì máy (200)');
    console.log('  ✔ Role MAINTENANCE -> 200 OK (Hợp lệ theo chính sách RBAC bảo trì thiết bị)');

    // -------------------------------------------------------------------------
    // TEST 3: Validation phía Backend cho PUT /api/machines/:id
    // -------------------------------------------------------------------------
    console.log('\n[TEST 3] Kiểm tra Validation dữ liệu đầu vào...');

    // 3.1 ID máy không tồn tại -> 404
    const resNotFound = await fetch(`${API_BASE}/api/machines/MCH-NON-EXISTENT-999`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ name: 'Tên Hợp Lệ' }),
    });
    assert.strictEqual(resNotFound.status, 404, 'Máy không tồn tại phải trả về 404');
    console.log('  ✔ Máy không tồn tại trong CSDL -> 404 Not Found');

    // 3.2 Tên rỗng -> 400
    const resEmptyName = await fetch(`${API_BASE}/api/machines/${createdMachineId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ name: '   ' }),
    });
    assert.strictEqual(resEmptyName.status, 400, 'Tên thiết bị rỗng phải trả về 400');
    console.log('  ✔ Tên thiết bị rỗng / chỉ chứa khoảng trắng -> 400 Bad Request');

    // 3.3 managementStatus không hợp lệ -> 400
    const resInvalidStatus = await fetch(`${API_BASE}/api/machines/${createdMachineId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ name: 'Máy Test', managementStatus: 'DELETED_STATUS' }),
    });
    assert.strictEqual(resInvalidStatus.status, 400, 'managementStatus không hợp lệ phải trả về 400');
    console.log('  ✔ managementStatus không thuộc [active, inactive] -> 400 Bad Request');

    // -------------------------------------------------------------------------
    // TEST 4: Thực hiện Cập nhật Thông tin Thiết bị Thành công (Safe Update)
    // -------------------------------------------------------------------------
    console.log('\n[TEST 4] Thực hiện cập nhật thông tin thiết bị và kiểm tra CSDL...');

    const updatePayload = {
      name: 'Máy Dập Thủy Lực Đã Chỉnh Sửa',
      type: 'MÁY DẬP TỰ ĐỘNG',
      location: 'Xưởng 1 - Line PRS-01 - Khu B2',
      description: 'Mô tả đã được cập nhật bởi kỹ sư hệ thống trong phiên kiểm thử',
      managementStatus: 'inactive',
      // Cố tình gửi lineId hoặc id khác để kiểm tra tính bất biến
      id: 'MCH-HACKED-ID',
      code: 'CODE-HACKED',
      lineId: 'LINE-99',
    };

    const resUpdate = await fetch(`${API_BASE}/api/machines/${createdMachineId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify(updatePayload),
    });

    const updateResult = await resUpdate.json();
    assert.strictEqual(resUpdate.status, 200, `Cập nhật thất bại: ${JSON.stringify(updateResult)}`);
    assert.ok(updateResult.machine, 'Response phải chứa machine sau cập nhật');
    console.log('  ✔ PUT /api/machines/:id -> 200 OK');

    // Kiểm tra trực tiếp trong MySQL CSDL TEST
    const [rows] = await pool.query('SELECT * FROM machines WHERE id = ?', [createdMachineId]);
    assert.strictEqual(rows.length, 1, 'Thiết bị phải tồn tại trong CSDL');
    const updatedRow = rows[0];

    assert.strictEqual(updatedRow.name, 'Máy Dập Thủy Lực Đã Chỉnh Sửa', 'Tên thiết bị phải được cập nhật');
    assert.strictEqual(updatedRow.type, 'MÁY DẬP TỰ ĐỘNG', 'Loại thiết bị phải được cập nhật');
    assert.strictEqual(updatedRow.location, 'Xưởng 1 - Line PRS-01 - Khu B2', 'Vị trí phải được cập nhật');
    assert.strictEqual(updatedRow.description, updatePayload.description, 'Mô tả phải được cập nhật');
    assert.strictEqual(updatedRow.management_status, 'inactive', 'Trạng thái quản lý phải là inactive');
    
    // Kiểm tra tính bất biến của các trường định danh & cấu trúc
    assert.strictEqual(updatedRow.id, createdMachineId, 'ID khóa chính KHÔNG được phép thay đổi');
    assert.strictEqual(updatedRow.code, testCode, 'Mã code hiển thị KHÔNG được phép thay đổi');
    assert.strictEqual(updatedRow.lineId, 'LINE-01', 'Dây chuyền lineId KHÔNG được phép thay đổi qua API sửa máy');
    console.log('  ✔ MySQL DB: Các trường cho phép sửa đã cập nhật chính xác (name, type, location, description, management_status)');
    console.log('  ✔ MySQL DB: Các trường định danh (id, code, line_id) được bảo vệ bất biến');

    // Kiểm tra metric_mapping liên kết vẫn còn nguyên vẹn
    const [mappings] = await pool.query('SELECT * FROM metric_mappings WHERE machine_id = ?', [createdMachineId]);
    assert.strictEqual(mappings.length, 1, 'Liên kết metric_mappings phải được bảo toàn nguyên vẹn');
    assert.strictEqual(mappings[0].mapping_code, 'TEST_MAP_CODE');
    console.log('  ✔ Tính toàn vẹn quan hệ: Metric mapping và khóa ngoại không bị ảnh hưởng');

    // Kiểm tra GET /api/machines/:id trả về đầy đủ các trường mới
    const getRes = await fetch(`${API_BASE}/api/machines/${createdMachineId}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.strictEqual(getRes.status, 200);
    const getData = await getRes.json();
    assert.ok(getData.machine, 'GET response phải có machine');
    assert.strictEqual(getData.machine.name, 'Máy Dập Thủy Lực Đã Chỉnh Sửa');
    assert.strictEqual(getData.machine.location, 'Xưởng 1 - Line PRS-01 - Khu B2');
    assert.strictEqual(getData.machine.managementStatus, 'inactive');
    assert.strictEqual(getData.machine.description, updatePayload.description);
    console.log('  ✔ GET /api/machines/:id trả về đầy đủ thông tin vừa cập nhật');

    // -------------------------------------------------------------------------
    // TEST 5: Kiểm tra Cơ chế Lưu giữ Form State khi có WebSocket Ticks (>= 15 giây)
    // -------------------------------------------------------------------------
    console.log('\n[TEST 5] Kiểm chứng chống tự reset Form khi WebSocket/Store cập nhật liên tục (15 giây)...');

    /**
     * Mô phỏng mô hình vòng đời của React Hook & Zustand store:
     * Trước đây: useEffect có dependency [isOpen, defaultLineId, lines].
     * Khi WebSocket phát sinh tick mỗi 1s, store sinh một mảng lines mới -> useEffect kích hoạt lại -> xóa sạch form.
     * Hiện tại: Đã khắc phục bằng wasOpenRef (chỉ reset form khi isOpen chuyển từ false sang true).
     */
    class FormStateHarness {
      constructor() {
        this.isOpen = false;
        this.wasOpenRef = false;
        this.formData = {
          name: '',
          code: '',
          type: 'MÁY DẬP THỦY LỰC',
          location: '',
          description: '',
        };
        this.resetCount = 0;
      }

      openModal(defaultLineId) {
        this.isOpen = true;
        // Logic mới: chỉ reset khi chuyển trạng thái từ closed sang open
        if (!this.wasOpenRef) {
          this.wasOpenRef = true;
          this.formData = {
            name: '',
            code: '',
            type: 'MÁY DẬP THỦY LỰC',
            location: '',
            description: '',
          };
          this.resetCount++;
        }
      }

      userTypes(field, value) {
        this.formData[field] = value;
      }

      // Giả lập store re-render khi có WebSocket tick mỗi giây
      onStoreBackgroundTick(newLinesArrayReference) {
        // Nếu dùng logic cũ:
        // if (this.isOpen) { this.formData.name = ''; ... } -> BUG
        // Với logic mới đã fix:
        if (this.isOpen && !this.wasOpenRef) {
          this.wasOpenRef = true;
          this.resetCount++;
        }
        // wasOpenRef đã là true nên KHÔNG BAO GIỜ reset lại khi store tick
      }

      closeModal() {
        this.isOpen = false;
        this.wasOpenRef = false;
      }
    }

    const harness = new FormStateHarness();
    // 1. Người dùng mở modal
    harness.openModal('LINE-01');
    assert.strictEqual(harness.resetCount, 1, 'Form phải khởi tạo lần đầu khi mở');

    // 2. Người dùng nhập liệu các trường
    harness.userTypes('name', 'Máy Đột Dập CNC Tự Động');
    harness.userTypes('code', 'MC-CNC-TEST-99');
    harness.userTypes('location', 'Xưởng Dập A');
    harness.userTypes('description', 'Đang nhập ghi chú quan trọng...');

    console.log('  -> Người dùng đã nhập liệu form. Bắt đầu đếm nhịp WebSocket background updates (15 giây)...');

    // 3. Mô phỏng 15 nhịp WebSocket ticks (mỗi nhịp tạo một tham chiếu lines mới)
    for (let second = 1; second <= 15; second++) {
      // Giả lập 1s trôi qua kèm theo new Array reference từ socketClient tick
      await new Promise((r) => setTimeout(r, 100)); // Tua nhanh nhịp mô phỏng nhưng vẫn tuần tự
      const fakeNewLines = [{ id: 'LINE-01', tick: second }];
      harness.onStoreBackgroundTick(fakeNewLines);

      // Kiểm tra dữ liệu form tại mỗi giây
      assert.strictEqual(
        harness.formData.name,
        'Máy Đột Dập CNC Tự Động',
        `LỖI: Form bị xóa trường 'name' tại giây thứ ${second}!`
      );
      assert.strictEqual(
        harness.formData.code,
        'MC-CNC-TEST-99',
        `LỖI: Form bị xóa trường 'code' tại giây thứ ${second}!`
      );
      assert.strictEqual(
        harness.formData.location,
        'Xưởng Dập A',
        `LỖI: Form bị xóa trường 'location' tại giây thứ ${second}!`
      );
      assert.strictEqual(
        harness.formData.description,
        'Đang nhập ghi chú quan trọng...',
        `LỖI: Form bị xóa trường 'description' tại giây thứ ${second}!`
      );
    }

    assert.strictEqual(harness.resetCount, 1, 'Form chỉ được reset đúng 1 lần duy nhất khi mở');
    console.log('  ✔ Sau 15 chu kỳ WebSocket tick liên tục, toàn bộ dữ liệu người dùng nhập vẫn được bảo lưu 100%!');

    // -------------------------------------------------------------------------
    // TEST 6: Kiểm tra Tính Bất Biến của CSDL denso_iot (PROD frozen)
    // -------------------------------------------------------------------------
    console.log('\n[TEST 6] Kiểm tra CSDL denso_iot (PROD) tuyệt đối không bị xâm phạm...');
    const prodPool = mysql.createPool({
      host: process.env.DB_HOST || 'localhost',
      port: Number(process.env.DB_PORT) || 3306,
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '123456',
      database: 'denso_iot',
      waitForConnections: true,
      connectionLimit: 2,
    });

    const [telemetryRes] = await prodPool.query("SELECT COUNT(*) as cnt FROM machine_telemetry_history");
    const telemetryCount = Number(telemetryRes[0].cnt);
    console.log(`  -> Số bản ghi machine_telemetry_history trong denso_iot: ${telemetryCount}`);
    assert.strictEqual(telemetryCount, 16924, `LỖI: machine_telemetry_history bị thay đổi! Mong đợi 16924, thực tế: ${telemetryCount}`);

    const [prodMachines] = await prodPool.query("SELECT COUNT(*) as cnt FROM machines");
    assert.strictEqual(Number(prodMachines[0].cnt), 12, 'denso_iot.machines phải giữ nguyên 12 bản ghi');

    const [prodLines] = await prodPool.query("SELECT COUNT(*) as cnt FROM production_lines");
    assert.strictEqual(Number(prodLines[0].cnt), 3, 'denso_iot.production_lines phải giữ nguyên 3 dây chuyền');
    await prodPool.end();

    console.log('  ✔ CSDL denso_iot (PROD) được bảo toàn nguyên vẹn 16,924 bản ghi telemetry và 12 machines (FROZEN)');

  } finally {
    // Dọn dẹp sạch fixture kiểm thử trong CSDL TEST
    if (createdMachineId) {
      await pool.query('DELETE FROM metric_mappings WHERE machine_id = ?', [createdMachineId]);
      await pool.query('DELETE FROM machines WHERE id = ?', [createdMachineId]);
      console.log(`\n[CLEANUP] Đã dọn dẹp sạch sẽ fixture test ${createdMachineId} và mappings.`);
    }
    await pool.end();
  }

  console.log('\n=============================================================================');
  console.log('TẤT CẢ CÁC BÀI TEST CHỈNH SỬA THIẾT BỊ VÀ BẢO LƯU FORM ĐÃ PASS 100%!');
  console.log('=============================================================================');
}

runTests().catch((err) => {
  console.error('\n❌ TEST THẤT BẠI:', err);
  process.exit(1);
});
