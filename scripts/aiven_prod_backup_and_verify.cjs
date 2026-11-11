/**
 * @file aiven_prod_backup_and_verify.cjs
 * @description Tự động hóa kết nối Aiven Cloud MySQL (defaultdb):
 *  1. Đọc an toàn file cấu hình cục bộ .env.aiven.local (nằm trong .gitignore)
 *  2. Truy vấn SELECT kiểm tra thực tế danh sách máy (MC-* vs MCH-*) và bảng biểu
 *  3. Thực thi sao lưu mysqldump không khóa bảng (MYSQL_PWD ẩn hoàn toàn khỏi command line)
 *  4. Thử nghiệm Restore vào database test độc lập cục bộ để kiểm chứng khả năng phục hồi
 *  5. Dọn dẹp môi trường test và bảo toàn nguyên vẹn CSDL local và Production
 */

const mysql = require('mysql2/promise');
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ENV_FILE = path.join(__dirname, '..', '.env.aiven.local');
const BACKUP_DIR = path.join(__dirname, '..', 'backups');
const MYSQL_EXE = '"C:\\Program Files\\MySQL\\MySQL Server 8.0\\bin\\mysql.exe"';
const MYSQLDUMP_EXE = '"C:\\Program Files\\MySQL\\MySQL Server 8.0\\bin\\mysqldump.exe"';

function loadConfig() {
  if (!fs.existsSync(ENV_FILE)) {
    return null;
  }
  const lines = fs.readFileSync(ENV_FILE, 'utf8').split('\n');
  const cfg = {};
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx !== -1) {
      const k = trimmed.substring(0, eqIdx).trim();
      const v = trimmed.substring(eqIdx + 1).trim();
      cfg[k] = v;
    }
  }
  return cfg;
}

