/**
 * @file tests/test_phase2f_ingestion_api.js
 * @description Kiểm chứng các REST API giám sát Ingestion Service (Giai đoạn C)
 */

import http from 'http';
import jwt from 'jsonwebtoken';
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../.env') });

const JWT_SECRET = process.env.JWT_SECRET || 'denso-iot-enterprise-secret-key-2026';
const adminToken = jwt.sign({ id: 'usr-admin-01', role: 'ADMIN' }, JWT_SECRET, { expiresIn: '1h' });
const opToken = jwt.sign({ id: 'usr-op-01', role: 'OPERATOR' }, JWT_SECRET, { expiresIn: '1h' });

const TEST_PORT = 5012;
process.env.PORT = String(TEST_PORT);
process.env.DB_NAME = 'denso_iot_phase1_test';
process.env.ENABLE_FILE_INGESTION = 'false'; // Dormant check

let passed = 0;
let total = 0;

function assert(cond, msg) {
  total++;
  if (!cond) {
    console.error(`  ✗ [FAIL] ${msg}`);
    throw new Error(msg);
  }
  passed++;
  console.log(`  ✓ [PASS] ${msg}`);
}

async function fetchApi(endpoint, options = {}) {
  const url = `http://127.0.0.1:${TEST_PORT}${endpoint}`;
  const res = await fetch(url, options);
  let json = null;
  try {
    json = await res.json();
  } catch {}
  return { status: res.status, data: json };
}

async function run() {
  console.log('--- KIỂM CHỨNG REST APIS INGESTION (GIAI ĐOẠN C) ---');
  
  // Import dynamically after env set
  const serverModule = await import('../server/index.js');
  
  // Wait for server to bind
  await new Promise(r => setTimeout(r, 2000));

  // 1. GET /api/ingestion/status không token -> 401
  const resNoAuth = await fetchApi('/api/ingestion/status');
  assert(resNoAuth.status === 401, 'Truy cập /api/ingestion/status không token bị từ chối 401');

  // 2. GET /api/ingestion/status với token admin -> 200 OK
  const resStatus = await fetchApi('/api/ingestion/status', {
    headers: { Authorization: `Bearer ${adminToken}` }
  });
  assert(resStatus.status === 200, 'GET /api/ingestion/status trả về 200 OK');
  assert(resStatus.data.enabled === false, 'enabled = false khi ENABLE_FILE_INGESTION tắt');
  assert(resStatus.data.status === 'DISABLED', 'status = DISABLED');
  assert(Array.isArray(resStatus.data.profiles), 'profiles trả về danh sách hồ sơ đăng ký');

  // 3. GET /api/ingestion/files với token -> 200 OK
  const resFiles = await fetchApi('/api/ingestion/files', {
    headers: { Authorization: `Bearer ${adminToken}` }
  });
  assert(resFiles.status === 200, 'GET /api/ingestion/files trả về 200 OK');
  assert(Array.isArray(resFiles.data.files), 'files trả về danh sách mảng');

  // 4. GET /api/ingestion/conflicts với token -> 200 OK
  const resConflicts = await fetchApi('/api/ingestion/conflicts', {
    headers: { Authorization: `Bearer ${adminToken}` }
  });
  assert(resConflicts.status === 200, 'GET /api/ingestion/conflicts trả về 200 OK');
  assert(Array.isArray(resConflicts.data.conflicts), 'conflicts trả về danh sách mảng');

  // 5. POST /api/ingestion/pause với OPERATOR -> 403 Forbidden
  const resPauseOp = await fetchApi('/api/ingestion/pause', {
    method: 'POST',
    headers: { Authorization: `Bearer ${opToken}` }
  });
  assert(resPauseOp.status === 403, 'OPERATOR bị chặn tạm dừng Ingestion Watcher (403 Forbidden)');

  console.log(`\n=> KẾT QUẢ API INGESTION: ${passed}/${total} PASS (100%)\n`);
  process.exit(0);
}

run().catch(err => {
  console.error('Lỗi kiểm thử API:', err);
  process.exit(1);
});
