/**
 * @file restore_database.js
 * @description Trình khôi phục và kiểm chứng bản sao lưu vào một CSDL độc lập
 * Tuyệt đối không restore đè lên CSDL chính denso_iot
 */

import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../.env') });

const DB_HOST = process.env.DB_HOST || 'localhost';
const DB_PORT = parseInt(process.env.DB_PORT || '3306', 10);
const DB_USER = process.env.DB_USER || 'root';
const DB_PASSWORD = process.env.DB_PASSWORD || '123456';

const args = process.argv.slice(2);
const fileArg = args.find((a) => a.startsWith('--file='));
const dbArg = args.find((a) => a.startsWith('--database='));

const TARGET_RESTORE_DB = dbArg ? dbArg.split('=')[1] : 'denso_iot_backup_verify';

export async function restoreAndVerify(backupPath = null, targetDb = TARGET_RESTORE_DB) {
  if (targetDb === 'denso_iot') {
    throw new Error('⛔ [BẢO VỆ]: TUYỆT ĐỐI KHÔNG RESTORE ĐÈ LÊN DATABASE GỐC denso_iot!');
  }

  // Nếu không chỉ định file, lấy file backup mới nhất trong thư mục backups/
  if (!backupPath) {
    const backupDir = path.join(__dirname, '../backups');
    const files = fs.readdirSync(backupDir).filter((f) => f.endsWith('.sql')).sort().reverse();
    if (files.length === 0) {
      throw new Error('Không tìm thấy file backup nào trong thư mục backups/');
    }
    backupPath = path.join(backupDir, files[0]);
  }

  console.log('================================================================');
  console.log(`[RESTORE VERIFY] KHÔI PHỤC VÀ SO SÁNH BẢN SAO LƯU`);
  console.log(`[RESTORE VERIFY] File nguồn: ${backupPath}`);
  console.log(`[RESTORE VERIFY] CSDL Đích độc lập: [${targetDb}]`);
  console.log('================================================================\n');

  // Kết nối MySQL server không chọn database để tạo database đích
  const adminConn = await mysql.createConnection({
    host: DB_HOST,
    port: DB_PORT,
    user: DB_USER,
    password: DB_PASSWORD,
    multipleStatements: true,
    dateStrings: true,
  });

  try {
    console.log(`1. Tạo mới CSDL độc lập: \`${targetDb}\`...`);
    await adminConn.query(`DROP DATABASE IF EXISTS \`${targetDb}\``);
    await adminConn.query(`CREATE DATABASE \`${targetDb}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
    console.log(`   ✓ Đã tạo sạch CSDL \`${targetDb}\``);

    // Đọc file SQL và thực thi vào targetDb
    console.log(`\n2. Đang nạp nội dung file backup vào \`${targetDb}\`...`);
    const sqlContent = fs.readFileSync(backupPath, 'utf8');

    // Chuyển sang targetDb để nạp
    await adminConn.changeUser({ database: targetDb });
    await adminConn.query(sqlContent);
    console.log(`   ✓ Nạp dữ liệu hoàn tất.`);

    // -------------------------------------------------------------------------
    // 3. So sánh đối chiếu 1-1 giữa denso_iot và targetDb
    // -------------------------------------------------------------------------
    console.log('\n================================================================');
    console.log(`3. SO SÁNH ĐỐI CHIẾU: [denso_iot] vs [${targetDb}]`);
    console.log('================================================================');

    const [origTables] = await adminConn.query('SHOW TABLES FROM denso_iot');
    const [restTables] = await adminConn.query(`SHOW TABLES FROM \`${targetDb}\``);

    const origTableNames = origTables.map((t) => Object.values(t)[0]).sort();
    const restTableNames = restTables.map((t) => Object.values(t)[0]).sort();

    console.log(`- Danh sách bảng gốc (${origTableNames.length}):`, origTableNames.join(', '));
    console.log(`- Danh sách bảng sau restore (${restTableNames.length}):`, restTableNames.join(', '));

    const tablesMatch = JSON.stringify(origTableNames) === JSON.stringify(restTableNames);
    console.log(`=> Kiểm tra số lượng và tên bảng: ${tablesMatch ? '✓ KHỚP 100%' : '✗ LỆCH BẢNG'}`);

    const comparisons = [];
    let allDataMatched = true;

    for (const table of origTableNames) {
      const [origCount] = await adminConn.query(`SELECT COUNT(*) as c FROM denso_iot.\`${table}\``);
      const [restCount] = await adminConn.query(`SELECT COUNT(*) as c FROM \`${targetDb}\`.\`${table}\``);

      const oC = origCount[0].c;
      const rC = restCount[0].c;
      const isMatch = oC === rC;
      if (!isMatch) allDataMatched = false;

      comparisons.push({
        table,
        originalCount: oC,
        restoredCount: rC,
        status: isMatch ? 'KHỚP' : 'LỆCH',
      });
    }

    console.log('\nBảng chi tiết số lượng bản ghi:');
    console.table(comparisons);

    // Kiểm tra sâu telemetry
    const [origTele] = await adminConn.query(`
      SELECT COUNT(*) as c, MIN(timestamp) as min_ts, MAX(timestamp) as max_ts, SUM(value) as sum_val
      FROM denso_iot.machine_telemetry_history
    `);
    const [restTele] = await adminConn.query(`
      SELECT COUNT(*) as c, MIN(timestamp) as min_ts, MAX(timestamp) as max_ts, SUM(value) as sum_val
      FROM \`${targetDb}\`.machine_telemetry_history
    `);

    console.log('\nKiểm tra sâu tính toàn vẹn Telemetry:');
    console.log('  * Gốc:       ', origTele[0]);
    console.log('  * Đã restore:', restTele[0]);

    const deepTelemetryMatch =
      origTele[0].c === restTele[0].c &&
      origTele[0].min_ts === restTele[0].min_ts &&
      origTele[0].max_ts === restTele[0].max_ts &&
      Math.abs(Number(origTele[0].sum_val) - Number(restTele[0].sum_val)) < 0.01;

    console.log(`=> So khớp sâu Telemetry (Count, Min, Max, Checksum Sum): ${deepTelemetryMatch ? '✓ HOÀN HẢO 100%' : '✗ LỖI'}`);

    await adminConn.end();
    return {
      success: tablesMatch && allDataMatched && deepTelemetryMatch,
      targetDb,
      comparisons,
      deepTelemetryMatch,
    };
  } catch (err) {
    console.error('❌ [RESTORE VERIFY ERROR]:', err.message);
    await adminConn.end();
    throw err;
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const filePath = fileArg ? fileArg.split('=')[1] : null;
  restoreAndVerify(filePath)
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}
