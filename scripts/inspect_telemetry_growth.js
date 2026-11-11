import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../.env') });

async function checkTelemetry() {
  const conn = await mysql.createConnection({
    host: 'localhost',
    port: 3306,
    user: 'root',
    password: process.env.DB_PASSWORD || '123456',
    database: 'denso_iot'
  });

  const [countRows] = await conn.query('SELECT COUNT(*) as cnt FROM machine_telemetry_history');
  console.log('Total rows currently in denso_iot:', countRows[0].cnt);

  const [dateRange] = await conn.query('SELECT MIN(timestamp) as min_ts, MAX(timestamp) as max_ts FROM machine_telemetry_history');
  console.log('Date range:', dateRange[0]);

  // Breakdown by date
  const [byDate] = await conn.query(`
    SELECT DATE(timestamp) as dt, COUNT(*) as cnt, MIN(timestamp) as min_t, MAX(timestamp) as max_t
    FROM machine_telemetry_history
    GROUP BY DATE(timestamp)
    ORDER BY dt
  `);
  console.log('Breakdown by Date:');
  console.table(byDate);

  // Breakdown by machineId & metricId on 2026-11-07
  const [todayRows] = await conn.query(`
    SELECT lineId, machineId, metricId, COUNT(*) as cnt, MIN(timestamp) as min_t, MAX(timestamp) as max_t
    FROM machine_telemetry_history
    WHERE DATE(timestamp) = '2026-11-07'
    GROUP BY lineId, machineId, metricId
  `);
  console.log('Rows on 2026-11-07:');
  console.table(todayRows);

  // Check 5 most recent rows
  const [recentRows] = await conn.query('SELECT id, lineId, machineId, metricId, value, timestamp, quality FROM machine_telemetry_history ORDER BY id DESC LIMIT 5');
  console.log('Most recent rows:');
  console.table(recentRows);

  await conn.end();
}

checkTelemetry();
