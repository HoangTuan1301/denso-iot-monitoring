/**
 * @file docs/ba/diagrams/chapter7/generate_diagrams.js
 * @description Generator for Chapter 7 diagrams (ERD, DFD Level 0, DFD Level 1)
 * Exports SVG, high-resolution PNG (300 DPI equivalent), and Mermaid source files (.mmd)
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawnSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const outDir = __dirname;

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

// Helper function to render SVG to high-res PNG using Chrome Headless
function convertSvgToPng(svgPath, pngPath, width, height) {
  if (process.env.SKIP_PNG === '1') {
    console.log(`[SKIP_PNG] Bỏ qua xuất PNG cho ${path.basename(pngPath)} theo cờ SKIP_PNG=1`);
    return;
  }
  console.log(`[PNG Render] Rendering ${path.basename(pngPath)} (${width}x${height})...`);
  
  // Create a temporary HTML wrapper that scales SVG perfectly without any clipping
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
  const tempProfile = path.join(process.env.TEMP || 'C:\\temp', `chrome_render_${Date.now()}`);

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

  const res = spawnSync(CHROME_PATH, args, { stdio: 'ignore', timeout: 45000 });

  // Cleanup temp files
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
    console.error(`[ERR] Failed to render ${pngPath}. Stderr:`, res.stderr?.toString());
  }
}

// =============================================================================
// 1. SƠ ĐỒ 7.1: ERD (ENTITY RELATIONSHIP DIAGRAM)
// =============================================================================
function generateERD() {
  console.log('[1/3] Generating 7.1 ERD...');
  
  const width = 2400;
  const height = 1750;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">
  <defs>
    <style>
      @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&amp;family=JetBrains+Mono:wght@400;500;600&amp;display=swap');
      text { font-family: 'Inter', 'Segoe UI', Arial, sans-serif; }
      .code-font { font-family: 'JetBrains Mono', Consolas, monospace; }
      .shadow { filter: drop-shadow(0px 8px 16px rgba(15, 23, 42, 0.08)); }
      .header-grad-navy { fill: url(#navyGrad); }
      .header-grad-blue { fill: url(#blueGrad); }
      .header-grad-dark { fill: url(#darkGrad); }
    </style>
    
    <linearGradient id="navyGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#002B5B" />
      <stop offset="100%" stop-color="#004080" />
    </linearGradient>

    <linearGradient id="blueGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0F4C81" />
      <stop offset="100%" stop-color="#1B6CA8" />
    </linearGradient>

    <linearGradient id="darkGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#1E293B" />
      <stop offset="100%" stop-color="#334155" />
    </linearGradient>

    <!-- Marker Arrow & Crow's foot -->
    <marker id="arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
      <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#0284C7" />
    </marker>
    <marker id="dot" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6">
      <circle cx="5" cy="5" r="3.5" fill="#0284C7" />
    </marker>
  </defs>

  <!-- Background -->
  <rect width="100%" height="100%" fill="#F8FAFC" />
  <rect x="40" y="40" width="${width - 80}" height="${height - 80}" rx="24" fill="#FFFFFF" stroke="#E2E8F0" stroke-width="2" class="shadow" />

  <!-- Diagram Title Header Banner -->
  <g transform="translate(80, 80)">
    <rect width="${width - 160}" height="90" rx="12" fill="#003366" />
    <rect x="0" y="0" width="8" height="90" rx="4" fill="#E60012" />
    <text x="35" y="42" fill="#FFFFFF" font-size="28" font-weight="700" letter-spacing="0.5">SƠ ĐỒ MỐI QUAN HỆ THỰC THỂ (ENTITY RELATIONSHIP DIAGRAM - ERD)</text>
    <text x="35" y="70" fill="#93C5FD" font-size="16" font-weight="500">DỰ ÁN: DENSO INDUSTRIAL IoT MONITORING SYSTEM (KaiLink) | PHÂN TÍCH SCHEMA CƠ SỞ DỮ LIỆU MYSQL 8.0</text>
    <text x="${width - 200}" y="52" fill="#E2E8F0" font-size="14" font-weight="600" text-anchor="end">CHUẨN ĐẶC TẢ BA V2.1</text>
  </g>

  <!-- ==================== ENTITY TABLES ==================== -->

  <!-- TABLE 1: production_lines -->
  <g transform="translate(80, 220)" class="shadow">
    <rect width="480" height="380" rx="10" fill="#FFFFFF" stroke="#CBD5E1" stroke-width="2" />
    <path d="M 0 10 Q 0 0 10 0 L 470 0 Q 480 0 480 10 L 480 50 L 0 50 Z" class="header-grad-navy" />
    <text x="20" y="32" fill="#FFFFFF" font-size="18" font-weight="700">production_lines</text>
    <text x="460" y="32" fill="#93C5FD" font-size="13" font-weight="500" text-anchor="end">Dây Chuyền Sản Xuất</text>
    
    <!-- Columns -->
    <g transform="translate(20, 75)" font-size="14">
      <!-- Row 1 -->
      <rect x="-8" y="-16" width="456" height="28" fill="#F1F5F9" rx="4"/>
      <text x="0" y="3" fill="#D97706" font-weight="700" class="code-font">[PK]</text>
      <text x="45" y="3" fill="#0F172A" font-weight="600" class="code-font">id</text>
      <text x="240" y="3" fill="#475569" class="code-font">VARCHAR(64)</text>
      <text x="440" y="3" fill="#64748B" font-size="12" text-anchor="end">Mã dây chuyền</text>
      
      <!-- Row 2 -->
      <text x="45" y="35" fill="#0F172A" font-weight="500" class="code-font">name</text>
      <text x="240" y="35" fill="#475569" class="code-font">VARCHAR(128)</text>
      <text x="440" y="35" fill="#64748B" font-size="12" text-anchor="end">Tên dây chuyền</text>

      <!-- Row 3 -->
      <rect x="-8" y="48" width="456" height="28" fill="#F8FAFC" rx="4"/>
      <text x="45" y="67" fill="#0F172A" font-weight="500" class="code-font">code</text>
      <text x="240" y="67" fill="#475569" class="code-font">VARCHAR(64)</text>
      <text x="440" y="67" fill="#64748B" font-size="12" text-anchor="end">Mã ký hiệu xưởng</text>

      <!-- Row 4 -->
      <text x="45" y="99" fill="#0F172A" font-weight="500" class="code-font">status</text>
      <text x="240" y="99" fill="#475569" class="code-font">VARCHAR(32)</text>
      <text x="440" y="99" fill="#64748B" font-size="12" text-anchor="end">Trạng thái (normal...)</text>

      <!-- Row 5 -->
      <rect x="-8" y="112" width="456" height="28" fill="#F8FAFC" rx="4"/>
      <text x="45" y="131" fill="#0F172A" font-weight="500" class="code-font">safetyScore</text>
      <text x="240" y="131" fill="#475569" class="code-font">INT</text>
      <text x="440" y="131" fill="#64748B" font-size="12" text-anchor="end">Điểm an toàn (BR-03)</text>

      <!-- Row 6 -->
      <text x="45" y="163" fill="#0F172A" font-weight="500" class="code-font">targetOutput</text>
      <text x="240" y="163" fill="#475569" class="code-font">INT</text>
      <text x="440" y="163" fill="#64748B" font-size="12" text-anchor="end">Sản lượng mục tiêu</text>

      <!-- Row 7 -->
      <rect x="-8" y="176" width="456" height="28" fill="#F8FAFC" rx="4"/>
      <text x="45" y="195" fill="#0F172A" font-weight="500" class="code-font">actualOutput</text>
      <text x="240" y="195" fill="#475569" class="code-font">INT</text>
      <text x="440" y="195" fill="#64748B" font-size="12" text-anchor="end">Sản lượng thực tế</text>

      <!-- Row 8 -->
      <text x="45" y="227" fill="#0F172A" font-weight="500" class="code-font">createdAt</text>
      <text x="240" y="227" fill="#475569" class="code-font">DATETIME</text>
      <text x="440" y="227" fill="#64748B" font-size="12" text-anchor="end">Thời điểm tạo</text>
    </g>
  </g>

  <!-- TABLE 2: machines -->
  <g transform="translate(680, 220)" class="shadow">
    <rect width="500" height="430" rx="10" fill="#FFFFFF" stroke="#CBD5E1" stroke-width="2" />
    <path d="M 0 10 Q 0 0 10 0 L 490 0 Q 500 0 500 10 L 500 50 L 0 50 Z" class="header-grad-navy" />
    <text x="20" y="32" fill="#FFFFFF" font-size="18" font-weight="700">machines</text>
    <text x="480" y="32" fill="#93C5FD" font-size="13" font-weight="500" text-anchor="end">Máy Móc / Thiết Bị Tầng 2</text>
    
    <!-- Columns -->
    <g transform="translate(20, 75)" font-size="14">
      <rect x="-8" y="-16" width="476" height="28" fill="#F1F5F9" rx="4"/>
      <text x="0" y="3" fill="#D97706" font-weight="700" class="code-font">[PK]</text>
      <text x="45" y="3" fill="#0F172A" font-weight="600" class="code-font">id</text>
      <text x="220" y="3" fill="#475569" class="code-font">VARCHAR(64)</text>
      <text x="460" y="3" fill="#64748B" font-size="12" text-anchor="end">Mã định danh máy</text>

      <rect x="-8" y="16" width="476" height="28" fill="#E0F2FE" rx="4"/>
      <text x="0" y="35" fill="#0284C7" font-weight="700" class="code-font">[FK-L]</text>
      <text x="45" y="35" fill="#0369A1" font-weight="600" class="code-font">lineId</text>
      <text x="220" y="35" fill="#475569" class="code-font">VARCHAR(64)</text>
      <text x="460" y="35" fill="#0284C7" font-size="12" font-weight="600" text-anchor="end">-> production_lines.id</text>

      <text x="45" y="67" fill="#0F172A" font-weight="500" class="code-font">name</text>
      <text x="220" y="67" fill="#475569" class="code-font">VARCHAR(128)</text>
      <text x="460" y="67" fill="#64748B" font-size="12" text-anchor="end">Tên máy (Komatsu...)</text>

      <rect x="-8" y="80" width="476" height="28" fill="#F8FAFC" rx="4"/>
      <text x="45" y="99" fill="#0F172A" font-weight="500" class="code-font">code</text>
      <text x="220" y="99" fill="#475569" class="code-font">VARCHAR(64)</text>
      <text x="460" y="99" fill="#64748B" font-size="12" text-anchor="end">Mã máy xưởng (STP-01)</text>

      <text x="45" y="131" fill="#0F172A" font-weight="500" class="code-font">type</text>
      <text x="220" y="131" fill="#475569" class="code-font">VARCHAR(64)</text>
      <text x="460" y="131" fill="#64748B" font-size="12" text-anchor="end">Loại máy (dập, hàn...)</text>

      <rect x="-8" y="144" width="476" height="28" fill="#F8FAFC" rx="4"/>
      <text x="45" y="163" fill="#0F172A" font-weight="500" class="code-font">status</text>
      <text x="220" y="163" fill="#475569" class="code-font">VARCHAR(32)</text>
      <text x="460" y="163" fill="#64748B" font-size="12" text-anchor="end">Trạng thái (BR-02)</text>

      <text x="45" y="195" fill="#0F172A" font-weight="500" class="code-font">healthScore</text>
      <text x="220" y="195" fill="#475569" class="code-font">INT</text>
      <text x="460" y="195" fill="#64748B" font-size="12" text-anchor="end">Chỉ số sức khỏe (%)</text>

      <rect x="-8" y="208" width="476" height="28" fill="#F8FAFC" rx="4"/>
      <text x="45" y="227" fill="#0F172A" font-weight="500" class="code-font">uptimeHours</text>
      <text x="220" y="227" fill="#475569" class="code-font">INT</text>
      <text x="460" y="227" fill="#64748B" font-size="12" text-anchor="end">Số giờ chạy lũy kế</text>

      <text x="45" y="259" fill="#0F172A" font-weight="500" class="code-font">qrCodeUrl</text>
      <text x="220" y="259" fill="#475569" class="code-font">VARCHAR(255)</text>
      <text x="460" y="259" fill="#64748B" font-size="12" text-anchor="end">Đường dẫn mã QR</text>

      <rect x="-8" y="272" width="476" height="28" fill="#F8FAFC" rx="4"/>
      <text x="45" y="291" fill="#0F172A" font-weight="500" class="code-font">createdAt</text>
      <text x="220" y="291" fill="#475569" class="code-font">DATETIME</text>
      <text x="460" y="291" fill="#64748B" font-size="12" text-anchor="end">Thời điểm tạo</text>
    </g>
  </g>

  <!-- TABLE 3: plc_stations -->
  <g transform="translate(1300, 220)" class="shadow">
    <rect width="500" height="430" rx="10" fill="#FFFFFF" stroke="#CBD5E1" stroke-width="2" />
    <path d="M 0 10 Q 0 0 10 0 L 490 0 Q 500 0 500 10 L 500 50 L 0 50 Z" class="header-grad-navy" />
    <text x="20" y="32" fill="#FFFFFF" font-size="18" font-weight="700">plc_stations</text>
    <text x="480" y="32" fill="#93C5FD" font-size="13" font-weight="500" text-anchor="end">Trạm PLC Thu Thập Tín Hiệu</text>
    
    <!-- Columns -->
    <g transform="translate(20, 75)" font-size="14">
      <rect x="-8" y="-16" width="476" height="28" fill="#F1F5F9" rx="4"/>
      <text x="0" y="3" fill="#D97706" font-weight="700" class="code-font">[PK]</text>
      <text x="45" y="3" fill="#0F172A" font-weight="600" class="code-font">id</text>
      <text x="210" y="3" fill="#475569" class="code-font">VARCHAR(64)</text>
      <text x="460" y="3" fill="#64748B" font-size="12" text-anchor="end">Mã trạm (PLC-01...)</text>

      <text x="45" y="35" fill="#0F172A" font-weight="500" class="code-font">name</text>
      <text x="210" y="35" fill="#475569" class="code-font">VARCHAR(128)</text>
      <text x="460" y="35" fill="#64748B" font-size="12" text-anchor="end">Tên trạm điều khiển</text>

      <rect x="-8" y="48" width="476" height="28" fill="#F8FAFC" rx="4"/>
      <text x="45" y="67" fill="#0F172A" font-weight="500" class="code-font">protocol</text>
      <text x="210" y="67" fill="#475569" class="code-font">VARCHAR(32)</text>
      <text x="460" y="67" fill="#64748B" font-size="12" text-anchor="end">Modbus/TCP, OPC-UA</text>

      <text x="45" y="99" fill="#0F172A" font-weight="500" class="code-font">ipAddress</text>
      <text x="210" y="99" fill="#475569" class="code-font">VARCHAR(64)</text>
      <text x="460" y="99" fill="#64748B" font-size="12" text-anchor="end">Địa chỉ IP mạng</text>

      <rect x="-8" y="112" width="476" height="28" fill="#F8FAFC" rx="4"/>
      <text x="45" y="131" fill="#0F172A" font-weight="500" class="code-font">port</text>
      <text x="210" y="131" fill="#475569" class="code-font">INT</text>
      <text x="460" y="131" fill="#64748B" font-size="12" text-anchor="end">Cổng dịch vụ (502...)</text>

      <text x="45" y="163" fill="#0F172A" font-weight="500" class="code-font">isConnected</text>
      <text x="210" y="163" fill="#475569" class="code-font">BOOLEAN</text>
      <text x="460" y="163" fill="#64748B" font-size="12" text-anchor="end">Trạng thái kết nối</text>

      <rect x="-8" y="176" width="476" height="28" fill="#F8FAFC" rx="4"/>
      <text x="45" y="195" fill="#0F172A" font-weight="500" class="code-font">latencyMs</text>
      <text x="210" y="195" fill="#475569" class="code-font">INT</text>
      <text x="460" y="195" fill="#64748B" font-size="12" text-anchor="end">Độ trễ phản hồi (ms)</text>

      <text x="45" y="227" fill="#0F172A" font-weight="500" class="code-font">tagsCount</text>
      <text x="210" y="227" fill="#475569" class="code-font">INT</text>
      <text x="460" y="227" fill="#64748B" font-size="12" text-anchor="end">Số thanh ghi quét</text>

      <rect x="-8" y="240" width="476" height="28" fill="#F8FAFC" rx="4"/>
      <text x="45" y="259" fill="#0F172A" font-weight="500" class="code-font">lastSync</text>
      <text x="210" y="259" fill="#475569" class="code-font">VARCHAR(64)</text>
      <text x="460" y="259" fill="#64748B" font-size="12" text-anchor="end">Đồng bộ gần nhất</text>

      <text x="45" y="291" fill="#0F172A" font-weight="500" class="code-font">pollingRateMs</text>
      <text x="210" y="291" fill="#475569" class="code-font">INT</text>
      <text x="460" y="291" fill="#64748B" font-size="12" text-anchor="end">Chu kỳ quét (1000ms)</text>
    </g>
  </g>

  <!-- TABLE 4: machine_telemetry_history (CENTRAL FACT TABLE) -->
  <g transform="translate(480, 720)" class="shadow">
    <rect width="900" height="490" rx="10" fill="#FFFFFF" stroke="#0284C7" stroke-width="2.5" />
    <path d="M 0 10 Q 0 0 10 0 L 890 0 Q 900 0 900 10 L 900 50 L 0 50 Z" class="header-grad-blue" />
    <text x="20" y="32" fill="#FFFFFF" font-size="18" font-weight="700">machine_telemetry_history</text>
    <text x="880" y="32" fill="#E0F2FE" font-size="13" font-weight="500" text-anchor="end">Bảng Chuỗi Thời Gian Lịch Sử Hoạt Động Máy (Timeseries History)</text>
    
    <!-- Columns 2-column layout inside card -->
    <g transform="translate(20, 75)" font-size="13">
      <!-- Col Left -->
      <g transform="translate(0, 0)">
        <rect x="-8" y="-16" width="420" height="26" fill="#F1F5F9" rx="4"/>
        <text x="0" y="2" fill="#D97706" font-weight="700" class="code-font">[PK]</text>
        <text x="40" y="2" fill="#0F172A" font-weight="600" class="code-font">id</text>
        <text x="180" y="2" fill="#475569" class="code-font">VARCHAR(96)</text>
        <text x="400" y="2" fill="#64748B" font-size="11" text-anchor="end">SHA-256 Hash (BR-06)</text>

        <rect x="-8" y="14" width="420" height="26" fill="#F8FAFC" rx="4"/>
        <text x="0" y="32" fill="#16A34A" font-weight="700" class="code-font">[IDX]</text>
        <text x="40" y="32" fill="#0F172A" font-weight="600" class="code-font">timestamp</text>
        <text x="180" y="32" fill="#475569" class="code-font">DATETIME(3)</text>
        <text x="400" y="32" fill="#64748B" font-size="11" text-anchor="end">Mili-giây, UTC (BR-07)</text>

        <rect x="-8" y="44" width="420" height="26" fill="#E0F2FE" rx="4"/>
        <text x="0" y="62" fill="#0284C7" font-weight="700" class="code-font">[FK-L]</text>
        <text x="40" y="62" fill="#0369A1" font-weight="600" class="code-font">lineId</text>
        <text x="180" y="62" fill="#475569" class="code-font">VARCHAR(64)</text>
        <text x="400" y="62" fill="#0284C7" font-size="11" font-weight="600" text-anchor="end">-> production_lines.id</text>

        <rect x="-8" y="74" width="420" height="26" fill="#F8FAFC" rx="4"/>
        <text x="40" y="92" fill="#0F172A" font-weight="500" class="code-font">lineName</text>
        <text x="180" y="92" fill="#475569" class="code-font">VARCHAR(128)</text>
        <text x="400" y="92" fill="#64748B" font-size="11" text-anchor="end">Tên dây chuyền (Denorm)</text>

        <rect x="-8" y="104" width="420" height="26" fill="#E0F2FE" rx="4"/>
        <text x="0" y="122" fill="#0284C7" font-weight="700" class="code-font">[FK-L]</text>
        <text x="40" y="122" fill="#0369A1" font-weight="600" class="code-font">machineId</text>
        <text x="180" y="122" fill="#475569" class="code-font">VARCHAR(64)</text>
        <text x="400" y="122" fill="#0284C7" font-size="11" font-weight="600" text-anchor="end">-> machines.id</text>

        <rect x="-8" y="134" width="420" height="26" fill="#F8FAFC" rx="4"/>
        <text x="40" y="152" fill="#0F172A" font-weight="500" class="code-font">machineName</text>
        <text x="180" y="152" fill="#475569" class="code-font">VARCHAR(128)</text>
        <text x="400" y="152" fill="#64748B" font-size="11" text-anchor="end">Tên máy (Denorm)</text>

        <rect x="-8" y="164" width="420" height="26" fill="#F8FAFC" rx="4"/>
        <text x="0" y="182" fill="#16A34A" font-weight="700" class="code-font">[IDX]</text>
        <text x="40" y="182" fill="#0F172A" font-weight="600" class="code-font">metricId</text>
        <text x="180" y="182" fill="#475569" class="code-font">VARCHAR(64)</text>
        <text x="400" y="182" fill="#64748B" font-size="11" text-anchor="end">Mã thông số đo</text>
      </g>

      <!-- Col Right -->
      <g transform="translate(450, 0)">
        <rect x="-8" y="-16" width="420" height="26" fill="#F8FAFC" rx="4"/>
        <text x="40" y="2" fill="#0F172A" font-weight="500" class="code-font">metricName</text>
        <text x="180" y="2" fill="#475569" class="code-font">VARCHAR(128)</text>
        <text x="400" y="2" fill="#64748B" font-size="11" text-anchor="end">Tên thông số kỹ thuật</text>

        <rect x="-8" y="14" width="420" height="26" fill="#F8FAFC" rx="4"/>
        <text x="40" y="32" fill="#0F172A" font-weight="500" class="code-font">value</text>
        <text x="180" y="32" fill="#475569" class="code-font">DECIMAL(10,2)</text>
        <text x="400" y="32" fill="#64748B" font-size="11" text-anchor="end">Giá trị số đo kỹ thuật</text>

        <rect x="-8" y="44" width="420" height="26" fill="#F8FAFC" rx="4"/>
        <text x="40" y="62" fill="#0F172A" font-weight="500" class="code-font">unit</text>
        <text x="180" y="62" fill="#475569" class="code-font">VARCHAR(32)</text>
        <text x="400" y="62" fill="#64748B" font-size="11" text-anchor="end">Đơn vị (bar, °C, mm/s)</text>

        <rect x="-8" y="74" width="420" height="26" fill="#F1F5F9" rx="4"/>
        <text x="0" y="92" fill="#16A34A" font-weight="700" class="code-font">[IDX]</text>
        <text x="40" y="92" fill="#0F172A" font-weight="600" class="code-font">status</text>
        <text x="180" y="92" fill="#475569" class="code-font">ENUM(3)</text>
        <text x="400" y="92" fill="#64748B" font-size="11" text-anchor="end">normal, warning, critical</text>

        <rect x="-8" y="104" width="420" height="26" fill="#F8FAFC" rx="4"/>
        <text x="40" y="122" fill="#0F172A" font-weight="500" class="code-font">source</text>
        <text x="180" y="122" fill="#475569" class="code-font">ENUM(2)</text>
        <text x="400" y="122" fill="#64748B" font-size="11" text-anchor="end">'simulation' | 'device'</text>

        <rect x="-8" y="134" width="420" height="26" fill="#E0F2FE" rx="4"/>
        <text x="0" y="152" fill="#0284C7" font-weight="700" class="code-font">[FK-L]</text>
        <text x="40" y="152" fill="#0369A1" font-weight="600" class="code-font">plcStationId</text>
        <text x="180" y="152" fill="#475569" class="code-font">VARCHAR(64)</text>
        <text x="400" y="152" fill="#0284C7" font-size="11" font-weight="600" text-anchor="end">-> plc_stations.id (NULL)</text>

        <rect x="-8" y="164" width="420" height="26" fill="#F8FAFC" rx="4"/>
        <text x="40" y="182" fill="#0F172A" font-weight="500" class="code-font">createdAt</text>
        <text x="180" y="182" fill="#475569" class="code-font">DATETIME</text>
        <text x="400" y="182" fill="#64748B" font-size="11" text-anchor="end">CURRENT_TIMESTAMP</text>
      </g>

      <!-- Index Footnote -->
      <g transform="translate(0, 340)">
        <rect x="-8" y="0" width="870" height="50" rx="6" fill="#F8FAFC" stroke="#E2E8F0" />
        <text x="10" y="20" fill="#475569" font-size="12" font-weight="600">4 Chỉ mục B-Tree tối ưu truy vấn chuỗi thời gian &amp; xuất báo cáo (Index Optimization):</text>
        <text x="10" y="38" fill="#0284C7" font-size="11" class="code-font">idx_line_time (lineId, timestamp DESC) | idx_machine_time (machineId, timestamp DESC) | idx_metric_time | idx_time_status</text>
      </g>
    </g>
  </g>

  <!-- TABLE 5: users -->
  <g transform="translate(80, 1260)" class="shadow">
    <rect width="520" height="420" rx="10" fill="#FFFFFF" stroke="#CBD5E1" stroke-width="2" />
    <path d="M 0 10 Q 0 0 10 0 L 510 0 Q 520 0 520 10 L 520 50 L 0 50 Z" class="header-grad-dark" />
    <text x="20" y="32" fill="#FFFFFF" font-size="18" font-weight="700">users</text>
    <text x="500" y="32" fill="#CBD5E1" font-size="13" font-weight="500" text-anchor="end">Tài Khoản &amp; Phân Quyền (RBAC)</text>
    
    <!-- Columns -->
    <g transform="translate(20, 75)" font-size="14">
      <rect x="-8" y="-16" width="496" height="28" fill="#F1F5F9" rx="4"/>
      <text x="0" y="3" fill="#D97706" font-weight="700" class="code-font">[PK]</text>
      <text x="45" y="3" fill="#0F172A" font-weight="600" class="code-font">id</text>
      <text x="230" y="3" fill="#475569" class="code-font">VARCHAR(64)</text>
      <text x="480" y="3" fill="#64748B" font-size="12" text-anchor="end">usr-admin-01...</text>

      <text x="0" y="35" fill="#16A34A" font-weight="700" class="code-font">[UQ]</text>
      <text x="45" y="35" fill="#0F172A" font-weight="600" class="code-font">employeeId</text>
      <text x="230" y="35" fill="#475569" class="code-font">VARCHAR(32)</text>
      <text x="480" y="35" fill="#64748B" font-size="12" text-anchor="end">Mã thẻ DNS-1001</text>

      <rect x="-8" y="48" width="496" height="28" fill="#F8FAFC" rx="4"/>
      <text x="45" y="67" fill="#0F172A" font-weight="500" class="code-font">fullName</text>
      <text x="230" y="67" fill="#475569" class="code-font">VARCHAR(128)</text>
      <text x="480" y="67" fill="#64748B" font-size="12" text-anchor="end">Họ và tên nhân viên</text>

      <text x="0" y="99" fill="#16A34A" font-weight="700" class="code-font">[UQ]</text>
      <text x="45" y="99" fill="#0F172A" font-weight="600" class="code-font">email</text>
      <text x="230" y="99" fill="#475569" class="code-font">VARCHAR(128)</text>
      <text x="480" y="99" fill="#64748B" font-size="12" text-anchor="end">Email công ty (Login)</text>

      <rect x="-8" y="112" width="496" height="28" fill="#F8FAFC" rx="4"/>
      <text x="45" y="131" fill="#0F172A" font-weight="500" class="code-font">password</text>
      <text x="230" y="131" fill="#475569" class="code-font">VARCHAR(255)</text>
      <text x="480" y="131" fill="#64748B" font-size="12" text-anchor="end">Bcrypt Hash (10 rounds)</text>

      <text x="45" y="163" fill="#0F172A" font-weight="500" class="code-font">role</text>
      <text x="230" y="163" fill="#475569" class="code-font">ENUM(3)</text>
      <text x="480" y="163" fill="#64748B" font-size="12" text-anchor="end">ADMIN, OPERATOR, MAINT</text>

      <rect x="-8" y="176" width="496" height="28" fill="#E0F2FE" rx="4"/>
      <text x="0" y="195" fill="#0284C7" font-weight="700" class="code-font">[FK-L]</text>
      <text x="45" y="195" fill="#0369A1" font-weight="600" class="code-font">assignedLineId</text>
      <text x="230" y="195" fill="#475569" class="code-font">VARCHAR(64)</text>
      <text x="480" y="195" fill="#0284C7" font-size="12" font-weight="600" text-anchor="end">-> production_lines.id ('ALL')</text>

      <text x="45" y="227" fill="#0F172A" font-weight="500" class="code-font">avatarUrl</text>
      <text x="230" y="227" fill="#475569" class="code-font">VARCHAR(255)</text>
      <text x="480" y="227" fill="#64748B" font-size="12" text-anchor="end">Đường dẫn ảnh Multer (BR-13)</text>

      <rect x="-8" y="240" width="496" height="28" fill="#F8FAFC" rx="4"/>
      <text x="45" y="259" fill="#0F172A" font-weight="500" class="code-font">status</text>
      <text x="230" y="259" fill="#475569" class="code-font">ENUM(2)</text>
      <text x="480" y="259" fill="#64748B" font-size="12" text-anchor="end">'ACTIVE' | 'INACTIVE'</text>

      <text x="45" y="291" fill="#0F172A" font-weight="500" class="code-font">lastLoginAt</text>
      <text x="230" y="291" fill="#475569" class="code-font">DATETIME</text>
      <text x="480" y="291" fill="#64748B" font-size="12" text-anchor="end">Đăng nhập gần nhất</text>
    </g>
  </g>

  <!-- TABLE 6: audit_logs -->
  <g transform="translate(1260, 1260)" class="shadow">
    <rect width="540" height="420" rx="10" fill="#FFFFFF" stroke="#CBD5E1" stroke-width="2" />
    <path d="M 0 10 Q 0 0 10 0 L 530 0 Q 540 0 540 10 L 540 50 L 0 50 Z" class="header-grad-dark" />
    <text x="20" y="32" fill="#FFFFFF" font-size="18" font-weight="700">audit_logs</text>
    <text x="520" y="32" fill="#CBD5E1" font-size="13" font-weight="500" text-anchor="end">Nhật Ký Kiểm Toán &amp; Truy Vết An Toàn</text>
    
    <!-- Columns -->
    <g transform="translate(20, 75)" font-size="14">
      <rect x="-8" y="-16" width="516" height="28" fill="#F1F5F9" rx="4"/>
      <text x="0" y="3" fill="#D97706" font-weight="700" class="code-font">[PK]</text>
      <text x="45" y="3" fill="#0F172A" font-weight="600" class="code-font">id</text>
      <text x="220" y="3" fill="#475569" class="code-font">VARCHAR(64)</text>
      <text x="500" y="3" fill="#64748B" font-size="12" text-anchor="end">AUD-1718293041...</text>

      <rect x="-8" y="16" width="516" height="28" fill="#E0F2FE" rx="4"/>
      <text x="0" y="35" fill="#0284C7" font-weight="700" class="code-font">[FK-L]</text>
      <text x="45" y="35" fill="#0369A1" font-weight="600" class="code-font">userId</text>
      <text x="220" y="35" fill="#475569" class="code-font">VARCHAR(64)</text>
      <text x="500" y="35" fill="#0284C7" font-size="12" font-weight="600" text-anchor="end">-> users.id (NULLable)</text>

      <text x="45" y="67" fill="#0F172A" font-weight="500" class="code-font">userEmail</text>
      <text x="220" y="67" fill="#475569" class="code-font">VARCHAR(128)</text>
      <text x="500" y="67" fill="#64748B" font-size="12" text-anchor="end">Email người thực hiện</text>

      <rect x="-8" y="80" width="516" height="28" fill="#F8FAFC" rx="4"/>
      <text x="45" y="99" fill="#0F172A" font-weight="500" class="code-font">userName</text>
      <text x="220" y="99" fill="#475569" class="code-font">VARCHAR(128)</text>
      <text x="500" y="99" fill="#64748B" font-size="12" text-anchor="end">Họ tên người thao tác</text>

      <text x="45" y="131" fill="#0F172A" font-weight="500" class="code-font">employeeId</text>
      <text x="220" y="131" fill="#475569" class="code-font">VARCHAR(32)</text>
      <text x="500" y="131" fill="#64748B" font-size="12" text-anchor="end">Mã thẻ nhân viên</text>

      <rect x="-8" y="144" width="516" height="28" fill="#F1F5F9" rx="4"/>
      <text x="0" y="163" fill="#16A34A" font-weight="700" class="code-font">[IDX]</text>
      <text x="45" y="163" fill="#0F172A" font-weight="600" class="code-font">action</text>
      <text x="220" y="163" fill="#475569" class="code-font">VARCHAR(64)</text>
      <text x="500" y="163" fill="#64748B" font-size="12" text-anchor="end">LOGIN, ACK, RESOLVE, EXPORT</text>

      <text x="45" y="195" fill="#0F172A" font-weight="500" class="code-font">target</text>
      <text x="220" y="195" fill="#475569" class="code-font">VARCHAR(128)</text>
      <text x="500" y="195" fill="#64748B" font-size="12" text-anchor="end">auth, alarm, user, telemetry</text>

      <rect x="-8" y="208" width="516" height="28" fill="#F8FAFC" rx="4"/>
      <text x="45" y="227" fill="#0F172A" font-weight="500" class="code-font">details</text>
      <text x="220" y="227" fill="#475569" class="code-font">TEXT</text>
      <text x="500" y="227" fill="#64748B" font-size="12" text-anchor="end">Nội dung / Payload JSON</text>

      <text x="45" y="259" fill="#0F172A" font-weight="500" class="code-font">ipAddress</text>
      <text x="220" y="259" fill="#475569" class="code-font">VARCHAR(64)</text>
      <text x="500" y="259" fill="#64748B" font-size="12" text-anchor="end">IP Client gửi request</text>

      <rect x="-8" y="272" width="516" height="28" fill="#F1F5F9" rx="4"/>
      <text x="0" y="291" fill="#16A34A" font-weight="700" class="code-font">[IDX]</text>
      <text x="45" y="291" fill="#0F172A" font-weight="600" class="code-font">timestamp</text>
      <text x="220" y="291" fill="#475569" class="code-font">DATETIME</text>
      <text x="500" y="291" fill="#64748B" font-size="12" text-anchor="end">CURRENT_TIMESTAMP</text>
    </g>
  </g>

  <!-- ==================== RELATIONSHIP CONNECTORS ==================== -->
  
  <!-- Rel 1: production_lines (1) -> machines (0..N) -->
  <g>
    <path d="M 560 380 L 680 380" fill="none" stroke="#0284C7" stroke-width="2.5" stroke-dasharray="6,4" marker-end="url(#arrow)" marker-start="url(#dot)" />
    <rect x="585" y="355" width="70" height="22" rx="4" fill="#E0F2FE" stroke="#0284C7" stroke-width="1" />
    <text x="620" y="371" fill="#0369A1" font-size="12" font-weight="700" text-anchor="middle">1 : N (L)</text>
  </g>

  <!-- Rel 2: machines (1) -> machine_telemetry_history (0..N) -->
  <g>
    <path d="M 930 650 L 930 720" fill="none" stroke="#0284C7" stroke-width="2.5" stroke-dasharray="6,4" marker-end="url(#arrow)" marker-start="url(#dot)" />
    <rect x="895" y="670" width="70" height="22" rx="4" fill="#E0F2FE" stroke="#0284C7" stroke-width="1" />
    <text x="930" y="686" fill="#0369A1" font-size="12" font-weight="700" text-anchor="middle">1 : N (L)</text>
  </g>

  <!-- Rel 3: production_lines (1) -> machine_telemetry_history (0..N) -->
  <g>
    <path d="M 320 600 L 320 780 L 480 780" fill="none" stroke="#0284C7" stroke-width="2" stroke-dasharray="6,4" marker-end="url(#arrow)" marker-start="url(#dot)" />
    <rect x="340" y="765" width="70" height="22" rx="4" fill="#E0F2FE" stroke="#0284C7" stroke-width="1" />
    <text x="375" y="781" fill="#0369A1" font-size="12" font-weight="700" text-anchor="middle">1 : N (L)</text>
  </g>

  <!-- Rel 4: plc_stations (0..1) -> machine_telemetry_history (0..N) -->
  <g>
    <path d="M 1550 650 L 1550 780 L 1380 780" fill="none" stroke="#0284C7" stroke-width="2" stroke-dasharray="6,4" marker-end="url(#arrow)" marker-start="url(#dot)" />
    <rect x="1450" y="765" width="80" height="22" rx="4" fill="#E0F2FE" stroke="#0284C7" stroke-width="1" />
    <text x="1490" y="781" fill="#0369A1" font-size="12" font-weight="700" text-anchor="middle">0..1 : N (L)</text>
  </g>

  <!-- Rel 5: users (1) -> audit_logs (0..N) -->
  <g>
    <path d="M 600 1470 L 1260 1470" fill="none" stroke="#0284C7" stroke-width="2.5" stroke-dasharray="6,4" marker-end="url(#arrow)" marker-start="url(#dot)" />
    <rect x="900" y="1455" width="70" height="22" rx="4" fill="#E0F2FE" stroke="#0284C7" stroke-width="1" />
    <text x="935" y="1471" fill="#0369A1" font-size="12" font-weight="700" text-anchor="middle">1 : N (L)</text>
  </g>

  <!-- Rel 6: production_lines (0..1) -> users.assignedLineId (0..N) -->
  <g>
    <path d="M 160 600 L 160 1260" fill="none" stroke="#64748B" stroke-width="1.8" stroke-dasharray="4,4" marker-end="url(#arrow)" marker-start="url(#dot)" />
    <rect x="110" y="900" width="100" height="22" rx="4" fill="#F1F5F9" stroke="#94A3B8" stroke-width="1" />
    <text x="160" y="916" fill="#475569" font-size="12" font-weight="600" text-anchor="middle">0..1 : N (Scope)</text>
  </g>

  <!-- ==================== LEGEND & ARCHITECTURAL NOTE ==================== -->
  <g transform="translate(680, 1260)">
    <rect width="540" height="420" rx="10" fill="#F8FAFC" stroke="#94A3B8" stroke-width="1.5" />
    <rect width="540" height="40" rx="10" fill="#E2E8F0" />
    <text x="20" y="26" fill="#0F172A" font-size="16" font-weight="700">CHÚ GIẢI &amp; ĐẶC TẢ KIẾN TRÚC QUAN HỆ (LEGEND)</text>
    
    <g transform="translate(25, 65)" font-size="13">
      <rect x="0" y="0" width="45" height="20" fill="#D97706" rx="3" />
      <text x="22" y="15" fill="#FFFFFF" font-weight="700" font-size="11" text-anchor="middle">[PK]</text>
      <text x="60" y="15" fill="#334155" font-weight="600">Khóa chính (Primary Key)</text>

      <rect x="0" y="35" width="45" height="20" fill="#0284C7" rx="3" />
      <text x="22" y="50" fill="#FFFFFF" font-weight="700" font-size="11" text-anchor="middle">[FK-L]</text>
      <text x="60" y="50" fill="#334155" font-weight="600">Khóa ngoại Logic (Application-Enforced Foreign Key)</text>

      <rect x="0" y="70" width="45" height="20" fill="#16A34A" rx="3" />
      <text x="22" y="85" fill="#FFFFFF" font-weight="700" font-size="11" text-anchor="middle">[IDX]</text>
      <text x="60" y="85" fill="#334155" font-weight="600">Chỉ mục B-Tree (Tối ưu hóa tìm kiếm &amp; sắp xếp chuỗi thời gian)</text>

      <line x1="0" y1="120" x2="45" y2="120" stroke="#0284C7" stroke-width="2.5" stroke-dasharray="6,4" />
      <text x="60" y="124" fill="#334155" font-weight="600">Đường nét đứt: Quan hệ tham chiếu Logic (Không khai báo FOREIGN KEY cứng)</text>

      <!-- Detailed Explanation Box -->
      <rect x="0" y="145" width="490" height="185" rx="6" fill="#FFFFFF" stroke="#CBD5E1" />
      <text x="15" y="172" fill="#003366" font-weight="700" font-size="13">ĐẶC THÙ THIẾT KẾ SCHEMA TRONG MÃ NGUỒN (server/db-mysql.js):</text>
      <text x="15" y="196" fill="#475569" font-size="12">1. Toàn bộ 6 bảng KHÔNG khai báo ràng buộc khóa ngoại cứng (CONSTRAINT FK) trong câu lệnh DDL</text>
      <text x="15" y="216" fill="#475569" font-size="12">   nhằm loại bỏ hiện tượng khóa bảng (Lock contention) và tăng tốc độ ghi chuỗi thời gian telemetry.</text>
      <text x="15" y="240" fill="#475569" font-size="12">2. Tính toàn vẹn quan hệ (Referential Integrity) được kiểm soát 100% bằng nghiệp vụ Backend Node.js.</text>
      <text x="15" y="264" fill="#475569" font-size="12">3. Bảng machine_telemetry_history lưu trữ phi chuẩn hóa (Denormalization: lineName, machineName)</text>
      <text x="15" y="284" fill="#475569" font-size="12">   giúp truy vấn lịch sử và xuất Excel/CSV nhanh gấp 10 lần mà không cần JOIN nhiều bảng.</text>
      <text x="15" y="308" fill="#D97706" font-size="12" font-weight="600">4. Bảng alarms chưa tồn tại trong MySQL; cảnh báo đang lưu trên RAM Zustand (Technical Debt TD-01).</text>
    </g>
  </g>

</svg>`;

  const svgPath = path.join(outDir, '7.1_ERD.svg');
  const pngPath = path.join(outDir, '7.1_ERD.png');
  const mmdPath = path.join(outDir, '7.1_ERD.mmd');

  fs.writeFileSync(svgPath, svg, 'utf8');
  console.log(`[OK] Created ${path.basename(svgPath)}`);

  // Create Mermaid source file (.mmd)
  const mmdContent = `erDiagram
    %% DENSO Industrial IoT Monitoring System (KaiLink)
    %% Sơ đồ ERD - Cơ sở dữ liệu MySQL 8.0 (Commit 8ac31ea)
    
    production_lines ||--o{ machines : "1:N (Logic: lineId)"
    production_lines ||--o{ machine_telemetry_history : "1:N (Logic: lineId)"
    machines ||--o{ machine_telemetry_history : "1:N (Logic: machineId)"
    plc_stations |o--o{ machine_telemetry_history : "0..1:N (Logic: plcStationId)"
    users ||--o{ audit_logs : "1:N (Logic: userId)"
    production_lines |o--o{ users : "0..1:N (Logic: assignedLineId)"

    production_lines {
        varchar(64) id PK "Mã dây chuyền"
        varchar(128) name "Tên dây chuyền"
        varchar(64) code "Mã ký hiệu xưởng"
        varchar(32) status "normal | warning | critical"
        int safetyScore "Điểm an toàn (BR-03)"
        int targetOutput "Mục tiêu ca"
        int actualOutput "Sản lượng lũy kế"
        datetime createdAt "Thời điểm tạo"
    }

    machines {
        varchar(64) id PK "Mã định danh máy"
        varchar(64) lineId FK "Tham chiếu logic production_lines"
        varchar(128) name "Tên máy công nghiệp"
        varchar(64) code "Mã máy tại xưởng"
        varchar(64) type "hydraulic_press, robot..."
        varchar(32) status "normal | warning | critical"
        int healthScore "Điểm sức khỏe thiết bị"
        int uptimeHours "Số giờ chạy lũy kế"
        varchar(255) qrCodeUrl "URL mã QR dán thân máy"
        datetime createdAt "Thời điểm khởi tạo"
    }

    plc_stations {
        varchar(64) id PK "Mã trạm PLC"
        varchar(128) name "Tên trạm PLC (S7-1500...)"
        varchar(32) protocol "Modbus/TCP, OPC-UA"
        varchar(64) ipAddress "Địa chỉ IP mạng"
        int port "Cổng dịch vụ (502, 4840)"
        boolean isConnected "Trạng thái truyền thông"
        int latencyMs "Độ trễ Ping/Polling (ms)"
        int tagsCount "Số thanh ghi cấu hình"
        varchar(64) lastSync "Đồng bộ gần nhất"
        int pollingRateMs "Chu kỳ quét (1000ms)"
    }

    machine_telemetry_history {
        varchar(96) id PK "SHA-256 Hash xác định (BR-06)"
        datetime(3) timestamp "Mili-giây, UTC (BR-07)"
        varchar(64) lineId FK "Tham chiếu logic production_lines"
        varchar(128) lineName "Tên dây chuyền (Denorm)"
        varchar(64) machineId FK "Tham chiếu logic machines"
        varchar(128) machineName "Tên máy (Denorm)"
        varchar(64) metricId "Mã thông số kỹ thuật"
        varchar(128) metricName "Tên thông số (Áp suất...)"
        decimal(10_2) value "Giá trị số đo kỹ thuật"
        varchar(32) unit "Đơn vị (bar, C, mm/s)"
        enum status "normal | warning | critical"
        enum source "'simulation' | 'device'"
        varchar(64) plcStationId FK "Tham chiếu logic plc_stations"
        datetime createdAt "Thời điểm chèn bản ghi"
    }

    users {
        varchar(64) id PK "usr-admin-01..."
        varchar(32) employeeId UK "Mã thẻ nhân viên DNS"
        varchar(128) fullName "Họ tên nhân viên"
        varchar(128) email UK "Email công ty"
        varchar(255) password "Bcrypt Hash (10 rounds)"
        enum role "ADMIN | OPERATOR | MAINTENANCE"
        varchar(64) assignedLineId FK "Mã dây chuyền hoặc 'ALL'"
        varchar(255) avatarUrl "Ảnh đại diện Multer (BR-13)"
        enum status "'ACTIVE' | 'INACTIVE'"
        datetime createdAt "Ngày tạo tài khoản"
        datetime lastLoginAt "Đăng nhập gần nhất"
    }

    audit_logs {
        varchar(64) id PK "AUD-1718293041..."
        varchar(64) userId FK "Tham chiếu logic users (NULL)"
        varchar(128) userEmail "Email người thực hiện"
        varchar(128) userName "Họ tên người thao tác"
        varchar(32) employeeId "Mã thẻ nhân viên"
        varchar(64) action "LOGIN, ACK, RESOLVE, EXPORT..."
        varchar(128) target "auth, alarm, user, telemetry"
        text details "Nội dung / Payload JSON"
        varchar(64) ipAddress "Địa chỉ IP máy trạm"
        datetime timestamp "Thời điểm ghi nhận"
    }
`;
  fs.writeFileSync(mmdPath, mmdContent, 'utf8');
  console.log(`[OK] Created ${path.basename(mmdPath)}`);

  // Render high-res PNG (2400x1750 = ~300 DPI equivalent)
  convertSvgToPng(svgPath, pngPath, width, height);
}

// =============================================================================
// 2. SƠ ĐỒ 7.3.1: DFD MỨC 0 (CONTEXT DIAGRAM)
// =============================================================================
function generateDFDLevel0() {
  console.log('[2/3] Generating 7.3.1 DFD Level 0 (Context Diagram)...');
  
  const width = 2200;
  const height = 1500;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">
  <defs>
    <style>
      @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&amp;family=JetBrains+Mono:wght@400;500;600&amp;display=swap');
      text { font-family: 'Inter', 'Segoe UI', Arial, sans-serif; }
      .code-font { font-family: 'JetBrains Mono', Consolas, monospace; }
      .shadow { filter: drop-shadow(0px 8px 16px rgba(15, 23, 42, 0.08)); }
      .shadow-center { filter: drop-shadow(0px 12px 28px rgba(0, 51, 102, 0.15)); }
    </style>

    <linearGradient id="centerProcessGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#003366" />
      <stop offset="50%" stop-color="#004080" />
      <stop offset="100%" stop-color="#0F4C81" />
    </linearGradient>

    <linearGradient id="entityOperatorGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#F8FAFC" />
      <stop offset="100%" stop-color="#E2E8F0" />
    </linearGradient>

    <!-- Markers -->
    <marker id="arrow-blue" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
      <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#0284C7" />
    </marker>
    <marker id="arrow-green" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
      <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#16A34A" />
    </marker>
    <marker id="arrow-orange" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
      <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#EA580C" />
    </marker>
  </defs>

  <!-- Background -->
  <rect width="100%" height="100%" fill="#F8FAFC" />
  <rect x="40" y="40" width="${width - 80}" height="${height - 80}" rx="24" fill="#FFFFFF" stroke="#E2E8F0" stroke-width="2" class="shadow" />

  <!-- Diagram Title Header Banner -->
  <g transform="translate(80, 80)">
    <rect width="${width - 160}" height="90" rx="12" fill="#003366" />
    <rect x="0" y="0" width="8" height="90" rx="4" fill="#E60012" />
    <text x="35" y="42" fill="#FFFFFF" font-size="28" font-weight="700">SƠ ĐỒ LUỒNG DỮ LIỆU MỨC 0 (DFD LEVEL 0 - CONTEXT DIAGRAM)</text>
    <text x="35" y="70" fill="#93C5FD" font-size="16" font-weight="500">MÔ HÌNH HÓA RANH GIỚI HỆ THỐNG VÀ LUỒNG THÔNG TIN TƯƠNG TÁC VỚI CÁC TÁC NHÂN NGOÀI (EXTERNAL ENTITIES)</text>
    <text x="${width - 200}" y="52" fill="#E2E8F0" font-size="14" font-weight="600" text-anchor="end">CHUẨN YOURDON &amp; COAD</text>
  </g>

  <!-- ==================== CENTRAL PROCESS 0.0 ==================== -->
  <g transform="translate(820, 560)" class="shadow-center">
    <rect width="560" height="380" rx="40" fill="url(#centerProcessGrad)" stroke="#38BDF8" stroke-width="3" />
    
    <!-- Top badge in process -->
    <rect x="200" y="25" width="160" height="36" rx="18" fill="rgba(255, 255, 255, 0.15)" stroke="rgba(255, 255, 255, 0.3)" />
    <text x="280" y="49" fill="#FFFFFF" font-size="16" font-weight="700" text-anchor="middle" letter-spacing="1">TIẾN TRÌNH 0.0</text>

    <!-- System Name -->
    <text x="280" y="115" fill="#FFFFFF" font-size="28" font-weight="800" text-anchor="middle" letter-spacing="0.5">HỆ THỐNG GIÁM SÁT IoT</text>
    <text x="280" y="155" fill="#38BDF8" font-size="26" font-weight="800" text-anchor="middle" letter-spacing="1">DENSO KAILINK</text>
    <line x1="80" y1="180" x2="480" y2="180" stroke="rgba(255, 255, 255, 0.25)" stroke-width="1.5" />

    <!-- Core Responsibilities -->
    <g transform="translate(60, 210)" font-size="14" fill="#E2E8F0">
      <text x="0" y="0">✓ Tiếp nhận &amp; chuẩn hóa chuỗi thời gian Telemetry UTC (BR-07)</text>
      <text x="0" y="28">✓ Đánh giá 4 ngưỡng kỹ thuật (BR-01) &amp; Cảnh báo Andon tức thì</text>
      <text x="0" y="56">✓ Tính toán chỉ số an toàn Safety Score theo ca kíp (BR-03)</text>
      <text x="0" y="84">✓ Xuất báo cáo đa định dạng (.xlsx, .csv, .json) trần 10.000 dòng</text>
      <text x="0" y="112">✓ Phân quyền bảo mật RBAC &amp; Nhật ký kiểm toán toàn diện</text>
    </g>

    <rect x="130" y="340" width="300" height="24" rx="12" fill="#E60012" />
    <text x="280" y="356" fill="#FFFFFF" font-size="11" font-weight="700" text-anchor="middle" letter-spacing="0.5">NỀN TẢNG GIÁM SÁT SẢN XUẤT THÔNG MINH</text>
  </g>

  <!-- ==================== EXTERNAL ENTITIES ==================== -->

  <!-- ENTITY 1: OPERATOR (Top-Left) -->
  <g transform="translate(100, 260)" class="shadow">
    <rect width="460" height="230" rx="12" fill="#FFFFFF" stroke="#003366" stroke-width="2.5" />
    <path d="M 0 12 Q 0 0 12 0 L 448 0 Q 460 0 460 12 L 460 45 L 0 45 Z" fill="#003366" />
    <text x="20" y="30" fill="#FFFFFF" font-size="18" font-weight="700">TÁC NHÂN: VẬN HÀNH VIÊN (OPERATOR)</text>
    
    <g transform="translate(20, 75)" font-size="13" fill="#334155">
      <text x="0" y="0" font-weight="600" fill="#003366">Vai trò nghiệp vụ:</text>
      <text x="0" y="22">• Trực tiếp theo dõi dây chuyền dập, hàn, sơn, lắp ráp.</text>
      <text x="0" y="44">• Quan sát bảng Digital Andon toàn màn hình tại xưởng.</text>
      <text x="0" y="66">• Thực hiện Xác nhận cảnh báo sự cố bước 1 (BR-04 Ack Alarm).</text>
      <text x="0" y="88">• Tra cứu nhanh thông số vận hành và mã QR thiết bị.</text>
      <text x="0" y="110">• Quyền hạn hệ thống: Giám sát Tier 1/2/3, Andon, Xác nhận lỗi.</text>
    </g>
  </g>

  <!-- ENTITY 2: MAINTENANCE (Bottom-Left) -->
  <g transform="translate(100, 1020)" class="shadow">
    <rect width="460" height="230" rx="12" fill="#FFFFFF" stroke="#0F4C81" stroke-width="2.5" />
    <path d="M 0 12 Q 0 0 12 0 L 448 0 Q 460 0 460 12 L 460 45 L 0 45 Z" fill="#0F4C81" />
    <text x="20" y="30" fill="#FFFFFF" font-size="18" font-weight="700">TÁC NHÂN: KỸ SƯ BẢO TRÌ (MAINTENANCE)</text>
    
    <g transform="translate(20, 75)" font-size="13" fill="#334155">
      <text x="0" y="0" font-weight="600" fill="#0F4C81">Vai trò nghiệp vụ:</text>
      <text x="0" y="22">• Tiếp nhận sự cố kỹ thuật từ còi cảnh báo Andon.</text>
      <text x="0" y="44">• Xem đồ thị sóng rung động, áp suất, nhiệt độ tại máy (Tier 3).</text>
      <text x="0" y="66">• Khắc phục hỏng hóc &amp; Nghiệm thu đóng sự cố kèm biên bản (BR-05).</text>
      <text x="0" y="88">• Cấu hình 4 ngưỡng cảnh báo cảm biến (Warning/Critical).</text>
      <text x="0" y="110">• Bật/Tắt kết nối truyền thông trạm PLC công nghiệp.</text>
    </g>
  </g>

  <!-- ENTITY 3: ADMIN (Bottom-Right) -->
  <g transform="translate(1640, 1020)" class="shadow">
    <rect width="460" height="230" rx="12" fill="#FFFFFF" stroke="#334155" stroke-width="2.5" />
    <path d="M 0 12 Q 0 0 12 0 L 448 0 Q 460 0 460 12 L 460 45 L 0 45 Z" fill="#334155" />
    <text x="20" y="30" fill="#FFFFFF" font-size="18" font-weight="700">TÁC NHÂN: QUẢN TRỊ VIÊN (ADMIN)</text>
    
    <g transform="translate(20, 75)" font-size="13" fill="#334155">
      <text x="0" y="0" font-weight="600" fill="#334155">Vai trò nghiệp vụ:</text>
      <text x="0" y="22">• Quản trị toàn quyền người dùng &amp; phân quyền vai trò RBAC.</text>
      <text x="0" y="44">• Bảo vệ tài khoản quản trị tối cao không bị tự xóa (BR-11).</text>
      <text x="0" y="66">• Truy vấn và xuất báo cáo lịch sử máy (.xlsx, .csv, .json).</text>
      <text x="0" y="88">• Kiểm tra nhật ký kiểm toán hệ thống (Audit Logs).</text>
      <text x="0" y="110">• Giám sát trạng thái hoạt động của cơ sở dữ liệu MySQL.</text>
    </g>
  </g>

  <!-- ENTITY 4: DATA SOURCES (Top-Right) -->
  <g transform="translate(1640, 240)" class="shadow">
    <rect width="460" height="270" rx="12" fill="#FFFFFF" stroke="#EA580C" stroke-width="2.5" />
    <path d="M 0 12 Q 0 0 12 0 L 448 0 Q 460 0 460 12 L 460 45 L 0 45 Z" fill="#EA580C" />
    <text x="20" y="30" fill="#FFFFFF" font-size="18" font-weight="700">NGUỒN DỮ LIỆU TELEMETRY THIẾT BỊ</text>
    
    <!-- Split Sources Box -->
    <g transform="translate(20, 60)">
      <!-- Source A: Current Simulation -->
      <rect x="0" y="0" width="420" height="85" rx="8" fill="#FFF7ED" stroke="#FDBA74" stroke-width="1.5" />
      <text x="15" y="24" fill="#C2410C" font-size="14" font-weight="700">1. Nguồn Giả Lập Tập Trung (Hiện Tại - Stage 4A):</text>
      <text x="15" y="46" fill="#431407" font-size="12">• Bộ sinh dữ liệu chuỗi thời gian Backend (server/db-mysql.js).</text>
      <text x="15" y="66" fill="#431407" font-size="12">• Chu kỳ quét 1000ms, tự động sinh 4 ngưỡng đo kỹ thuật.</text>

      <!-- Source B: Future Physical PLC -->
      <rect x="0" y="95" width="420" height="95" rx="8" fill="#F8FAFC" stroke="#94A3B8" stroke-width="1.5" stroke-dasharray="5,4" />
      <text x="15" y="119" fill="#0F172A" font-size="14" font-weight="700">2. Trạm PLC Vật Lý Thực Tế (Đề Xuất Giai Đoạn 2):</text>
      <text x="15" y="141" fill="#475569" font-size="12">• Siemens S7-1500 (Modbus/TCP:502) &amp; Omron NX1P2 (OPC-UA:4840).</text>
      <text x="15" y="161" fill="#475569" font-size="12">• Đấu nối tủ điện công nghiệp qua cổng Edge Gateway Kepware.</text>
    </g>
  </g>

  <!-- ==================== DATA FLOWS (ARROWS & LABELS) ==================== -->

  <!-- Flow 1: Operator -> System -->
  <g>
    <!-- Inflow -->
    <path d="M 560 340 L 820 620" fill="none" stroke="#0284C7" stroke-width="2.5" marker-end="url(#arrow-blue)" />
    <rect x="580" y="450" width="220" height="42" rx="6" fill="#FFFFFF" stroke="#0284C7" stroke-width="1" class="shadow" />
    <text x="590" y="468" fill="#0369A1" font-size="12" font-weight="700">1. Đăng nhập &amp; Chọn ca kíp</text>
    <text x="590" y="484" fill="#475569" font-size="11">2. Xác nhận sự cố (Ack Alarm - BR-04)</text>

    <!-- Outflow -->
    <path d="M 820 660 L 560 380" fill="none" stroke="#16A34A" stroke-width="2.5" marker-end="url(#arrow-green)" />
    <rect x="580" y="510" width="220" height="42" rx="6" fill="#FFFFFF" stroke="#16A34A" stroke-width="1" class="shadow" />
    <text x="590" y="528" fill="#15803D" font-size="12" font-weight="700">1. Trạng thái máy Real-time (WebSocket)</text>
    <text x="590" y="544" fill="#475569" font-size="11">2. Cảnh báo còi/đèn Digital Andon</text>
  </g>

  <!-- Flow 2: Maintenance <-> System -->
  <g>
    <!-- Inflow -->
    <path d="M 560 1080 L 820 840" fill="none" stroke="#0284C7" stroke-width="2.5" marker-end="url(#arrow-blue)" />
    <rect x="580" y="930" width="220" height="54" rx="6" fill="#FFFFFF" stroke="#0284C7" stroke-width="1" class="shadow" />
    <text x="590" y="948" fill="#0369A1" font-size="12" font-weight="700">1. Biên bản đóng sự cố (Resolve)</text>
    <text x="590" y="964" fill="#475569" font-size="11">2. Cấu hình ngưỡng cảnh báo</text>
    <text x="590" y="978" fill="#475569" font-size="11">3. Lệnh kiểm tra truyền thông PLC</text>

    <!-- Outflow -->
    <path d="M 820 880 L 560 1120" fill="none" stroke="#16A34A" stroke-width="2.5" marker-end="url(#arrow-green)" />
    <rect x="580" y="1005" width="220" height="42" rx="6" fill="#FFFFFF" stroke="#16A34A" stroke-width="1" class="shadow" />
    <text x="590" y="1023" fill="#15803D" font-size="12" font-weight="700">1. Đồ thị sóng đo lường 60s (Tier 3)</text>
    <text x="590" y="1039" fill="#475569" font-size="11">2. Danh sách cảnh báo chi tiết</text>
  </g>

  <!-- Flow 3: Telemetry Data Source -> System -->
  <g>
    <!-- Simulation Inflow (Solid line) -->
    <path d="M 1640 370 L 1380 620" fill="none" stroke="#EA580C" stroke-width="2.5" marker-end="url(#arrow-orange)" />
    <rect x="1400" y="450" width="220" height="42" rx="6" fill="#FFFFFF" stroke="#EA580C" stroke-width="1" class="shadow" />
    <text x="1410" y="468" fill="#C2410C" font-size="12" font-weight="700">Gói tin Telemetry Giả Lập (1s)</text>
    <text x="1410" y="484" fill="#475569" font-size="11">Áp suất, Nhiệt độ, Rung, Dòng điện</text>

    <!-- Future Physical PLC Inflow (Dashed line) -->
    <path d="M 1640 440 L 1380 660" fill="none" stroke="#64748B" stroke-width="2" stroke-dasharray="6,4" marker-end="url(#arrow-blue)" />
    <rect x="1400" y="515" width="220" height="42" rx="6" fill="#FFFFFF" stroke="#64748B" stroke-width="1" stroke-dasharray="4,3" class="shadow" />
    <text x="1410" y="533" fill="#334155" font-size="12" font-weight="700">Gói Modbus/OPC-UA (Giai đoạn 2)</text>
    <text x="1410" y="549" fill="#64748B" font-size="11">Tín hiệu thanh ghi cảm biến thật</text>

    <!-- Polling Request to PLC -->
    <path d="M 1380 600 L 1640 330" fill="none" stroke="#0284C7" stroke-width="2" stroke-dasharray="6,4" marker-end="url(#arrow-blue)" />
    <rect x="1400" y="390" width="220" height="26" rx="4" fill="#F0F9FF" stroke="#0284C7" stroke-width="1" />
    <text x="1410" y="407" fill="#0369A1" font-size="11" font-weight="600">Lệnh Polling / Heartbeat định kỳ</text>
  </g>

  <!-- Flow 4: Admin <-> System -->
  <g>
    <!-- Inflow -->
    <path d="M 1640 1080 L 1380 840" fill="none" stroke="#0284C7" stroke-width="2.5" marker-end="url(#arrow-blue)" />
    <rect x="1400" y="930" width="220" height="54" rx="6" fill="#FFFFFF" stroke="#0284C7" stroke-width="1" class="shadow" />
    <text x="1410" y="948" fill="#0369A1" font-size="12" font-weight="700">1. Quản lý tài khoản CRUD &amp; RBAC</text>
    <text x="1410" y="964" fill="#475569" font-size="11">2. Yêu cầu xuất báo cáo (.xlsx/.csv)</text>
    <text x="1410" y="978" fill="#475569" font-size="11">3. Tra cứu lịch sử &amp; kiểm toán</text>

    <!-- Outflow -->
    <path d="M 1380 880 L 1640 1120" fill="none" stroke="#16A34A" stroke-width="2.5" marker-end="url(#arrow-green)" />
    <rect x="1400" y="1005" width="220" height="42" rx="6" fill="#FFFFFF" stroke="#16A34A" stroke-width="1" class="shadow" />
    <text x="1410" y="1023" fill="#15803D" font-size="12" font-weight="700">1. Luồng file xuất an toàn (10k dòng)</text>
    <text x="1410" y="1039" fill="#475569" font-size="11">2. Dữ liệu tài khoản &amp; Nhật ký Audit</text>
  </g>

  <!-- Flow Legend Footer -->
  <g transform="translate(80, 1370)">
    <rect width="${width - 160}" height="55" rx="8" fill="#F8FAFC" stroke="#CBD5E1" />
    <text x="25" y="32" fill="#0F172A" font-size="13" font-weight="700">CHÚ GIẢI KÝ HIỆU DFD MỨC 0:</text>
    
    <line x1="260" y1="28" x2="300" y2="28" stroke="#0284C7" stroke-width="2.5" marker-end="url(#arrow-blue)" />
    <text x="310" y="33" fill="#475569" font-size="13">Luồng dữ liệu vào (Inflow)</text>

    <line x1="530" y1="28" x2="570" y2="28" stroke="#16A34A" stroke-width="2.5" marker-end="url(#arrow-green)" />
    <text x="580" y="33" fill="#475569" font-size="13">Luồng dữ liệu ra (Outflow)</text>

    <line x1="800" y1="28" x2="840" y2="28" stroke="#EA580C" stroke-width="2.5" marker-end="url(#arrow-orange)" />
    <text x="850" y="33" fill="#475569" font-size="13">Luồng Telemetry giả lập hiện tại</text>

    <line x1="1140" y1="28" x2="1180" y2="28" stroke="#64748B" stroke-width="2" stroke-dasharray="5,4" marker-end="url(#arrow-blue)" />
    <text x="1190" y="33" fill="#475569" font-size="13">Luồng truyền thông PLC thực tế (Kế hoạch Giai đoạn 2)</text>
  </g>

</svg>`;

  const svgPath = path.join(outDir, '7.3.1_DFD_Level_0.svg');
  const pngPath = path.join(outDir, '7.3.1_DFD_Level_0.png');
  const mmdPath = path.join(outDir, '7.3.1_DFD_Level_0.mmd');

  fs.writeFileSync(svgPath, svg, 'utf8');
  console.log(`[OK] Created ${path.basename(svgPath)}`);

  // Create Mermaid source file (.mmd)
  const mmdContent = `flowchart TD
    %% DENSO Industrial IoT Monitoring System (KaiLink)
    %% Sơ đồ Luồng Dữ Liệu Mức 0 (DFD Level 0 - Context Diagram)
    
    subgraph SYSTEM ["0.0 HỆ THỐNG GIÁM SÁT IoT NHÀ MÁY (KaiLink)"]
        CORE["DENSO KaiLink Core Engine\n- Chuẩn hóa Telemetry UTC\n- Đánh giá ngưỡng & Cảnh báo\n- Quản lý cảnh báo & Andon\n- Truy vấn & Xuất báo cáo\n- Quản trị RBAC & Kiểm toán"]
    end

    OP["VẬN HÀNH VIÊN\n(Operator)"]
    MAINT["KỸ SƯ BẢO TRÌ\n(Maintenance)"]
    ADMIN["QUẢN TRỊ VIÊN\n(Admin)"]
    
    subgraph SOURCES ["NGUỒN DỮ LIỆU TELEMETRY"]
        SIM["Bộ Giả Lập Telemetry\n(Hiện tại - Simulation)"]
        PLC["Trạm PLC Vật Lý Thực Tế\n(Giai đoạn 2 - Siemens/Omron)"]
    end

    %% Flows for Operator
    OP -->|"Đăng nhập, Chọn ca kíp,\nXác nhận sự cố (BR-04 Ack)"| CORE
    CORE -->|"Trạng thái máy Real-time (WebSocket),\nCảnh báo đèn/còi Digital Andon"| OP

    %% Flows for Maintenance
    MAINT -->|"Nghiệm thu đóng lỗi (BR-05 Resolve),\nCấu hình ngưỡng, Lệnh quét PLC"| CORE
    CORE -->|"Đồ thị sóng đo lường 60s (Tier 3),\nDanh sách cảnh báo chi tiết"| MAINT

    %% Flows for Admin
    ADMIN -->|"Quản trị người dùng (CRUD),\nYêu cầu xuất báo cáo Excel/CSV/JSON,\nTra cứu nhật ký kiểm toán"| CORE
    CORE -->|"Luồng file báo cáo an toàn (10k dòng),\nDanh mục user, Nhật ký Audit Logs"| ADMIN

    %% Flows for Telemetry
    SIM -->|"Gói tin Telemetry chu kỳ 1s\n(Áp suất, Nhiệt độ, Rung, Dòng)"| CORE
    PLC -.->|"Gói Modbus/TCP, OPC-UA\n(Kế hoạch Giai đoạn 2)"| CORE
    CORE -.->|"Lệnh quét Polling & Heartbeat"| PLC
`;
  fs.writeFileSync(mmdPath, mmdContent, 'utf8');
  console.log(`[OK] Created ${path.basename(mmdPath)}`);

  // Render high-res PNG (2200x1500 = ~300 DPI equivalent)
  convertSvgToPng(svgPath, pngPath, width, height);
}

// =============================================================================
// 3. SƠ ĐỒ 7.3.2: DFD MỨC 1 (DECOMPOSITION DIAGRAM)
// =============================================================================
function generateDFDLevel1() {
  console.log('[3/3] Generating 7.3.2 DFD Level 1 (Decomposition Diagram)...');
  
  const width = 2500;
  const height = 1950;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">
  <defs>
    <style>
      @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&amp;family=JetBrains+Mono:wght@400;500;600&amp;display=swap');
      text { font-family: 'Inter', 'Segoe UI', Arial, sans-serif; }
      .code-font { font-family: 'JetBrains Mono', Consolas, monospace; }
      .shadow { filter: drop-shadow(0px 8px 16px rgba(15, 23, 42, 0.08)); }
      .shadow-process { filter: drop-shadow(0px 8px 20px rgba(0, 51, 102, 0.12)); }
    </style>

    <!-- Linear Gradients for Process Bubbles -->
    <linearGradient id="p1Grad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#003366" />
      <stop offset="100%" stop-color="#005599" />
    </linearGradient>

    <linearGradient id="p2Grad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0F4C81" />
      <stop offset="100%" stop-color="#0284C7" />
    </linearGradient>

    <linearGradient id="p3Grad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#C2410C" />
      <stop offset="100%" stop-color="#EA580C" />
    </linearGradient>

    <linearGradient id="p4Grad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#047857" />
      <stop offset="100%" stop-color="#10B981" />
    </linearGradient>

    <linearGradient id="p5Grad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#334155" />
      <stop offset="100%" stop-color="#475569" />
    </linearGradient>

    <!-- Markers -->
    <marker id="arrow-dark" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
      <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#0284C7" />
    </marker>
    <marker id="arrow-green" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
      <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#10B981" />
    </marker>
    <marker id="arrow-orange" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
      <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#EA580C" />
    </marker>
    <marker id="arrow-purple" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
      <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#6366F1" />
    </marker>
  </defs>

  <!-- Background -->
  <rect width="100%" height="100%" fill="#F8FAFC" />
  <rect x="40" y="40" width="${width - 80}" height="${height - 80}" rx="24" fill="#FFFFFF" stroke="#E2E8F0" stroke-width="2" class="shadow" />

  <!-- Diagram Title Header Banner -->
  <g transform="translate(80, 80)">
    <rect width="${width - 160}" height="90" rx="12" fill="#003366" />
    <rect x="0" y="0" width="8" height="90" rx="4" fill="#E60012" />
    <text x="35" y="42" fill="#FFFFFF" font-size="28" font-weight="700">SƠ ĐỒ PHÂN RÃ CHỨC NĂNG MỨC 1 (DFD LEVEL 1 - DECOMPOSITION DIAGRAM)</text>
    <text x="35" y="70" fill="#93C5FD" font-size="16" font-weight="500">PHÂN TÁCH 5 TIẾN TRÌNH CỐT LÕI, CÁC KHO DỮ LIỆU MYSQL VÀ BỘ NHỚ ĐỆM ZUSTAND THEO SOURCE CODE THỰC TẾ</text>
    <text x="${width - 200}" y="52" fill="#E2E8F0" font-size="14" font-weight="600" text-anchor="end">CHUẨN ĐẶC TẢ BA V2.1</text>
  </g>

  <!-- ==================== EXTERNAL ENTITIES (LEFT & RIGHT) ==================== -->

  <!-- ENTITY 1: DATA SOURCES (Top-Left) -->
  <g transform="translate(80, 220)" class="shadow">
    <rect width="360" height="180" rx="10" fill="#FFFFFF" stroke="#EA580C" stroke-width="2.5" />
    <rect width="360" height="38" rx="10" fill="#EA580C" />
    <text x="180" y="25" fill="#FFFFFF" font-size="16" font-weight="700" text-anchor="middle">NGUỒN DỮ LIỆU TELEMETRY</text>
    <g transform="translate(15, 60)" font-size="12" fill="#431407">
      <text x="0" y="0" font-weight="700" fill="#C2410C">1. Bộ giả lập tập trung (Hiện tại - 1s)</text>
      <text x="0" y="20">• Áp suất, Nhiệt độ, Rung động, Dòng điện</text>
      <text x="0" y="48" font-weight="700" fill="#475569">2. Trạm PLC Thực Tế (Giai đoạn 2)</text>
      <text x="0" y="68">• Siemens S7-1500 (Modbus/TCP:502)</text>
      <text x="0" y="88">• Omron NX1P2 (OPC-UA:4840)</text>
    </g>
  </g>

  <!-- ENTITY 2: OPERATOR (Middle-Left) -->
  <g transform="translate(80, 640)" class="shadow">
    <rect width="360" height="200" rx="10" fill="#FFFFFF" stroke="#003366" stroke-width="2.5" />
    <rect width="360" height="38" rx="10" fill="#003366" />
    <text x="180" y="25" fill="#FFFFFF" font-size="16" font-weight="700" text-anchor="middle">VẬN HÀNH VIÊN (OPERATOR)</text>
    <g transform="translate(15, 60)" font-size="12" fill="#334155">
      <text x="0" y="0" font-weight="700" fill="#003366">Quyền hạn &amp; Thao tác:</text>
      <text x="0" y="22">• Đăng nhập tài khoản xưởng (Dual Auth)</text>
      <text x="0" y="44">• Xem màn hình Digital Andon, Tier 1, Tier 2</text>
      <text x="0" y="66">• Xác nhận sự cố bước 1: Ack Alarm (BR-04)</text>
      <text x="0" y="88">• Tra cứu mã QR hồ sơ bảo trì thân máy</text>
      <text x="0" y="110">• Xem lịch sử vận hành &amp; lọc ca sản xuất</text>
    </g>
  </g>

  <!-- ENTITY 3: MAINTENANCE (Middle-Right) -->
  <g transform="translate(2060, 640)" class="shadow">
    <rect width="360" height="200" rx="10" fill="#FFFFFF" stroke="#0F4C81" stroke-width="2.5" />
    <rect width="360" height="38" rx="10" fill="#0F4C81" />
    <text x="180" y="25" fill="#FFFFFF" font-size="16" font-weight="700" text-anchor="middle">KỸ THUẬT VIÊN BẢO TRÌ (MAINT)</text>
    <g transform="translate(15, 60)" font-size="12" fill="#334155">
      <text x="0" y="0" font-weight="700" fill="#0F4C81">Quyền hạn &amp; Thao tác:</text>
      <text x="0" y="22">• Xem chi tiết linh kiện máy Tầng 3 (Tier 3)</text>
      <text x="0" y="44">• Xem đồ thị sóng thời gian thực (60s)</text>
      <text x="0" y="66">• Nghiệm thu đóng sự cố kèm biên bản (BR-05)</text>
      <text x="0" y="88">• Cấu hình 4 ngưỡng kỹ thuật (Warning/Crit)</text>
      <text x="0" y="110">• Quản lý kết nối &amp; Polling trạm PLC ảo</text>
    </g>
  </g>

  <!-- ENTITY 4: ADMIN (Bottom-Right) -->
  <g transform="translate(2060, 1340)" class="shadow">
    <rect width="360" height="210" rx="10" fill="#FFFFFF" stroke="#334155" stroke-width="2.5" />
    <rect width="360" height="38" rx="10" fill="#334155" />
    <text x="180" y="25" fill="#FFFFFF" font-size="16" font-weight="700" text-anchor="middle">QUẢN TRỊ VIÊN HỆ THỐNG (ADMIN)</text>
    <g transform="translate(15, 60)" font-size="12" fill="#334155">
      <text x="0" y="0" font-weight="700" fill="#334155">Quyền hạn &amp; Thao tác:</text>
      <text x="0" y="22">• Quản lý danh mục người dùng (CRUD Users)</text>
      <text x="0" y="44">• Phân quyền vai trò RBAC (Admin, Op, Maint)</text>
      <text x="0" y="66">• Khóa tài khoản, bảo vệ không tự xóa mình</text>
      <text x="0" y="88">• Yêu cầu xuất báo cáo Excel, CSV, JSON</text>
      <text x="0" y="110">• Tra cứu &amp; xuất nhật ký kiểm toán (Audit)</text>
    </g>
  </g>

  <!-- ==================== 5 FUNCTIONAL PROCESSES (CENTER) ==================== -->

  <!-- PROCESS 1.0: TIẾP NHẬN & XỬ LÝ TELEMETRY -->
  <g transform="translate(560, 220)" class="shadow-process">
    <rect width="440" height="220" rx="28" fill="url(#p1Grad)" stroke="#38BDF8" stroke-width="2.5" />
    <rect x="140" y="15" width="160" height="28" rx="14" fill="rgba(255, 255, 255, 0.2)" />
    <text x="220" y="34" fill="#FFFFFF" font-size="14" font-weight="700" text-anchor="middle">TIẾN TRÌNH 1.0</text>
    <text x="220" y="70" fill="#FFFFFF" font-size="18" font-weight="800" text-anchor="middle">TIẾP NHẬN &amp; XỬ LÝ TELEMETRY</text>
    
    <g transform="translate(25, 95)" font-size="12" fill="#E0F2FE">
      <text x="0" y="0">• Giải mã thanh ghi PLC thô (DEC12, BIT12) (BR-15)</text>
      <text x="0" y="22">• Quy đổi sang đơn vị đo kỹ thuật (bar, °C, mm/s)</text>
      <text x="0" y="44">• Chuẩn hóa mốc thời gian UTC ISO-8601 (BR-07)</text>
      <text x="0" y="66">• Sinh khóa chính xác định SHA-256 Hash (BR-06)</text>
      <text x="0" y="88">• Phân loại nguồn telemetry ('simulation' / 'device')</text>
      <text x="0" y="108">• Ghi bản ghi vào CSDL qua INSERT IGNORE</text>
    </g>
  </g>

  <!-- PROCESS 2.0: GIÁM SÁT & ĐÁNH GIÁ NGƯỠNG -->
  <g transform="translate(1120, 220)" class="shadow-process">
    <rect width="440" height="220" rx="28" fill="url(#p2Grad)" stroke="#7DD3FC" stroke-width="2.5" />
    <rect x="140" y="15" width="160" height="28" rx="14" fill="rgba(255, 255, 255, 0.2)" />
    <text x="220" y="34" fill="#FFFFFF" font-size="14" font-weight="700" text-anchor="middle">TIẾN TRÌNH 2.0</text>
    <text x="220" y="70" fill="#FFFFFF" font-size="18" font-weight="800" text-anchor="middle">GIÁM SÁT &amp; ĐÁNH GIÁ NGƯỠNG</text>
    
    <g transform="translate(25, 95)" font-size="12" fill="#F0F9FF">
      <text x="0" y="0">• So sánh giá trị đo với 4 ngưỡng vận hành (BR-01)</text>
      <text x="0" y="22">• Phân loại trạng thái: normal, warning, critical</text>
      <text x="0" y="44">• Tổng hợp trạng thái máy theo lỗi nặng nhất (BR-02)</text>
      <text x="0" y="66">• Tính toán điểm an toàn Safety Score dây chuyền (BR-03)</text>
      <text x="0" y="88">• Phát thanh WebSocket trực tiếp tới UI Client (&lt;100ms)</text>
      <text x="0" y="108">• Phát hiện vi phạm ngưỡng chuyển tiếp sang Quản lý cảnh báo</text>
    </g>
  </g>

  <!-- PROCESS 3.0: QUẢN LÝ CẢNH BÁO & SỰ CỐ -->
  <g transform="translate(1120, 630)" class="shadow-process">
    <rect width="440" height="220" rx="28" fill="url(#p3Grad)" stroke="#FDBA74" stroke-width="2.5" />
    <rect x="140" y="15" width="160" height="28" rx="14" fill="rgba(255, 255, 255, 0.2)" />
    <text x="220" y="34" fill="#FFFFFF" font-size="14" font-weight="700" text-anchor="middle">TIẾN TRÌNH 3.0</text>
    <text x="220" y="70" fill="#FFFFFF" font-size="18" font-weight="800" text-anchor="middle">QUẢN LÝ CẢNH BÁO &amp; SỰ CỐ</text>
    
    <g transform="translate(25, 95)" font-size="12" fill="#FFF7ED">
      <text x="0" y="0">• Tiếp nhận sự kiện vi phạm ngưỡng từ Tiến trình 2.0</text>
      <text x="0" y="22">• Khởi tạo cảnh báo trạng thái ACTIVE, nhấp nháy còi Andon</text>
      <text x="0" y="44">• Xử lý sự kiện Xác nhận sự cố bước 1: Ack Alarm (BR-04)</text>
      <text x="0" y="66">• Xử lý Nghiệm thu đóng sự cố bước 2: Resolve Alarm (BR-05)</text>
      <text x="0" y="88">• Quản lý hàng đợi cảnh báo trong bộ nhớ RAM useAlarmStore</text>
      <text x="0" y="108">• Gửi sự kiện kiểm toán xử lý sự cố sang Tiến trình 5.0</text>
    </g>
  </g>

  <!-- PROCESS 4.0: TRUY VẤN LỊCH SỬ & XUẤT BÁO CÁO -->
  <g transform="translate(560, 1020)" class="shadow-process">
    <rect width="440" height="230" rx="28" fill="url(#p4Grad)" stroke="#6EE7B7" stroke-width="2.5" />
    <rect x="140" y="15" width="160" height="28" rx="14" fill="rgba(255, 255, 255, 0.2)" />
    <text x="220" y="34" fill="#FFFFFF" font-size="14" font-weight="700" text-anchor="middle">TIẾN TRÌNH 4.0</text>
    <text x="220" y="70" fill="#FFFFFF" font-size="18" font-weight="800" text-anchor="middle">TRUY VẤN LỊCH SỬ &amp; XUẤT FILE</text>
    
    <g transform="translate(25, 95)" font-size="12" fill="#ECFDF5">
      <text x="0" y="0">• Tiếp nhận tham số lọc: Line, Machine, Metric, Status, Source</text>
      <text x="0" y="22">• Quy đổi khoảng thời gian ca kíp Việt Nam sang UTC (BR-07)</text>
      <text x="0" y="44">• Xử lý cuộn ngày của ca 3 sản xuất qua đêm (BR-08)</text>
      <text x="0" y="66">• Kiểm tra Whitelist 7 cột sắp xếp chống SQLi (BR-14)</text>
      <text x="0" y="88">• Kiểm tra khống chế trần an toàn 10.000 dòng dữ liệu (BR-09)</text>
      <text x="0" y="108">• Làm sạch công thức chống tấn công CSV Injection (BR-10)</text>
      <text x="0" y="128">• Đóng gói luồng nhị phân Excel (.xlsx), CSV, JSON tải về máy</text>
    </g>
  </g>

  <!-- PROCESS 5.0: QUẢN TRỊ HỆ THỐNG & KIỂM TOÁN -->
  <g transform="translate(1480, 1020)" class="shadow-process">
    <rect width="460" height="230" rx="28" fill="url(#p5Grad)" stroke="#94A3B8" stroke-width="2.5" />
    <rect x="150" y="15" width="160" height="28" rx="14" fill="rgba(255, 255, 255, 0.2)" />
    <text x="230" y="34" fill="#FFFFFF" font-size="14" font-weight="700" text-anchor="middle">TIẾN TRÌNH 5.0</text>
    <text x="230" y="70" fill="#FFFFFF" font-size="18" font-weight="800" text-anchor="middle">QUẢN TRỊ HỆ THỐNG &amp; KIỂM TOÁN</text>
    
    <g transform="translate(25, 95)" font-size="12" fill="#F8FAFC">
      <text x="0" y="0">• Xác thực thông tin đăng nhập, sinh Access/Refresh Token JWT</text>
      <text x="0" y="22">• Phân quyền vai trò RBAC: ADMIN, OPERATOR, MAINTENANCE</text>
      <text x="0" y="44">• Quản lý tài khoản (CRUD), băm mật khẩu Bcrypt 10 vòng</text>
      <text x="0" y="66">• Bảo vệ tài khoản quản trị tối cao không bị tự xóa (BR-11)</text>
      <text x="0" y="88">• Xác thực và lưu trữ file ảnh Avatar qua Multer (BR-13)</text>
      <text x="0" y="108">• Ghi nhận đầy đủ vết thao tác (Audit Logs) vào CSDL MySQL</text>
      <text x="0" y="128">• Cung cấp dữ liệu tra cứu và xuất nhật ký kiểm toán</text>
    </g>
  </g>

  <!-- ==================== DATA STORES ==================== -->

  <!-- DATA STORE D1: machine_telemetry_history -->
  <g transform="translate(560, 520)" class="shadow">
    <path d="M 0 0 L 440 0 M 0 65 L 440 65" stroke="#003366" stroke-width="3" fill="none" />
    <rect x="0" y="0" width="440" height="65" fill="#F0F9FF" opacity="0.9" />
    <rect x="0" y="0" width="8" height="65" fill="#0284C7" />
    <text x="25" y="26" fill="#003366" font-size="15" font-weight="700">D1: machine_telemetry_history</text>
    <text x="25" y="48" fill="#475569" font-size="12">CSDL MySQL 8.0 (Bền Vững) - Chuỗi thời gian Telemetry UTC (BR-06, BR-07)</text>
  </g>

  <!-- DATA STORE D2 & D3: machines & production_lines -->
  <g transform="translate(1660, 220)" class="shadow">
    <path d="M 0 0 L 360 0 M 0 85 L 360 85" stroke="#003366" stroke-width="3" fill="none" />
    <rect x="0" y="0" width="360" height="85" fill="#F8FAFC" opacity="0.9" />
    <rect x="0" y="0" width="8" height="85" fill="#003366" />
    <text x="25" y="26" fill="#003366" font-size="15" font-weight="700">D2: machines | D3: production_lines</text>
    <text x="25" y="48" fill="#475569" font-size="12">CSDL MySQL 8.0 (Bền Vững)</text>
    <text x="25" y="68" fill="#64748B" font-size="11">Cấu hình danh mục máy, ngưỡng &amp; chỉ tiêu</text>
  </g>

  <!-- DATA STORE M1: useAlarmStore (RAM Client - Explicitly Not Persistent) -->
  <g transform="translate(1640, 670)" class="shadow">
    <rect x="0" y="0" width="380" height="135" rx="8" fill="#FFF7ED" stroke="#EA580C" stroke-width="2" stroke-dasharray="6,4" />
    <rect x="0" y="0" width="380" height="32" rx="8" fill="#EA580C" />
    <text x="190" y="22" fill="#FFFFFF" font-size="14" font-weight="700" text-anchor="middle">M1: useAlarmStore (RAM CLIENT ZUSTAND)</text>
    <g transform="translate(15, 52)" font-size="11" fill="#431407">
      <text x="0" y="0" font-weight="700" fill="#C2410C">LƯU TRỮ TẠM THỜI TRONG PHIÊN (VOLATILE):</text>
      <text x="0" y="18">• Hàng đợi danh sách cảnh báo đang diễn ra (useAlarmStore.ts)</text>
      <text x="0" y="36">• Quản lý trạng thái: pending -> acknowledged -> resolved</text>
      <text x="0" y="54" fill="#DC2626" font-weight="700">⚠ KHÔNG PHẢI CSDL VĨNH VIỄN: Dữ liệu mất khi F5 / đóng tab</text>
      <text x="0" y="70" fill="#475569">• Lộ trình Giai đoạn 2: Chuyển toàn bộ vào bảng alarms trong MySQL</text>
    </g>
  </g>

  <!-- DATA STORE D5: audit_logs -->
  <g transform="translate(1080, 1090)" class="shadow">
    <path d="M 0 0 L 340 0 M 0 75 L 340 75" stroke="#334155" stroke-width="3" fill="none" />
    <rect x="0" y="0" width="340" height="75" fill="#F8FAFC" opacity="0.9" />
    <rect x="0" y="0" width="8" height="75" fill="#334155" />
    <text x="25" y="26" fill="#0F172A" font-size="15" font-weight="700">D5: audit_logs</text>
    <text x="25" y="48" fill="#475569" font-size="12">CSDL MySQL 8.0 (Bền Vững)</text>
    <text x="25" y="66" fill="#64748B" font-size="11">Vết thao tác LOGIN, ACK, RESOLVE, EXPORT...</text>
  </g>

  <!-- DATA STORE D6: users -->
  <g transform="translate(1480, 1370)" class="shadow">
    <path d="M 0 0 L 460 0 M 0 75 L 460 75" stroke="#334155" stroke-width="3" fill="none" />
    <rect x="0" y="0" width="460" height="75" fill="#F8FAFC" opacity="0.9" />
    <rect x="0" y="0" width="8" height="75" fill="#334155" />
    <text x="25" y="26" fill="#0F172A" font-size="15" font-weight="700">D6: users</text>
    <text x="25" y="48" fill="#475569" font-size="12">CSDL MySQL 8.0 (Bền Vững)</text>
    <text x="25" y="66" fill="#64748B" font-size="11">Hồ sơ người dùng, phân quyền RBAC, mật khẩu Bcrypt</text>
  </g>

  <!-- ==================== DATA FLOW PIPELINES (CONNECTORS) ==================== -->

  <!-- Flow 1: Sources -> Process 1.0 -->
  <g>
    <path d="M 440 310 L 560 310" fill="none" stroke="#EA580C" stroke-width="2.5" marker-end="url(#arrow-orange)" />
    <rect x="445" y="285" width="110" height="20" rx="3" fill="#FFFFFF" stroke="#EA580C" stroke-width="1" />
    <text x="500" y="299" fill="#C2410C" font-size="10" font-weight="700" text-anchor="middle">Thanh ghi thô</text>
  </g>

  <!-- Flow 2: Process 1.0 -> Data Store D1 -->
  <g>
    <path d="M 780 440 L 780 520" fill="none" stroke="#0284C7" stroke-width="2.5" marker-end="url(#arrow-dark)" />
    <rect x="710" y="465" width="140" height="24" rx="4" fill="#FFFFFF" stroke="#0284C7" stroke-width="1" />
    <text x="780" y="481" fill="#0369A1" font-size="11" font-weight="700" text-anchor="middle">Ghi bản ghi UTC (BR-06)</text>
  </g>

  <!-- Flow 3: Process 1.0 -> Process 2.0 -->
  <g>
    <path d="M 1000 310 L 1120 310" fill="none" stroke="#0284C7" stroke-width="2.5" marker-end="url(#arrow-dark)" />
    <rect x="1010" y="285" width="100" height="22" rx="4" fill="#FFFFFF" stroke="#0284C7" stroke-width="1" />
    <text x="1060" y="300" fill="#0369A1" font-size="11" font-weight="700" text-anchor="middle">Giá trị kỹ thuật</text>
  </g>

  <!-- Flow 4: Data Store D2/D3 -> Process 2.0 -->
  <g>
    <path d="M 1660 260 L 1560 260" fill="none" stroke="#64748B" stroke-width="2" marker-end="url(#arrow-dark)" />
    <rect x="1565" y="235" width="90" height="20" rx="3" fill="#FFFFFF" stroke="#64748B" stroke-width="1" />
    <text x="1610" y="249" fill="#334155" font-size="10" font-weight="600" text-anchor="middle">Ngưỡng chuẩn</text>
  </g>

  <!-- Flow 5: Process 2.0 -> WebSocket Real-time to Operator & Maintenance -->
  <g>
    <!-- To Operator -->
    <path d="M 1160 440 L 1160 560 L 440 680" fill="none" stroke="#10B981" stroke-width="2" marker-end="url(#arrow-green)" />
    <rect x="680" y="580" width="220" height="22" rx="4" fill="#FFFFFF" stroke="#10B981" stroke-width="1" />
    <text x="790" y="595" fill="#047857" font-size="11" font-weight="700" text-anchor="middle">WebSocket Broadcast: Andon, Tier 1, Tier 2</text>

    <!-- To Maintenance -->
    <path d="M 1520 440 L 1520 560 L 2060 680" fill="none" stroke="#10B981" stroke-width="2" marker-end="url(#arrow-green)" />
    <rect x="1640" y="580" width="220" height="22" rx="4" fill="#FFFFFF" stroke="#10B981" stroke-width="1" />
    <text x="1750" y="595" fill="#047857" font-size="11" font-weight="700" text-anchor="middle">WebSocket: Đồ thị sóng 60s, Tier 3</text>
  </g>

  <!-- Flow 6: Process 2.0 -> Process 3.0 (Alarm Trigger) -->
  <g>
    <path d="M 1340 440 L 1340 630" fill="none" stroke="#EA580C" stroke-width="2.5" marker-end="url(#arrow-orange)" />
    <rect x="1270" y="520" width="140" height="24" rx="4" fill="#FFFFFF" stroke="#EA580C" stroke-width="1" />
    <text x="1340" y="536" fill="#C2410C" font-size="11" font-weight="700" text-anchor="middle">Sự kiện vi phạm ngưỡng</text>
  </g>

  <!-- Flow 7: Process 3.0 <-> Data Store M1 (useAlarmStore) -->
  <g>
    <path d="M 1560 720 L 1640 720" fill="none" stroke="#EA580C" stroke-width="2" marker-end="url(#arrow-orange)" />
    <path d="M 1640 760 L 1560 760" fill="none" stroke="#EA580C" stroke-width="2" marker-end="url(#arrow-orange)" />
    <rect x="1565" y="728" width="70" height="22" rx="3" fill="#FFFFFF" stroke="#EA580C" stroke-width="1" />
    <text x="1600" y="743" fill="#C2410C" font-size="10" font-weight="700" text-anchor="middle">Sync RAM</text>
  </g>

  <!-- Flow 8: Operator & Maintenance Interactions with Process 3.0 -->
  <g>
    <!-- Operator Ack -->
    <path d="M 440 730 L 1120 730" fill="none" stroke="#0284C7" stroke-width="2" marker-end="url(#arrow-dark)" />
    <rect x="680" y="718" width="180" height="22" rx="4" fill="#FFFFFF" stroke="#0284C7" stroke-width="1" />
    <text x="770" y="733" fill="#0369A1" font-size="11" font-weight="700" text-anchor="middle">Xác nhận sự cố: Ack (BR-04)</text>

    <!-- Maintenance Resolve -->
    <path d="M 2060 740 L 1560 740" fill="none" stroke="#0284C7" stroke-width="2" marker-end="url(#arrow-dark)" />
    <rect x="1750" y="728" width="220" height="22" rx="4" fill="#FFFFFF" stroke="#0284C7" stroke-width="1" />
    <text x="1860" y="743" fill="#0369A1" font-size="11" font-weight="700" text-anchor="middle">Nghiệm thu đóng lỗi: Resolve (BR-05)</text>
  </g>

  <!-- Flow 9: Process 3.0 -> Process 5.0 (Audit Log Event) -->
  <g>
    <path d="M 1380 850 L 1380 940 L 1600 940 L 1600 1020" fill="none" stroke="#6366F1" stroke-width="2" marker-end="url(#arrow-purple)" />
    <rect x="1420" y="928" width="150" height="22" rx="4" fill="#FFFFFF" stroke="#6366F1" stroke-width="1" />
    <text x="1495" y="943" fill="#4338CA" font-size="11" font-weight="700" text-anchor="middle">Sự kiện ACK &amp; RESOLVE</text>
  </g>

  <!-- Flow 10: Process 4.0 (History & Export) Reads D1 -->
  <g>
    <path d="M 780 585 L 780 1020" fill="none" stroke="#047857" stroke-width="2.5" marker-end="url(#arrow-green)" />
    <rect x="680" y="870" width="200" height="38" rx="4" fill="#FFFFFF" stroke="#047857" stroke-width="1" />
    <text x="780" y="887" fill="#065F46" font-size="11" font-weight="700" text-anchor="middle">Đọc Telemetry theo bộ lọc</text>
    <text x="780" y="901" fill="#475569" font-size="10">UTC Conversion, Whitelist (BR-07, 14)</text>
  </g>

  <!-- Flow 11: Process 4.0 <-> Users (Operator / Maintenance / Admin) -->
  <g>
    <!-- Inflow from Admin / Operator -->
    <path d="M 440 790 L 520 790 L 520 1080 L 560 1080" fill="none" stroke="#0284C7" stroke-width="2" marker-end="url(#arrow-dark)" />
    <rect x="410" y="880" width="140" height="22" rx="4" fill="#FFFFFF" stroke="#0284C7" stroke-width="1" />
    <text x="480" y="895" fill="#0369A1" font-size="11" font-weight="700" text-anchor="middle">Tham số lọc ca kíp</text>

    <!-- Outflow to Admin: Safe Export Files -->
    <path d="M 1000 1140 L 2060 1440" fill="none" stroke="#10B981" stroke-width="2.5" marker-end="url(#arrow-green)" />
    <rect x="1400" y="1270" width="230" height="38" rx="4" fill="#FFFFFF" stroke="#10B981" stroke-width="1" />
    <text x="1515" y="1287" fill="#047857" font-size="11" font-weight="700" text-anchor="middle">File tải về (.xlsx, .csv, .json)</text>
    <text x="1515" y="1301" fill="#475569" font-size="10">Trần 10k dòng, Chống CSV Injection</text>
  </g>

  <!-- Flow 12: Process 4.0 -> Process 5.0 (Audit Export Log) -->
  <g>
    <path d="M 1000 1090 L 1080 1090" fill="none" stroke="#6366F1" stroke-width="2" marker-end="url(#arrow-purple)" />
    <rect x="995" y="1065" width="120" height="22" rx="3" fill="#FFFFFF" stroke="#6366F1" stroke-width="1" />
    <text x="1055" y="1080" fill="#4338CA" font-size="10" font-weight="700" text-anchor="middle">Log EXPORT_LOGS</text>
  </g>

  <!-- Flow 13: Process 5.0 <-> Admin & Users -->
  <g>
    <!-- Admin -> Process 5.0 -->
    <path d="M 2060 1380 L 1940 1180" fill="none" stroke="#0284C7" stroke-width="2.5" marker-end="url(#arrow-dark)" />
    <rect x="1950" y="1260" width="160" height="38" rx="4" fill="#FFFFFF" stroke="#0284C7" stroke-width="1" />
    <text x="2030" y="1277" fill="#0369A1" font-size="11" font-weight="700" text-anchor="middle">1. Đăng nhập / Token</text>
    <text x="2030" y="1291" fill="#475569" font-size="10">2. Quản lý CRUD User</text>

    <!-- Process 5.0 -> Admin -->
    <path d="M 1940 1210 L 2060 1410" fill="none" stroke="#10B981" stroke-width="2.5" marker-end="url(#arrow-green)" />
    <rect x="1950" y="1310" width="160" height="38" rx="4" fill="#FFFFFF" stroke="#10B981" stroke-width="1" />
    <text x="2030" y="1327" fill="#047857" font-size="11" font-weight="700" text-anchor="middle">1. JWT Token, Hồ sơ</text>
    <text x="2030" y="1341" fill="#475569" font-size="10">2. Danh sách Audit Logs</text>
  </g>

  <!-- Flow 14: Process 5.0 <-> Data Stores D5 & D6 -->
  <g>
    <!-- To D5 audit_logs -->
    <path d="M 1480 1120 L 1420 1120" fill="none" stroke="#334155" stroke-width="2" marker-end="url(#arrow-dark)" />
    <text x="1450" y="1110" fill="#334155" font-size="10" font-weight="700" text-anchor="middle">Ghi vết</text>

    <!-- To D6 users -->
    <path d="M 1710 1250 L 1710 1370" fill="none" stroke="#334155" stroke-width="2" marker-end="url(#arrow-dark)" />
    <rect x="1660" y="1295" width="100" height="22" rx="3" fill="#FFFFFF" stroke="#334155" stroke-width="1" />
    <text x="1710" y="1310" fill="#0F172A" font-size="10" font-weight="700" text-anchor="middle">Đọc / Ghi User</text>
  </g>

  <!-- Flow Legend Footer -->
  <g transform="translate(80, 1840)">
    <rect width="${width - 160}" height="55" rx="8" fill="#F8FAFC" stroke="#CBD5E1" />
    <text x="25" y="32" fill="#0F172A" font-size="13" font-weight="700">CHÚ GIẢI KÝ HIỆU DFD MỨC 1:</text>
    
    <rect x="230" y="18" width="22" height="22" rx="5" fill="#003366" />
    <text x="260" y="33" fill="#475569" font-size="12">Tiến trình xử lý (Process)</text>

    <line x1="430" y1="20" x2="490" y2="20" stroke="#003366" stroke-width="3" />
    <line x1="430" y1="38" x2="490" y2="38" stroke="#003366" stroke-width="3" />
    <text x="500" y="33" fill="#475569" font-size="12">Kho dữ liệu MySQL bền vững (D1-D6)</text>

    <rect x="730" y="18" width="30" height="20" rx="3" fill="#FFF7ED" stroke="#EA580C" stroke-width="1.5" stroke-dasharray="4,3" />
    <text x="770" y="33" fill="#C2410C" font-size="12" font-weight="600">Kho dữ liệu RAM Zustand tạm thời (M1 - Không phải CSDL vĩnh viễn)</text>

    <line x1="1260" y1="28" x2="1300" y2="28" stroke="#0284C7" stroke-width="2.5" marker-end="url(#arrow-dark)" />
    <text x="1310" y="33" fill="#475569" font-size="12">Luồng dữ liệu điều khiển / nghiệp vụ</text>

    <line x1="1560" y1="28" x2="1600" y2="28" stroke="#10B981" stroke-width="2.5" marker-end="url(#arrow-green)" />
    <text x="1610" y="33" fill="#475569" font-size="12">Luồng dữ liệu kết quả / File / WebSocket</text>
  </g>

</svg>`;

  const svgPath = path.join(outDir, '7.3.2_DFD_Level_1.svg');
  const pngPath = path.join(outDir, '7.3.2_DFD_Level_1.png');
  const mmdPath = path.join(outDir, '7.3.2_DFD_Level_1.mmd');

  fs.writeFileSync(svgPath, svg, 'utf8');
  console.log(`[OK] Created ${path.basename(svgPath)}`);

  // Create Mermaid source file (.mmd)
  const mmdContent = `flowchart TD
    %% DENSO Industrial IoT Monitoring System (KaiLink)
    %% Sơ đồ Luồng Dữ Liệu Mức 1 (DFD Level 1 - Decomposition Diagram)

    %% External Entities
    SRC["NGUỒN TELEMETRY\n(Giả lập 1s / Trạm PLC thực)"]
    OP["VẬN HÀNH VIÊN\n(Operator)"]
    MAINT["KỸ SƯ BẢO TRÌ\n(Maintenance)"]
    ADMIN["QUẢN TRỊ VIÊN\n(Admin)"]

    %% Processes
    P1(("1.0 Tiếp nhận &\nChuẩn hóa Telemetry"))
    P2(("2.0 Giám sát &\nĐánh giá Ngưỡng"))
    P3(("3.0 Quản lý\nCảnh báo & Sự cố"))
    P4(("4.0 Truy vấn Lịch sử\n& Xuất Báo Cáo"))
    P5(("5.0 Quản trị\nHệ thống & Kiểm toán"))

    %% Data Stores (MySQL)
    D1[("D1: machine_telemetry_history\n(MySQL 8.0 - Bền vững)")]
    D2D3[("D2: machines | D3: production_lines\n(MySQL 8.0 - Bền vững)")]
    D5[("D5: audit_logs\n(MySQL 8.0 - Bền vững)")]
    D6[("D6: users\n(MySQL 8.0 - Bền vững)")]

    %% Memory Store (Zustand - Explicitly Volatile)
    M1{{"M1: useAlarmStore\n(RAM Client Zustand - TẠM THỜI)"}}

    %% Data Flows
    SRC -->|"Thanh ghi thô (DEC12, BIT12)"| P1
    P1 -->|"Ghi bản ghi UTC, SHA-256 (BR-06, 07)"| D1
    P1 -->|"Luồng giá trị đo kỹ thuật"| P2

    D2D3 -->|"Cấu hình 4 ngưỡng chuẩn (BR-01)"| P2
    P2 -->|"WebSocket: Andon, Tier 1/2"| OP
    P2 -->|"WebSocket: Đồ thị sóng 60s, Tier 3"| MAINT
    P2 -->|"Sự kiện vi phạm ngưỡng"| P3

    OP -->|"Xác nhận sự cố: Ack (BR-04)"| P3
    MAINT -->|"Nghiệm thu đóng lỗi: Resolve (BR-05)"| P3
    P3 <-->|"Đồng bộ hàng đợi RAM"| M1
    P3 -->|"Ghi vết ACK_ALARM, RESOLVE_ALARM"| P5

    OP -->|"Tham số lọc ca kíp, thời gian"| P4
    MAINT -->|"Tham số tra cứu máy"| P4
    ADMIN -->|"Yêu cầu xuất Excel/CSV/JSON"| P4
    D1 -->|"Đọc Telemetry (BR-07 UTC, BR-14 Whitelist)"| P4
    P4 -->|"File xuất an toàn trần 10k dòng (BR-09, 10)"| ADMIN
    P4 -->|"Ghi vết EXPORT_LOGS"| P5

    ADMIN <-->|"Quản lý User CRUD, RBAC, Đăng nhập"| P5
    P5 <-->|"Đọc/Ghi User (Bcrypt 10 rounds)"| D6
    P5 -->|"Ghi vết toàn bộ hành động"| D5
    D5 -->|"Tra cứu nhật ký kiểm toán"| ADMIN
`;
  fs.writeFileSync(mmdPath, mmdContent, 'utf8');
  console.log(`[OK] Created ${path.basename(mmdPath)}`);

  // Render high-res PNG (2500x1950 = ~300 DPI equivalent)
  convertSvgToPng(svgPath, pngPath, width, height);
}

// Master execution
console.log('=== BẮT ĐẦU TẠO 3 SƠ ĐỒ CHƯƠNG 7 CHO DENSO KAILINK ===');
generateERD();
generateDFDLevel0();
generateDFDLevel1();
console.log('=== HOÀN THÀNH TẠO 3 SƠ ĐỒ THÀNH CÔNG ===');
