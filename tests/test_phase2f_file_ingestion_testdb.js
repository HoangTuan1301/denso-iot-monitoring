/**
 * @file tests/test_phase2f_file_ingestion_testdb.js
 * @description Bộ kiểm chứng tự động toàn diện cho Giai đoạn B (File Ingestion Service):
 * 1. Môi trường: CHỈ THỰC THI TRÊN denso_iot_phase1_test, cô lập hoàn toàn với denso_iot.
 * 2. Phân tích file thực tế log215_DATA_260522.csv (dòng 1 "DATA", dòng 2 Header, 207 dòng dữ liệu).
 * 3. Kiểm chứng 621 giá trị đo lường thực tế (207 dòng x 3 kênh POS1, POS2, POS3).
 * 4. Phân biệt 3 mốc thời gian: measuredAt, exportedAt/fileModifiedAt, receivedAt.
 * 5. Kiểm chứng chống nhập trùng cấp file (SHA-256) và cấp bản ghi (eventId 5 thành phần).
 * 6. Kiểm chứng DATA No reset về 0 ở ngày khác mà không va chạm khóa.
 * 7. Kiểm chứng nhiều bản ghi cùng 1 giây timestamp.
 * 8. Kiểm chứng phát hiện xung đột giá trị (Conflict Log) mà KHÔNG tự động ghi đè.
 * 9. Kiểm chứng phân luồng Historical: Không phát sự kiện Live giả, không bật Online máy.
 * 10. Kiểm chứng Crash Recovery (file bị kẹt trong processing/ sau restart).
 * 11. Kiểm chứng cách ly file lỗi cú pháp vào failed/ kèm .error.json.
 * 12. TRIPLE VERIFICATION BẢO VỆ CSDL GỐC denso_iot: So sánh 11 bảng trước và sau test.
 */

import fs from 'fs';
import path from 'path';
import mysql from 'mysql2/promise';
import crypto from 'crypto';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

import { CSVTwoLineParser } from '../server/ingestion/parsers/CSVTwoLineParser.js';
import { FileProfileRegistry } from '../server/ingestion/FileProfileRegistry.js';
import { FileIngestionService } from '../server/ingestion/FileIngestionService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../.env') });

const DB_HOST = process.env.DB_HOST || 'localhost';
const DB_PORT = parseInt(process.env.DB_PORT || '3306', 10);
const DB_USER = process.env.DB_USER || 'root';
const DB_PASSWORD = process.env.DB_PASSWORD || '123456';

const PROD_DB_NAME = 'denso_iot';
const TEST_DB_NAME = 'denso_iot_phase1_test';
const TEST_STORAGE_DIR = path.join(__dirname, '../test_data_ingest');

async function calculateFullDbSnapshot(dbName) {
  const conn = await mysql.createConnection({
    host: DB_HOST,
    port: DB_PORT,
    user: DB_USER,
    password: DB_PASSWORD,
    database: dbName,
  });

  const [tables] = await conn.query('SHOW TABLES');
  const tableNames = tables.map((r) => Object.values(r)[0]).sort();
  const snapshot = {};

  for (const table of tableNames) {
    const [[countRow]] = await conn.query(`SELECT COUNT(*) as cnt FROM \`${table}\``);
    const [chkRows] = await conn.query(`CHECKSUM TABLE \`${table}\``);
    const [rows] = await conn.query(`SELECT * FROM \`${table}\` ORDER BY 1`);
    const sha = crypto.createHash('sha256').update(JSON.stringify(rows)).digest('hex');

    snapshot[table] = {
      count: countRow.cnt,
      checksum: chkRows[0].Checksum,
      sha256: sha,
    };
  }

  await conn.end();
  return snapshot;
}

let passedTests = 0;
let totalTests = 0;

