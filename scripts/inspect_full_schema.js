import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../.env') });

async function dumpSchema() {
  const conn = await mysql.createConnection({
    host: 'localhost',
    port: 3306,
    user: 'root',
    password: process.env.DB_PASSWORD || '123456',
    database: 'denso_iot'
  });

  const [tables] = await conn.query('SHOW TABLES');
  const tableNames = tables.map(r => Object.values(r)[0]);

  for (const t of tableNames) {
    const [res] = await conn.query(`SHOW CREATE TABLE \`${t}\``);
    console.log(`-- ==========================================`);
    console.log(`-- Table: ${t}`);
    console.log(`-- ==========================================`);
    console.log(res[0]['Create Table'] + ';\n');
  }

  // Dump foreign keys specifically
  const [fks] = await conn.query(`
    SELECT 
      TABLE_NAME, COLUMN_NAME, CONSTRAINT_NAME, 
      REFERENCED_TABLE_NAME, REFERENCED_COLUMN_NAME
    FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
    WHERE TABLE_SCHEMA = 'denso_iot' AND REFERENCED_TABLE_NAME IS NOT NULL
    ORDER BY TABLE_NAME, CONSTRAINT_NAME
  `);
  console.log('-- ==========================================');
  console.log('-- FOREIGN KEYS:');
  console.log('-- ==========================================');
  console.table(fks);

  await conn.end();
}

dumpSchema();
