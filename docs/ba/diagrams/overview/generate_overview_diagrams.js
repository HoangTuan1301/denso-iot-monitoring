/**
 * @file docs/ba/diagrams/overview/generate_overview_diagrams.js
 * @description Generates 5 high-resolution architectural & flow diagrams for DENSO KaiLink Overview Doc
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawnSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const outDir = __dirname;
const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

function renderSvgToPng(svgPath, pngPath, width, height) {
  console.log(`[PNG Render] Rendering ${path.basename(pngPath)} (${width}x${height})...`);
  
  const htmlWrapperPath = path.join(outDir, `_temp_${path.basename(svgPath, '.svg')}.html`);
  const svgContent = fs.readFileSync(svgPath, 'utf8');
  
  const htmlContent = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body {
      width: ${width}px;
      height: ${height}px;
      overflow: hidden;
      background-color: #FFFFFF;
      display: flex;
      justify-content: center;
      align-items: center;
    }
    svg {
      width: 100%;
      height: 100%;
      display: block;
    }
  </style>
</head>
<body>
  ${svgContent}
</body>
</html>`;

  fs.writeFileSync(htmlWrapperPath, htmlContent, 'utf8');
  const fileUrl = `file:///${htmlWrapperPath.replace(/\\/g, '/')}`;
  const tempProfile = path.join(process.env.TEMP || 'C:\\temp', `chrome_render_ov_${Date.now()}`);

  const args = [
    '--headless=new',
    '--disable-gpu',
    '--no-sandbox',
    '--hide-scrollbars',
    `--user-data-dir=${tempProfile}`,
    `--window-size=${width},${height}`,
    `--screenshot=${pngPath}`,
    fileUrl,
  ];

  spawnSync(CHROME_PATH, args, { stdio: 'ignore', timeout: 35000 });

  try {
    fs.unlinkSync(htmlWrapperPath);
    if (fs.existsSync(tempProfile)) {
      fs.rmSync(tempProfile, { recursive: true, force: true });
    }
  } catch (e) {}

  if (fs.existsSync(pngPath)) {
    const stat = fs.statSync(pngPath);
    console.log(`[OK] Created ${path.basename(pngPath)}: ${(stat.size / 1024).toFixed(1)} KB`);
  } else {
    console.error(`[ERR] Failed to render ${pngPath}`);
  }
}

// =============================================================================
// DIAGRAM 1: SYSTEM ARCHITECTURE
// =============================================================================
function generateArchitectureDiagram() {
  const width = 2200;
  const height = 1400;
  const svgPath = path.join(outDir, 'arch_overview.svg');
  const pngPath = path.join(outDir, 'arch_overview.png');

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">
  <defs>
    <style>
      text { font-family: 'Segoe UI', Arial, sans-serif; }
      .code-font { font-family: Consolas, 'Courier New', monospace; }
      .shadow { filter: drop-shadow(0px 8px 16px rgba(15, 23, 42, 0.08)); }
    </style>
    <linearGradient id="headerGrad" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#002B5B" />
      <stop offset="100%" stop-color="#004080" />
    </linearGradient>
    <marker id="arrBlue" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
      <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#0284C7" />
    </marker>
    <marker id="arrRed" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
      <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#DC2626" />
    </marker>
    <marker id="arrGreen" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
      <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#059669" />
    </marker>
  </defs>

  <!-- Background -->
  <rect width="100%" height="100%" fill="#F8FAFC" />
  <rect x="30" y="30" width="${width - 60}" height="${height - 60}" rx="20" fill="#FFFFFF" stroke="#E2E8F0" stroke-width="2" class="shadow" />

  <!-- Title Banner -->
  <g transform="translate(60, 60)">
    <rect width="${width - 120}" height="80" rx="10" fill="url(#headerGrad)" />
    <rect x="0" y="0" width="8" height="80" rx="4" fill="#E60012" />
    <text x="30" y="38" fill="#FFFFFF" font-size="24" font-weight="700">SƠ ĐỒ KIẾN TRÚC TỔNG THỂ HỆ THỐNG (SYSTEM ARCHITECTURE DIAGRAM)</text>
    <text x="30" y="64" fill="#93C5FD" font-size="14" font-weight="500">DENSO INDUSTRIAL IoT MONITORING SYSTEM (KaiLink) | FRONTEND - BACKEND - WEBSOCKET - DATABASE</text>
    <text x="${width - 160}" y="48" fill="#E2E8F0" font-size="13" font-weight="600" text-anchor="end">TECHNICAL OVERVIEW</text>
  </g>

  <!-- COLUMN 1: PRESENTATION TIER (CLIENT SPA) -->
  <g transform="translate(60, 170)">
    <rect width="460" height="920" rx="14" fill="#F0FDF4" stroke="#86EFAC" stroke-width="2" />
    <rect width="460" height="50" rx="14" fill="#15803D" />
    <rect x="0" y="36" width="460" height="14" fill="#15803D" />
    <text x="230" y="32" fill="#FFFFFF" font-size="16" font-weight="700" text-anchor="middle">1. TẦNG TRÌNH DIỄN (FRONTEND SPA)</text>

    <!-- Box 1: UI Engine -->
    <g transform="translate(20, 70)">
      <rect width="420" height="130" rx="10" fill="#FFFFFF" stroke="#BBF7D0" stroke-width="1.5" class="shadow" />
      <text x="20" y="30" fill="#166534" font-size="15" font-weight="700">Giao diện Người dùng (UI Framework)</text>
      <text x="20" y="55" fill="#374151" font-size="13">• React 18 (SPA) + TypeScript + Vite Bundler</text>
      <text x="20" y="78" fill="#374151" font-size="13">• Tailwind CSS 3.4 (Responsive Factory Theme)</text>
      <text x="20" y="101" fill="#374151" font-size="13">• Lucide React Icons + Recharts (Live Telemetry)</text>
    </g>

    <!-- Box 2: 3-Tier Dashboard Views -->
    <g transform="translate(20, 220)">
      <rect width="420" height="150" rx="10" fill="#FFFFFF" stroke="#BBF7D0" stroke-width="1.5" class="shadow" />
      <text x="20" y="30" fill="#166534" font-size="15" font-weight="700">Các Màn hình Giám sát 3 Cấp</text>
      <text x="20" y="55" fill="#374151" font-size="13">• Cấp 1 (Factory): KPI Nhà máy, thẻ Line, OEE</text>
      <text x="20" y="78" fill="#374151" font-size="13">• Cấp 2 (Line): Danh mục 4 máy, trạng thái Run/Idle</text>
      <text x="20" y="101" fill="#374151" font-size="13">• Cấp 3 (Machine): Đồ thị rung động, áp suất, nhiệt</text>
      <text x="20" y="124" fill="#374151" font-size="13">• Digital Andon Board: Bảng đèn cảnh báo thời gian thực</text>
    </g>

    <!-- Box 3: Client State & Real-time -->
    <g transform="translate(20, 390)">
      <rect width="420" height="160" rx="10" fill="#FFFFFF" stroke="#BBF7D0" stroke-width="1.5" class="shadow" />
      <text x="20" y="30" fill="#166534" font-size="15" font-weight="700">Quản lý State & Kết nối Real-time</text>
      <text x="20" y="55" fill="#374151" font-size="13">• Zustand Store (useAlarmStore - In-memory RAM)</text>
      <text x="20" y="78" fill="#374151" font-size="13">• Socket.io-client (useSocket Hook kết nối WSS)</text>
      <text x="20" y="101" fill="#374151" font-size="13">• Axios / Fetch Client (Gọi RESTful Endpoints)</text>
      <text x="20" y="124" fill="#DC2626" font-size="12" font-weight="600">! Cảnh báo lưu tạm trên RAM Zustand (Volatile)</text>
    </g>

    <!-- Box 4: Administrative & Export Views -->
    <g transform="translate(20, 570)">
      <rect width="420" height="150" rx="10" fill="#FFFFFF" stroke="#BBF7D0" stroke-width="1.5" class="shadow" />
      <text x="20" y="30" fill="#166534" font-size="15" font-weight="700">Quản trị & Báo cáo Lịch sử</text>
      <text x="20" y="55" fill="#374151" font-size="13">• Machine History: Bộ lọc Line, Machine, Metric</text>
      <text x="20" y="78" fill="#374151" font-size="13">• Xuất file: Nút tải 3 định dạng Excel, CSV, JSON</text>
      <text x="20" y="101" fill="#374151" font-size="13">• Quản lý Người dùng & Phân quyền RBAC</text>
      <text x="20" y="124" fill="#374151" font-size="13">• Nhật ký thao tác kiểm toán (Audit Logs Viewer)</text>
    </g>

    <!-- Deployment Pill -->
    <g transform="translate(20, 740)">
      <rect width="420" height="150" rx="10" fill="#DCFCE7" stroke="#4ADE80" stroke-width="1.5" />
      <text x="20" y="30" fill="#14532D" font-size="14" font-weight="700">Hạ tầng Triển khai Frontend</text>
      <text x="20" y="55" fill="#15803D" font-size="13">• Nền tảng: Vercel Edge Network (Global CDN)</text>
      <text x="20" y="78" fill="#15803D" font-size="13">• Build output: Single Page App tĩnh tối ưu hóa</text>
      <text x="20" y="101" fill="#15803D" font-size="13">• Giao thức: HTTPS + WSS mã hóa SSL/TLS</text>
      <text x="20" y="124" fill="#15803D" font-size="13">• Biến môi trường: VITE_API_URL, VITE_WS_URL</text>
    </g>
  </g>

  <!-- COLUMN 2: APPLICATION SERVICES (BACKEND) -->
  <g transform="translate(560, 170)">
    <rect width="520" height="920" rx="14" fill="#EFF6FF" stroke="#93C5FD" stroke-width="2" />
    <rect width="520" height="50" rx="14" fill="#1D4ED8" />
    <rect x="0" y="36" width="520" height="14" fill="#1D4ED8" />
    <text x="260" y="32" fill="#FFFFFF" font-size="16" font-weight="700" text-anchor="middle">2. TẦNG DỊCH VỤ ỨNG DỤNG (BACKEND API &amp; WS)</text>

    <!-- Box 1: Core Framework -->
    <g transform="translate(20, 70)">
      <rect width="480" height="130" rx="10" fill="#FFFFFF" stroke="#BFDBFE" stroke-width="1.5" class="shadow" />
      <text x="20" y="30" fill="#1E40AF" font-size="15" font-weight="700">Nền tảng Máy chủ &amp; Giao tiếp</text>
      <text x="20" y="55" fill="#374151" font-size="13">• Node.js v18/20 LTS Runtime + Express.js Framework</text>
      <text x="20" y="78" fill="#374151" font-size="13">• Socket.IO Server (Broadcast Real-time Telemetry)</text>
      <text x="20" y="101" fill="#374151" font-size="13">• Middleware: CORS Whitelist, Helmet, BodyParser</text>
    </g>

    <!-- Box 2: Telemetry & Simulation Engine -->
    <g transform="translate(20, 220)">
      <rect width="480" height="160" rx="10" fill="#FFFFFF" stroke="#BFDBFE" stroke-width="1.5" class="shadow" />
      <text x="20" y="30" fill="#1E40AF" font-size="15" font-weight="700">Động cơ Thu nạp &amp; Mô phỏng Telemetry</text>
      <text x="20" y="55" fill="#374151" font-size="13">• Sinh tín hiệu tập trung tại Backend (Chu kỳ 1s - 5s)</text>
      <text x="20" y="78" fill="#374151" font-size="13">• Chuẩn hóa ISO-8601 UTC + Hash định danh SHA-256</text>
      <text x="20" y="101" fill="#374151" font-size="13">• Ghi tự động vào bảng machine_telemetry_history</text>
      <text x="20" y="124" fill="#374151" font-size="13">• Đánh giá vi phạm 4 ngưỡng cảm biến (BR-01)</text>
    </g>

    <!-- Box 3: Security & Business Handlers -->
    <g transform="translate(20, 400)">
      <rect width="480" height="160" rx="10" fill="#FFFFFF" stroke="#BFDBFE" stroke-width="1.5" class="shadow" />
      <text x="20" y="30" fill="#1E40AF" font-size="15" font-weight="700">Bảo mật RBAC &amp; Bộ Xử lý Nghiệp vụ</text>
      <text x="20" y="55" fill="#374151" font-size="13">• Auth Controller: Xác thực mật khẩu Bcrypt (10 rounds)</text>
      <text x="20" y="78" fill="#374151" font-size="13">• Phân quyền 3 vai trò: ADMIN, OPERATOR, MAINTENANCE</text>
      <text x="20" y="101" fill="#374151" font-size="13">• Alarm Life-cycle: Tiếp nhận (Ack) &amp; Khắc phục (Resolve)</text>
      <text x="20" y="124" fill="#374151" font-size="13">• Audit Logger: Tự động ghi vết mọi thao tác quản trị</text>
    </g>

    <!-- Box 4: Multi-format Export Engine -->
    <g transform="translate(20, 580)">
      <rect width="480" height="140" rx="10" fill="#FFFFFF" stroke="#BFDBFE" stroke-width="1.5" class="shadow" />
      <text x="20" y="30" fill="#1E40AF" font-size="15" font-weight="700">Động cơ Xuất Dữ liệu Đa Định dạng</text>
      <text x="20" y="55" fill="#374151" font-size="13">• ExcelJS: Định dạng Workbook XLSX với Header/Border</text>
      <text x="20" y="78" fill="#374151" font-size="13">• Stream CSV (fast-csv) + JSON Array Stream an toàn</text>
      <text x="20" y="101" fill="#374151" font-size="13">• Giới hạn cứng 10.000 dòng + Lọc Whitelist SQL (BR-09,10)</text>
    </g>

    <!-- Deployment Pill -->
    <g transform="translate(20, 740)">
      <rect width="480" height="150" rx="10" fill="#DBEAFE" stroke="#60A5FA" stroke-width="1.5" />
      <text x="20" y="30" fill="#1E3A8A" font-size="14" font-weight="700">Hạ tầng Triển khai Backend</text>
      <text x="20" y="55" fill="#1D4ED8" font-size="13">• Nền tảng Cloud: Render Web Service (Node.js LTS)</text>
      <text x="20" y="78" fill="#1D4ED8" font-size="13">• Local Development: Chạy độc lập qua npm run dev</text>
      <text x="20" y="101" fill="#1D4ED8" font-size="13">• Kết nối Database: Connection Pool (mysql2/promise)</text>
      <text x="20" y="124" fill="#1D4ED8" font-size="13">• Cấu hình qua File: .env (PORT, DB_HOST, DB_USER, DB_NAME)</text>
    </g>
  </g>

  <!-- COLUMN 3: PERSISTENCE TIER (DATABASE MYSQL) -->
  <g transform="translate(1120, 170)">
    <rect width="480" height="920" rx="14" fill="#FFFBEB" stroke="#FDE68A" stroke-width="2" />
    <rect width="480" height="50" rx="14" fill="#D97706" />
    <rect x="0" y="36" width="480" height="14" fill="#D97706" />
    <text x="240" y="32" fill="#FFFFFF" font-size="16" font-weight="700" text-anchor="middle">3. TẦNG CƠ SỞ DỮ LIỆU (MYSQL 8.0)</text>

    <!-- Box 1: Master Schema -->
    <g transform="translate(20, 70)">
      <rect width="440" height="170" rx="10" fill="#FFFFFF" stroke="#FCD34D" stroke-width="1.5" class="shadow" />
      <text x="20" y="30" fill="#B45309" font-size="15" font-weight="700">Danh mục Dây chuyền &amp; Thiết bị</text>
      <text x="20" y="55" fill="#374151" font-size="13">• production_lines: Mã line, trạng thái, mục tiêu ca</text>
      <text x="20" y="78" fill="#374151" font-size="13">• machines: 4 máy (CNC, Robot, Ép dập, Sơn sấy)</text>
      <text x="20" y="101" fill="#374151" font-size="13">• plc_stations: Trạm PLC giả lập (IP, Port, Protocol)</text>
      <text x="20" y="124" fill="#374151" font-size="13">• Quan hệ logic qua lineId có chỉ mục B-Tree Index</text>
      <text x="20" y="147" fill="#059669" font-size="12" font-weight="600">✓ Không tạo khóa ngoại cứng để tối ưu tốc độ ghi</text>
    </g>

    <!-- Box 2: Timeseries History -->
    <g transform="translate(20, 260)">
      <rect width="440" height="170" rx="10" fill="#FFFFFF" stroke="#FCD34D" stroke-width="1.5" class="shadow" />
      <text x="20" y="30" fill="#B45309" font-size="15" font-weight="700">machine_telemetry_history (Chuỗi thời gian)</text>
      <text x="20" y="55" fill="#374151" font-size="13">• id: Khóa chính SHA-256 (Chống ghi trùng lặp)</text>
      <text x="20" y="78" fill="#374151" font-size="13">• timestamp: DATETIME(3) UTC chuẩn hóa quốc tế</text>
      <text x="20" y="101" fill="#374151" font-size="13">• value: DECIMAL(10,2), metricId, unit, status</text>
      <text x="20" y="124" fill="#374151" font-size="13">• source: 'simulation' | 'plc' | 'manual'</text>
      <text x="20" y="147" fill="#059669" font-size="12" font-weight="600">✓ Phi chuẩn hóa lineName, machineName giảm JOIN</text>
    </g>

    <!-- Box 3: Security & Audit -->
    <g transform="translate(20, 450)">
      <rect width="440" height="150" rx="10" fill="#FFFFFF" stroke="#FCD34D" stroke-width="1.5" class="shadow" />
      <text x="20" y="30" fill="#B45309" font-size="15" font-weight="700">Tài khoản &amp; Nhật ký Kiểm toán</text>
      <text x="20" y="55" fill="#374151" font-size="13">• users: Mã nhân viên UNIQUE, Password Bcrypt hash</text>
      <text x="20" y="78" fill="#374151" font-size="13">• audit_logs: userId, action, target, details, ipAddress</text>
      <text x="20" y="101" fill="#374151" font-size="13">• Chỉ mục Index trên action và timestamp</text>
      <text x="20" y="124" fill="#DC2626" font-size="12" font-weight="600">! Thiếu bảng alarms vật lý (Nợ kỹ thuật TD-01)</text>
    </g>

    <!-- Box 4: Deployment Pill -->
    <g transform="translate(20, 620)">
      <rect width="440" height="130" rx="10" fill="#FEF3C7" stroke="#F59E0B" stroke-width="1.5" />
      <text x="20" y="30" fill="#78350F" font-size="14" font-weight="700">Hạ tầng Cơ sở Dữ liệu</text>
      <text x="20" y="55" fill="#B45309" font-size="13">• Cloud: Aiven Cloud MySQL 8.0 Managed Service</text>
      <text x="20" y="78" fill="#B45309" font-size="13">• Development: MySQL 8.0 Localhost (Port 3306)</text>
      <text x="20" y="101" fill="#B45309" font-size="13">• Connection: mysql2 connection pool với SSL/TLS</text>
    </g>
  </g>

  <!-- COLUMN 4: HARDWARE & SENSOR DATA SOURCE (IIoT TIER) -->
  <g transform="translate(1640, 170)">
    <rect width="500" height="920" rx="14" fill="#F8FAFC" stroke="#CBD5E1" stroke-width="2" />
    <rect width="500" height="50" rx="14" fill="#334155" />
    <rect x="0" y="36" width="500" height="14" fill="#334155" />
    <text x="250" y="32" fill="#FFFFFF" font-size="16" font-weight="700" text-anchor="middle">4. NGUỒN TÍN HIỆU THIẾT BỊ (IIoT LAYER)</text>

    <!-- Current State -->
    <g transform="translate(20, 70)">
      <rect width="460" height="230" rx="10" fill="#FFFFFF" stroke="#3B82F6" stroke-width="2" class="shadow" />
      <rect width="460" height="35" rx="10" fill="#DBEAFE" />
      <rect x="0" y="25" width="460" height="10" fill="#DBEAFE" />
      <text x="20" y="24" fill="#1D4ED8" font-size="14" font-weight="700">HIỆN TẠI: SIMULATION ENGINE TẬP TRUNG</text>
      
      <text x="20" y="65" fill="#374151" font-size="13">• Sinh tín hiệu mô phỏng ngẫu nhiên có kiểm soát</text>
      <text x="20" y="88" fill="#374151" font-size="13">• 4 thông số: Rung (mm/s), Nhiệt (°C), Áp (bar), Điện (A)</text>
      <text x="20" y="111" fill="#374151" font-size="13">• Chu kỳ phát nhịp: 1.000 ms - 5.000 ms</text>
      <text x="20" y="134" fill="#374151" font-size="13">• Tự động kích hoạt dao động vi phạm ngưỡng</text>
      <text x="20" y="157" fill="#374151" font-size="13">• Đóng dấu source = 'simulation' trong CSDL</text>
      <text x="20" y="180" fill="#059669" font-size="12" font-weight="600">✓ Đảm bảo đồng bộ 100% giữa Dashboard và DB History</text>
      <text x="20" y="200" fill="#059669" font-size="12" font-weight="600">✓ Loại bỏ dữ liệu ngẫu nhiên riêng lẻ của từng Browser</text>
    </g>

    <!-- Future Target -->
    <g transform="translate(20, 320)">
      <rect width="460" height="230" rx="10" fill="#FFFFFF" stroke="#CBD5E1" stroke-width="1.5" stroke-dasharray="6,4" class="shadow" />
      <rect width="460" height="35" rx="10" fill="#F1F5F9" />
      <rect x="0" y="25" width="460" height="10" fill="#F1F5F9" />
      <text x="20" y="24" fill="#475569" font-size="14" font-weight="700">TƯƠNG LAI: KẾT NỐI PLC VẬT LÝ THỰC TẾ</text>
      
      <text x="20" y="65" fill="#64748B" font-size="13">• Giao thức công nghiệp: Modbus TCP / MC Protocol / S7</text>
      <text x="20" y="88" fill="#64748B" font-size="13">• Trạm PLC thực tế: Mitsubishi MELSEC, Siemens S7-1200</text>
      <text x="20" y="111" fill="#64748B" font-size="13">• Đọc thanh ghi thô: D100 (Vibration), D102 (Temperature)</text>
      <text x="20" y="134" fill="#64748B" font-size="13">• Cần cài đặt IoT Gateway / Edge Box tại xưởng DENSO</text>
      <text x="20" y="157" fill="#64748B" font-size="13">• Đóng dấu source = 'plc' khi có tín hiệu vật lý</text>
      <text x="20" y="185" fill="#D97706" font-size="12" font-weight="600">! Chưa triển khai trong mã nguồn hiện tại</text>
      <text x="20" y="205" fill="#D97706" font-size="12" font-weight="600">! Dữ liệu bảng plc_stations hiện là bản ghi mô phỏng</text>
    </g>

    <!-- Communication Protocols -->
    <g transform="translate(20, 570)">
      <rect width="460" height="180" rx="10" fill="#F8FAFC" stroke="#E2E8F0" stroke-width="1.5" />
      <text x="20" y="30" fill="#1E293B" font-size="14" font-weight="700">Giao Thức Truyền Dẫn IIoT</text>
      <text x="20" y="55" fill="#475569" font-size="13">• Mạng nội bộ nhà máy (OT Network): VLAN riêng biệt</text>
      <text x="20" y="78" fill="#475569" font-size="13">• Port tiêu chuẩn: 502 (Modbus TCP), 102 (Siemens S7)</text>
      <text x="20" y="101" fill="#475569" font-size="13">• Chống nhiễu công nghiệp, Polling rate 500ms - 2000ms</text>
      <text x="20" y="124" fill="#475569" font-size="13">• Cơ chế Heartbeat &amp; Watchdog giám sát mất kết nối</text>
      <text x="20" y="147" fill="#475569" font-size="13">• Buffer hàng đợi SQLite/Redis tại Edge khi mất mạng WAN</text>
    </g>
  </g>

  <!-- BOTTOM BAR: ARCHITECTURE HIGHLIGHTS -->
  <g transform="translate(60, 1110)">
    <rect width="${width - 120}" height="220" rx="14" fill="#F1F5F9" stroke="#CBD5E1" stroke-width="1.5" />
    <text x="30" y="35" fill="#0F172A" font-size="16" font-weight="700">CÁC ĐẶC ĐIỂM KỸ THUẬT CỐT LÕI (TECHNICAL ARCHITECTURE HIGHLIGHTS)</text>
    
    <g transform="translate(30, 60)">
      <rect width="480" height="135" rx="8" fill="#FFFFFF" stroke="#E2E8F0" />
      <text x="15" y="28" fill="#0369A1" font-size="14" font-weight="700">1. Luồng Dữ liệu Thời gian thực (Real-time)</text>
      <text x="15" y="52" fill="#475569" font-size="12">• Socket.io duy trì kết nối Full-duplex WebSocket.</text>
      <text x="15" y="72" fill="#475569" font-size="12">• Tần suất broadcast 1-5 giây/lần không làm nghẽn CPU.</text>
      <text x="15" y="92" fill="#475569" font-size="12">• Client tự cập nhật đồ thị động mà không cần F5/Reload.</text>
      <text x="15" y="112" fill="#475569" font-size="12">• Fallback an toàn sang Polling HTTP nếu chặn WSS.</text>
    </g>

    <g transform="translate(540, 60)">
      <rect width="480" height="135" rx="8" fill="#FFFFFF" stroke="#E2E8F0" />
      <text x="15" y="28" fill="#047857" font-size="14" font-weight="700">2. Thiết kế CSDL Tối ưu Ghi Chuỗi Thời Gian</text>
      <text x="15" y="52" fill="#475569" font-size="12">• Khóa chính SHA-256 ngăn ngừa ghi trùng ID.</text>
      <text x="15" y="72" fill="#475569" font-size="12">• Bỏ khóa ngoại cứng DDL loại trừ hoàn toàn Lock contention.</text>
      <text x="15" y="92" fill="#475569" font-size="12">• Phi chuẩn hóa lineName, machineName tăng tốc xuất báo cáo.</text>
      <text x="15" y="112" fill="#475569" font-size="12">• Chỉ mục B-Tree (machineId, timestamp) quét dải cực nhanh.</text>
    </g>

    <g transform="translate(1050, 60)">
      <rect width="480" height="135" rx="8" fill="#FFFFFF" stroke="#E2E8F0" />
      <text x="15" y="28" fill="#B45309" font-size="14" font-weight="700">3. An toàn Xuất Dữ liệu &amp; Giới hạn Tải</text>
      <text x="15" y="52" fill="#475569" font-size="12">• Áp dụng SQL Whitelist kiểm soát chặt chẽ tham số lọc.</text>
      <text x="15" y="72" fill="#475569" font-size="12">• Giới hạn cứng 10.000 dòng tránh tràn bộ nhớ Heap.</text>
      <text x="15" y="92" fill="#475569" font-size="12">• Động cơ ExcelJS, fast-csv stream tải trực tiếp về máy trạm.</text>
      <text x="15" y="112" fill="#475569" font-size="12">• Ghi nhật ký kiểm toán EXPORT_LOGS phục vụ tra soát.</text>
    </g>

    <g transform="translate(1560, 60)">
      <rect width="480" height="135" rx="8" fill="#FFFFFF" stroke="#E2E8F0" />
      <text x="15" y="28" fill="#B91C1C" font-size="14" font-weight="700">4. Nợ Kỹ thuật Cần Nâng cấp (Tech Debts)</text>
      <text x="15" y="52" fill="#475569" font-size="12">• TD-01: Cảnh báo chưa có bảng alarms vật lý (Đang lưu RAM).</text>
      <text x="15" y="72" fill="#475569" font-size="12">• TD-02: Chưa có driver kết nối PLC công nghiệp thực tế.</text>
      <text x="15" y="92" fill="#475569" font-size="12">• TD-03: Cần triển khai JWT Bearer Token thay cho State.</text>
      <text x="15" y="112" fill="#475569" font-size="12">• TD-04: Phân vùng Partition theo tháng cho bảng History.</text>
    </g>
  </g>

  <!-- Connective Arrows -->
  <line x1="520" y1="280" x2="560" y2="280" stroke="#0284C7" stroke-width="3" marker-end="url(#arrBlue)" />
  <line x1="560" y1="340" x2="520" y2="340" stroke="#0284C7" stroke-width="3" marker-end="url(#arrBlue)" />
  
  <line x1="1080" y1="300" x2="1120" y2="300" stroke="#D97706" stroke-width="3" marker-end="url(#arrGreen)" />
  <line x1="1120" y1="360" x2="1080" y2="360" stroke="#D97706" stroke-width="3" marker-end="url(#arrGreen)" />

  <line x1="1640" y1="300" x2="1080" y2="300" stroke="#0284C7" stroke-width="3" marker-end="url(#arrBlue)" stroke-dasharray="6,4" />
</svg>`;

  fs.writeFileSync(svgPath, svg, 'utf8');
  console.log(`[OK] Created ${path.basename(svgPath)}`);
  renderSvgToPng(svgPath, pngPath, width, height);
}

// =============================================================================
// DIAGRAM 2: TELEMETRY DATA FLOW
// =============================================================================
function generateTelemetryFlowDiagram() {
  const width = 2200;
  const height = 1350;
  const svgPath = path.join(outDir, 'flow_telemetry.svg');
  const pngPath = path.join(outDir, 'flow_telemetry.png');

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">
  <defs>
    <style>
      text { font-family: 'Segoe UI', Arial, sans-serif; }
      .code-font { font-family: Consolas, monospace; }
      .shadow { filter: drop-shadow(0px 8px 16px rgba(15, 23, 42, 0.08)); }
    </style>
    <linearGradient id="headerGrad2" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#002B5B" />
      <stop offset="100%" stop-color="#0F4C81" />
    </linearGradient>
    <marker id="arr2" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
      <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#0284C7" />
    </marker>
    <marker id="arrGreen2" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
      <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#059669" />
    </marker>
    <marker id="arrAmber2" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
      <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#D97706" />
    </marker>
  </defs>

  <rect width="100%" height="100%" fill="#F8FAFC" />
  <rect x="30" y="30" width="${width - 60}" height="${height - 60}" rx="20" fill="#FFFFFF" stroke="#E2E8F0" stroke-width="2" class="shadow" />

  <!-- Banner -->
  <g transform="translate(60, 60)">
    <rect width="${width - 120}" height="80" rx="10" fill="url(#headerGrad2)" />
    <rect x="0" y="0" width="8" height="80" rx="4" fill="#E60012" />
    <text x="30" y="38" fill="#FFFFFF" font-size="24" font-weight="700">LUỒNG DỮ LIỆU THU NẠP &amp; PHÁT TRUYỀN TELEMETRY (IoT TELEMETRY DATA FLOW)</text>
    <text x="30" y="64" fill="#93C5FD" font-size="14" font-weight="500">QUY TRÌNH TỪ BỘ SINH DỮ LIỆU TẬP TRUNG -> CHUẨN HÓA UTC/HASH -> LƯU CSDL MYSQL -> BROADCAST WEBSOCKET -> UI</text>
    <text x="${width - 160}" y="48" fill="#E2E8F0" font-size="13" font-weight="600" text-anchor="end">FLOW 2 / 5</text>
  </g>

  <!-- 5 STEPS HORIZONTAL LAYOUT -->
  <!-- STEP 1: GENERATION -->
  <g transform="translate(60, 180)">
    <rect width="380" height="780" rx="12" fill="#F8FAFC" stroke="#CBD5E1" stroke-width="2" />
    <rect width="380" height="50" rx="12" fill="#334155" />
    <rect x="0" y="36" width="380" height="14" fill="#334155" />
    <text x="190" y="32" fill="#FFFFFF" font-size="15" font-weight="700" text-anchor="middle">BƯỚC 1: KHỞI TẠO TÍN HIỆU</text>

    <g transform="translate(20, 70)">
      <rect width="340" height="180" rx="8" fill="#FFFFFF" stroke="#E2E8F0" class="shadow" />
      <text x="15" y="28" fill="#1E293B" font-size="14" font-weight="700">Nguồn Phát Dữ Liệu</text>
      <text x="15" y="55" fill="#475569" font-size="12">• Backend Central Engine</text>
      <text x="15" y="75" fill="#475569" font-size="12">• Chu kỳ phát: 1.000ms - 5.000ms</text>
      <text x="15" y="95" fill="#475569" font-size="12">• 4 Thông số giám sát thiết bị:</text>
      <text x="25" y="115" fill="#0369A1" font-size="12">- Rung động (Vibration: mm/s)</text>
      <text x="25" y="135" fill="#B45309" font-size="12">- Nhiệt độ (Temperature: °C)</text>
      <text x="25" y="155" fill="#15803D" font-size="12">- Áp suất khí nén (Pressure: bar)</text>
      <text x="25" y="175" fill="#7C3AED" font-size="12">- Dòng điện tiêu thụ (Power: A)</text>
    </g>

    <g transform="translate(20, 270)">
      <rect width="340" height="150" rx="8" fill="#FFFFFF" stroke="#E2E8F0" class="shadow" />
      <text x="15" y="28" fill="#1E293B" font-size="14" font-weight="700">Đặc Điểm Sinh Tín Hiệu</text>
      <text x="15" y="52" fill="#475569" font-size="12">• Giá trị cơ sở ổn định (Normal baseline)</text>
      <text x="15" y="72" fill="#475569" font-size="12">• Nhiễu ngẫu nhiên Gauss biên độ nhỏ</text>
      <text x="15" y="92" fill="#475569" font-size="12">• Kịch bản mô phỏng lỗi (Fault injection):</text>
      <text x="25" y="112" fill="#DC2626" font-size="12">- Quá nhiệt trục chính (> 80°C)</text>
      <text x="25" y="132" fill="#DC2626" font-size="12">- Rung lệch tâm vòng bi (> 4.5 mm/s)</text>
    </g>

    <g transform="translate(20, 440)">
      <rect width="340" height="150" rx="8" fill="#EFF6FF" stroke="#93C5FD" />
      <text x="15" y="28" fill="#1D4ED8" font-size="13" font-weight="700">Nguyên Tắc Thiết Kế (BR-12)</text>
      <text x="15" y="52" fill="#374151" font-size="12">Toàn bộ dữ liệu telemetry ĐƯỢC SINH</text>
      <text x="15" y="72" fill="#374151" font-size="12">DUY NHẤT TẠI BACKEND.</text>
      <text x="15" y="95" fill="#374151" font-size="12">Nghiêm cấm từng trình duyệt client tự</text>
      <text x="15" y="115" fill="#374151" font-size="12">tạo số ngẫu nhiên riêng để tránh phân</text>
      <text x="15" y="135" fill="#374151" font-size="12">mảnh dữ liệu giữa các giám sát viên.</text>
    </g>

    <g transform="translate(20, 610)">
      <rect width="340" height="140" rx="8" fill="#FEF2F2" stroke="#F87171" stroke-dasharray="4,3" />
      <text x="15" y="28" fill="#991B1B" font-size="13" font-weight="700">Khả Năng Mở Rộng PLC Thật</text>
      <text x="15" y="52" fill="#7F1D1D" font-size="12">Thay thế bộ sinh mô phỏng bằng module</text>
      <text x="15" y="72" fill="#7F1D1D" font-size="12">Modbus TCP / Siemens S7 Client để đọc</text>
      <text x="15" y="92" fill="#7F1D1D" font-size="12">trực tiếp thanh ghi vật lý mà KHÔNG cần</text>
      <text x="15" y="112" fill="#7F1D1D" font-size="12">thay đổi kiến trúc các tầng phía sau.</text>
    </g>
  </g>

  <!-- STEP 2: NORMALIZATION & ENRICHMENT -->
  <g transform="translate(480, 180)">
    <rect width="380" height="780" rx="12" fill="#EFF6FF" stroke="#93C5FD" stroke-width="2" />
    <rect width="380" height="50" rx="12" fill="#1D4ED8" />
    <rect x="0" y="36" width="380" height="14" fill="#1D4ED8" />
    <text x="190" y="32" fill="#FFFFFF" font-size="15" font-weight="700" text-anchor="middle">BƯỚC 2: CHUẨN HÓA &amp; GÁN METADATA</text>

    <g transform="translate(20, 70)">
      <rect width="340" height="210" rx="8" fill="#FFFFFF" stroke="#BFDBFE" class="shadow" />
      <text x="15" y="28" fill="#1E40AF" font-size="14" font-weight="700">Xử lý Chuẩn Hóa Payload</text>
      <text x="15" y="52" fill="#374151" font-size="12">1. Định dạng mốc thời gian (BR-07):</text>
      <text x="25" y="72" fill="#0369A1" font-size="11" class="code-font">timestamp = new Date().toISOString()</text>
      <text x="25" y="90" fill="#475569" font-size="12">(Đảm bảo chuẩn UTC ISO-8601)</text>
      
      <text x="15" y="115" fill="#374151" font-size="12">2. Tính toán Khóa chính (BR-06):</text>
      <text x="25" y="135" fill="#0369A1" font-size="11" class="code-font">id = SHA256(machineId + metricId</text>
      <text x="25" y="152" fill="#0369A1" font-size="11" class="code-font">     + timestamp).substring(0, 32)</text>
      <text x="25" y="172" fill="#475569" font-size="12">(Chống ghi trùng lặp khi mất mạng)</text>
      <text x="15" y="195" fill="#374151" font-size="12">3. Gán nguồn: source = 'simulation'</text>
    </g>

    <g transform="translate(20, 300)">
      <rect width="340" height="190" rx="8" fill="#FFFFFF" stroke="#BFDBFE" class="shadow" />
      <text x="15" y="28" fill="#1E40AF" font-size="14" font-weight="700">Làm Giàu Dữ Liệu (Denormalization)</text>
      <text x="15" y="52" fill="#374151" font-size="12">• Truy xuất thông tin dây chuyền &amp; máy:</text>
      <text x="25" y="72" fill="#475569" font-size="12">- lineId: 'line-01' -> lineName: 'Line 1'</text>
      <text x="25" y="92" fill="#475569" font-size="12">- machineId: 'cnc-01' -> machineName</text>
      <text x="25" y="112" fill="#475569" font-size="12">- metricId: 'vibration' -> unit: 'mm/s'</text>
      <text x="15" y="137" fill="#374151" font-size="12">• Mục đích kiến trúc:</text>
      <text x="25" y="157" fill="#059669" font-size="12">Giúp tầng truy vấn và xuất file Excel/CSV</text>
      <text x="25" y="175" fill="#059669" font-size="12">không phải JOIN bảng nặng nề.</text>
    </g>

    <g transform="translate(20, 510)">
      <rect width="340" height="240" rx="8" fill="#FEF3C7" stroke="#FCD34D" />
      <text x="15" y="28" fill="#92400E" font-size="13" font-weight="700">Đánh Giá Ngưỡng Tức Thời (BR-01)</text>
      <text x="15" y="52" fill="#78350F" font-size="12">Hệ thống so khớp giá trị đo với 4 mốc:</text>
      <text x="20" y="72" fill="#B45309" font-size="12">• Low Warning &lt;= value &lt;= High Warning</text>
      <text x="20" y="92" fill="#DC2626" font-size="12">• Low Alarm &lt;= value &lt;= High Alarm</text>
      <text x="15" y="118" fill="#78350F" font-size="12">Gán trạng thái bản ghi:</text>
      <text x="20" y="138" fill="#059669" font-size="12">• 'normal': Giá trị trong dải cho phép</text>
      <text x="20" y="158" fill="#D97706" font-size="12">• 'warning': Chớm vượt ngưỡng chú ý</text>
      <text x="20" y="178" fill="#DC2626" font-size="12">• 'critical': Vượt ngưỡng dừng máy nguy cấp</text>
      <text x="15" y="205" fill="#B91C1C" font-size="12" font-weight="600">-> Tự động bắn tín hiệu cảnh báo</text>
      <text x="15" y="223" fill="#B91C1C" font-size="12" font-weight="600">sang phân hệ Digital Andon Board!</text>
    </g>
  </g>

  <!-- STEP 3: PERSISTENCE LAYER -->
  <g transform="translate(900, 180)">
    <rect width="380" height="780" rx="12" fill="#FFFBEB" stroke="#FDE68A" stroke-width="2" />
    <rect width="380" height="50" rx="12" fill="#D97706" />
    <rect x="0" y="36" width="380" height="14" fill="#D97706" />
    <text x="190" y="32" fill="#FFFFFF" font-size="15" font-weight="700" text-anchor="middle">BƯỚC 3: LƯU TRỮ CHUỖI THỜI GIAN</text>

    <g transform="translate(20, 70)">
      <rect width="340" height="230" rx="8" fill="#FFFFFF" stroke="#FCD34D" class="shadow" />
      <text x="15" y="28" fill="#92400E" font-size="14" font-weight="700">Ghi Vào MySQL (B-Tree Index)</text>
      <text x="15" y="52" fill="#374151" font-size="12">Bảng: machine_telemetry_history</text>
      <text x="15" y="72" fill="#374151" font-size="12">Cơ chế ghi bất đồng bộ (Non-blocking):</text>
      <text x="25" y="92" fill="#475569" font-size="11" class="code-font">INSERT INTO machine_telemetry_history</text>
      <text x="25" y="108" fill="#475569" font-size="11" class="code-font">(id, timestamp, lineId, lineName,</text>
      <text x="25" y="124" fill="#475569" font-size="11" class="code-font"> machineId, machineName, metricId,</text>
      <text x="25" y="140" fill="#475569" font-size="11" class="code-font"> value, unit, status, source)</text>
      <text x="25" y="156" fill="#475569" font-size="11" class="code-font">VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)</text>
      <text x="25" y="172" fill="#475569" font-size="11" class="code-font">ON DUPLICATE KEY UPDATE value=value;</text>
      <text x="15" y="200" fill="#059669" font-size="12" font-weight="600">✓ Đảm bảo tính Idempotency (Bất biến)</text>
      <text x="15" y="218" fill="#059669" font-size="12" font-weight="600">✓ Không làm sập server khi trùng gói tin</text>
    </g>

    <g transform="translate(20, 320)">
      <rect width="340" height="190" rx="8" fill="#FFFFFF" stroke="#FCD34D" class="shadow" />
      <text x="15" y="28" fill="#92400E" font-size="14" font-weight="700">Tối Ưu Hiệu Năng Ghi (High-write)</text>
      <text x="15" y="52" fill="#475569" font-size="12">• Tách rời luồng ghi DB và luồng WebSocket:</text>
      <text x="25" y="72" fill="#475569" font-size="12">Nếu DB MySQL bận, WebSocket vẫn phát</text>
      <text x="25" y="90" fill="#475569" font-size="12">thông suốt đến Dashboard không bị lag.</text>
      <text x="15" y="115" fill="#475569" font-size="12">• Không dùng FOREIGN KEY ràng buộc cứng:</text>
      <text x="25" y="135" fill="#475569" font-size="12">Tránh nghẽn khóa hàng (Row-lock) khi có</text>
      <text x="25" y="152" fill="#475569" font-size="12">nhiều luồng ghi đồng thời.</text>
      <text x="15" y="175" fill="#475569" font-size="12">• Connection Pool quản lý kết nối hiệu quả.</text>
    </g>

    <g transform="translate(20, 530)">
      <rect width="340" height="220" rx="8" fill="#FEF2F2" stroke="#F87171" />
      <text x="15" y="28" fill="#991B1B" font-size="13" font-weight="700">Phục Vụ Tra Cứu &amp; Xuất File</text>
      <text x="15" y="52" fill="#7F1D1D" font-size="12">Dữ liệu trong bảng này là nguồn chân lý</text>
      <text x="15" y="70" fill="#7F1D1D" font-size="12">(Single Source of Truth) để:</text>
      <text x="20" y="92" fill="#B91C1C" font-size="12">1. Xem bảng Machine History trên web.</text>
      <text x="20" y="112" fill="#B91C1C" font-size="12">2. Xuất dữ liệu Excel (.xlsx), CSV, JSON.</text>
      <text x="20" y="132" fill="#B91C1C" font-size="12">3. Tính toán độ trễ, OEE và KPI ca kíp.</text>
      <text x="15" y="160" fill="#78350F" font-size="12">• Hỗ trợ lọc theo dải thời gian:</text>
      <text x="25" y="180" fill="#78350F" font-size="11" class="code-font">WHERE timestamp BETWEEN ? AND ?</text>
      <text x="25" y="198" fill="#78350F" font-size="11" class="code-font">ORDER BY timestamp DESC LIMIT 10000</text>
    </g>
  </g>

  <!-- STEP 4: WEBSOCKET BROADCAST -->
  <g transform="translate(1320, 180)">
    <rect width="380" height="780" rx="12" fill="#F0FDF4" stroke="#86EFAC" stroke-width="2" />
    <rect width="380" height="50" rx="12" fill="#15803D" />
    <rect x="0" y="36" width="380" height="14" fill="#15803D" />
    <text x="190" y="32" fill="#FFFFFF" font-size="15" font-weight="700" text-anchor="middle">BƯỚC 4: PHÁT SÓNG REAL-TIME</text>

    <g transform="translate(20, 70)">
      <rect width="340" height="210" rx="8" fill="#FFFFFF" stroke="#BBF7D0" class="shadow" />
      <text x="15" y="28" fill="#166534" font-size="14" font-weight="700">Kênh WebSocket (Socket.IO)</text>
      <text x="15" y="52" fill="#374151" font-size="12">• Giao thức: Full-duplex WebSocket (WSS)</text>
      <text x="15" y="72" fill="#374151" font-size="12">• Sự kiện phát sóng chính:</text>
      <text x="25" y="92" fill="#0369A1" font-size="11" class="code-font">io.emit('telemetry_update', payload)</text>
      <text x="25" y="112" fill="#DC2626" font-size="11" class="code-font">io.emit('alarm_trigger', alarmData)</text>
      <text x="15" y="137" fill="#374151" font-size="12">• Cơ chế Heartbeat (Ping/Pong):</text>
      <text x="25" y="157" fill="#475569" font-size="12">- Giữ kết nối qua firewall nhà máy</text>
      <text x="25" y="175" fill="#475569" font-size="12">- Tự động kết nối lại khi rớt mạng</text>
      <text x="25" y="195" fill="#475569" font-size="12">- Fallback sang HTTP Long-polling</text>
    </g>

    <g transform="translate(20, 300)">
      <rect width="340" height="190" rx="8" fill="#FFFFFF" stroke="#BBF7D0" class="shadow" />
      <text x="15" y="28" fill="#166534" font-size="14" font-weight="700">Phân Phối Theo Kênh (Rooms)</text>
      <text x="15" y="52" fill="#374151" font-size="12">• Giảm tải băng thông mạng nhà máy:</text>
      <text x="25" y="72" fill="#475569" font-size="12">- Room 'factory': Nhận tổng hợp KPI</text>
      <text x="25" y="92" fill="#475569" font-size="12">- Room 'line-01': Nhận telemetry Line 1</text>
      <text x="25" y="112" fill="#475569" font-size="12">- Room 'machine-cnc': Chi tiết máy CNC</text>
      <text x="15" y="137" fill="#374151" font-size="12">• Client chỉ lắng nghe Room màn hình</text>
      <text x="25" y="157" fill="#059669" font-size="12">đang hiển thị, giảm tiêu tốn tài nguyên</text>
      <text x="25" y="175" fill="#059669" font-size="12">CPU của trình duyệt.</text>
    </g>

    <g transform="translate(20, 510)">
      <rect width="340" height="240" rx="8" fill="#DCFCE7" stroke="#4ADE80" />
      <text x="15" y="28" fill="#14532D" font-size="13" font-weight="700">Độ Trễ &amp; Dung Lượng Gói Tin</text>
      <text x="15" y="52" fill="#166534" font-size="12">• Độ trễ truyền dẫn (End-to-End Latency):</text>
      <text x="25" y="72" fill="#15803D" font-size="12">&lt; 150 ms trên mạng LAN nội bộ</text>
      <text x="25" y="90" fill="#15803D" font-size="12">&lt; 350 ms qua Cloud Render/Vercel</text>
      <text x="15" y="115" fill="#166534" font-size="12">• Kích thước gói tin JSON tối ưu:</text>
      <text x="25" y="135" fill="#15803D" font-size="12">Trung bình ~180 bytes/bản ghi</text>
      <text x="15" y="160" fill="#166534" font-size="12">• Băng thông tiêu thụ cực thấp:</text>
      <text x="25" y="180" fill="#15803D" font-size="12">&lt; 25 KB/giây cho toàn bộ xưởng 4 máy,</text>
      <text x="25" y="198" fill="#15803D" font-size="12">hoạt động mượt mà trên cả mạng WiFi</text>
      <text x="25" y="216" fill="#15803D" font-size="12">công nghiệp hoặc 4G/5G nhà xưởng.</text>
    </g>
  </g>

  <!-- STEP 5: CLIENT RENDERING & ANDON -->
  <g transform="translate(1740, 180)">
    <rect width="400" height="780" rx="12" fill="#FAF5FF" stroke="#D8B4FE" stroke-width="2" />
    <rect width="400" height="50" rx="12" fill="#7E22CE" />
    <rect x="0" y="36" width="400" height="14" fill="#7E22CE" />
    <text x="200" y="32" fill="#FFFFFF" font-size="15" font-weight="700" text-anchor="middle">BƯỚC 5: CẬP NHẬT GIAO DIỆN &amp; ANDON</text>

    <g transform="translate(20, 70)">
      <rect width="360" height="190" rx="8" fill="#FFFFFF" stroke="#E9D5FF" class="shadow" />
      <text x="15" y="28" fill="#6B21A8" font-size="14" font-weight="700">Zustand Client State Store</text>
      <text x="15" y="52" fill="#374151" font-size="12">• useSocket nhận payload telemetry</text>
      <text x="15" y="72" fill="#374151" font-size="12">• Cập nhật trạng thái vào bộ nhớ Client:</text>
      <text x="25" y="92" fill="#0369A1" font-size="11" class="code-font">useAlarmStore.getState().addAlarm()</text>
      <text x="25" y="112" fill="#0369A1" font-size="11" class="code-font">useMachineStore.updateMetrics()</text>
      <text x="15" y="137" fill="#374151" font-size="12">• Tránh re-render toàn trang:</text>
      <text x="25" y="157" fill="#059669" font-size="12">Chỉ các thẻ máy (Card) hoặc biểu đồ</text>
      <text x="25" y="175" fill="#059669" font-size="12">có dữ liệu thay đổi mới được vẽ lại.</text>
    </g>

    <g transform="translate(20, 280)">
      <rect width="360" height="190" rx="8" fill="#FFFFFF" stroke="#E9D5FF" class="shadow" />
      <text x="15" y="28" fill="#6B21A8" font-size="14" font-weight="700">Trực Quan Hóa Đồ Thị (Recharts)</text>
      <text x="15" y="52" fill="#374151" font-size="12">• Đồ thị sóng cuộn thời gian thực 60s:</text>
      <text x="25" y="72" fill="#475569" font-size="12">- Giữ cố định 30 - 60 điểm gần nhất</text>
      <text x="25" y="90" fill="#475569" font-size="12">- Tự động đẩy điểm cũ ra khỏi mảng</text>
      <text x="25" y="108" fill="#475569" font-size="12">- Tránh tràn RAM trình duyệt</text>
      <text x="15" y="132" fill="#374151" font-size="12">• Đường ngưỡng tham chiếu (Reference Line):</text>
      <text x="25" y="152" fill="#D97706" font-size="12">Vạch vàng (Warning) &amp; Vạch đỏ (Alarm)</text>
      <text x="25" y="170" fill="#475569" font-size="12">giúp kỹ thuật viên nhận biết tức thì.</text>
    </g>

    <g transform="translate(20, 490)">
      <rect width="360" height="260" rx="8" fill="#FEF2F2" stroke="#F87171" />
      <text x="15" y="28" fill="#991B1B" font-size="13" font-weight="700">Kích Hoạt Digital Andon Board</text>
      <text x="15" y="52" fill="#7F1D1D" font-size="12">Khi nhận sự kiện vi phạm ngưỡng:</text>
      <text x="20" y="74" fill="#DC2626" font-size="12">1. Header đổi màu viền chớp đỏ/vàng.</text>
      <text x="20" y="94" fill="#DC2626" font-size="12">2. Bảng Andon Banner bật sáng toàn màn hình.</text>
      <text x="20" y="114" fill="#DC2626" font-size="12">3. Phát âm thanh cảnh báo tần số cao (Buzzer).</text>
      <text x="20" y="134" fill="#DC2626" font-size="12">4. Thẻ máy chuyển trạng thái sang ERROR.</text>
      <text x="15" y="162" fill="#78350F" font-size="12">Chờ thao tác tiếp nhận từ Vận hành viên:</text>
      <text x="25" y="184" fill="#0369A1" font-size="12">• Nút "Xác nhận sự cố" (Acknowledge)</text>
      <text x="25" y="204" fill="#047857" font-size="12">• Nút "Khắc phục xong" (Resolve)</text>
      <text x="25" y="224" fill="#475569" font-size="12">• Khóa nút nếu chưa đăng nhập hoặc sai Role.</text>
      <text x="15" y="246" fill="#1E293B" font-size="11" font-weight="600">-> Chuyển tiếp sang Flow 4 (Xử lý sự cố)</text>
    </g>
  </g>

  <!-- Connective Arrows between Steps -->
  <line x1="440" y1="270" x2="480" y2="270" stroke="#0284C7" stroke-width="4" marker-end="url(#arr2)" />
  <line x1="860" y1="270" x2="900" y2="270" stroke="#D97706" stroke-width="4" marker-end="url(#arrAmber2)" />
  <line x1="1280" y1="270" x2="1320" y2="270" stroke="#059669" stroke-width="4" marker-end="url(#arrGreen2)" />
  <line x1="1700" y1="270" x2="1740" y2="270" stroke="#7E22CE" stroke-width="4" marker-end="url(#arr2)" />

  <!-- Bottom Summary Info Banner -->
  <g transform="translate(60, 980)">
    <rect width="${width - 120}" height="310" rx="14" fill="#F1F5F9" stroke="#CBD5E1" stroke-width="1.5" />
    <text x="30" y="35" fill="#0F172A" font-size="16" font-weight="700">TỔNG KẾT LUỒNG DỮ LIỆU TELEMETRY (DATA FLOW SUMMARY)</text>

    <g transform="translate(30, 60)">
      <rect width="480" height="225" rx="8" fill="#FFFFFF" stroke="#E2E8F0" />
      <text x="20" y="30" fill="#0369A1" font-size="14" font-weight="700">Nguồn Khởi Tạo &amp; Chuẩn Hóa</text>
      <text x="20" y="60" fill="#475569" font-size="12">• Actor khởi tạo: Telemetry Simulator Hub tại Backend.</text>
      <text x="20" y="85" fill="#475569" font-size="12">• Dữ liệu đầu vào: Cấu hình tần số, dải tham số, mã máy.</text>
      <text x="20" y="110" fill="#475569" font-size="12">• Chuẩn hóa: Đóng mốc ISO-8601 UTC, tạo khóa băm SHA-256.</text>
      <text x="20" y="135" fill="#475569" font-size="12">• Đánh giá ngưỡng: Phát hiện sớm rung động &amp; nhiệt độ quá tải.</text>
      <text x="20" y="160" fill="#475569" font-size="12">• Đóng dấu nguồn: source = 'simulation' bảo đảm tính minh bạch.</text>
      <text x="20" y="190" fill="#059669" font-size="12" font-weight="600">✓ Loại bỏ hoàn toàn sự không đồng bộ giữa các client.</text>
    </g>

    <g transform="translate(540, 60)">
      <rect width="480" height="225" rx="8" fill="#FFFFFF" stroke="#E2E8F0" />
      <text x="20" y="30" fill="#B45309" font-size="14" font-weight="700">Lưu Trữ Chuỗi Thời Gian</text>
      <text x="20" y="60" fill="#475569" font-size="12">• Thành phần tham gia: MySQL 8.0, connection pool.</text>
      <text x="20" y="85" fill="#475569" font-size="12">• Tối ưu hóa: B-Tree Index trên (machineId, timestamp).</text>
      <text x="20" y="110" fill="#475569" font-size="12">• Chống ghi trùng: Bắt sự kiện ON DUPLICATE KEY UPDATE.</text>
      <text x="20" y="135" fill="#475569" font-size="12">• Giảm tải JOIN: Phi chuẩn hóa lưu kèm lineName, machineName.</text>
      <text x="20" y="160" fill="#475569" font-size="12">• Sẵn sàng mở rộng: Sắp xếp bảng theo Partition tháng.</text>
      <text x="20" y="190" fill="#059669" font-size="12" font-weight="600">✓ Truy vấn lịch sử 10.000 dòng hoàn tất dưới 350ms.</text>
    </g>

    <g transform="translate(1050, 60)">
      <rect width="480" height="225" rx="8" fill="#FFFFFF" stroke="#E2E8F0" />
      <text x="20" y="30" fill="#15803D" font-size="14" font-weight="700">Truyền Dẫn &amp; Trực Quan Hóa</text>
      <text x="20" y="60" fill="#475569" font-size="12">• Giao thức: WebSocket Full-duplex qua Socket.IO.</text>
      <text x="20" y="85" fill="#475569" font-size="12">• Quản lý kênh: Room-based routing tránh lãng phí băng thông.</text>
      <text x="20" y="110" fill="#475569" font-size="12">• Phía Client: Zustand store tiếp nhận và cập nhật state.</text>
      <text x="20" y="135" fill="#475569" font-size="12">• Giao diện: Đồ thị Recharts sóng cuộn 60 giây không giật lag.</text>
      <text x="20" y="160" fill="#475569" font-size="12">• Bảng Andon: Đèn cảnh báo âm thanh và hình ảnh tức thì.</text>
      <text x="20" y="190" fill="#059669" font-size="12" font-weight="600">✓ Giảm 85% thời gian phát hiện sự cố cho nhân viên nhà xưởng.</text>
    </g>

    <g transform="translate(1560, 60)">
      <rect width="480" height="225" rx="8" fill="#FFFFFF" stroke="#E2E8F0" />
      <text x="20" y="30" fill="#991B1B" font-size="14" font-weight="700">Kết Quả Cuối Cùng &amp; Đầu Ra</text>
      <text x="20" y="60" fill="#475569" font-size="12">• Màn hình Dashboard 3 cấp hiển thị chỉ số liên tục.</text>
      <text x="20" y="85" fill="#475569" font-size="12">• Cơ sở dữ liệu lưu trữ lịch sử máy đầy đủ và chuẩn xác.</text>
      <text x="20" y="110" fill="#475569" font-size="12">• Sự cố vi phạm ngưỡng được ghi nhận và cảnh báo ngay lập tức.</text>
      <text x="20" y="135" fill="#475569" font-size="12">• Dữ liệu sẵn sàng phục vụ bộ lọc Machine History và xuất báo cáo.</text>
      <text x="20" y="160" fill="#475569" font-size="12">• Tính toán độ sẵn sàng (Availability) và độ ổn định thiết bị.</text>
      <text x="20" y="190" fill="#B91C1C" font-size="12" font-weight="600">✓ Đạt chuẩn tài liệu chuyển giao kỹ thuật cho dự án KaiLink.</text>
    </g>
  </g>
</svg>`;

  fs.writeFileSync(svgPath, svg, 'utf8');
  console.log(`[OK] Created ${path.basename(svgPath)}`);
  renderSvgToPng(svgPath, pngPath, width, height);
}

// =============================================================================
// DIAGRAM 3: AUTHENTICATION & AUTHORIZATION FLOW
// =============================================================================
function generateAuthFlowDiagram() {
  const width = 2000;
  const height = 1300;
  const svgPath = path.join(outDir, 'flow_auth.svg');
  const pngPath = path.join(outDir, 'flow_auth.png');

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">
  <defs>
    <style>
      text { font-family: 'Segoe UI', Arial, sans-serif; }
      .code-font { font-family: Consolas, monospace; }
      .shadow { filter: drop-shadow(0px 8px 16px rgba(15, 23, 42, 0.08)); }
    </style>
    <linearGradient id="headerGrad3" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#002B5B" />
      <stop offset="100%" stop-color="#1E3A8A" />
    </linearGradient>
    <marker id="arrBlue3" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
      <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#0284C7" />
    </marker>
    <marker id="arrRed3" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
      <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#DC2626" />
    </marker>
  </defs>

  <rect width="100%" height="100%" fill="#F8FAFC" />
  <rect x="30" y="30" width="${width - 60}" height="${height - 60}" rx="20" fill="#FFFFFF" stroke="#E2E8F0" stroke-width="2" class="shadow" />

  <!-- Banner -->
  <g transform="translate(60, 60)">
    <rect width="${width - 120}" height="80" rx="10" fill="url(#headerGrad3)" />
    <rect x="0" y="0" width="8" height="80" rx="4" fill="#E60012" />
    <text x="30" y="38" fill="#FFFFFF" font-size="24" font-weight="700">LUỒNG XÁC THỰC &amp; PHÂN QUYỀN NGƯỜI DÙNG (AUTHENTICATION &amp; RBAC FLOW)</text>
    <text x="30" y="64" fill="#93C5FD" font-size="14" font-weight="500">ĐĂNG NHẬP -> XÁC THỰC BCRYPT 10 ROUNDS -> KIỂM TRA ROLE -> GHI AUDIT LOG -> PHÂN QUYỀN MÀN HÌNH VÀ THAO TÁC</text>
    <text x="${width - 160}" y="48" fill="#E2E8F0" font-size="13" font-weight="600" text-anchor="end">FLOW 1 / 5</text>
  </g>

  <!-- 4 COLUMNS: USER -> FRONTEND -> BACKEND -> MYSQL -->
  <!-- ACTOR / USER -->
  <g transform="translate(60, 180)">
    <rect width="380" height="700" rx="12" fill="#F8FAFC" stroke="#CBD5E1" stroke-width="2" />
    <rect width="380" height="50" rx="12" fill="#334155" />
    <rect x="0" y="36" width="380" height="14" fill="#334155" />
    <text x="190" y="32" fill="#FFFFFF" font-size="15" font-weight="700" text-anchor="middle">NGƯỜI DÙNG (ACTORS)</text>

    <g transform="translate(20, 70)">
      <rect width="340" height="180" rx="8" fill="#FFFFFF" stroke="#E2E8F0" class="shadow" />
      <text x="15" y="28" fill="#1E293B" font-size="14" font-weight="700">3 Nhóm Vai Trò Hệ Thống</text>
      <text x="15" y="55" fill="#DC2626" font-size="13" font-weight="600">• QUẢN TRỊ VIÊN (ADMIN):</text>
      <text x="25" y="75" fill="#475569" font-size="12">Toàn quyền cấu hình, User CRUD, Audit</text>
      <text x="15" y="100" fill="#0284C7" font-size="13" font-weight="600">• VẬN HÀNH VIÊN (OPERATOR):</text>
      <text x="25" y="120" fill="#475569" font-size="12">Giám sát ca kíp, xác nhận sự cố (Ack)</text>
      <text x="15" y="145" fill="#D97706" font-size="13" font-weight="600">• KỸ THUẬT VIÊN (MAINTENANCE):</text>
      <text x="25" y="165" fill="#475569" font-size="12">Chẩn đoán thông số, khắc phục lỗi (Resolve)</text>
    </g>

    <g transform="translate(20, 270)">
      <rect width="340" height="160" rx="8" fill="#FFFFFF" stroke="#E2E8F0" class="shadow" />
      <text x="15" y="28" fill="#1E293B" font-size="14" font-weight="700">Thao Tác Đăng Nhập</text>
      <text x="15" y="52" fill="#475569" font-size="12">1. Nhập Mã nhân viên (employeeId)</text>
      <text x="25" y="72" fill="#475569" font-size="12">hoặc Địa chỉ Email hợp lệ.</text>
      <text x="15" y="95" fill="#475569" font-size="12">2. Nhập Mật khẩu cá nhân.</text>
      <text x="15" y="118" fill="#475569" font-size="12">3. Nhấn nút "Đăng nhập".</text>
      <text x="15" y="142" fill="#059669" font-size="12" font-weight="600">-> Gửi thông tin đến Frontend</text>
    </g>

    <g transform="translate(20, 450)">
      <rect width="340" height="220" rx="8" fill="#EFF6FF" stroke="#93C5FD" />
      <text x="15" y="28" fill="#1D4ED8" font-size="13" font-weight="700">Tài Khoản Seed Mặc Định</text>
      <text x="15" y="52" fill="#374151" font-size="12">• Admin:</text>
      <text x="25" y="70" fill="#1E40AF" font-size="11" class="code-font">admin@denso.com / admin123</text>
      <text x="15" y="92" fill="#374151" font-size="12">• Operator:</text>
      <text x="25" y="110" fill="#1E40AF" font-size="11" class="code-font">operator@denso.com / op123</text>
      <text x="15" y="132" fill="#374151" font-size="12">• Maintenance:</text>
      <text x="25" y="150" fill="#1E40AF" font-size="11" class="code-font">tech@denso.com / tech123</text>
      <text x="15" y="178" fill="#B45309" font-size="12" font-weight="600">! Khuyến cáo đổi mật khẩu khi</text>
      <text x="15" y="198" fill="#B45309" font-size="12" font-weight="600">triển khai lên môi trường Production.</text>
    </g>
  </g>

  <!-- FRONTEND SPA LAYER -->
  <g transform="translate(480, 180)">
    <rect width="440" height="700" rx="12" fill="#F0FDF4" stroke="#86EFAC" stroke-width="2" />
    <rect width="440" height="50" rx="12" fill="#15803D" />
    <rect x="0" y="36" width="440" height="14" fill="#15803D" />
    <text x="220" y="32" fill="#FFFFFF" font-size="15" font-weight="700" text-anchor="middle">FRONTEND CLIENT (REACT SPA)</text>

    <g transform="translate(20, 70)">
      <rect width="400" height="180" rx="8" fill="#FFFFFF" stroke="#BBF7D0" class="shadow" />
      <text x="15" y="28" fill="#166534" font-size="14" font-weight="700">Form Đăng Nhập &amp; Validation</text>
      <text x="15" y="52" fill="#374151" font-size="12">• Kiểm tra định dạng client-side (Email/Mã NV)</text>
      <text x="15" y="72" fill="#374151" font-size="12">• Chống click đúp (isSubmitting flag)</text>
      <text x="15" y="92" fill="#374151" font-size="12">• Gửi yêu cầu HTTP RESTful:</text>
      <text x="25" y="112" fill="#0369A1" font-size="11" class="code-font">POST /api/auth/login</text>
      <text x="25" y="130" fill="#0369A1" font-size="11" class="code-font">Payload: { email, password }</text>
      <text x="15" y="155" fill="#475569" font-size="12">• Bật icon loading trạng thái chờ phản hồi</text>
    </g>

    <g transform="translate(20, 270)">
      <rect width="400" height="200" rx="8" fill="#FFFFFF" stroke="#BBF7D0" class="shadow" />
      <text x="15" y="28" fill="#166534" font-size="14" font-weight="700">Xử Lý Phản Hồi Thành Công</text>
      <text x="15" y="52" fill="#374151" font-size="12">• Nhận đối tượng: { user: { id, fullName, role } }</text>
      <text x="15" y="72" fill="#374151" font-size="12">• Lưu session vào localStorage &amp; Zustand</text>
      <text x="15" y="95" fill="#15803D" font-size="13" font-weight="700">Phân Phối Quyền Trên Giao Diện (RBAC):</text>
      <text x="20" y="118" fill="#DC2626" font-size="12">- Nếu role == 'ADMIN': Hiển thị tab Quản lý User,</text>
      <text x="25" y="135" fill="#DC2626" font-size="12">Tab Audit Logs, nút Xuất dữ liệu Lịch sử.</text>
      <text x="20" y="155" fill="#0284C7" font-size="12">- Nếu role == 'OPERATOR': Mở khóa nút Xác nhận (Ack).</text>
      <text x="20" y="175" fill="#D97706" font-size="12">- Nếu role == 'MAINTENANCE': Mở khóa nút Khắc phục.</text>
    </g>

    <g transform="translate(20, 490)">
      <rect width="400" height="180" rx="8" fill="#FEF2F2" stroke="#F87171" />
      <text x="15" y="28" fill="#991B1B" font-size="13" font-weight="700">Xử Lý Thất Bại &amp; Bị Chặn Quyền</text>
      <text x="15" y="52" fill="#7F1D1D" font-size="12">• Sai mật khẩu: Hiển thị thông báo đỏ "Mật khẩu</text>
      <text x="25" y="70" fill="#7F1D1D" font-size="12">hoặc tài khoản không chính xác".</text>
      <text x="15" y="92" fill="#7F1D1D" font-size="12">• Tài khoản bị khóa (status == 'INACTIVE'): Từ chối.</text>
      <text x="15" y="115" fill="#7F1D1D" font-size="12">• Cố tình truy cập trang cấm bằng URL:</text>
      <text x="25" y="135" fill="#991B1B" font-size="12">Protected Route chặn lại và redirect về Dashboard</text>
      <text x="25" y="155" fill="#991B1B" font-size="12">đồng thời hiện Toast cảnh báo không có quyền.</text>
    </g>
  </g>

  <!-- BACKEND CONTROLLER LAYER -->
  <g transform="translate(960, 180)">
    <rect width="460" height="700" rx="12" fill="#EFF6FF" stroke="#93C5FD" stroke-width="2" />
    <rect width="460" height="50" rx="12" fill="#1D4ED8" />
    <rect x="0" y="36" width="460" height="14" fill="#1D4ED8" />
    <text x="230" y="32" fill="#FFFFFF" font-size="15" font-weight="700" text-anchor="middle">BACKEND AUTH SERVICE (EXPRESS)</text>

    <g transform="translate(20, 70)">
      <rect width="420" height="190" rx="8" fill="#FFFFFF" stroke="#BFDBFE" class="shadow" />
      <text x="15" y="28" fill="#1E40AF" font-size="14" font-weight="700">Truy Vấn Tài Khoản &amp; So Khớp Hash</text>
      <text x="15" y="52" fill="#374151" font-size="12">1. Truy vấn MySQL lấy thông tin người dùng:</text>
      <text x="25" y="72" fill="#0369A1" font-size="11" class="code-font">SELECT * FROM users WHERE email = ?</text>
      <text x="25" y="90" fill="#0369A1" font-size="11" class="code-font">OR employeeId = ? LIMIT 1</text>
      <text x="15" y="115" fill="#374151" font-size="12">2. Kiểm tra mật khẩu qua thư viện Bcrypt:</text>
      <text x="25" y="135" fill="#0369A1" font-size="11" class="code-font">const match = await bcrypt.compare(</text>
      <text x="25" y="152" fill="#0369A1" font-size="11" class="code-font">  plainPassword, user.passwordHash)</text>
      <text x="15" y="175" fill="#059669" font-size="12" font-weight="600">✓ Bcrypt 10 rounds chống tấn công Rainbow Table</text>
    </g>

    <g transform="translate(20, 280)">
      <rect width="420" height="190" rx="8" fill="#FFFFFF" stroke="#BFDBFE" class="shadow" />
      <text x="15" y="28" fill="#1E40AF" font-size="14" font-weight="700">Tự Động Ghi Vết Kiểm Toán (Audit Trail)</text>
      <text x="15" y="52" fill="#374151" font-size="12">Dù đăng nhập THÀNH CÔNG hay THẤT BẠI,</text>
      <text x="15" y="70" fill="#374151" font-size="12">Backend đều lập tức ghi bản ghi vào audit_logs:</text>
      <text x="25" y="92" fill="#475569" font-size="11" class="code-font">INSERT INTO audit_logs (userId, action,</text>
      <text x="25" y="108" fill="#475569" font-size="11" class="code-font"> target, details, ipAddress, timestamp)</text>
      <text x="25" y="124" fill="#475569" font-size="11" class="code-font">VALUES (?, 'LOGIN_SUCCESS', ...)</text>
      <text x="15" y="150" fill="#374151" font-size="12">Thu thập thông tin:</text>
      <text x="25" y="170" fill="#475569" font-size="12">• Địa chỉ IP client, User-Agent trình duyệt</text>
    </g>

    <g transform="translate(20, 490)">
      <rect width="420" height="180" rx="8" fill="#FEF3C7" stroke="#FCD34D" />
      <text x="15" y="28" fill="#92400E" font-size="13" font-weight="700">Cập Nhật Mốc Đăng Nhập Gần Nhất</text>
      <text x="15" y="52" fill="#78350F" font-size="12">• Cập nhật trường lastLoginAt trong bảng users:</text>
      <text x="25" y="75" fill="#78350F" font-size="11" class="code-font">UPDATE users SET lastLoginAt = UTC_TIMESTAMP()</text>
      <text x="25" y="92" fill="#78350F" font-size="11" class="code-font">WHERE id = ?</text>
      <text x="15" y="120" fill="#78350F" font-size="12">• Trả về JSON chứa User DTO sạch (đã bóc tách</text>
      <text x="25" y="138" fill="#78350F" font-size="12">loại bỏ trường password hash để đảm bảo an toàn).</text>
      <text x="15" y="160" fill="#059669" font-size="12" font-weight="600">✓ Hoàn tất chu trình xác thực.</text>
    </g>
  </g>

  <!-- DATABASE MYSQL LAYER -->
  <g transform="translate(1460, 180)">
    <rect width="480" height="700" rx="12" fill="#FFFBEB" stroke="#FDE68A" stroke-width="2" />
    <rect width="480" height="50" rx="12" fill="#D97706" />
    <rect x="0" y="36" width="480" height="14" fill="#D97706" />
    <text x="240" y="32" fill="#FFFFFF" font-size="15" font-weight="700" text-anchor="middle">CƠ SỞ DỮ LIỆU (MYSQL 8.0)</text>

    <g transform="translate(20, 70)">
      <rect width="440" height="270" rx="8" fill="#FFFFFF" stroke="#FCD34D" class="shadow" />
      <text x="15" y="28" fill="#92400E" font-size="14" font-weight="700">Bảng: users (Lưu Danh Tính)</text>
      <text x="15" y="55" fill="#475569" font-size="12">• id: varchar(36) PK</text>
      <text x="15" y="75" fill="#475569" font-size="12">• employeeId: varchar(20) UNIQUE (Mã thẻ DENSO)</text>
      <text x="15" y="95" fill="#475569" font-size="12">• fullName: varchar(100) (Họ và tên)</text>
      <text x="15" y="115" fill="#475569" font-size="12">• email: varchar(100) UNIQUE (Thư điện tử)</text>
      <text x="15" y="135" fill="#475569" font-size="12">• password: varchar(255) (Bcrypt Salt 10 rounds)</text>
      <text x="15" y="155" fill="#DC2626" font-size="12" font-weight="600">• role: enum('ADMIN', 'OPERATOR', 'MAINTENANCE')</text>
      <text x="15" y="175" fill="#475569" font-size="12">• assignedLineId: varchar(36) (Dây chuyền phụ trách)</text>
      <text x="15" y="195" fill="#475569" font-size="12">• avatarUrl: text (Ảnh đại diện cá nhân)</text>
      <text x="15" y="215" fill="#475569" font-size="12">• status: enum('ACTIVE', 'INACTIVE')</text>
      <text x="15" y="235" fill="#475569" font-size="12">• lastLoginAt: datetime(3) UTC</text>
      <text x="15" y="255" fill="#059669" font-size="12" font-weight="600">✓ Toàn bộ mật khẩu được hash một chiều an toàn</text>
    </g>

    <g transform="translate(20, 360)">
      <rect width="440" height="310" rx="8" fill="#FFFFFF" stroke="#FCD34D" class="shadow" />
      <text x="15" y="28" fill="#92400E" font-size="14" font-weight="700">Bảng: audit_logs (Bảo Đảm Tính Bất Khả Chối Bỏ)</text>
      <text x="15" y="55" fill="#475569" font-size="12">• id: varchar(36) PK</text>
      <text x="15" y="75" fill="#475569" font-size="12">• userId: varchar(36) Logic FK</text>
      <text x="15" y="95" fill="#475569" font-size="12">• userEmail: varchar(100)</text>
      <text x="15" y="115" fill="#475569" font-size="12">• userName: varchar(100)</text>
      <text x="15" y="135" fill="#475569" font-size="12">• action: varchar(50) INDEX (VD: LOGIN_SUCCESS)</text>
      <text x="15" y="155" fill="#475569" font-size="12">• target: varchar(100) (VD: AUTH_MODULE)</text>
      <text x="15" y="175" fill="#475569" font-size="12">• details: text (Payload JSON chi tiết thao tác)</text>
      <text x="15" y="195" fill="#475569" font-size="12">• ipAddress: varchar(64)</text>
      <text x="15" y="215" fill="#475569" font-size="12">• timestamp: datetime(3) UTC INDEX</text>
      <text x="15" y="245" fill="#0369A1" font-size="12" font-weight="600">Đặc tính kỹ thuật:</text>
      <text x="25" y="265" fill="#475569" font-size="12">- Bảng chỉ ghi thêm (Append-only), cấm sửa/xóa.</text>
      <text x="25" y="285" fill="#475569" font-size="12">- Phục vụ tra cứu thanh tra an ninh công nghiệp.</text>
    </g>
  </g>

  <!-- Connective Arrows -->
  <line x1="440" y1="280" x2="480" y2="280" stroke="#0284C7" stroke-width="4" marker-end="url(#arrBlue3)" />
  <line x1="920" y1="280" x2="960" y2="280" stroke="#0284C7" stroke-width="4" marker-end="url(#arrBlue3)" />
  <line x1="1420" y1="280" x2="1460" y2="280" stroke="#0284C7" stroke-width="4" marker-end="url(#arrBlue3)" />

  <!-- Flow Summary Card -->
  <g transform="translate(60, 910)">
    <rect width="${width - 120}" height="330" rx="14" fill="#F1F5F9" stroke="#CBD5E1" stroke-width="1.5" />
    <text x="30" y="35" fill="#0F172A" font-size="16" font-weight="700">TỔNG HỢP NGUYÊN TẮC PHÂN QUYỀN VAI TRÒ (RBAC MATRIX &amp; FLOW SUMMARY)</text>

    <g transform="translate(30, 60)">
      <rect width="600" height="240" rx="8" fill="#FFFFFF" stroke="#E2E8F0" />
      <text x="20" y="30" fill="#DC2626" font-size="14" font-weight="700">1. Quản Trị Viên (ADMIN)</text>
      <text x="20" y="55" fill="#475569" font-size="12">• Quyền hạn cao nhất trong hệ thống.</text>
      <text x="20" y="75" fill="#475569" font-size="12">• Được phép thêm mới, chỉnh sửa, khóa/mở khóa người dùng.</text>
      <text x="20" y="95" fill="#475569" font-size="12">• Được phép đổi ảnh đại diện (Avatar) cho mọi nhân sự.</text>
      <text x="20" y="115" fill="#475569" font-size="12">• Xem toàn bộ danh sách Nhật ký kiểm toán (Audit Logs).</text>
      <text x="20" y="135" fill="#475569" font-size="12">• Xuất báo cáo lịch sử máy định dạng Excel, CSV, JSON.</text>
      <text x="20" y="160" fill="#059669" font-size="12" font-weight="600">✓ Bảo vệ toàn vẹn cấu hình vận hành nhà xưởng.</text>
    </g>

    <g transform="translate(660, 60)">
      <rect width="600" height="240" rx="8" fill="#FFFFFF" stroke="#E2E8F0" />
      <text x="20" y="30" fill="#0284C7" font-size="14" font-weight="700">2. Vận Hành Viên (OPERATOR)</text>
      <text x="20" y="55" fill="#475569" font-size="12">• Giám sát màn hình Dashboard cấp 1, cấp 2 và cấp 3.</text>
      <text x="20" y="75" fill="#475569" font-size="12">• Tiếp nhận tín hiệu chuông/đèn từ Digital Andon Board.</text>
      <text x="20" y="95" fill="#475569" font-size="12">• Có quyền bấm nút "Xác nhận sự cố" (Acknowledge).</text>
      <text x="20" y="115" fill="#475569" font-size="12">• Xem danh mục máy móc và chỉ số OEE dây chuyền phụ trách.</text>
      <text x="20" y="135" fill="#DC2626" font-size="12">• BỊ CHẶN: Không thể sửa User, không thể đóng sự cố (Resolve).</text>
      <text x="20" y="160" fill="#059669" font-size="12" font-weight="600">✓ Tách biệt trách nhiệm giữa vận hành và bảo trì kỹ thuật.</text>
    </g>

    <g transform="translate(1290, 60)">
      <rect width="600" height="240" rx="8" fill="#FFFFFF" stroke="#E2E8F0" />
      <text x="20" y="30" fill="#D97706" font-size="14" font-weight="700">3. Kỹ Thuật Viên Bảo Trì (MAINTENANCE)</text>
      <text x="20" y="55" fill="#475569" font-size="12">• Giám sát chuyên sâu đồ thị sóng cảm biến cấp 3.</text>
      <text x="20" y="75" fill="#475569" font-size="12">• Chẩn đoán rung động vòng bi, nhiệt độ trục chính và áp suất khí.</text>
      <text x="20" y="95" fill="#475569" font-size="12">• Có quyền bấm nút "Khắc phục xong" (Resolve) sau khi sửa chữa.</text>
      <text x="20" y="115" fill="#475569" font-size="12">• Bắt buộc nhập ghi chú nguyên nhân và phương án khắc phục.</text>
      <text x="20" y="135" fill="#475569" font-size="12">• Đóng sự cố và đưa trạng thái máy trở lại OPERATIONAL.</text>
      <text x="20" y="160" fill="#059669" font-size="12" font-weight="600">✓ Khép kín vòng đời xử lý sự cố thiết bị công nghiệp.</text>
    </g>
  </g>
</svg>`;

  fs.writeFileSync(svgPath, svg, 'utf8');
  console.log(`[OK] Created ${path.basename(svgPath)}`);
  renderSvgToPng(svgPath, pngPath, width, height);
}

// =============================================================================
// DIAGRAM 4: ALARM HANDLING WORKFLOW
// =============================================================================
function generateAlarmWorkflowDiagram() {
  const width = 2200;
  const height = 1350;
  const svgPath = path.join(outDir, 'flow_alarm.svg');
  const pngPath = path.join(outDir, 'flow_alarm.png');

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">
  <defs>
    <style>
      text { font-family: 'Segoe UI', Arial, sans-serif; }
      .code-font { font-family: Consolas, monospace; }
      .shadow { filter: drop-shadow(0px 8px 16px rgba(15, 23, 42, 0.08)); }
    </style>
    <linearGradient id="headerGrad4" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#7F1D1D" />
      <stop offset="100%" stop-color="#B91C1C" />
    </linearGradient>
    <marker id="arrRed4" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
      <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#DC2626" />
    </marker>
    <marker id="arrGreen4" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
      <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#059669" />
    </marker>
  </defs>

  <rect width="100%" height="100%" fill="#F8FAFC" />
  <rect x="30" y="30" width="${width - 60}" height="${height - 60}" rx="20" fill="#FFFFFF" stroke="#E2E8F0" stroke-width="2" class="shadow" />

  <!-- Banner -->
  <g transform="translate(60, 60)">
    <rect width="${width - 120}" height="80" rx="10" fill="url(#headerGrad4)" />
    <rect x="0" y="0" width="8" height="80" rx="4" fill="#FBBF24" />
    <text x="30" y="38" fill="#FFFFFF" font-size="24" font-weight="700">QUY TRÌNH XỬ LÝ CẢNH BÁO &amp; SỰ CỐ THIẾT BỊ (ALARM HANDLING WORKFLOW)</text>
    <text x="30" y="64" fill="#FDE68A" font-size="14" font-weight="500">VI PHẠM NGƯỠNG CẢM BIẾN -> KÍCH HOẠT ANDON BOARD -> TIẾP NHẬN (ACK) -> KHẮC PHỤC (RESOLVE) -> GHI AUDIT LOG</text>
    <text x="${width - 160}" y="48" fill="#E2E8F0" font-size="13" font-weight="600" text-anchor="end">FLOW 4 / 5</text>
  </g>

  <!-- 4 PHASES -->
  <!-- PHASE 1: TRIGGER -->
  <g transform="translate(60, 180)">
    <rect width="480" height="740" rx="12" fill="#FEF2F2" stroke="#F87171" stroke-width="2" />
    <rect width="480" height="50" rx="12" fill="#DC2626" />
    <rect x="0" y="36" width="480" height="14" fill="#DC2626" />
    <text x="240" y="32" fill="#FFFFFF" font-size="15" font-weight="700" text-anchor="middle">PHA 1: PHÁT SINH CẢNH BÁO</text>

    <g transform="translate(20, 70)">
      <rect width="440" height="200" rx="8" fill="#FFFFFF" stroke="#FECACA" class="shadow" />
      <text x="15" y="28" fill="#991B1B" font-size="14" font-weight="700">1. Phát Hiện Vi Phạm Ngưỡng</text>
      <text x="15" y="52" fill="#374151" font-size="12">• Sensor đo được giá trị vượt biên độ:</text>
      <text x="25" y="72" fill="#DC2626" font-size="12">- Nhiệt độ trục chính: 85°C (> 80°C Critical)</text>
      <text x="25" y="92" fill="#D97706" font-size="12">- Độ rung ổ trục: 3.8 mm/s (> 3.5 mm/s Warning)</text>
      <text x="15" y="118" fill="#374151" font-size="12">• Phân loại cấp độ sự cố:</text>
      <text x="25" y="138" fill="#D97706" font-size="12">- WARNING: Thiết bị có dấu hiệu bất thường</text>
      <text x="25" y="158" fill="#DC2626" font-size="12">- CRITICAL: Nguy cơ hư hỏng nặng, dừng chuyền</text>
      <text x="15" y="185" fill="#475569" font-size="12">• Máy chuyển trạng thái sang WARNING hoặc ERROR</text>
    </g>

    <g transform="translate(20, 290)">
      <rect width="440" height="190" rx="8" fill="#FFFFFF" stroke="#FECACA" class="shadow" />
      <text x="15" y="28" fill="#991B1B" font-size="14" font-weight="700">2. Bật Bảng Đèn Digital Andon</text>
      <text x="15" y="52" fill="#374151" font-size="12">• WebSocket broadcast sự kiện 'alarm_trigger'</text>
      <text x="15" y="72" fill="#374151" font-size="12">• Giao diện hiển thị cảnh báo đa giác quan:</text>
      <text x="25" y="92" fill="#DC2626" font-size="12">- Header nhấp nháy đèn đỏ / vàng liên tục</text>
      <text x="25" y="112" fill="#DC2626" font-size="12">- Banner cảnh báo hiện tên máy, vị trí Line</text>
      <text x="25" y="132" fill="#DC2626" font-size="12">- Loa phát âm thanh còi hú báo động (Buzzer)</text>
      <text x="15" y="157" fill="#374151" font-size="12">• Thẻ máy trên Dashboard Cấp 2 đổi màu viền</text>
      <text x="15" y="177" fill="#475569" font-size="12">• Tạo bản ghi cảnh báo trong Zustand RAM Store</text>
    </g>

    <g transform="translate(20, 500)">
      <rect width="440" height="210" rx="8" fill="#FFFBEB" stroke="#FDE68A" />
      <text x="15" y="28" fill="#92400E" font-size="13" font-weight="700">Ghi Chú Nợ Kỹ Thuật (TD-01)</text>
      <text x="15" y="52" fill="#78350F" font-size="12">Hiện tại, bảng 'alarms' CHƯA TỒN TẠI</text>
      <text x="15" y="70" fill="#78350F" font-size="12">trong CSDL MySQL vật lý.</text>
      <text x="15" y="95" fill="#78350F" font-size="12">Toàn bộ danh sách cảnh báo đang được duy trì</text>
      <text x="15" y="115" fill="#78350F" font-size="12">trên bộ nhớ RAM Zustand của Client.</text>
      <text x="15" y="140" fill="#B45309" font-size="12">• Hậu quả: Khi F5 / Reload trang web, danh</text>
      <text x="25" y="158" fill="#B45309" font-size="12">sách cảnh báo chưa xử lý sẽ bị làm mới.</text>
      <text x="15" y="185" fill="#059669" font-size="12" font-weight="600">-> Đã đưa vào lộ trình Giai đoạn 5 để bổ sung</text>
      <text x="25" y="202" fill="#059669" font-size="12" font-weight="600">bảng alarms vật lý vào MySQL.</text>
    </g>
  </g>

  <!-- PHASE 2: ACKNOWLEDGE -->
  <g transform="translate(580, 180)">
    <rect width="480" height="740" rx="12" fill="#EFF6FF" stroke="#93C5FD" stroke-width="2" />
    <rect width="480" height="50" rx="12" fill="#1D4ED8" />
    <rect x="0" y="36" width="480" height="14" fill="#1D4ED8" />
    <text x="240" y="32" fill="#FFFFFF" font-size="15" font-weight="700" text-anchor="middle">PHA 2: TIẾP NHẬN SỰ CỐ (ACKNOWLEDGE)</text>

    <g transform="translate(20, 70)">
      <rect width="440" height="200" rx="8" fill="#FFFFFF" stroke="#BFDBFE" class="shadow" />
      <text x="15" y="28" fill="#1E40AF" font-size="14" font-weight="700">1. Vận Hành Viên Bấm Xác Nhận</text>
      <text x="15" y="52" fill="#374151" font-size="12">• Đối tượng thực hiện: VẬN HÀNH VIÊN (OPERATOR)</text>
      <text x="15" y="72" fill="#374151" font-size="12">• Điều kiện: Đã đăng nhập tài khoản có quyền</text>
      <text x="15" y="92" fill="#374151" font-size="12">• Thao tác: Nhấn nút "XÁC NHẬN" (Acknowledge)</text>
      <text x="15" y="115" fill="#374151" font-size="12">• Ý nghĩa nghiệp vụ:</text>
      <text x="25" y="135" fill="#15803D" font-size="12">Xác nhận con người đã nhận được thông tin</text>
      <text x="25" y="152" fill="#15803D" font-size="12">cảnh báo từ hệ thống, đang tiếp cận hiện trường</text>
      <text x="25" y="170" fill="#15803D" font-size="12">để kiểm tra dây chuyền sản xuất.</text>
    </g>

    <g transform="translate(20, 290)">
      <rect width="440" height="190" rx="8" fill="#FFFFFF" stroke="#BFDBFE" class="shadow" />
      <text x="15" y="28" fill="#1E40AF" font-size="14" font-weight="700">2. Thay Đổi Trạng Thái Hệ Thống</text>
      <text x="15" y="52" fill="#374151" font-size="12">• Trạng thái cảnh báo chuyển sang ACKNOWLEDGED</text>
      <text x="15" y="72" fill="#374151" font-size="12">• Còi hú báo động tự động tắt âm thanh</text>
      <text x="15" y="92" fill="#374151" font-size="12">• Đèn Andon chuyển từ đỏ chớp sang vàng tĩnh</text>
      <text x="15" y="112" fill="#374151" font-size="12">• Ghi nhận mốc thời gian tiếp nhận: acknowledgedAt</text>
      <text x="15" y="132" fill="#374151" font-size="12">• Ghi nhận nhân viên tiếp nhận: acknowledgedBy</text>
      <text x="15" y="160" fill="#059669" font-size="12" font-weight="600">✓ Tính toán chỉ số MTTA (Mean Time To Acknowledge)</text>
    </g>

    <g transform="translate(20, 500)">
      <rect width="440" height="210" rx="8" fill="#EFF6FF" stroke="#93C5FD" />
      <text x="15" y="28" fill="#1E40AF" font-size="13" font-weight="700">Ghi Nhật Ký Kiểm Toán (BR-04)</text>
      <text x="15" y="52" fill="#374151" font-size="12">Backend tự động lưu vết vào bảng audit_logs:</text>
      <text x="20" y="75" fill="#1E40AF" font-size="11" class="code-font">• action: 'ACK_ALARM'</text>
      <text x="20" y="92" fill="#1E40AF" font-size="11" class="code-font">• target: alarmId, machineId</text>
      <text x="20" y="110" fill="#1E40AF" font-size="11" class="code-font">• details: 'Vận hành viên đã nhận sự cố'</text>
      <text x="20" y="128" fill="#1E40AF" font-size="11" class="code-font">• userId: operatorId, timestamp: UTC</text>
      <text x="15" y="155" fill="#15803D" font-size="12">Phát tín hiệu thông báo cho Bộ phận Bảo trì:</text>
      <text x="25" y="175" fill="#15803D" font-size="12">Kỹ thuật viên bảo trì nhận thông báo để mang</text>
      <text x="25" y="195" fill="#15803D" font-size="12">dụng cụ chuyên dụng vào xưởng xử lý.</text>
    </g>
  </g>

  <!-- PHASE 3: RESOLVE -->
  <g transform="translate(1100, 180)">
    <rect width="480" height="740" rx="12" fill="#FFFBEB" stroke="#FDE68A" stroke-width="2" />
    <rect width="480" height="50" rx="12" fill="#D97706" />
    <rect x="0" y="36" width="480" height="14" fill="#D97706" />
    <text x="240" y="32" fill="#FFFFFF" font-size="15" font-weight="700" text-anchor="middle">PHA 3: KHẮC PHỤC &amp; ĐÓNG SỰ CỐ</text>

    <g transform="translate(20, 70)">
      <rect width="440" height="200" rx="8" fill="#FFFFFF" stroke="#FCD34D" class="shadow" />
      <text x="15" y="28" fill="#92400E" font-size="14" font-weight="700">1. Kỹ Thuật Viên Xử Lý Phần Cứng</text>
      <text x="15" y="52" fill="#374151" font-size="12">• Đối tượng: KỸ THUẬT VIÊN BẢO TRÌ (MAINTENANCE)</text>
      <text x="15" y="72" fill="#374151" font-size="12">• Kiểm tra thực địa tại máy:</text>
      <text x="25" y="92" fill="#475569" font-size="12">- Bôi trơn ổ bi, siết bu lông chống rung</text>
      <text x="25" y="112" fill="#475569" font-size="12">- Bổ sung dung dịch làm mát trục chính</text>
      <text x="25" y="132" fill="#475569" font-size="12">- Hiệu chỉnh áp suất van khí nén</text>
      <text x="15" y="157" fill="#374151" font-size="12">• Chờ cảm biến hồi phục về dải an toàn</text>
      <text x="15" y="177" fill="#374151" font-size="12">• Mở hộp thoại "KHẮC PHỤC SỰ CỐ" (Resolve Modal)</text>
    </g>

    <g transform="translate(20, 290)">
      <rect width="440" height="190" rx="8" fill="#FFFFFF" stroke="#FCD34D" class="shadow" />
      <text x="15" y="28" fill="#92400E" font-size="14" font-weight="700">2. Nhập Báo Cáo Nghiệm Thu</text>
      <text x="15" y="52" fill="#374151" font-size="12">• Bắt buộc nhập biên bản nghiệm thu (BR-05):</text>
      <text x="25" y="72" fill="#78350F" font-size="12">- Nguyên nhân gốc rễ (Root Cause)</text>
      <text x="25" y="90" fill="#78350F" font-size="12">- Phương án khắc phục đã áp dụng</text>
      <text x="25" y="108" fill="#78350F" font-size="12">- Vật tư linh kiện đã thay thế</text>
      <text x="15" y="132" fill="#374151" font-size="12">• Không cho phép đóng sự cố nếu để trống ghi chú</text>
      <text x="15" y="155" fill="#374151" font-size="12">• Nhấn nút "Xác nhận đã khắc phục"</text>
      <text x="15" y="175" fill="#059669" font-size="12" font-weight="600">✓ Đảm bảo trách nhiệm bảo trì minh bạch</text>
    </g>

    <g transform="translate(20, 500)">
      <rect width="440" height="210" rx="8" fill="#FFFBEB" stroke="#FCD34D" />
      <text x="15" y="28" fill="#92400E" font-size="13" font-weight="700">Lưu Vết Nghiệm Thu (Audit Log)</text>
      <text x="15" y="52" fill="#78350F" font-size="12">Ghi bản ghi kiểm toán hoàn tất sự cố:</text>
      <text x="20" y="75" fill="#78350F" font-size="11" class="code-font">• action: 'RESOLVE_ALARM'</text>
      <text x="20" y="92" fill="#78350F" font-size="11" class="code-font">• details: JSON payload ghi chú nghiệm thu</text>
      <text x="20" y="110" fill="#78350F" font-size="11" class="code-font">• resolvedBy: techId, resolvedAt: UTC</text>
      <text x="15" y="135" fill="#78350F" font-size="12">• Trạng thái cảnh báo đổi thành RESOLVED</text>
      <text x="15" y="155" fill="#78350F" font-size="12">• Đóng hộp thoại, loại bỏ khỏi hàng đợi cảnh báo</text>
      <text x="15" y="180" fill="#059669" font-size="12" font-weight="600">✓ Tính toán chỉ số MTTR (Mean Time To Recovery)</text>
    </g>
  </g>

  <!-- PHASE 4: RECOVERY & CLOSURE -->
  <g transform="translate(1620, 180)">
    <rect width="520" height="740" rx="12" fill="#F0FDF4" stroke="#86EFAC" stroke-width="2" />
    <rect width="520" height="50" rx="12" fill="#15803D" />
    <rect x="0" y="36" width="520" height="14" fill="#15803D" />
    <text x="260" y="32" fill="#FFFFFF" font-size="15" font-weight="700" text-anchor="middle">PHA 4: HỒI PHỤC VẬN HÀNH &amp; LƯU TRỮ</text>

    <g transform="translate(20, 70)">
      <rect width="480" height="200" rx="8" fill="#FFFFFF" stroke="#BBF7D0" class="shadow" />
      <text x="15" y="28" fill="#166534" font-size="14" font-weight="700">1. Máy Trở Lại Trạng Thái Bình Thường</text>
      <text x="15" y="52" fill="#374151" font-size="12">• Trạng thái máy móc cập nhật sang OPERATIONAL</text>
      <text x="15" y="72" fill="#374151" font-size="12">• Thẻ Line Card và Machine Card chuyển sang màu xanh lá</text>
      <text x="15" y="92" fill="#374151" font-size="12">• Đèn Andon tắt hoàn toàn, bảng điều khiển trở về trạng thái an toàn</text>
      <text x="15" y="112" fill="#374151" font-size="12">• Tiếp tục quy trình sản xuất theo kế hoạch ca</text>
      <text x="15" y="137" fill="#15803D" font-size="12">• Bộ đếm sản lượng mục tiêu và sản lượng thực tế tiếp tục ghi nhận</text>
      <text x="15" y="165" fill="#059669" font-size="12" font-weight="600">✓ Khôi phục hoạt động nhà xưởng không làm gián đoạn dây chuyền</text>
    </g>

    <g transform="translate(20, 290)">
      <rect width="480" height="190" rx="8" fill="#FFFFFF" stroke="#BBF7D0" class="shadow" />
      <text x="15" y="28" fill="#166534" font-size="14" font-weight="700">2. Cập Nhật KPI Hiệu Suất Thiết Bị (OEE)</text>
      <text x="15" y="52" fill="#374151" font-size="12">• Ghi nhận thời gian dừng máy phát sinh (Downtime Duration):</text>
      <text x="25" y="72" fill="#0369A1" font-size="11" class="code-font">downtime = resolvedAt - triggeredAt</text>
      <text x="15" y="95" fill="#374151" font-size="12">• Tính toán lại các chỉ số hiệu suất OEE cấp nhà máy:</text>
      <text x="25" y="115" fill="#475569" font-size="12">- Tính khả dụng (Availability) = (Operating Time / Planned Time)</text>
      <text x="25" y="135" fill="#475569" font-size="12">- Hiệu suất vận hành (Performance) và Tỷ lệ chất lượng (Quality)</text>
      <text x="15" y="160" fill="#059669" font-size="12" font-weight="600">✓ Cung cấp số liệu chính xác cho báo cáo giao ban ca kíp</text>
    </g>

    <g transform="translate(20, 500)">
      <rect width="480" height="210" rx="8" fill="#DCFCE7" stroke="#4ADE80" />
      <text x="15" y="28" fill="#14532D" font-size="13" font-weight="700">Khép Kín Vòng Đời Cảnh Báo (Closed-loop)</text>
      <text x="15" y="52" fill="#166534" font-size="12">Toàn bộ thông tin sự cố từ lúc phát sinh, tiếp nhận đến khi khắc phục</text>
      <text x="15" y="70" fill="#166534" font-size="12">được lưu trữ đầy đủ trong Audit Trail phục vụ:</text>
      <text x="20" y="92" fill="#15803D" font-size="12">1. Tra cứu lịch sử bảo dưỡng máy móc định kỳ.</text>
      <text x="20" y="112" fill="#15803D" font-size="12">2. Đánh giá tay nghề và thời gian phản ứng của kỹ thuật viên.</text>
      <text x="20" y="132" fill="#15803D" font-size="12">3. Phân tích nguyên nhân gốc rễ (Root Cause Analysis - RCA).</text>
      <text x="20" y="152" fill="#15803D" font-size="12">4. Xây dựng dữ liệu huấn luyện cho bảo trì dự đoán (PdM) tương lai.</text>
      <text x="15" y="180" fill="#047857" font-size="12" font-weight="600">✓ Đạt chuẩn quản lý sản xuất tinh gọn Lean Manufacturing.</text>
    </g>
  </g>

  <!-- Connective Arrows -->
  <line x1="540" y1="280" x2="580" y2="280" stroke="#0284C7" stroke-width="4" marker-end="url(#arrGreen4)" />
  <line x1="1060" y1="280" x2="1100" y2="280" stroke="#D97706" stroke-width="4" marker-end="url(#arrGreen4)" />
  <line x1="1580" y1="280" x2="1620" y2="280" stroke="#059669" stroke-width="4" marker-end="url(#arrGreen4)" />

  <!-- Flow Summary Table -->
  <g transform="translate(60, 950)">
    <rect width="${width - 120}" height="340" rx="14" fill="#F1F5F9" stroke="#CBD5E1" stroke-width="1.5" />
    <text x="30" y="35" fill="#0F172A" font-size="16" font-weight="700">TỔNG HỢP VÒNG ĐỜI CẢNH BÁO (ALARM LIFECYCLE SUMMARY)</text>

    <g transform="translate(30, 60)">
      <rect width="480" height="255" rx="8" fill="#FFFFFF" stroke="#E2E8F0" />
      <text x="20" y="30" fill="#DC2626" font-size="14" font-weight="700">1. Kích Hoạt (Trigger)</text>
      <text x="20" y="60" fill="#475569" font-size="12">• Actor/Nguồn: Threshold Evaluator (Backend/Client).</text>
      <text x="20" y="85" fill="#475569" font-size="12">• Dữ liệu vào: Giá trị đo rung, nhiệt, áp, dòng điện.</text>
      <text x="20" y="110" fill="#475569" font-size="12">• Hành động: So sánh ngưỡng, tạo sự kiện cảnh báo.</text>
      <text x="20" y="135" fill="#475569" font-size="12">• Đầu ra: Còi hú Andon, đèn chớp đỏ, thẻ máy ERROR.</text>
      <text x="20" y="160" fill="#475569" font-size="12">• Trạng thái: ACTIVE_UNACK (Chờ tiếp nhận).</text>
      <text x="20" y="190" fill="#DC2626" font-size="12" font-weight="600">! Cảnh báo tức thì &lt; 200ms đến nhân viên xưởng.</text>
    </g>

    <g transform="translate(540, 60)">
      <rect width="480" height="255" rx="8" fill="#FFFFFF" stroke="#E2E8F0" />
      <text x="20" y="30" fill="#0284C7" font-size="14" font-weight="700">2. Tiếp Nhận (Acknowledge)</text>
      <text x="20" y="60" fill="#475569" font-size="12">• Actor: Vận hành viên (OPERATOR) có thẩm quyền.</text>
      <text x="20" y="85" fill="#475569" font-size="12">• Dữ liệu vào: Lệnh nhấn nút Xác nhận trên Andon.</text>
      <text x="20" y="110" fill="#475569" font-size="12">• Hành động: Tắt còi, đổi đèn vàng tĩnh, ghi audit.</text>
      <text x="20" y="135" fill="#475569" font-size="12">• Đầu ra: Bản ghi audit_logs (action: 'ACK_ALARM').</text>
      <text x="20" y="160" fill="#475569" font-size="12">• Trạng thái: ACKNOWLEDGED (Đang xử lý).</text>
      <text x="20" y="190" fill="#0284C7" font-size="12" font-weight="600">✓ Ghi nhận mốc thời gian phản hồi MTTA.</text>
    </g>

    <g transform="translate(1050, 60)">
      <rect width="480" height="255" rx="8" fill="#FFFFFF" stroke="#E2E8F0" />
      <text x="20" y="30" fill="#D97706" font-size="14" font-weight="700">3. Khắc Phục (Resolve)</text>
      <text x="20" y="60" fill="#475569" font-size="12">• Actor: Kỹ thuật viên (MAINTENANCE).</text>
      <text x="20" y="85" fill="#475569" font-size="12">• Dữ liệu vào: Biên bản nghiệm thu và ghi chú sửa chữa.</text>
      <text x="20" y="110" fill="#475569" font-size="12">• Hành động: Sửa chữa thiết bị, nhập mô tả, bấm Resolve.</text>
      <text x="20" y="135" fill="#475569" font-size="12">• Đầu ra: Bản ghi audit_logs (action: 'RESOLVE_ALARM').</text>
      <text x="20" y="160" fill="#475569" font-size="12">• Trạng thái: RESOLVED (Đã khắc phục xong).</text>
      <text x="20" y="190" fill="#D97706" font-size="12" font-weight="600">✓ Ghi nhận mốc thời gian hồi phục MTTR.</text>
    </g>

    <g transform="translate(1560, 60)">
      <rect width="480" height="255" rx="8" fill="#FFFFFF" stroke="#E2E8F0" />
      <text x="20" y="30" fill="#059669" font-size="14" font-weight="700">4. Đóng Hồ Sơ &amp; Khôi Phục</text>
      <text x="20" y="60" fill="#475569" font-size="12">• Actor/Thành phần: Hệ thống giám sát KaiLink.</text>
      <text x="20" y="85" fill="#475569" font-size="12">• Dữ liệu vào: Tín hiệu cảm biến trở về dải an toàn.</text>
      <text x="20" y="110" fill="#475569" font-size="12">• Hành động: Chuyển máy sang OPERATIONAL, tắt Andon.</text>
      <text x="20" y="135" fill="#475569" font-size="12">• Đầu ra: Khôi phục dây chuyền, cập nhật OEE.</text>
      <text x="20" y="160" fill="#475569" font-size="12">• Trạng thái: CLOSED &amp; ARCHIVED.</text>
      <text x="20" y="190" fill="#059669" font-size="12" font-weight="600">✓ Đảm bảo quy trình sản xuất liên tục, an toàn.</text>
    </g>
  </g>
</svg>`;

  fs.writeFileSync(svgPath, svg, 'utf8');
  console.log(`[OK] Created ${path.basename(svgPath)}`);
  renderSvgToPng(svgPath, pngPath, width, height);
}

// =============================================================================
// DIAGRAM 5: DATA QUERY & EXPORT FLOW
// =============================================================================
function generateExportFlowDiagram() {
  const width = 2200;
  const height = 1350;
  const svgPath = path.join(outDir, 'flow_export.svg');
  const pngPath = path.join(outDir, 'flow_export.png');

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">
  <defs>
    <style>
      text { font-family: 'Segoe UI', Arial, sans-serif; }
      .code-font { font-family: Consolas, monospace; }
      .shadow { filter: drop-shadow(0px 8px 16px rgba(15, 23, 42, 0.08)); }
    </style>
    <linearGradient id="headerGrad5" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#065F46" />
      <stop offset="100%" stop-color="#047857" />
    </linearGradient>
    <marker id="arrGreen5" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
      <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#059669" />
    </marker>
    <marker id="arrBlue5" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
      <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#0284C7" />
    </marker>
  </defs>

  <rect width="100%" height="100%" fill="#F8FAFC" />
  <rect x="30" y="30" width="${width - 60}" height="${height - 60}" rx="20" fill="#FFFFFF" stroke="#E2E8F0" stroke-width="2" class="shadow" />

  <!-- Banner -->
  <g transform="translate(60, 60)">
    <rect width="${width - 120}" height="80" rx="10" fill="url(#headerGrad5)" />
    <rect x="0" y="0" width="8" height="80" rx="4" fill="#E60012" />
    <text x="30" y="38" fill="#FFFFFF" font-size="24" font-weight="700">LUỒNG TRUY VẤN LỊCH SỬ &amp; XUẤT BÁO CÁO (HISTORICAL DATA QUERY &amp; EXPORT FLOW)</text>
    <text x="30" y="64" fill="#A7F3D0" font-size="14" font-weight="500">LỌC THAM SỐ -> SQL WHITELIST -> TRUY VẤN MYSQL B-TREE INDEX (LIMIT 10.000) -> ĐỘNG CƠ EXCEL/CSV/JSON -> STREAM DOWNLOAD</text>
    <text x="${width - 160}" y="48" fill="#E2E8F0" font-size="13" font-weight="600" text-anchor="end">FLOW 5 / 5</text>
  </g>

  <!-- 4 COLUMNS: CLIENT FILTER -> API VALIDATION -> DATABASE QUERY -> EXPORT ENGINE & DOWNLOAD -->
  <!-- STEP 1: CLIENT FILTER -->
  <g transform="translate(60, 180)">
    <rect width="480" height="740" rx="12" fill="#F0FDF4" stroke="#86EFAC" stroke-width="2" />
    <rect width="480" height="50" rx="12" fill="#15803D" />
    <rect x="0" y="36" width="480" height="14" fill="#15803D" />
    <text x="240" y="32" fill="#FFFFFF" font-size="15" font-weight="700" text-anchor="middle">BƯỚC 1: THIẾT LẬP BỘ LỌC (CLIENT)</text>

    <g transform="translate(20, 70)">
      <rect width="440" height="210" rx="8" fill="#FFFFFF" stroke="#BBF7D0" class="shadow" />
      <text x="15" y="28" fill="#166534" font-size="14" font-weight="700">Giao Diện Machine History View</text>
      <text x="15" y="52" fill="#374151" font-size="12">• Người dùng: ADMIN hoặc KỸ THUẬT VIÊN</text>
      <text x="15" y="72" fill="#374151" font-size="12">• Chọn các tiêu chí tra cứu linh hoạt:</text>
      <text x="25" y="92" fill="#0369A1" font-size="12">- Chọn Dây chuyền (Line): Line 1, Line 2...</text>
      <text x="25" y="112" fill="#0369A1" font-size="12">- Chọn Máy (Machine): CNC-01, Robot-02...</text>
      <text x="25" y="132" fill="#0369A1" font-size="12">- Chọn Thông số (Metric): Rung, Nhiệt, Áp, Dòng</text>
      <text x="25" y="152" fill="#0369A1" font-size="12">- Trạng thái: 'ALL' | 'NORMAL' | 'WARNING' | 'CRITICAL'</text>
      <text x="25" y="172" fill="#0369A1" font-size="12">- Khoảng thời gian: startTime &amp; endTime (UTC)</text>
      <text x="15" y="195" fill="#475569" font-size="12">• Phân trang hiển thị bảng: 20, 50, 100 dòng/trang</text>
    </g>

    <g transform="translate(20, 300)">
      <rect width="440" height="190" rx="8" fill="#FFFFFF" stroke="#BBF7D0" class="shadow" />
      <text x="15" y="28" fill="#166534" font-size="14" font-weight="700">Tùy Chọn Định Dạng Xuất File</text>
      <text x="15" y="52" fill="#374151" font-size="12">• 3 Nút bấm xuất định dạng tiêu chuẩn:</text>
      <text x="25" y="72" fill="#15803D" font-size="13" font-weight="600">1. Xuất Excel (.xlsx):</text>
      <text x="35" y="90" fill="#475569" font-size="12">Đầy đủ Header màu, định dạng số, border chuẩn.</text>
      <text x="25" y="110" fill="#0284C7" font-size="13" font-weight="600">2. Xuất CSV (.csv):</text>
      <text x="35" y="128" fill="#475569" font-size="12">Gọn nhẹ, tương thích phần mềm thống kê, R, Python.</text>
      <text x="25" y="148" fill="#7C3AED" font-size="13" font-weight="600">3. Xuất JSON (.json):</text>
      <text x="35" y="166" fill="#475569" font-size="12">Cấu trúc phân cấp, phục vụ tích hợp hệ thống MES/ERP.</text>
    </g>

    <g transform="translate(20, 510)">
      <rect width="440" height="200" rx="8" fill="#DCFCE7" stroke="#4ADE80" />
      <text x="15" y="28" fill="#14532D" font-size="13" font-weight="700">Khởi Tạo Yêu Cầu Tải Dữ Liệu</text>
      <text x="15" y="52" fill="#166534" font-size="12">• Client gọi API Endpoint xuất báo cáo:</text>
      <text x="25" y="75" fill="#0369A1" font-size="11" class="code-font">POST /api/telemetry/history/export</text>
      <text x="25" y="95" fill="#0369A1" font-size="11" class="code-font">Body: { lineId, machineId, metricId,</text>
      <text x="25" y="112" fill="#0369A1" font-size="11" class="code-font">        status, startTime, endTime, format }</text>
      <text x="15" y="140" fill="#166534" font-size="12">• Khóa nút bấm xuất file, hiện spinner chờ tải</text>
      <text x="15" y="160" fill="#166534" font-size="12">• Ngăn chặn người dùng bấm liên tục gây quá tải</text>
      <text x="15" y="180" fill="#059669" font-size="12" font-weight="600">✓ Cơ chế Debounce an toàn 3000ms</text>
    </g>
  </g>

  <!-- STEP 2: API & VALIDATION -->
  <g transform="translate(580, 180)">
    <rect width="480" height="740" rx="12" fill="#EFF6FF" stroke="#93C5FD" stroke-width="2" />
    <rect width="480" height="50" rx="12" fill="#1D4ED8" />
    <rect x="0" y="36" width="480" height="14" fill="#1D4ED8" />
    <text x="240" y="32" fill="#FFFFFF" font-size="15" font-weight="700" text-anchor="middle">BƯỚC 2: KIỂM TRA SQL WHITELIST &amp; GIỚI HẠN</text>

    <g transform="translate(20, 70)">
      <rect width="440" height="210" rx="8" fill="#FFFFFF" stroke="#BFDBFE" class="shadow" />
      <text x="15" y="28" fill="#1E40AF" font-size="14" font-weight="700">1. Áp Dụng Danh Sách Trắng (Whitelist)</text>
      <text x="15" y="52" fill="#374151" font-size="12">Chống triệt để tấn công SQL Injection (BR-14):</text>
      <text x="25" y="72" fill="#475569" font-size="12">• metricId chỉ chấp nhận các giá trị hợp lệ:</text>
      <text x="35" y="90" fill="#0369A1" font-size="11" class="code-font">['vibration', 'temperature', 'pressure', 'power']</text>
      <text x="25" y="112" fill="#475569" font-size="12">• status chỉ chấp nhận:</text>
      <text x="35" y="130" fill="#0369A1" font-size="11" class="code-font">['normal', 'warning', 'critical']</text>
      <text x="25" y="152" fill="#475569" font-size="12">• format chỉ chấp nhận:</text>
      <text x="35" y="170" fill="#0369A1" font-size="11" class="code-font">['xlsx', 'csv', 'json']</text>
      <text x="15" y="195" fill="#DC2626" font-size="12" font-weight="600">! Từ chối ngay lập tức (400 Bad Request) nếu sai Whitelist</text>
    </g>

    <g transform="translate(20, 300)">
      <rect width="440" height="190" rx="8" fill="#FFFFFF" stroke="#BFDBFE" class="shadow" />
      <text x="15" y="28" fill="#1E40AF" font-size="14" font-weight="700">2. Giới Hạn Cứng 10.000 Dòng (BR-09)</text>
      <text x="15" y="52" fill="#374151" font-size="12">• Mục đích bảo vệ hệ thống:</text>
      <text x="25" y="72" fill="#475569" font-size="12">- Tránh tràn bộ nhớ Node.js Heap Out-of-Memory</text>
      <text x="25" y="90" fill="#475569" font-size="12">- Ngăn ngừa nghẽn băng thông mạng nội bộ</text>
      <text x="25" y="108" fill="#475569" font-size="12">- Giữ thời gian xử lý luôn dưới 2.0 giây</text>
      <text x="15" y="132" fill="#374151" font-size="12">• Cơ chế thực thi:</text>
      <text x="25" y="152" fill="#0369A1" font-size="11" class="code-font">const limit = Math.min(parseInt(req.query.limit)</text>
      <text x="25" y="170" fill="#0369A1" font-size="11" class="code-font">              || 10000, 10000);</text>
    </g>

    <g transform="translate(20, 510)">
      <rect width="440" height="200" rx="8" fill="#EFF6FF" stroke="#93C5FD" />
      <text x="15" y="28" fill="#1E40AF" font-size="13" font-weight="700">3. Xây Dựng Câu Lệnh Truy Vấn SQL An Toàn</text>
      <text x="15" y="52" fill="#374151" font-size="12">• Sử dụng hoàn toàn Parameterized Query (?):</text>
      <text x="20" y="75" fill="#1E40AF" font-size="11" class="code-font">let query = 'SELECT * FROM machine_telemetry_history</text>
      <text x="20" y="92" fill="#1E40AF" font-size="11" class="code-font">             WHERE 1=1';</text>
      <text x="20" y="110" fill="#1E40AF" font-size="11" class="code-font">if (machineId) { query += ' AND machineId = ?'; }</text>
      <text x="20" y="128" fill="#1E40AF" font-size="11" class="code-font">if (metricId)  { query += ' AND metricId = ?'; }</text>
      <text x="20" y="146" fill="#1E40AF" font-size="11" class="code-font">query += ' ORDER BY timestamp DESC LIMIT ?';</text>
      <text x="15" y="175" fill="#059669" font-size="12" font-weight="600">✓ Truy vấn tối ưu, an toàn tuyệt đối</text>
    </g>
  </g>

  <!-- STEP 3: DATABASE QUERY -->
  <g transform="translate(1100, 180)">
    <rect width="480" height="740" rx="12" fill="#FFFBEB" stroke="#FDE68A" stroke-width="2" />
    <rect width="480" height="50" rx="12" fill="#D97706" />
    <rect x="0" y="36" width="480" height="14" fill="#D97706" />
    <text x="240" y="32" fill="#FFFFFF" font-size="15" font-weight="700" text-anchor="middle">BƯỚC 3: QUÉT DỮ LIỆU CSDL MYSQL</text>

    <g transform="translate(20, 70)">
      <rect width="440" height="210" rx="8" fill="#FFFFFF" stroke="#FCD34D" class="shadow" />
      <text x="15" y="28" fill="#92400E" font-size="14" font-weight="700">Thực Thi Qua Connection Pool</text>
      <text x="15" y="52" fill="#374151" font-size="12">• Gửi truy vấn xuống MySQL 8.0:</text>
      <text x="25" y="72" fill="#0369A1" font-size="11" class="code-font">const [rows] = await pool.query(query, params);</text>
      <text x="15" y="95" fill="#374151" font-size="12">• Tối ưu hóa bằng B-Tree Indexes:</text>
      <text x="25" y="115" fill="#475569" font-size="12">- idx_mth_machine_time: (machineId, timestamp)</text>
      <text x="25" y="135" fill="#475569" font-size="12">- idx_mth_line_mach_time: (lineId, machineId, time)</text>
      <text x="15" y="160" fill="#059669" font-size="12" font-weight="600">✓ Không thực hiện Table Scan toàn bảng</text>
      <text x="15" y="180" fill="#059669" font-size="12" font-weight="600">✓ Tốc độ phản hồi &lt; 250ms cho 10.000 dòng</text>
    </g>

    <g transform="translate(20, 300)">
      <rect width="440" height="190" rx="8" fill="#FFFFFF" stroke="#FCD34D" class="shadow" />
      <text x="15" y="28" fill="#92400E" font-size="14" font-weight="700">Lợi Thế Của Cấu Trúc Phi Chuẩn Hóa</text>
      <text x="15" y="52" fill="#374151" font-size="12">• Dữ liệu bảng machine_telemetry_history</text>
      <text x="25" y="70" fill="#475569" font-size="12">đã lưu sẵn các cột: lineName, machineName.</text>
      <text x="15" y="95" fill="#374151" font-size="12">• Không cần JOIN với bảng production_lines hay machines</text>
      <text x="15" y="115" fill="#374151" font-size="12">• Tiết kiệm tài nguyên CPU và bộ nhớ đệm Buffer Pool</text>
      <text x="15" y="135" fill="#374151" font-size="12">• Bản ghi lấy ra sẵn sàng chuyển sang bộ tạo file</text>
      <text x="15" y="165" fill="#059669" font-size="12" font-weight="600">✓ Giảm 75% tải truy vấn so với thiết kế chuẩn 3NF</text>
    </g>

    <g transform="translate(20, 510)">
      <rect width="440" height="200" rx="8" fill="#FEF3C7" stroke="#FCD34D" />
      <text x="15" y="28" fill="#92400E" font-size="13" font-weight="700">Xử Lý Múi Giờ Quốc Tế (UTC vs Local)</text>
      <text x="15" y="52" fill="#78350F" font-size="12">• Mốc thời gian lưu trong CSDL là chuẩn UTC (Z)</text>
      <text x="15" y="72" fill="#78350F" font-size="12">• Khi xuất ra Excel / CSV:</text>
      <text x="25" y="92" fill="#78350F" font-size="12">- Giữ nguyên cột timestamp chuẩn UTC ISO-8601</text>
      <text x="25" y="110" fill="#78350F" font-size="12">- Bổ sung cột định dạng giờ địa phương nhà máy</text>
      <text x="25" y="128" fill="#78350F" font-size="12">  (Asia/Ho_Chi_Minh - GMT+7 hoặc Japan - GMT+9)</text>
      <text x="15" y="155" fill="#059669" font-size="12" font-weight="600">✓ Thuận tiện cho chuyên gia kiểm toán và kỹ sư vận hành</text>
      <text x="15" y="175" fill="#059669" font-size="12" font-weight="600">✓ Không bị lệch giờ khi phân tích sự cố xuyên quốc gia</text>
    </g>
  </g>

  <!-- STEP 4: EXPORT ENGINE & STREAM DOWNLOAD -->
  <g transform="translate(1620, 180)">
    <rect width="520" height="740" rx="12" fill="#FAF5FF" stroke="#D8B4FE" stroke-width="2" />
    <rect width="520" height="50" rx="12" fill="#7E22CE" />
    <rect x="0" y="36" width="520" height="14" fill="#7E22CE" />
    <text x="260" y="32" fill="#FFFFFF" font-size="15" font-weight="700" text-anchor="middle">BƯỚC 4: ĐỘNG CƠ XUẤT FILE &amp; STREAMING</text>

    <g transform="translate(20, 70)">
      <rect width="480" height="210" rx="8" fill="#FFFFFF" stroke="#E9D5FF" class="shadow" />
      <text x="15" y="28" fill="#6B21A8" font-size="14" font-weight="700">1. Động Cơ Định Dạng Đa Năng</text>
      <text x="15" y="52" fill="#374151" font-size="12">• Xử lý theo từng định dạng yêu cầu:</text>
      <text x="25" y="72" fill="#15803D" font-size="12">✓ Excel (.xlsx): Thư viện ExcelJS tạo Workbook,</text>
      <text x="35" y="90" fill="#475569" font-size="12">tạo Worksheet 'Telemetry History', định dạng Header xanh Navy,</text>
      <text x="35" y="108" fill="#475569" font-size="12">chữ trắng đậm, kẻ border mỏng, căn lề số thập phân.</text>
      <text x="25" y="130" fill="#0284C7" font-size="12">✓ CSV (.csv): Thư viện fast-csv stream từng dòng,</text>
      <text x="35" y="148" fill="#475569" font-size="12">mã hóa UTF-8 với BOM để mở trực tiếp trong Excel tiếng Việt.</text>
      <text x="25" y="170" fill="#7C3AED" font-size="12">✓ JSON (.json): JSON Array chuẩn hóa khóa băm.</text>
    </g>

    <g transform="translate(20, 300)">
      <rect width="480" height="190" rx="8" fill="#FFFFFF" stroke="#E9D5FF" class="shadow" />
      <text x="15" y="28" fill="#6B21A8" font-size="14" font-weight="700">2. Truyền Phát Tệp Tin (Stream Download)</text>
      <text x="15" y="52" fill="#374151" font-size="12">• Thiết lập HTTP Headers tải tệp:</text>
      <text x="25" y="72" fill="#0369A1" font-size="11" class="code-font">Content-Disposition: attachment; filename="..."</text>
      <text x="25" y="90" fill="#0369A1" font-size="11" class="code-font">Content-Type: application/vnd.openxmlformats...</text>
      <text x="15" y="115" fill="#374151" font-size="12">• Cơ chế Stream trực tiếp xuống Response Stream:</text>
      <text x="25" y="135" fill="#059669" font-size="12">Không tạo file rác tạm thời trên đĩa cứng của server,</text>
      <text x="25" y="152" fill="#059669" font-size="12">tiết kiệm dung lượng và bảo mật dữ liệu sản xuất.</text>
      <text x="15" y="175" fill="#475569" font-size="12">• Trình duyệt tự động mở hộp thoại lưu file về máy trạm.</text>
    </g>

    <g transform="translate(20, 510)">
      <rect width="480" height="200" rx="8" fill="#FAF5FF" stroke="#C084FC" />
      <text x="15" y="28" fill="#581C87" font-size="13" font-weight="700">3. Ghi Nhật Ký Kiểm Toán (Audit Log)</text>
      <text x="15" y="52" fill="#374151" font-size="12">Ghi nhận hành vi xuất dữ liệu nhạy cảm:</text>
      <text x="20" y="75" fill="#581C87" font-size="11" class="code-font">• action: 'EXPORT_LOGS'</text>
      <text x="20" y="92" fill="#581C87" font-size="11" class="code-font">• target: format (xlsx/csv/json)</text>
      <text x="20" y="110" fill="#581C87" font-size="11" class="code-font">• details: 'Xuất 8,450 dòng telemetry Line 1'</text>
      <text x="20" y="128" fill="#581C87" font-size="11" class="code-font">• user: email, employeeId, ipAddress</text>
      <text x="15" y="155" fill="#059669" font-size="12" font-weight="600">✓ Tuân thủ tiêu chuẩn an toàn thông tin ISO 27001</text>
      <text x="15" y="175" fill="#059669" font-size="12" font-weight="600">✓ Dễ dàng điều tra nếu phát hiện rò rỉ bí mật nhà máy</text>
    </g>
  </g>

  <!-- Connective Arrows -->
  <line x1="540" y1="280" x2="580" y2="280" stroke="#059669" stroke-width="4" marker-end="url(#arrGreen5)" />
  <line x1="1060" y1="280" x2="1100" y2="280" stroke="#D97706" stroke-width="4" marker-end="url(#arrGreen5)" />
  <line x1="1580" y1="280" x2="1620" y2="280" stroke="#7E22CE" stroke-width="4" marker-end="url(#arrGreen5)" />

  <!-- Flow Summary Table -->
  <g transform="translate(60, 950)">
    <rect width="${width - 120}" height="340" rx="14" fill="#F1F5F9" stroke="#CBD5E1" stroke-width="1.5" />
    <text x="30" y="35" fill="#0F172A" font-size="16" font-weight="700">TỔNG HỢP LUỒNG TRUY VẤN VÀ XUẤT BÁO CÁO (EXPORT PIPELINE SUMMARY)</text>

    <g transform="translate(30, 60)">
      <rect width="480" height="255" rx="8" fill="#FFFFFF" stroke="#E2E8F0" />
      <text x="20" y="30" fill="#15803D" font-size="14" font-weight="700">1. Tác Nhân &amp; Tham Số Vào</text>
      <text x="20" y="60" fill="#475569" font-size="12">• Actor: Người dùng có quyền ADMIN hoặc KỸ THUẬT.</text>
      <text x="20" y="85" fill="#475569" font-size="12">• Đầu vào: Khoảng thời gian, mã Line, mã Máy, thông số.</text>
      <text x="20" y="110" fill="#475569" font-size="12">• Định dạng mong muốn: Excel (.xlsx), CSV (.csv), JSON (.json).</text>
      <text x="20" y="135" fill="#475569" font-size="12">• Giao thức: HTTP POST có gắn Header xác thực.</text>
      <text x="20" y="160" fill="#475569" font-size="12">• Bảo vệ Client: Nút bấm có trạng thái loading chống click đúp.</text>
      <text x="20" y="190" fill="#15803D" font-size="12" font-weight="600">✓ Trải nghiệm mượt mà, phản hồi trực quan trên giao diện.</text>
    </g>

    <g transform="translate(540, 60)">
      <rect width="480" height="255" rx="8" fill="#FFFFFF" stroke="#E2E8F0" />
      <text x="20" y="30" fill="#1D4ED8" font-size="14" font-weight="700">2. Kiểm Soát An Ninh API</text>
      <text x="20" y="60" fill="#475569" font-size="12">• Bộ lọc Whitelist kiểm tra giá trị tham số hợp lệ.</text>
      <text x="20" y="85" fill="#475569" font-size="12">• Ngăn chặn 100% các lỗ hổng SQL Injection phổ biến.</text>
      <text x="20" y="110" fill="#475569" font-size="12">• Giới hạn cứng tối đa 10.000 bản ghi mỗi lượt tải.</text>
      <text x="20" y="135" fill="#475569" font-size="12">• Không cho phép truy vấn không giới hạn làm cạn kiệt RAM.</text>
      <text x="20" y="160" fill="#475569" font-size="12">• Phân quyền chặt chẽ theo vai trò (RBAC).</text>
      <text x="20" y="190" fill="#1D4ED8" font-size="12" font-weight="600">✓ Bảo vệ máy chủ an toàn trong mọi điều kiện tải cao.</text>
    </g>

    <g transform="translate(1050, 60)">
      <rect width="480" height="255" rx="8" fill="#FFFFFF" stroke="#E2E8F0" />
      <text x="20" y="30" fill="#D97706" font-size="14" font-weight="700">3. Hiệu Năng Truy Vấn CSDL</text>
      <text x="20" y="60" fill="#475569" font-size="12">• Khai thác sức mạnh của B-Tree Composite Index.</text>
      <text x="20" y="85" fill="#475569" font-size="12">• Không thực hiện phép JOIN phức tạp nhờ lưu trữ phi chuẩn.</text>
      <text x="20" y="110" fill="#475569" font-size="12">• Tốc độ quét 10.000 bản ghi hoàn tất trong chưa đầy 300ms.</text>
      <text x="20" y="135" fill="#475569" font-size="12">• Trả về mảng dữ liệu có mốc thời gian UTC và Local chuẩn xác.</text>
      <text x="20" y="160" fill="#475569" font-size="12">• Không gây block các luồng ghi telemetry thời gian thực.</text>
      <text x="20" y="190" fill="#D97706" font-size="12" font-weight="600">✓ Đảm bảo tính sẵn sàng cao cho cơ sở dữ liệu.</text>
    </g>

    <g transform="translate(1560, 60)">
      <rect width="480" height="255" rx="8" fill="#FFFFFF" stroke="#E2E8F0" />
      <text x="20" y="30" fill="#7E22CE" font-size="14" font-weight="700">4. Đầu Ra &amp; Tệp Tin Báo Cáo</text>
      <text x="20" y="60" fill="#475569" font-size="12">• Tệp tin Excel/CSV/JSON tải trực tiếp về thư mục Downloads.</text>
      <text x="20" y="85" fill="#475569" font-size="12">• Bảng tính Excel có tiêu đề rõ ràng, số liệu dễ đọc.</text>
      <text x="20" y="110" fill="#475569" font-size="12">• Tự động ghi nhật ký thao tác xuất file vào audit_logs.</text>
      <text x="20" y="135" fill="#475569" font-size="12">• Kỹ sư sẵn sàng đưa số liệu vào phân tích OEE, SPC, CPK.</text>
      <text x="20" y="160" fill="#475569" font-size="12">• Báo cáo đáp ứng đầy đủ yêu cầu của ban lãnh đạo DENSO.</text>
      <text x="20" y="190" fill="#7E22CE" font-size="12" font-weight="600">✓ Hoàn tất chu trình phân tích và khai thác dữ liệu IoT.</text>
    </g>
  </g>
</svg>`;

  fs.writeFileSync(svgPath, svg, 'utf8');
  console.log(`[OK] Created ${path.basename(svgPath)}`);
  renderSvgToPng(svgPath, pngPath, width, height);
}

// Master Execution
console.log('=== BẮT ĐẦU TẠO 5 SƠ ĐỒ OVERVIEW CHO DENSO KAILINK ===');
generateArchitectureDiagram();
generateTelemetryFlowDiagram();
generateAuthFlowDiagram();
generateAlarmWorkflowDiagram();
generateExportFlowDiagram();
console.log('=== HOÀN TẤT TẠO 5 SƠ ĐỒ OVERVIEW THÀNH CÔNG ===');