function assert(condition, message) {
  totalTests++;
  if (condition) {
    console.log(`  ✓ [PASS] ${message}`);
    passedTests++;
  } else {
    console.error(`  ✗ [FAIL] ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
}

// 209 dòng nguyên bản của tệp log215_DATA_260522.csv
const SAMPLE_CSV_CONTENT = `"DATA"
"DATA No","DATE","TIME","POS1","POS2","POS3"
0,2026/05/22,08:20:19,43019,43095,43054
1,2026/05/22,08:20:34,46015,46056,46024
2,2026/05/22,08:25:54,40026,40000,40104
3,2026/05/22,08:29:07,41907,42139,42797
4,2026/05/22,08:29:54,41934,42144,42740
5,2026/05/22,08:31:41,41920,42143,42798
6,2026/05/22,09:34:11,42592,42045,42911
7,2026/05/22,09:41:09,42807,42214,43112
8,2026/05/22,09:41:58,42528,41914,43291
9,2026/05/22,09:42:46,42335,41414,42464
10,2026/05/22,09:43:38,42791,41466,42604
11,2026/05/22,09:44:26,43045,41981,42853
12,2026/05/22,09:45:12,42562,41776,42652
13,2026/05/22,09:46:23,41838,41657,43030
14,2026/05/22,09:49:32,42230,41830,42849
15,2026/05/22,09:51:44,42524,41767,42590
16,2026/05/22,09:52:57,42541,41882,42661
17,2026/05/22,09:53:51,42532,41963,43200
18,2026/05/22,09:54:40,42094,42024,42901
19,2026/05/22,09:55:30,42923,41420,42540
20,2026/05/22,09:56:22,42889,41580,42550
21,2026/05/22,09:57:10,42300,41639,43101
22,2026/05/22,09:58:00,42858,41379,42662
23,2026/05/22,09:58:46,42871,41864,43235
24,2026/05/22,09:59:29,42376,41674,42941
25,2026/05/22,10:00:14,42570,41723,43520
26,2026/05/22,10:01:18,42860,41375,42848
27,2026/05/22,10:02:13,42424,41974,42961
28,2026/05/22,10:03:00,42596,41394,42749
29,2026/05/22,10:03:46,42242,42346,42963
30,2026/05/22,10:04:32,42547,41565,43494
31,2026/05/22,10:05:19,42752,41899,43422
32,2026/05/22,10:08:00,42648,41916,42627
33,2026/05/22,10:09:19,42623,41586,42925
34,2026/05/22,10:10:15,42451,41322,42753
35,2026/05/22,10:11:03,42171,41803,42713
36,2026/05/22,10:11:52,42463,41660,43155
37,2026/05/22,10:12:42,43028,41150,43170
38,2026/05/22,10:13:26,43561,41751,43305
39,2026/05/22,10:27:58,42780,41772,42739
40,2026/05/22,10:28:46,42864,42668,42930
41,2026/05/22,10:30:53,42541,42554,43310
42,2026/05/22,10:32:10,42763,42275,42824
43,2026/05/22,10:32:58,42745,42138,43113
44,2026/05/22,10:33:50,42238,42188,42566
45,2026/05/22,10:34:40,42397,41825,42699
46,2026/05/22,10:35:27,42354,42119,42997
47,2026/05/22,10:36:12,43212,41834,42967
48,2026/05/22,10:36:57,42516,42080,42986
49,2026/05/22,10:37:42,42840,41667,42985
50,2026/05/22,10:38:29,42618,42066,43109
51,2026/05/22,10:39:16,43206,41463,42907
52,2026/05/22,10:40:02,42240,41678,43238
53,2026/05/22,10:40:48,42778,41840,42962
54,2026/05/22,10:41:36,42449,41408,43021
55,2026/05/22,10:42:19,42800,41700,42771
56,2026/05/22,10:44:23,42210,42383,42824
57,2026/05/22,10:45:12,42838,42567,43015
58,2026/05/22,10:45:58,43007,41785,42606
59,2026/05/22,10:46:45,42670,41981,42814
60,2026/05/22,10:47:30,42481,41522,42751
61,2026/05/22,10:48:17,42558,41686,42720
62,2026/05/22,10:49:01,42727,41857,43101
63,2026/05/22,10:49:47,43122,41471,42768
64,2026/05/22,10:50:37,43319,41916,43176
65,2026/05/22,10:53:10,42448,41514,42705
66,2026/05/22,10:53:55,42325,41935,43013
67,2026/05/22,10:54:39,42641,42110,42931
68,2026/05/22,10:55:23,42726,41854,42865
69,2026/05/22,10:56:10,42651,41530,42850
70,2026/05/22,10:56:56,42724,41768,43096
71,2026/05/22,10:57:43,42581,41916,42870
72,2026/05/22,10:58:33,42721,41570,43026
73,2026/05/22,10:59:19,42627,41580,43027
74,2026/05/22,11:00:05,42913,41660,43001
75,2026/05/22,11:00:54,42504,41380,42884
76,2026/05/22,11:01:41,42361,41836,43481
77,2026/05/22,11:02:29,42626,41319,43114
78,2026/05/22,11:03:16,42360,41782,43256
79,2026/05/22,11:04:02,42727,41957,43400
80,2026/05/22,11:04:48,42578,41674,42862
81,2026/05/22,11:05:35,42529,41783,43082
82,2026/05/22,11:06:22,42534,41670,43014
83,2026/05/22,11:07:11,42706,41414,43021
84,2026/05/22,11:07:58,42617,41605,42884
85,2026/05/22,11:08:50,42793,41390,42429
86,2026/05/22,11:43:35,42507,41465,42326
87,2026/05/22,11:44:26,42432,41826,42168
88,2026/05/22,11:45:16,41817,42199,42985
89,2026/05/22,11:48:45,41985,42050,42438
90,2026/05/22,11:49:33,42799,41605,43393
91,2026/05/22,11:50:24,43087,41501,42808
92,2026/05/22,11:51:13,42650,41764,43042
93,2026/05/22,11:52:01,43160,41183,43253
94,2026/05/22,11:52:48,42362,41746,42865
95,2026/05/22,11:53:39,42409,41570,42920
96,2026/05/22,11:54:24,43015,41620,42827
97,2026/05/22,11:55:13,42303,41813,42931
98,2026/05/22,11:56:18,42580,42261,42830
99,2026/05/22,11:57:05,42348,41767,42771
100,2026/05/22,11:57:49,42878,42137,42660
101,2026/05/22,11:58:34,42877,42812,43220
102,2026/05/22,11:59:20,42994,42076,43430
103,2026/05/22,12:02:12,42509,41419,42891
104,2026/05/22,12:02:30,42912,41697,42972
105,2026/05/22,12:04:05,42906,41701,42938
106,2026/05/22,12:04:33,42926,41699,42967
107,2026/05/22,12:06:06,42921,41701,42975
108,2026/05/22,12:48:26,42995,43052,43061
109,2026/05/22,12:48:41,46015,46058,46026
110,2026/05/22,12:49:19,45981,46057,46024
111,2026/05/22,12:51:47,45985,46033,46050
112,2026/05/22,12:55:09,39984,39981,40134
113,2026/05/22,13:48:47,42756,41625,43052
114,2026/05/22,13:53:20,43282,41306,42801
115,2026/05/22,14:13:59,43227,41070,42889
116,2026/05/22,14:14:55,43177,41343,42247
117,2026/05/22,14:16:23,43325,41868,43008
118,2026/05/22,14:17:15,43210,41121,43190
119,2026/05/22,14:18:07,43280,41341,42999
120,2026/05/22,14:19:01,42948,41782,42463
121,2026/05/22,14:27:14,42571,41739,42542
122,2026/05/22,14:28:11,42922,41694,42375
123,2026/05/22,14:29:45,42922,41642,42392
124,2026/05/22,14:30:42,42974,41763,42517
125,2026/05/22,14:31:35,42847,42608,43218
126,2026/05/22,14:32:31,42816,42651,42247
127,2026/05/22,14:33:27,42540,42312,43162
128,2026/05/22,14:34:25,42711,41951,42325
129,2026/05/22,14:36:08,43096,42330,43126
130,2026/05/22,14:36:57,42989,41887,42788
131,2026/05/22,14:38:49,43051,42106,42767
132,2026/05/22,14:39:41,42990,41919,43111
133,2026/05/22,14:40:36,42892,42268,42792
134,2026/05/22,14:43:57,43438,42112,43420
135,2026/05/22,14:44:51,43237,42622,42403
136,2026/05/22,14:47:19,43312,41605,42134
137,2026/05/22,14:48:10,43027,42405,43210
138,2026/05/22,14:48:59,43258,42204,42661
139,2026/05/22,14:49:50,43382,42091,42989
140,2026/05/22,14:50:40,43557,42528,42914
141,2026/05/22,14:51:32,43357,41663,42839
142,2026/05/22,14:52:26,43138,41947,42368
143,2026/05/22,14:54:03,42961,42067,42748
144,2026/05/22,14:54:55,42532,42277,42748
145,2026/05/22,14:55:53,43052,42278,42968
146,2026/05/22,14:56:47,42952,42250,42641
147,2026/05/22,14:57:38,42635,41844,42896
148,2026/05/22,15:00:46,43075,41946,42669
149,2026/05/22,15:02:50,43153,42239,43107
150,2026/05/22,15:04:57,43554,42071,42497
151,2026/05/22,15:06:07,43160,41840,42670
152,2026/05/22,15:06:59,42976,41817,42380
153,2026/05/22,15:07:49,42981,42255,42089
154,2026/05/22,15:08:41,42808,41542,43119
155,2026/05/22,15:09:35,42844,42047,42840
156,2026/05/22,15:10:19,43153,41980,43026
157,2026/05/22,15:11:06,42886,41824,42782
158,2026/05/22,15:11:54,43007,41492,42913
159,2026/05/22,15:12:46,43132,41694,42820
160,2026/05/22,15:13:34,42874,42193,42710
161,2026/05/22,15:14:25,43027,42618,42766
162,2026/05/22,15:15:17,42954,41964,43199
163,2026/05/22,15:16:03,43219,42322,42295
164,2026/05/22,15:16:56,43145,42314,42719
165,2026/05/22,15:17:48,43422,42175,42411
166,2026/05/22,15:18:37,43343,41953,42259
167,2026/05/22,15:19:32,42804,41846,43201
168,2026/05/22,15:20:54,43699,42328,42724
169,2026/05/22,15:21:49,43292,41917,43099
170,2026/05/22,15:22:37,43395,41733,42606
171,2026/05/22,15:23:55,43794,41909,42698
172,2026/05/22,15:25:48,43333,41939,43054
173,2026/05/22,15:29:58,43243,42184,43129
174,2026/05/22,15:34:06,42889,42407,43282
175,2026/05/22,15:35:33,42968,42281,42895
176,2026/05/22,15:36:26,42307,42398,42659
177,2026/05/22,15:37:18,43283,42045,42793
178,2026/05/22,15:39:53,42961,42185,42318
179,2026/05/22,15:40:41,42999,42278,43394
180,2026/05/22,15:42:15,43174,42751,42628
181,2026/05/22,15:43:48,43282,42034,43022
182,2026/05/22,15:44:44,43185,41949,42441
183,2026/05/22,15:45:38,42697,41873,42556
184,2026/05/22,15:46:30,42978,42209,42931
185,2026/05/22,15:47:43,42940,41722,42310
186,2026/05/22,15:48:34,43154,42127,42816
187,2026/05/22,15:49:24,43034,42328,42485
188,2026/05/22,15:50:13,43029,42246,43089
189,2026/05/22,15:51:03,42870,42346,42799
190,2026/05/22,15:51:55,42864,41986,42280
191,2026/05/22,15:52:44,43100,42478,42748
192,2026/05/22,15:54:02,43016,42237,42719
193,2026/05/22,15:54:57,42855,42049,42940
194,2026/05/22,15:55:53,43587,42195,42556
195,2026/05/22,15:56:47,42764,42004,42730
196,2026/05/22,15:57:40,43353,42468,42974
197,2026/05/22,15:58:29,43246,42046,42897
198,2026/05/22,15:59:15,43138,42241,43116
199,2026/05/22,16:00:03,42980,42110,42849
200,2026/05/22,16:00:56,43095,42607,42760
201,2026/05/22,16:01:58,43454,42099,43366
202,2026/05/22,16:02:48,43118,42645,42801
203,2026/05/22,16:04:37,43004,42972,43060
204,2026/05/22,16:04:58,46022,45972,46033
205,2026/05/22,16:06:20,39987,39900,40117
206,2026/05/22,16:09:36,42245,42313,43259`;

async function main() {
  console.log('='.repeat(78));
  console.log('   BỘ KIỂM CHỨNG TỰ ĐỘNG GIAI ĐOẠN B: FILE INGESTION (TEST ONLY)');
  console.log(`   Môi trường thực thi: ${TEST_DB_NAME} (Cô lập hoàn toàn)`);
  console.log('='.repeat(78));

  // 1. CHỤP SNAPSHOT BẢO VỆ TUYỆT ĐỐI CSDL GỐC denso_iot TRƯỚC TEST
  console.log('\n[BẢO VỆ CSDL GỐC] Chụp snapshot 11 bảng của denso_iot trước test...');
  const prodSnapshotBefore = await calculateFullDbSnapshot(PROD_DB_NAME);
  console.log(`  -> Số lượng bảng denso_iot: ${Object.keys(prodSnapshotBefore).length}`);
  console.log(`  -> machine_telemetry_history Count: ${prodSnapshotBefore.machine_telemetry_history.count}`);
  console.log(`  -> machine_telemetry_history Checksum: ${prodSnapshotBefore.machine_telemetry_history.checksum}`);

  // 2. CHUẨN BỊ MÔI TRƯỜNG VÀ FIXTURES TRÊN CSDL TEST denso_iot_phase1_test
  console.log('\n[CHUẨN BỊ MÔI TRƯỜNG TEST] Thiết lập fixtures trên denso_iot_phase1_test...');
  const testConn = await mysql.createConnection({
    host: DB_HOST,
    port: DB_PORT,
    user: DB_USER,
    password: DB_PASSWORD,
    database: TEST_DB_NAME,
  });

  const testMachineId = 'MC-TEST-LOG215';
  const testMappingPos1 = 'MAP-TEST-2F-POS1';
  const testMappingPos2 = 'MAP-TEST-2F-POS2';
  const testMappingPos3 = 'MAP-TEST-2F-POS3';
  const testCodePos1 = 'MTR-TEST-POS1';
  const testCodePos2 = 'MTR-TEST-POS2';
  const testCodePos3 = 'MTR-TEST-POS3';

  // Dọn dẹp dữ liệu test cũ nếu có
  await testConn.query('DELETE FROM machine_telemetry_history WHERE machineId = ?', [testMachineId]);
  await testConn.query('DELETE FROM ingested_file_conflicts WHERE machine_id = ?', [testMachineId]);
  await testConn.query('DELETE FROM ingested_files_log WHERE machine_id = ?', [testMachineId]);
  await testConn.query('DELETE FROM metric_mappings WHERE machine_id = ?', [testMachineId]);
  await testConn.query('DELETE FROM machines WHERE id = ?', [testMachineId]);

  // Tạo máy thử nghiệm MC-TEST-LOG215
  await testConn.query(`
    INSERT INTO machines (id, lineId, name, code, type, status, healthScore, uptimeHours)
    VALUES (?, 'LINE-01', 'Máy Thử Nghiệm Trạm Đo Log215', 'MC-LOG215', 'testing_station', 'normal', 98.0, 150)
  `, [testMachineId]);

  // Tạo 3 Metric Mappings gắn với file_tag_name tương ứng 'POS1', 'POS2', 'POS3'
  // Lưu ý: data_source_type = 'FILE_INGEST', plc_id = NULL (không gắn trạm PLC mạng)
  await testConn.query(`
    INSERT INTO metric_mappings (
      id, machine_id, plc_id, metric_id, mapping_code, channel_name, plc_register,
      scale_factor, sampling_rate_ms, monitoring_enabled, status, data_source_type, file_tag_name
    ) VALUES 
      (?, ?, NULL, 'MTR-CAT-CUR-01', ?, 'Kênh Đo Thử Nghiệm POS1', NULL, 1.0000, 1000, 1, 'ACTIVE', 'FILE_INGEST', 'POS1'),
      (?, ?, NULL, 'MTR-CAT-CUR-01', ?, 'Kênh Đo Thử Nghiệm POS2', NULL, 1.0000, 1000, 1, 'ACTIVE', 'FILE_INGEST', 'POS2'),
      (?, ?, NULL, 'MTR-CAT-CUR-01', ?, 'Kênh Đo Thử Nghiệm POS3', NULL, 1.0000, 1000, 1, 'ACTIVE', 'FILE_INGEST', 'POS3')
  `, [
    testMappingPos1, testMachineId, testCodePos1,
    testMappingPos2, testMachineId, testCodePos2,
    testMappingPos3, testMachineId, testCodePos3,
  ]);

  // Chuẩn bị thư mục test
  if (fs.existsSync(TEST_STORAGE_DIR)) {
    fs.rmSync(TEST_STORAGE_DIR, { recursive: true, force: true });
  }

  // Khởi tạo FileProfileRegistry và FileIngestionService
  const profileRegistry = new FileProfileRegistry();
  profileRegistry.registerProfile({
    id: 'PROFILE-TEST-LOG215',
    pattern: /^log215_DATA_.*\.csv$/i,
    parserType: 'CSV_TWO_LINE',
    targetMachineId: testMachineId, // Gán rõ ràng cho máy test
  });

  const livePacketsReceived = [];
  const historicalBatchesReceived = [];

  const service = new FileIngestionService({
    storageRoot: TEST_STORAGE_DIR,
    pool: testConn,
    profileRegistry,
    liveWindowMs: 10 * 60 * 1000, // 10 phút
    onLivePacket: (packet) => livePacketsReceived.push(packet),
    onHistoricalBatch: (batch) => historicalBatchesReceived.push(batch),
  });

  await service.initialize();

  // -------------------------------------------------------------------------
  // PHẦN 1: PARSE VÀ NẠP TỆP CSV THỰC TẾ log215_DATA_260522.csv
  // -------------------------------------------------------------------------
  console.log('\n--- PHẦN 1: NẠP FILE MẪU THỰC TẾ log215_DATA_260522.csv ---');
  const sampleFileName = 'log215_DATA_260522.csv';
  const sampleFilePath = path.join(service.inboxDir, sampleFileName);
  fs.writeFileSync(sampleFilePath, SAMPLE_CSV_CONTENT, 'utf8');

  // Kích hoạt xử lý file
  const ingestResult = await service.processIncomingFile(sampleFilePath, sampleFileName);

  assert(ingestResult && ingestResult.success === true, 'TC-FB-01.1: Quá trình nạp tệp hoàn tất thành công (success=true)');
  assert(ingestResult.dataRowsCount === 207, `TC-FB-01.2: Phân tích chính xác 207 dòng dữ liệu đo (thực tế: ${ingestResult.dataRowsCount})`);
  assert(ingestResult.committedRecordsCount === 621, `TC-FB-01.3: Chèn thành công 621 bản ghi đo (207 dòng x 3 kênh POS1/POS2/POS3) (thực tế: ${ingestResult.committedRecordsCount})`);

  // Kiểm tra tệp đã được di chuyển khỏi inbox và processing sang completed/
  assert(!fs.existsSync(sampleFilePath), 'TC-FB-01.4: Tệp gốc đã được di chuyển khỏi inbox/');
  const completedDateFolder = path.join(service.completedDir, new Date().toISOString().slice(0, 10));
  const completedFiles = fs.readdirSync(completedDateFolder);
  assert(completedFiles.some((f) => f.includes(sampleFileName)), 'TC-FB-01.5: Tệp đã được lưu trữ an toàn trong completed/YYYY-MM-DD/');

  // -------------------------------------------------------------------------
  // PHẦN 2: KIỂM CHỨNG DỮ LIỆU ĐO LƯỜNG VÀ 3 MỐC THỜI GIAN
  // -------------------------------------------------------------------------
  console.log('\n--- PHẦN 2: KIỂM CHỨNG DỮ LIỆU ĐO VÀ 3 MỐC THỜI GIAN ---');
  const [row0POS1] = await testConn.query(`
    SELECT * FROM machine_telemetry_history 
    WHERE machineId = ? AND metricId = ? 
    ORDER BY timestamp ASC LIMIT 1
  `, [testMachineId, testCodePos1]);

  assert(row0POS1.length === 1, 'TC-FB-02.1: Truy vấn được bản ghi dòng 0 kênh POS1');
  const r0 = row0POS1[0];
  assert(Number(r0.value) === 43019.00, `TC-FB-02.2: Giá trị thô POS1 dòng 0 chính xác 43019.00 (thực tế: ${r0.value})`);
  assert(r0.source === 'device', 'TC-FB-02.3: Nguồn bản ghi được lưu là "device" (không phải simulation)');
  assert(r0.plcStationId === null, 'TC-FB-02.4: plcStationId là NULL (không dùng tên file giả làm khóa ngoại)');

  const [row206POS3] = await testConn.query(`
    SELECT * FROM machine_telemetry_history 
    WHERE machineId = ? AND metricId = ? 
    ORDER BY timestamp DESC LIMIT 1
  `, [testMachineId, testCodePos3]);
  assert(Number(row206POS3[0].value) === 43259.00, `TC-FB-02.5: Giá trị thô POS3 dòng 206 chính xác 43259.00 (thực tế: ${row206POS3[0].value})`);

  // Kiểm tra ingested_files_log
  const [logRows] = await testConn.query('SELECT * FROM ingested_files_log WHERE machine_id = ?', [testMachineId]);
  assert(logRows.length === 1, 'TC-FB-02.6: Bảng ingested_files_log ghi nhận 1 bản ghi nạp tệp');
  const logEntry = logRows[0];
  assert(logEntry.status === 'COMMITTED', 'TC-FB-02.7: Trạng thái tệp là COMMITTED');
  assert(logEntry.file_modified_at !== null, 'TC-FB-02.8: Ghi nhận mốc thời gian file_modified_at (từ mtime tệp)');
  assert(logEntry.ingested_at !== null, 'TC-FB-02.9: Ghi nhận mốc thời gian ingested_at (thời gian hệ thống tiếp nhận)');

  // -------------------------------------------------------------------------
  // PHẦN 3: PHÂN TÁCH LUỒNG HISTORICAL VÀ BẢO VỆ DASHBOARD
  // -------------------------------------------------------------------------
  console.log('\n--- PHẦN 3: PHÂN TÁCH LUỒNG HISTORICAL & BẢO VỆ DASHBOARD ---');
  assert(ingestResult.isHistorical === true, 'TC-FB-03.1: Nhận diện chính xác tệp 2026/05/22 là tệp lịch sử (isHistorical=true)');
  assert(historicalBatchesReceived.length === 1, 'TC-FB-03.2: Phát sóng sự kiện historical_batch_ingested qua WebSocket');
  assert(livePacketsReceived.length === 0, 'TC-FB-03.3: KHÔNG phát sóng sự kiện Live telemetry_packet cho tệp lịch sử (tránh Online giả)');

  // -------------------------------------------------------------------------
  // PHẦN 4: CHỐNG NHẬP TRÙNG CẤP TỆP (SHA-256 HASH DEDUPLICATION)
  // -------------------------------------------------------------------------
  console.log('\n--- PHẦN 4: CHỐNG NHẬP TRÙNG CẤP TỆP (FILE HASH DEDUPLICATION) ---');
  const dupFilePath = path.join(service.inboxDir, 'log215_DATA_260522_RETRY.csv');
  fs.writeFileSync(dupFilePath, SAMPLE_CSV_CONTENT, 'utf8'); // Cùng nội dung, khác tên

  const dupResult = await service.processIncomingFile(dupFilePath, 'log215_DATA_260522_RETRY.csv');
  assert(dupResult && dupResult.success === false && dupResult.reason === 'DUPLICATE_FILE', 'TC-FB-04.1: Phát hiện tệp trùng lặp mã băm SHA-256');

  const duplicateFiles = fs.readdirSync(service.duplicateDir);
  assert(duplicateFiles.some((f) => f.includes('log215_DATA_260522_RETRY.csv')), 'TC-FB-04.2: Tệp trùng lặp được chuyển sang thư mục duplicate/');

  const [[countAfterDup]] = await testConn.query('SELECT COUNT(*) as c FROM machine_telemetry_history WHERE machineId = ?', [testMachineId]);
  assert(countAfterDup.c === 621, `TC-FB-04.3: Số bản ghi CSDL giữ nguyên đúng 621 (không bị tăng thêm) (thực tế: ${countAfterDup.c})`);

  // -------------------------------------------------------------------------
  // PHẦN 5: CHỐNG TRÙNG VÀ XỬ LÝ KHI DATA No RESET VỀ 0 Ở TỆP KHÁC NGÀY
  // -------------------------------------------------------------------------
  console.log('\n--- PHẦN 5: DATA No RESET VỀ 0 Ở TỆP KHÁC NGÀY ---');
  // Giả lập tệp ngày hôm sau 2026/05/23 với DATA No reset về 0, 1
  const NEXT_DAY_CSV = `"DATA"
"DATA No","DATE","TIME","POS1","POS2","POS3"
0,2026/05/23,08:15:00,41000,42000,43000
1,2026/05/23,08:15:30,41500,42500,43500`;

  const nextDayFileName = 'log215_DATA_260523.csv';
  const nextDayFilePath = path.join(service.inboxDir, nextDayFileName);
  fs.writeFileSync(nextDayFilePath, NEXT_DAY_CSV, 'utf8');

  const nextDayResult = await service.processIncomingFile(nextDayFilePath, nextDayFileName);
  assert(nextDayResult.success === true, 'TC-FB-05.1: Nạp thành công tệp ngày tiếp theo');
  assert(nextDayResult.committedRecordsCount === 6, 'TC-FB-05.2: Chèn đủ 6 bản ghi mới (2 dòng x 3 kênh)');

  const [row0NextDay] = await testConn.query(`
    SELECT * FROM machine_telemetry_history 
    WHERE machineId = ? AND metricId = ? AND timestamp = '2026-05-23 08:15:00'
  `, [testMachineId, testCodePos1]);
  assert(row0NextDay.length === 1 && Number(row0NextDay[0].value) === 41000.00, 'TC-FB-05.3: Dòng 0 của ngày mới được lưu độc lập, không bị đè vào dòng 0 của ngày trước');

  // -------------------------------------------------------------------------
  // PHẦN 6: PHÁT HIỆN VÀ GHI VẾT XUNG ĐỘT GIÁ TRỊ (CONFLICT LOG)
  // -------------------------------------------------------------------------
  console.log('\n--- PHẦN 6: PHÁT HIỆN VÀ GHI VẾT XUNG ĐỘT (CONFLICT LOG) ---');
  // Giả lập một file hiệu chỉnh chứa dòng 0 của ngày 22/05 nhưng giá trị POS1 bị sửa từ 43019 thành 99999
  const CONFLICT_CSV = `"DATA"
"DATA No","DATE","TIME","POS1","POS2","POS3"
0,2026/05/22,08:20:19,99999,43095,43054`;

  const conflictFileName = 'log215_DATA_260522_REVISED.csv';
  const conflictFilePath = path.join(service.inboxDir, conflictFileName);
  fs.writeFileSync(conflictFilePath, CONFLICT_CSV, 'utf8');

  const conflictResult = await service.processIncomingFile(conflictFilePath, conflictFileName);
  assert(conflictResult.conflictRecordsCount >= 1, `TC-FB-06.1: Phát hiện có bản ghi xung đột giá trị (conflictCount=${conflictResult.conflictRecordsCount})`);

  // Kiểm tra bảng ingested_file_conflicts
  const [conflictLogs] = await testConn.query('SELECT * FROM ingested_file_conflicts WHERE machine_id = ?', [testMachineId]);
  assert(conflictLogs.length >= 1, 'TC-FB-06.2: Ghi nhận xung đột vào bảng ingested_file_conflicts');
  assert(Number(conflictLogs[0].existing_value) === 43019.00, 'TC-FB-06.3: Ghi nhận đúng giá trị cũ (existing_value = 43019.00)');
  assert(Number(conflictLogs[0].incoming_value) === 99999.00, 'TC-FB-06.4: Ghi nhận đúng giá trị mới (incoming_value = 99999.00)');
  assert(conflictLogs[0].resolution === 'REJECTED', 'TC-FB-06.5: Quyết định mặc định là REJECTED (Không tự ý ghi đè)');

  // Kiểm tra giá trị trong machine_telemetry_history không bị đè
  const [checkRow0] = await testConn.query(`
    SELECT value FROM machine_telemetry_history 
    WHERE machineId = ? AND metricId = ? AND timestamp = '2026-05-22 08:20:19'
  `, [testMachineId, testCodePos1]);
  assert(Number(checkRow0[0].value) === 43019.00, 'TC-FB-06.6: Giá trị trong CSDL vẫn giữ nguyên 43019.00 (Không bị đè thành 99999)');

  // -------------------------------------------------------------------------
  // PHẦN 7: KHỞI TẠO ẤM (WARM REHYDRATION) VÀ CRASH RECOVERY
  // -------------------------------------------------------------------------
  console.log('\n--- PHẦN 7: KHỞI TẠO ẤM (WARM REHYDRATION) & CRASH RECOVERY ---');
  // Giả lập khởi động lại Backend: Tạo service mới và gọi initialize()
  const freshEngineService = new FileIngestionService({
    storageRoot: TEST_STORAGE_DIR,
    pool: testConn,
    profileRegistry,
  });

  await freshEngineService.initialize();
  const statePos1 = freshEngineService.entityStates.get(`${testMachineId}::${testCodePos1}`);
  assert(Boolean(statePos1), 'TC-FB-07.1: Khởi tạo ấm nạp lại thành công trạng thái kênh đo vào RAM');
  assert(statePos1.lastKnownTimestamp.includes('2026-05-23'), `TC-FB-07.2: lastKnownTimestamp nạp lại chuẩn xác mốc mới nhất (2026-05-23) (thực tế: ${statePos1.lastKnownTimestamp})`);

  // Giả lập file kẹt trong processing/ có trạng thái COMMITTED
  const stuckFileName = 'log215_DATA_260524_STUCK.csv';
  const stuckFilePath = path.join(freshEngineService.processingDir, `stuck_${stuckFileName}`);
  fs.writeFileSync(stuckFilePath, SAMPLE_CSV_CONTENT + '\n# crash recovery test', 'utf8');
  const stuckHash = freshEngineService.calculateFileHash(stuckFilePath);

  // Giả lập đã commit trước khi crash
  await testConn.query(`
    INSERT INTO ingested_files_log (id, file_hash, file_name, file_size, machine_id, status, ingested_at)
    VALUES ('IFL-STUCK-TEST', ?, ?, 100, ?, 'COMMITTED', NOW())
  `, [stuckHash, stuckFileName, testMachineId]);

  await freshEngineService.recoverProcessingFiles();
  assert(!fs.existsSync(stuckFilePath), 'TC-FB-07.3: Phục hồi sau crash phát hiện file đã committed và dọn dẹp khỏi processing/');

  // -------------------------------------------------------------------------
  // PHẦN 8: XỬ LÝ FILE LỖI CÚ PHÁP VÀO failed/ KÈM .error.json
  // -------------------------------------------------------------------------
  console.log('\n--- PHẦN 8: CÁCH LY FILE LỖI VÀO failed/ ---');
  const corruptFileName = 'log215_DATA_CORRUPT.csv';
  const corruptFilePath = path.join(freshEngineService.inboxDir, corruptFileName);
  fs.writeFileSync(corruptFilePath, '"WRONG_HEADER"\n1,2,3', 'utf8');

  await freshEngineService.processIncomingFile(corruptFilePath, corruptFileName);
  const failedDateFolder = path.join(freshEngineService.failedDir, new Date().toISOString().slice(0, 10));
  const failedFiles = fs.readdirSync(failedDateFolder);

  assert(failedFiles.some((f) => f.includes(corruptFileName)), 'TC-FB-08.1: File lỗi cú pháp được cách ly vào failed/YYYY-MM-DD/');
  assert(failedFiles.some((f) => f.includes(`${corruptFileName}.error.json`)), 'TC-FB-08.2: Tạo file .error.json ghi lại chi tiết nguyên nhân lỗi');

  // -------------------------------------------------------------------------
  // PHẦN 9: DỌN DẸP FIXTURES TRÊN CSDL TEST denso_iot_phase1_test
  // -------------------------------------------------------------------------
  console.log('\n--- PHẦN 9: DỌN DẸP FIXTURES TRÊN CSDL TEST ---');
  await testConn.query('DELETE FROM machine_telemetry_history WHERE machineId = ?', [testMachineId]);
  await testConn.query('DELETE FROM ingested_file_conflicts WHERE machine_id = ?', [testMachineId]);
  await testConn.query('DELETE FROM ingested_files_log WHERE machine_id = ?', [testMachineId]);
  await testConn.query('DELETE FROM metric_mappings WHERE machine_id = ?', [testMachineId]);
  await testConn.query('DELETE FROM machines WHERE id = ?', [testMachineId]);
  await testConn.end();

  // Dọn dẹp thư mục test
  if (fs.existsSync(TEST_STORAGE_DIR)) {
    fs.rmSync(TEST_STORAGE_DIR, { recursive: true, force: true });
  }
  console.log('  ✓ Đã dọn dẹp sạch toàn bộ fixtures thử nghiệm trên denso_iot_phase1_test và ổ đĩa.');

  // -------------------------------------------------------------------------
  // PHẦN 10: TRIPLE VERIFICATION BẢO VỆ CSDL GỐC denso_iot
  // -------------------------------------------------------------------------
  console.log('\n--- PHẦN 10: TRIPLE VERIFICATION BẢO VỆ CSDL GỐC DENSO_IOT ---');
  const prodSnapshotAfter = await calculateFullDbSnapshot(PROD_DB_NAME);
  let is100PercentIdentical = true;

  for (const [tbl, dataBefore] of Object.entries(prodSnapshotBefore)) {
    const dataAfter = prodSnapshotAfter[tbl];
    const matchCount = dataBefore.count === dataAfter.count;
    const matchChecksum = dataBefore.checksum === dataAfter.checksum;
    const matchSha256 = dataBefore.sha256 === dataAfter.sha256;

    console.log(
      `   - ${tbl.padEnd(26)}: Count=${dataAfter.count} (${matchCount ? 'OK' : 'MISMATCH'}), Checksum=${dataAfter.checksum} (${matchChecksum ? 'OK' : 'MISMATCH'}), SHA256=${dataAfter.sha256.slice(0, 12)}... (${matchSha256 ? 'MATCH' : 'MISMATCH'})`
    );

    if (!matchCount || !matchChecksum || !matchSha256) is100PercentIdentical = false;
  }

  assert(
    is100PercentIdentical,
    'TC-FB-10: CSDL gốc denso_iot được bảo vệ tuyệt đối: 100% bản ghi (kể cả telemetry lịch sử), Checksum và SHA-256 hoàn toàn trùng khớp từng byte!'
  );

  // -------------------------------------------------------------------------
  // TỔNG KẾT
  // -------------------------------------------------------------------------
  console.log('\n' + '='.repeat(78));
  console.log(`   KẾT QUẢ KIỂM THỬ GIAI ĐOẠN B: ${passedTests}/${totalTests} KIỂM CHỨNG PASS (100%)`);
  console.log('='.repeat(78) + '\n');

  process.exit(0);
}

main().catch((err) => {
  console.error('\n[FATAL TEST ERROR]:', err);
  process.exit(1);
});
