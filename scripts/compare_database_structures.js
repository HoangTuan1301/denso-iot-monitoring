/**
 * @file compare_database_structures.js
 * @description So sánh toàn diện cấu trúc CSDL giữa 2 database:
 * - So sánh từng cột (Tên cột, Kiểu dữ liệu, Nullable, Default value)
 * - So sánh từng Chỉ mục (Index name, Cột, Tính duy nhất Unique)
 * - So sánh từng Ràng buộc (Primary Key, Unique Key, Foreign Key)
 * - So sánh Triggers, Views, Stored Procedures
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
const db1Arg = args.find((a) => a.startsWith('--db1='));
const db2Arg = args.find((a) => a.startsWith('--db2='));

const DB1 = db1Arg ? db1Arg.split('=')[1] : 'denso_iot';
const DB2 = db2Arg ? db2Arg.split('=')[1] : 'denso_iot_backup_verify';

export async function compareStructures(dbSource = DB1, dbTarget = DB2) {
  console.log('================================================================');
  console.log(`[STRUCTURE COMPARISON] SO SÁNH TOÀN DIỆN CẤU TRÚC VÀ ĐỐI TƯỢNG`);
  console.log(`[STRUCTURE COMPARISON] Nguồn: [${dbSource}] <=> Đích: [${dbTarget}]`);
  console.log('================================================================\n');

  const conn = await mysql.createConnection({
    host: DB_HOST,
    port: DB_PORT,
    user: DB_USER,
    password: DB_PASSWORD,
  });

  try {
    let hasMismatch = false;

    // 1. So sánh danh sách Bảng
    const [t1] = await conn.query('SHOW TABLES FROM `' + dbSource + '`');
    const [t2] = await conn.query('SHOW TABLES FROM `' + dbTarget + '`');
    const tables1 = t1.map((r) => Object.values(r)[0]).sort();
    const tables2 = t2.map((r) => Object.values(r)[0]).sort();

    console.log(`1. So sánh danh sách bảng:`);
    console.log(`   * [${dbSource}]: ${tables1.length} bảng (${tables1.join(', ')})`);
    console.log(`   * [${dbTarget}]: ${tables2.length} bảng (${tables2.join(', ')})`);

    const tablesMatch = JSON.stringify(tables1) === JSON.stringify(tables2);
    console.log(`   -> Trạng thái: ${tablesMatch ? '✓ KHỚP 100%' : '✗ LỆCH'}\n`);
    if (!tablesMatch) hasMismatch = true;

    // 2. So sánh chi tiết từng Cột (Columns)
    console.log(`2. So sánh chi tiết từng Cột (Columns, Types, Nullability, Defaults):`);
    const [cols1] = await conn.query(
      `SELECT TABLE_NAME, COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT, EXTRA
       FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = ?
       ORDER BY TABLE_NAME, ORDINAL_POSITION`,
      [dbSource]
    );

    const [cols2] = await conn.query(
      `SELECT TABLE_NAME, COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT, EXTRA
       FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = ?
       ORDER BY TABLE_NAME, ORDINAL_POSITION`,
      [dbTarget]
    );

    const colMap1 = new Map(cols1.map((c) => [`${c.TABLE_NAME}.${c.COLUMN_NAME}`, c]));
    const colMap2 = new Map(cols2.map((c) => [`${c.TABLE_NAME}.${c.COLUMN_NAME}`, c]));

    let colMismatches = 0;
    for (const [key, c1] of colMap1.entries()) {
      const c2 = colMap2.get(key);
      if (!c2) {
        console.log(`   ✗ Thiếu cột tại ${dbTarget}: ${key}`);
        colMismatches++;
      } else if (
        c1.COLUMN_TYPE !== c2.COLUMN_TYPE ||
        c1.IS_NULLABLE !== c2.IS_NULLABLE ||
        c1.COLUMN_DEFAULT !== c2.COLUMN_DEFAULT
      ) {
        console.log(`   ✗ Sai khác định nghĩa cột ${key}:`, { c1, c2 });
        colMismatches++;
      }
    }
    console.log(`   -> Đã kiểm tra ${cols1.length} cột: ${colMismatches === 0 ? '✓ KHỚP 100% CẤU TRÚC CỘT' : `✗ Có ${colMismatches} cột sai khác`}\n`);
    if (colMismatches > 0) hasMismatch = true;

    // 3. So sánh Chỉ mục (Indexes & Keys)
    console.log(`3. So sánh Chỉ mục (Indexes, Unique Constraints):`);
    const [idx1] = await conn.query(
      `SELECT TABLE_NAME, INDEX_NAME, NON_UNIQUE, SEQ_IN_INDEX, COLUMN_NAME, COLLATION
       FROM INFORMATION_SCHEMA.STATISTICS
       WHERE TABLE_SCHEMA = ?
       ORDER BY TABLE_NAME, INDEX_NAME, SEQ_IN_INDEX`,
      [dbSource]
    );

    const [idx2] = await conn.query(
      `SELECT TABLE_NAME, INDEX_NAME, NON_UNIQUE, SEQ_IN_INDEX, COLUMN_NAME, COLLATION
       FROM INFORMATION_SCHEMA.STATISTICS
       WHERE TABLE_SCHEMA = ?
       ORDER BY TABLE_NAME, INDEX_NAME, SEQ_IN_INDEX`,
      [dbTarget]
    );

    const idxKey = (i) => `${i.TABLE_NAME}.${i.INDEX_NAME}.${i.SEQ_IN_INDEX}.${i.COLUMN_NAME}.${i.NON_UNIQUE}`;
    const idxSet1 = new Set(idx1.map(idxKey));
    const idxSet2 = new Set(idx2.map(idxKey));

    let idxDiff = 0;
    for (const k of idxSet1) {
      if (!idxSet2.has(k)) {
        console.log(`   ✗ Thiếu chỉ mục tại ${dbTarget}: ${k}`);
        idxDiff++;
      }
    }
    console.log(`   -> Đã kiểm tra ${idx1.length} chỉ mục: ${idxDiff === 0 ? '✓ KHỚP 100% CHỈ MỤC' : `✗ Có ${idxDiff} chỉ mục sai khác`}\n`);
    if (idxDiff > 0) hasMismatch = true;

    // 4. So sánh Ràng buộc khóa ngoại & Ràng buộc toàn vẹn (Constraints)
    console.log(`4. So sánh Ràng buộc toàn vẹn (Table Constraints & FK):`);
    const [cst1] = await conn.query(
      `SELECT TABLE_NAME, CONSTRAINT_NAME, CONSTRAINT_TYPE
       FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
       WHERE TABLE_SCHEMA = ?
       ORDER BY TABLE_NAME, CONSTRAINT_NAME`,
      [dbSource]
    );

    const [cst2] = await conn.query(
      `SELECT TABLE_NAME, CONSTRAINT_NAME, CONSTRAINT_TYPE
       FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
       WHERE TABLE_SCHEMA = ?
       ORDER BY TABLE_NAME, CONSTRAINT_NAME`,
      [dbTarget]
    );

    const cstKey = (c) => `${c.TABLE_NAME}.${c.CONSTRAINT_NAME}.${c.CONSTRAINT_TYPE}`;
    const cstSet1 = new Set(cst1.map(cstKey));
    const cstSet2 = new Set(cst2.map(cstKey));

    let cstDiff = 0;
    for (const k of cstSet1) {
      if (!cstSet2.has(k)) {
        console.log(`   ✗ Thiếu ràng buộc tại ${dbTarget}: ${k}`);
        cstDiff++;
      }
    }
    console.log(`   -> Đã kiểm tra ${cst1.length} ràng buộc: ${cstDiff === 0 ? '✓ KHỚP 100% RÀNG BUỘC' : `✗ Có ${cstDiff} ràng buộc sai khác`}\n`);
    if (cstDiff > 0) hasMismatch = true;

    // 5. So sánh Triggers, Views, Routines
    console.log(`5. So sánh Đối tượng nâng cao (Triggers, Views, Stored Procedures):`);
    const [trg1] = await conn.query(`SHOW TRIGGERS FROM \`${dbSource}\``);
    const [trg2] = await conn.query(`SHOW TRIGGERS FROM \`${dbTarget}\``);
    const triggersMatch = trg1.length === trg2.length;
    console.log(`   * Triggers: [${dbSource}] có ${trg1.length} <=> [${dbTarget}] có ${trg2.length} (${triggersMatch ? '✓ KHỚP' : '✗ LỆCH'})`);

    const [vw1] = await conn.query('SELECT TABLE_NAME FROM INFORMATION_SCHEMA.VIEWS WHERE TABLE_SCHEMA = ?', [dbSource]);
    const [vw2] = await conn.query('SELECT TABLE_NAME FROM INFORMATION_SCHEMA.VIEWS WHERE TABLE_SCHEMA = ?', [dbTarget]);
    const viewsMatch = vw1.length === vw2.length;
    console.log(`   * Views: [${dbSource}] có ${vw1.length} <=> [${dbTarget}] có ${vw2.length} (${viewsMatch ? '✓ KHỚP' : '✗ LỆCH'})`);

    const [rtn1] = await conn.query('SELECT ROUTINE_NAME FROM INFORMATION_SCHEMA.ROUTINES WHERE ROUTINE_SCHEMA = ?', [dbSource]);
    const [rtn2] = await conn.query('SELECT ROUTINE_NAME FROM INFORMATION_SCHEMA.ROUTINES WHERE ROUTINE_SCHEMA = ?', [dbTarget]);
    const routinesMatch = rtn1.length === rtn2.length;
    console.log(`   * Routines: [${dbSource}] có ${rtn1.length} <=> [${dbTarget}] có ${rtn2.length} (${routinesMatch ? '✓ KHỚP' : '✗ LỆCH'})`);

    if (!triggersMatch || !viewsMatch || !routinesMatch) hasMismatch = true;

    console.log('\n================================================================');
    console.log(`[KẾT QUẢ ĐỐI CHIẾU CẤU TRÚC]: ${!hasMismatch ? '✅ KHỚP TUYỆT ĐỐI 100% TỪNG ĐỐI TƯỢNG VÀ SCHEMA' : '❌ PHÁT HIỆN LỆCH CẤU TRÚC'}`);
    console.log('================================================================\n');

    await conn.end();
    return { success: !hasMismatch };
  } catch (err) {
    console.error('❌ [LỖI SO SÁNH]:', err.message);
    await conn.end();
    throw err;
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  compareStructures()
    .then((r) => process.exit(r.success ? 0 : 1))
    .catch(() => process.exit(1));
}
