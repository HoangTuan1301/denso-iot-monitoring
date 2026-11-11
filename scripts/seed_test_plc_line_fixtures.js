/**
 * @file scripts/seed_test_plc_line_fixtures.js
 * @description Cấu hình liên kết trạm PLC gắn sẵn với Dây chuyền trong CSDL TEST (denso_iot_phase1_test).
 * - PLC-STATION-01 gắn sẵn vào LINE-01 (Dây chuyền Dập & Hàn)
 * - PLC-STATION-02 gắn sẵn vào LINE-02 (Dây chuyền Sơn Tĩnh Điện)
 * - Giữ nguyên is_demo = 1, enabled = 0, connection_status = 'UNKNOWN' (không giả mạo PLC vật lý).
 * - Bảo vệ tuyệt đối CSDL Production denso_iot.
 */

import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

const DB_HOST = process.env.DB_HOST || 'localhost';
const DB_PORT = parseInt(process.env.DB_PORT || '3306', 10);
const DB_USER = process.env.DB_USER || 'root';
const DB_PASSWORD = process.env.DB_PASSWORD || '123456';
const TEST_DB = 'denso_iot_phase1_test';
const PROD_DB = 'denso_iot';

async function seed() {
  console.log('='.repeat(70));
  console.log(`[SEED FIXTURES] Cấu hình liên kết PLC gắn sẵn với Dây chuyền: ${TEST_DB}`);
  console.log('='.repeat(70));

  // Kiểm tra an toàn CSDL Production trước
  const prodConn = await mysql.createConnection({
    host: DB_HOST,
    port: DB_PORT,
    user: DB_USER,
    password: DB_PASSWORD,
    database: PROD_DB,
  });
  const [[prodCnt]] = await prodConn.query('SELECT COUNT(*) as count FROM machine_telemetry_history');
  console.log(`  [SAFETY CHECK] Production denso_iot records: ${prodCnt.count} (phải là 16924)`);
  if (prodCnt.count !== 16924) {
    throw new Error('Production database count mismatch! Aborting.');
  }
  await prodConn.end();

  // Kết nối CSDL TEST
  const testConn = await mysql.createConnection({
    host: DB_HOST,
    port: DB_PORT,
    user: DB_USER,
    password: DB_PASSWORD,
    database: TEST_DB,
  });

  try {
    // 1. Kiểm tra tồn tại Dây chuyền
    const [lines] = await testConn.query('SELECT id, name FROM production_lines WHERE id IN ("LINE-01", "LINE-02")');
    console.log(`  ✓ Tìm thấy ${lines.length} dây chuyền sản xuất mục tiêu (LINE-01, LINE-02)`);

    // 2. Cập nhật liên kết gắn sẵn PLC - Line
    await testConn.query('UPDATE plc_stations SET line_id = "LINE-01" WHERE id = "PLC-STATION-01"');
    console.log('  ✓ Đã liên kết PLC-STATION-01 -> LINE-01 (Dây chuyền Dập & Hàn Khung Gầm)');

    await testConn.query('UPDATE plc_stations SET line_id = "LINE-02" WHERE id = "PLC-STATION-02"');
    console.log('  ✓ Đã liên kết PLC-STATION-02 -> LINE-02 (Dây chuyền Sơn Tĩnh Điện)');

    // 3. Xác minh kết quả
    const [plcs] = await testConn.query('SELECT id, name, line_id, is_demo, enabled, connection_status FROM plc_stations');
    console.log('\n  [XÁC MINH TRẠNG THÁI PLC TRONG TEST DB]:');
    plcs.forEach((p) => {
      console.log(`    - [${p.id}] ${p.name}`);
      console.log(`      Line liên kết: ${p.line_id || 'Chưa gán'}`);
      console.log(`      Demo flag: is_demo = ${p.is_demo} (Bảo toàn, không sửa thành production)`);
      console.log(`      Trạng thái: connection_status = ${p.connection_status} (Không giả mạo Online)`);
    });

    console.log('\n  ✓ HOÀN TẤT THIẾT LẬP FIXTURE AN TOÀN 100%!');
  } finally {
    await testConn.end();
  }
}

seed().catch((err) => {
  console.error('[SEED ERROR]:', err);
  process.exit(1);
});
