/**
 * @file backup_database.js
 * @description Trình sao lưu CSDL an toàn (Schema + Dữ liệu), không lộ mật khẩu trên dòng lệnh
 * Xuất file SQL có gán timestamp, lưu trữ tại thư mục backups/
 * Sử dụng dateStrings: true để bảo toàn 100% độ chính xác của DATETIME và mili-giây mà không bị lệch timezone.
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
const dbArg = args.find((a) => a.startsWith('--database='));
const SOURCE_DB = dbArg ? dbArg.split('=')[1] : process.env.SOURCE_DB || 'denso_iot';

export async function createBackup(databaseName = SOURCE_DB) {
  const timestamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);
  const backupDir = path.join(__dirname, '../backups');
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  const backupFilename = `${databaseName}_backup_${timestamp}.sql`;
  const backupFilePath = path.join(backupDir, backupFilename);

  console.log('================================================================');
  console.log(`[BACKUP PROCESS] BẮT ĐẦU SAO LƯU CSDL: [${databaseName}]`);
  console.log(`[BACKUP PROCESS] File đích: ${backupFilePath}`);
  console.log('================================================================\n');

  // Dùng dateStrings: true để lấy chuỗi raw datetime chính xác tuyệt đối, tránh lệch múi giờ
  const conn = await mysql.createConnection({
    host: DB_HOST,
    port: DB_PORT,
    user: DB_USER,
    password: DB_PASSWORD,
    database: databaseName,
    dateStrings: true,
  });

  const writeStream = fs.createWriteStream(backupFilePath, { encoding: 'utf8' });

  writeStream.write(`-- =============================================================================\n`);
  writeStream.write(`-- DENSO IoT Monitoring System Database Backup\n`);
  writeStream.write(`-- Source Database: ${databaseName}\n`);
  writeStream.write(`-- Timestamp: ${new Date().toISOString()}\n`);
  writeStream.write(`-- Server: MySQL ${DB_HOST}:${DB_PORT}\n`);
  writeStream.write(`-- =============================================================================\n\n`);
  writeStream.write(`SET FOREIGN_KEY_CHECKS=0;\n`);
  writeStream.write(`SET SQL_MODE="NO_AUTO_VALUE_ON_ZERO";\n\n`);

  try {
    const [tables] = await conn.query('SHOW TABLES');
    const tableNames = tables.map((r) => Object.values(r)[0]);
    console.log(`Tìm thấy ${tableNames.length} bảng cần sao lưu:`, tableNames.join(', '));

    for (const table of tableNames) {
      console.log(` -> Đang sao lưu bảng: ${table}...`);
      writeStream.write(`-- -----------------------------------------------------\n`);
      writeStream.write(`-- Table structure for table \`${table}\`\n`);
      writeStream.write(`-- -----------------------------------------------------\n`);
      writeStream.write(`DROP TABLE IF EXISTS \`${table}\`;\n`);

      const [createTableRows] = await conn.query(`SHOW CREATE TABLE \`${table}\``);
      const createTableSql = createTableRows[0]['Create Table'];
      writeStream.write(`${createTableSql};\n\n`);

      // Sao lưu dữ liệu
      const [rows] = await conn.query(`SELECT * FROM \`${table}\``);
      console.log(`    + Đã đọc ${rows.length} bản ghi.`);

      if (rows.length > 0) {
        writeStream.write(`-- Dumping data for table \`${table}\`\n`);
        writeStream.write(`LOCK TABLES \`${table}\` WRITE;\n`);

        const BATCH_SIZE = 500;
        for (let i = 0; i < rows.length; i += BATCH_SIZE) {
          const batch = rows.slice(i, i + BATCH_SIZE);
          const cols = Object.keys(batch[0]);
          const colsList = cols.map((c) => `\`${c}\``).join(', ');

          const valStrings = batch.map((r) => {
            const rowVals = cols.map((c) => {
              const val = r[c];
              if (val === null || val === undefined) return 'NULL';
              if (typeof val === 'number') return val;
              if (typeof val === 'boolean') return val ? 1 : 0;
              // Chuỗi (bao gồm cả date strings chuẩn)
              return `'${String(val).replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
            });
            return `(${rowVals.join(', ')})`;
          });

          writeStream.write(`INSERT INTO \`${table}\` (${colsList}) VALUES \n${valStrings.join(',\n')};\n`);
        }

        writeStream.write(`UNLOCK TABLES;\n\n`);
      }
    }

    writeStream.write(`SET FOREIGN_KEY_CHECKS=1;\n`);
    writeStream.end();

    await new Promise((resolve, reject) => {
      writeStream.on('finish', resolve);
      writeStream.on('error', reject);
    });

    const stats = fs.statSync(backupFilePath);
    console.log(`\n✅ [HOÀN TẤT SAO LƯU] File: ${backupFilename} (${(stats.size / 1024 / 1024).toFixed(2)} MB)`);

    await conn.end();
    return { success: true, filePath: backupFilePath, filename: backupFilename, sizeBytes: stats.size };
  } catch (err) {
    writeStream.end();
    console.error('❌ [BACKUP ERROR]:', err.message);
    await conn.end();
    throw err;
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  createBackup()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}
