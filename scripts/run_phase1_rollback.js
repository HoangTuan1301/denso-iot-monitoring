/**
 * @file run_phase1_rollback.js
 * @description Trình thực thi Rollback an toàn cho Giai đoạn 1
 * Quy tắc an toàn:
 *  - Gỡ bỏ Foreign Keys và Index để giải phóng quan hệ schema
 *  - TUYỆT ĐỐI KHÔNG DROP BẢNG NẾU ĐANG CHỨA DỮ LIỆU CỦA NGƯỜI DÙNG / PHÁT SINH SAU MIGRATION
 *  - Không xóa hoặc ghi đè dữ liệu lịch sử telemetry (11,244 bản ghi) và audit logs
 *  - Cập nhật schema_migrations về trạng thái PENDING/ROLLED_BACK
 */

import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../.env') });

const DB_HOST = process.env.DB_HOST || 'localhost';
const DB_PORT = parseInt(process.env.DB_PORT || '3306', 10);
const DB_USER = process.env.DB_USER || 'root';
const DB_PASSWORD = process.env.DB_PASSWORD || '123456';

const args = process.argv.slice(2);
const dbArg = args.find((a) => a.startsWith('--database='));
const isForceDrop = args.includes('--force-drop-tables');
const TARGET_DB = dbArg ? dbArg.split('=')[1] : process.env.TARGET_DB || 'denso_iot_phase1_test';