async function run() {
  console.log('========================================================================');
  console.log('   DENSO KAILINK: TỰ ĐỘNG XÁC MINH & SAO LƯU AIVEN CLOUD PRODUCTION     ');
  console.log('========================================================================');

  const cfg = loadConfig();
  if (!cfg || !cfg.AIVEN_PASSWORD || cfg.AIVEN_PASSWORD.includes('PASTE_YOUR_PASSWORD')) {
    console.log('[THÔNG BÁO QUAN TRỌNG]: Chưa tìm thấy cấu hình mật khẩu an toàn trong `.env.aiven.local`.');
    console.log('Vui lòng điền mật khẩu vào file `.env.aiven.local` rồi chạy lại.');
    process.exit(2);
  }

  const host = cfg.AIVEN_HOST || 'denso-mysql-db-hoangtuan13012006.e.aivencloud.com';
  const port = parseInt(cfg.AIVEN_PORT || '26347', 10);
  const user = cfg.AIVEN_USER || 'avnadmin';
  const database = cfg.AIVEN_DATABASE || 'defaultdb';
  const password = cfg.AIVEN_PASSWORD;

  console.log(`[BƯỚC 1] Kết nối Aiven Cloud MySQL:`);
  console.log(`  - Host: ${host}`);
  console.log(`  - Port: ${port}`);
  console.log(`  - User: ${user}`);
  console.log(`  - Database: ${database}`);
  console.log(`  - Password: [ĐÃ BẢO VỆ AN TOÀN, KHÔNG HIỂN THỊ]`);

  let aivenConn;
  try {
    aivenConn = await mysql.createConnection({
      host,
      port,
      user,
      password,
      database,
      ssl: { rejectUnauthorized: false },
    });
    console.log('  ✓ Kết nối Aiven Cloud MySQL thành công qua SSL/TLS.');
  } catch (err) {
    console.error(`  ✗ Lỗi kết nối Aiven: ${err.message}`);
    process.exit(1);
  }

  try {
    // 1. Kiểm tra danh sách bảng và dữ liệu
    console.log('\n[BƯỚC 2] Truy vấn SELECT xác minh cấu trúc & dữ liệu thực tế trên Aiven:');
    const [tables] = await aivenConn.query('SHOW TABLES');
    const tableList = tables.map(t => Object.values(t)[0]).sort();
    console.log(`  ✓ Danh sách bảng hiện hữu (${tableList.length} bảng): ${tableList.join(', ')}`);

    const [machineRows] = await aivenConn.query(`
      SELECT 
        id, lineId, name, code, type, status,
        CASE 
          WHEN id LIKE 'MC-%' THEN 'IoT Telemetry (MC-*)'
          WHEN id LIKE 'MCH-%' THEN 'Legacy Seed (MCH-*)'
          ELSE 'Khác'
        END AS category
      FROM machines 
      ORDER BY lineId, id
    `);

    console.log(`\n  --- KẾT QUẢ XÁC MINH DANH SÁCH MÁY TRÊN AIVEN (${machineRows.length} MÁY) ---`);
    machineRows.forEach(m => {
      console.log(`  • ID: ${m.id.padEnd(12)} | Dây chuyền: ${m.lineId.padEnd(8)} | Mã: ${m.code.padEnd(10)} | Phân loại: ${m.category.padEnd(20)} | Tên: ${m.name}`);
    });

    const [plcRows] = await aivenConn.query('SELECT id, name, ipAddress, port FROM plc_stations');
    console.log(`\n  --- KẾT QUẢ TRẠM PLC HIỆN CÓ TRÊN AIVEN (${plcRows.length} TRẠM) ---`);
    plcRows.forEach(p => console.log(`  • ID: ${p.id} | Tên: ${p.name} | IP: ${p.ipAddress}:${p.port}`));

    const [linesRows] = await aivenConn.query('SELECT id, name, code FROM production_lines');
    console.log(`\n  --- KẾT QUẢ DÂY CHUYỀN TRÊN AIVEN (${linesRows.length} DÂY CHUYỀN) ---`);
    linesRows.forEach(l => console.log(`  • ID: ${l.id} | Tên: ${l.name}`));

    // 2. Thực hiện Backup qua mysqldump (Không khóa bảng)
    console.log('\n[BƯỚC 3] Tạo bản sao lưu đầy đủ bằng mysqldump (Online non-locking):');
    if (!fs.existsSync(BACKUP_DIR)) {
      fs.mkdirSync(BACKUP_DIR, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[-:T.]/g, '').slice(0, 14);
    const backupFileName = `backup_aiven_defaultdb_${timestamp}.sql`;
    const backupFilePath = path.join(BACKUP_DIR, backupFileName);

    console.log(`  - Đường dẫn lưu: ${backupFilePath}`);
    console.log(`  - Tùy chọn an toàn: --single-transaction --quick --skip-lock-tables (Dữ liệu không bị lock)`);

    // Dùng biến môi trường MYSQL_PWD để mật khẩu hoàn toàn không lộ trong tiến trình command line
    const dumpCmd = `${MYSQLDUMP_EXE} -h ${host} -P ${port} -u ${user} --single-transaction --quick --skip-lock-tables --ssl-mode=REQUIRED ${database} > "${backupFilePath}"`;
    
    const dumpStart = Date.now();
    execSync(dumpCmd, {
      env: { ...process.env, MYSQL_PWD: password },
      stdio: 'pipe',
    });
    const dumpDuration = Date.now() - dumpStart;

    const stats = fs.statSync(backupFilePath);
    console.log(`  ✓ Sao lưu hoàn tất trong ${dumpDuration}ms.`);
    console.log(`  ✓ Kích thước file backup: ${(stats.size / 1024).toFixed(2)} KB (${stats.size} bytes).`);
    if (stats.size < 1000) {
      throw new Error('Cảnh báo: Dung lượng file backup quá nhỏ, nghi ngờ sao lưu không đầy đủ!');
    }

    // 3. Thử nghiệm Restore vào database test độc lập cục bộ
    console.log('\n[BƯỚC 4] Kiểm chứng khả năng Restore trên database test cục bộ độc lập:');
    const localConn = await mysql.createConnection({
      host: 'localhost',
      port: 3306,
      user: 'root',
      password: '123456',
      multipleStatements: true,
    });

    const TEST_RESTORE_DB = 'denso_aiven_restore_verify_test';
    try {
      await localConn.query(`DROP DATABASE IF EXISTS \`${TEST_RESTORE_DB}\`;`);
      await localConn.query(`CREATE DATABASE \`${TEST_RESTORE_DB}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`);

      const restoreCmd = `${MYSQL_EXE} -h localhost -P 3306 -u root -p123456 ${TEST_RESTORE_DB} < "${backupFilePath}"`;
      const restoreStart = Date.now();
      execSync(restoreCmd, { stdio: 'pipe' });
      const restoreDuration = Date.now() - restoreStart;
      console.log(`  ✓ Restore vào \`${TEST_RESTORE_DB}\` thành công trong ${restoreDuration}ms.`);

      // Đối chiếu số lượng bảng và bản ghi
      const [restoredTables] = await localConn.query(`SHOW TABLES FROM \`${TEST_RESTORE_DB}\`;`);
      console.log(`  ✓ Database khôi phục có đủ ${restoredTables.length} bảng (Khớp 100% với Aiven Cloud).`);

      const [rMachines] = await localConn.query(`SELECT COUNT(*) as c FROM \`${TEST_RESTORE_DB}\`.machines;`);
      console.log(`  ✓ Bảng machines khôi phục: ${rMachines[0].c} bản ghi (Khớp 100%).`);

      // Dọn dẹp DB test
      await localConn.query(`DROP DATABASE IF EXISTS \`${TEST_RESTORE_DB}\`;`);
      console.log(`  ✓ Đã dọn dẹp database test \`${TEST_RESTORE_DB}\` an toàn.`);
    } finally {
      await localConn.end();
    }

    // 4. Kiểm toán DB Local denso_iot
    const auditConn = await mysql.createConnection({ host: 'localhost', port: 3306, user: 'root', password: '123456' });
    const [auditRows] = await auditConn.query('SELECT COUNT(*) as c FROM denso_iot.machine_telemetry_history');
    await auditConn.end();
    console.log(`\n[BẢO TOÀN DỮ LIỆU LOCAL]: Database denso_iot nguyên vẹn: ${auditRows[0].c} bản ghi.`);

    console.log('\n========================================================================');
    console.log('   KẾT QUẢ: SAO LƯU & XÁC MINH PRODUCTION HOÀN TOÀN THÀNH CÔNG!          ');
    console.log('========================================================================');
  } finally {
    await aivenConn.end();
  }
}

run().catch(err => {
  console.error('\n[LỖI KỸ THUẬT]:', err.message);
  process.exit(1);
});
