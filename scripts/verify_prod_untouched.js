import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config();

const conn = await mysql.createConnection({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '3306'),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '123456',
  database: 'denso_iot'
});

const [t] = await conn.query('SHOW TABLES LIKE "ingested_%"');
console.log('denso_iot ingested tables (must be 0):', t.length);

const [c] = await conn.query('SHOW COLUMNS FROM metric_mappings LIKE "data_source_type"');
console.log('denso_iot data_source_type cols (must be 0):', c.length);

const [[cnt]] = await conn.query('SELECT COUNT(*) as cnt FROM machine_telemetry_history');
console.log('denso_iot telemetry records (must be 16924):', cnt.cnt);

await conn.end();