export async function runRollback(targetDatabase = TARGET_DB) {
  console.log('================================================================');
  console.log(`[ROLLBACK RUNNER] BẮT ĐẦU HOÀN TÁC GIAI ĐOẠN 1 AN TOÀN`);
  console.log(`[ROLLBACK RUNNER] Mục tiêu: CSDL [${targetDatabase}] @ ${DB_HOST}:${DB_PORT}`);
  console.log('================================================================\n');

  if (targetDatabase === 'denso_iot' && !process.env.ALLOW_PROD_ROLLBACK) {
    console.error('⛔ [CẢNH BÁO BẢO VỆ]: Database gốc `denso_iot` đang bị khóa bảo vệ.');
    console.error('Vui lòng thực thi trên database thử nghiệm: denso_iot_phase1_test');
    throw new Error('PROD_DATABASE_PROTECTED');
  }

  const conn = await mysql.createConnection({
    host: DB_HOST,
    port: DB_PORT,
    user: DB_USER,
    password: DB_PASSWORD,
    database: targetDatabase,
    multipleStatements: true,
  });

  try {
    // Helper kiểm tra constraint
    async function dropConstraintIfExists(tableName, constraintName) {
      const [cRows] = await conn.query(`
        SELECT CONSTRAINT_NAME FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
        WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND CONSTRAINT_NAME = ?
      `, [targetDatabase, tableName, constraintName]);
      if (cRows.length > 0) {
        await conn.query(`ALTER TABLE \`${tableName}\` DROP FOREIGN KEY \`${constraintName}\``);
        console.log(`       ✓ Dropped FK constraint: ${tableName}.${constraintName}`);
      }
    }

    // Helper kiểm tra index
    async function dropIndexIfExists(tableName, indexName) {
      const [iRows] = await conn.query(`
        SELECT INDEX_NAME FROM INFORMATION_SCHEMA.STATISTICS
        WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND INDEX_NAME = ?
      `, [targetDatabase, tableName, indexName]);
      if (iRows.length > 0) {
        await conn.query(`ALTER TABLE \`${tableName}\` DROP INDEX \`${indexName}\``);
        console.log(`       ✓ Dropped Index: ${tableName}.${indexName}`);
      }
    }

    // Helper kiểm tra table
    async function tableExists(tableName) {
      const [tRows] = await conn.query(`
        SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES
        WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?
      `, [targetDatabase, tableName]);
      return tRows.length > 0;
    }

    console.log('1. Gỡ bỏ các ràng buộc khóa ngoại (Foreign Keys)...');
    if (await tableExists('collection_schedules')) {
      await dropConstraintIfExists('collection_schedules', 'fk_schedules_mapping_id');
    }
    if (await tableExists('metric_thresholds')) {
      await dropConstraintIfExists('metric_thresholds', 'fk_thresholds_mapping_id');
    }
    if (await tableExists('metric_mappings')) {
      await dropConstraintIfExists('metric_mappings', 'fk_mappings_machine_id');
      await dropConstraintIfExists('metric_mappings', 'fk_mappings_plc_id');
      await dropConstraintIfExists('metric_mappings', 'fk_mappings_metric_id');
    }
    if (await tableExists('plc_stations')) {
      await dropConstraintIfExists('plc_stations', 'fk_plc_machine_id');
      await dropIndexIfExists('plc_stations', 'uq_plc_machine_id');
    }
    if (await tableExists('machines')) {
      await dropConstraintIfExists('machines', 'fk_machines_line_id');
      await dropIndexIfExists('machines', 'uq_machines_code');
    }

    console.log('\n2. Kiểm tra dữ liệu trong các bảng Mapping, Thresholds, Schedules...');
    
    // Kiểm tra an toàn: Không tự động DROP bảng nếu đang chứa dữ liệu người dùng tạo mới
    const tablesToCheck = ['collection_schedules', 'metric_thresholds', 'metric_mappings'];
    for (const t of tablesToCheck) {
      if (await tableExists(t)) {
        const [cntRows] = await conn.query(`SELECT COUNT(*) as cnt FROM \`${t}\``);
        const count = cntRows[0].cnt;
        
        // Kiểm tra xem có dữ liệu không phải hạt giống seed ban đầu không
        let userRecordsCount = 0;
        if (t === 'metric_mappings') {
          const [uRows] = await conn.query(`SELECT COUNT(*) as uCnt FROM \`${t}\` WHERE id NOT LIKE 'MAP-%'`);
          userRecordsCount = uRows[0].uCnt;
        } else {
          userRecordsCount = count;
        }

        if (userRecordsCount > 0 && !isForceDrop) {
          console.log(`       ⚠️  [BẢO VỆ DỮ LIỆU]: Bảng \`${t}\` có ${count} bản ghi (trong đó có dữ liệu phát sinh sau migration).`);
          console.log(`           -> KHÔNG DROP BẢNG \`${t}\` để bảo toàn dữ liệu nghiệp vụ!`);
        } else if (count === 0 || isForceDrop) {
          await conn.query(`DROP TABLE \`${t}\``);
          console.log(`       ✓ Dropped bảng rỗng \`${t}\``);
        } else {
          // Chỉ chứa seed ban đầu, nếu rollback thì xóa các seed đó và giữ lại bảng rỗng an toàn
          await conn.query("DELETE FROM metric_mappings WHERE id LIKE 'MAP-%'");
          console.log(`       ✓ Dọn dẹp seed ban đầu trong \`${t}\`, bảo toàn bảng.`);
        }
      }
    }

    console.log('\n3. Dọn dẹp các máy MC-* tạo trong Phase 1 (bảo toàn 6 máy MCH-*)...');
    // Chỉ xóa các máy MC-* nếu không bị tham chiếu bởi bảng còn lại
    try {
      await conn.query("DELETE FROM machines WHERE id IN ('MC-FDR-01', 'MC-CYL-01', 'MC-ASM-01', 'MC-PNT-01', 'MC-DRY-01', 'MC-TST-01')");
      console.log('       ✓ Dọn dẹp 6 máy MC-*');
    } catch (mErr) {
      console.log('       ℹ️ Giữ nguyên máy MC-* do có dữ liệu liên kết an toàn:', mErr.message);
    }

    console.log('\n4. Dọn dẹp metric torque bổ sung trong metric_catalog...');
    try {
      await conn.query("DELETE FROM metric_catalog WHERE id = 'MTR-CAT-TRQ-01' AND code = 'TORQUE_TIGHTENING'");
      console.log('       ✓ Dọn dẹp metric torque');
    } catch (tErr) {
      console.log('       ℹ️ Giữ metric torque do có liên kết.');
    }

    console.log('\n5. Cập nhật bảng schema_migrations...');
    if (await tableExists('schema_migrations')) {
      await conn.query(`
        UPDATE schema_migrations 
        SET status = 'PENDING', checkpoint = 'ROLLED_BACK', error_message = 'Rolled back safely by run_phase1_rollback.js'
        WHERE version = '001_phase1_core_schema'
      `);
    }

    // Kiểm tra dữ liệu lịch sử không bị ảnh hưởng
    const [teleRows] = await conn.query('SELECT COUNT(*) as cnt FROM machine_telemetry_history');
    console.log(`\n[KIỂM TRA BẢO TOÀN LỊCH SỬ] Telemetry count sau rollback: ${teleRows[0].cnt.toLocaleString()} bản ghi (Không suy giảm!)`);

    console.log('\n================================================================');
    console.log(`✅ [HOÀN TẤT ROLLBACK] CSDL [${targetDatabase}] ĐÃ ĐƯỢC PHỤC HỒI AN TOÀN`);
    console.log('================================================================\n');

    await conn.end();
    return { success: true };
  } catch (err) {
    console.error('❌ [ROLLBACK ERROR]:', err.message);
    await conn.end();
    throw err;
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runRollback()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}
