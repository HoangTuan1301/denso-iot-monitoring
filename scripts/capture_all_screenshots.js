import { spawn } from 'child_process';
import WebSocket from 'ws';
import fs from 'fs';
import path from 'path';
import os from 'os';

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const outDir = path.resolve('docs/ba/images/actual');
fs.mkdirSync(outDir, { recursive: true });

const tempProfile = path.join(os.tmpdir(), 'denso_shot_' + Date.now());

async function run() {
  console.log('=== KHỞI ĐỘNG CHROME HEADLESS ĐỂ CHỤP ẢNH GIAO DIỆN THỰC TẾ ===');
  const chromeProc = spawn(chromePath, [
    '--headless=new',
    '--remote-debugging-port=9222',
    `--user-data-dir=${tempProfile}`,
    '--window-size=1600,1050',
    '--hide-scrollbars',
    '--no-first-run',
    '--no-default-browser-check',
    'http://localhost:3000',
  ]);

  let wsUrl = null;
  for (let i = 0; i < 30; i++) {
    await new Promise((r) => setTimeout(r, 400));
    try {
      const res = await fetch('http://127.0.0.1:9222/json');
      const tabs = await res.json();
      const pageTab = tabs.find((t) => t.type === 'page');
      if (pageTab && pageTab.webSocketDebuggerUrl) {
        wsUrl = pageTab.webSocketDebuggerUrl;
        break;
      }
    } catch {}
  }

  if (!wsUrl) {
    console.error('Lỗi: Không kết nối được Chrome qua WebSocket');
    chromeProc.kill();
    return;
  }

  console.log('Đã kết nối Chrome CDP. Chuẩn bị thao tác trên trình duyệt...');
  const ws = new WebSocket(wsUrl);
  await new Promise((resolve) => ws.on('open', resolve));

  let reqId = 1;
  const call = (method, params = {}) => {
    return new Promise((resolve, reject) => {
      const id = reqId++;
      const onMsg = (buf) => {
        const msg = JSON.parse(buf.toString());
        if (msg.id === id) {
          ws.off('message', onMsg);
          if (msg.error) reject(new Error(msg.error.message));
          else resolve(msg.result);
        }
      };
      ws.on('message', onMsg);
      ws.send(JSON.stringify({ id, method, params }));
    });
  };

  const evalCode = async (expression) => {
    const res = await call('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true,
    });
    return res.result ? res.result.value : null;
  };

  const saveShot = async (filename, clip = null) => {
    const params = { format: 'png' };
    if (clip) params.clip = clip;
    const shot = await call('Page.captureScreenshot', params);
    const filePath = path.join(outDir, filename);
    fs.writeFileSync(filePath, Buffer.from(shot.data, 'base64'));
    console.log(`[OK] Đã lưu: ${filename} (${(fs.statSync(filePath).size / 1024).toFixed(1)} KB)`);
    return filePath;
  };

  await call('Page.enable');
  await call('Runtime.enable');
  await call('Emulation.setDeviceMetricsOverride', {
    width: 1600,
    height: 1050,
    deviceScaleFactor: 1.25,
    mobile: false,
  });

  // Chờ trang đăng nhập tải
  console.log('Đang mở trang Đăng nhập...');
  await new Promise((r) => setTimeout(r, 2000));

  // =========================================================================
  // BƯỚC 1: ĐĂNG NHẬP VỚI TÀI KHOẢN ADMIN (QUYỀN SỬA)
  // =========================================================================
  console.log('1. Đăng nhập tài khoản ADMIN (admin@denso.com)...');
  await evalCode(`
    (() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const adminBtn = buttons.find(b => b.textContent.includes('ADMIN'));
      if (adminBtn) adminBtn.click();
    })()
  `);
  await new Promise((r) => setTimeout(r, 2000));

  // Kiểm tra đã vào Dashboard chưa
  const currentTab = await evalCode(`document.body.innerText.includes("Dashboard")`);
  console.log('Trạng thái vào Dashboard Admin:', currentTab);

  // -------------------------------------------------------------------------
  // HÌNH 1.1: Quản lý Người dùng & Phân quyền (PHẦN 1 - Thực trạng phân quyền)
  // -------------------------------------------------------------------------
  console.log('2. Chuyển sang trang Quản lý Người dùng & Phân quyền...');
  await evalCode(`
    (() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const usersBtn = buttons.find(b => b.textContent.includes('Quản lý Người dùng'));
      if (usersBtn) usersBtn.click();
    })()
  `);
  await new Promise((r) => setTimeout(r, 2500));
  await saveShot('hinh_1_1_quan_ly_nguoi_dung_phan_quyen.png');

  // -------------------------------------------------------------------------
  // HÌNH 2.1: Header & Nút Giả lập Sự cố (PHẦN 2 - Mục 1)
  // -------------------------------------------------------------------------
  console.log('3. Chụp Header & Nút Giả lập Sự cố...');
  // Chụp phần Header phía trên
  await saveShot('hinh_2_1_header_gialap_suco.png', {
    x: 0,
    y: 0,
    width: 1600,
    height: 140,
    scale: 1,
  });

  // -------------------------------------------------------------------------
  // HÌNH 2.2: Dashboard Tổng quan Nhà máy Cấp 1 (PHẦN 2 - Mục 2)
  // -------------------------------------------------------------------------
  console.log('4. Chuyển về Dashboard Tổng quan...');
  await evalCode(`
    (() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const dashBtn = buttons.find(b => b.textContent.includes('Dashboard Tổng quan'));
      if (dashBtn) dashBtn.click();
    })()
  `);
  await new Promise((r) => setTimeout(r, 2500));
  await saveShot('hinh_2_2_dashboard_tong_quan.png');

  // -------------------------------------------------------------------------
  // HÌNH 2.3: Luồng & Thành phần (Dây chuyền và Máy) Cấp 2 (PHẦN 2 - Mục 3)
  // -------------------------------------------------------------------------
  console.log('5. Chuyển sang Luồng & Thành phần (Danh mục Máy)...');
  await evalCode(`
    (() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const linesBtn = buttons.find(b => b.textContent.includes('Luồng & Thành phần'));
      if (linesBtn) linesBtn.click();
    })()
  `);
  await new Promise((r) => setTimeout(r, 2500));
  await saveShot('hinh_2_3_luong_thanh_phan_may.png');

  // -------------------------------------------------------------------------
  // HÌNH 2.4: Hộp thoại Chi tiết Component & Đồ thị cảm biến (PHẦN 2 - Mục 4)
  // -------------------------------------------------------------------------
  console.log('6. Mở Hộp thoại Chi tiết Component & Đồ thị sóng 60s...');
  await evalCode(`
    (() => {
      // Tìm nút có title 'Xem chi tiết & Biểu đồ Tầng 3' hoặc nút SVG LineChart đầu tiên
      const detailBtn = document.querySelector('button[title*="Xem chi tiết"], button[title*="Biểu đồ"]');
      if (detailBtn) detailBtn.click();
      else {
        // Hoặc click vào mã máy đầu tiên
        const codeSpan = document.querySelector('td font-mono span, td.font-mono span');
        if (codeSpan) codeSpan.click();
      }
    })()
  `);
  await new Promise((r) => setTimeout(r, 2000));
  await saveShot('hinh_2_4_chitiet_component_dothi.png');

  // Đóng Modal Chi tiết
  await evalCode(`
    (() => {
      const closeBtn = document.querySelector('button[aria-label="Close"], button[aria-label="Đóng"]');
      if (closeBtn) closeBtn.click();
      else {
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape' }));
      }
    })()
  `);
  await new Promise((r) => setTimeout(r, 1000));

  // -------------------------------------------------------------------------
  // HÌNH 2.5: Hộp thoại Tem Mã QR Máy (PHẦN 2 - Mục 5)
  // -------------------------------------------------------------------------
  console.log('7. Mở Hộp thoại Tem Mã QR Máy...');
  await evalCode(`
    (() => {
      const qrBtn = document.querySelector('button[title*="Mã QR"], button[title*="QR"]');
      if (qrBtn) qrBtn.click();
    })()
  `);
  await new Promise((r) => setTimeout(r, 2000));
  await saveShot('hinh_2_5_hopthoai_ma_qr.png');

  // Đóng Modal QR
  await evalCode(`
    (() => {
      const closeBtn = document.querySelector('button[aria-label="Close"], button[aria-label="Đóng"]');
      if (closeBtn) closeBtn.click();
      else {
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape' }));
      }
    })()
  `);
  await new Promise((r) => setTimeout(r, 1000));

  // -------------------------------------------------------------------------
  // HÌNH 2.6: Nhật ký Cảnh báo & Sự cố (PHẦN 2 - Mục 6)
  // -------------------------------------------------------------------------
  console.log('8. Chuyển sang Nhật ký Cảnh báo & Sự cố (Alert Log)...');
  await evalCode(`
    (() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const alarmBtn = buttons.find(b => b.textContent.includes('Danh sách Alert') || b.textContent.includes('Cảnh báo'));
      if (alarmBtn) alarmBtn.click();
    })()
  `);
  await new Promise((r) => setTimeout(r, 2500));
  await saveShot('hinh_2_6_nhatky_canhbao_suco.png');

  // -------------------------------------------------------------------------
  // HÌNH 2.7: Lịch sử Hoạt động Máy & Chức năng Xuất Dữ liệu (PHẦN 2 - Mục 7)
  // -------------------------------------------------------------------------
  console.log('9. Chuyển sang Lịch sử Hoạt động Máy & Mở menu Xuất file...');
  await evalCode(`
    (() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const histBtn = buttons.find(b => b.textContent.includes('Lịch sử hoạt động'));
      if (histBtn) histBtn.click();
    })()
  `);
  await new Promise((r) => setTimeout(r, 3000));

  // Mở menu Xuất dữ liệu để thấy rõ cả 3 lựa chọn Excel, CSV, JSON
  await evalCode(`
    (() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const exportBtn = buttons.find(b => b.textContent.includes('Xuất dữ liệu') || b.textContent.includes('Export'));
      if (exportBtn) exportBtn.click();
    })()
  `);
  await new Promise((r) => setTimeout(r, 1000));
  await saveShot('hinh_2_7_lichsu_xuat_dulieu.png');

  // -------------------------------------------------------------------------
  // HÌNH 2.8: Mapping & Cấu hình Ngưỡng (PHẦN 2 - Mục 8)
  // -------------------------------------------------------------------------
  console.log('10. Chuyển sang Mapping & Cấu hình Ngưỡng...');
  await evalCode(`
    (() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const thresBtn = buttons.find(b => b.textContent.includes('Mapping & Ngưỡng') || b.textContent.includes('Cấu hình Ngưỡng'));
      if (thresBtn) thresBtn.click();
    })()
  `);
  await new Promise((r) => setTimeout(r, 2500));
  await saveShot('hinh_2_8_mapping_cauhinh_nguong.png');

  // -------------------------------------------------------------------------
  // HÌNH 2.9: Quản lý Người dùng & Phân quyền (PHẦN 2 - Mục 9)
  // -------------------------------------------------------------------------
  console.log('11. Chụp lại Quản lý Người dùng & Phân quyền chi tiết cho Admin...');
  await evalCode(`
    (() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const usersBtn = buttons.find(b => b.textContent.includes('Quản lý Người dùng'));
      if (usersBtn) usersBtn.click();
    })()
  `);
  await new Promise((r) => setTimeout(r, 2500));
  await saveShot('hinh_2_9_quanly_nguoidung_admin.png');

  // =========================================================================
  // BƯỚC 2: ĐĂNG XUẤT VÀ ĐĂNG NHẬP VỚI TÀI KHOẢN VẬN HÀNH (QUYỀN XEM)
  // =========================================================================
  console.log('12. Đăng xuất tài khoản Admin...');
  await evalCode(`
    (() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const logoutBtn = buttons.find(b => b.textContent.includes('Đăng xuất') || b.querySelector('svg.lucide-log-out'));
      if (logoutBtn) logoutBtn.click();
      else {
        // Fallback xóa token trong localStorage
        localStorage.clear();
        location.reload();
      }
    })()
  `);
  await new Promise((r) => setTimeout(r, 2500));

  console.log('13. Đăng nhập tài khoản OPERATOR (user@denso.com)...');
  await evalCode(`
    (() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const opBtn = buttons.find(b => b.textContent.includes('OPERATOR'));
      if (opBtn) opBtn.click();
    })()
  `);
  await new Promise((r) => setTimeout(r, 2500));

  // -------------------------------------------------------------------------
  // HÌNH 3.1: Dashboard Tổng quan (Quyền XEM)
  // -------------------------------------------------------------------------
  console.log('14. Chụp Dashboard Tổng quan dưới góc nhìn Quyền XEM (Operator)...');
  await saveShot('hinh_3_1_operator_dashboard.png');

  // -------------------------------------------------------------------------
  // HÌNH 3.2: Luồng & Chi tiết Máy (Quyền XEM)
  // -------------------------------------------------------------------------
  console.log('15. Chuyển sang Luồng & Chi tiết Máy dưới góc nhìn Quyền XEM...');
  await evalCode(`
    (() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const linesBtn = buttons.find(b => b.textContent.includes('Chi tiết Component') || b.textContent.includes('Luồng & Thành phần'));
      if (linesBtn) linesBtn.click();
    })()
  `);
  await new Promise((r) => setTimeout(r, 2500));
  await saveShot('hinh_3_2_operator_lines.png');

  // -------------------------------------------------------------------------
  // HÌNH 3.3: Cảnh báo Sự cố & Lịch sử Hoạt động (Quyền XEM)
  // -------------------------------------------------------------------------
  console.log('16. Chuyển sang Cảnh báo Sự cố & Tiếp nhận Andon dưới góc nhìn Quyền XEM...');
  await evalCode(`
    (() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const alarmBtn = buttons.find(b => b.textContent.includes('Danh sách Alert') || b.textContent.includes('Cảnh báo'));
      if (alarmBtn) alarmBtn.click();
    })()
  `);
  await new Promise((r) => setTimeout(r, 2500));
  await saveShot('hinh_3_3_operator_alarms_history.png');

  console.log('=== HOÀN TẤT CHỤP TẤT CẢ ẢNH GIAO DIỆN THỰC TẾ! ===');
  ws.close();
  chromeProc.kill();
  try {
    fs.rmSync(tempProfile, { recursive: true, force: true });
  } catch {}
}

run().catch((err) => {
  console.error('Lỗi quy trình chụp ảnh:', err);
  process.exit(1);
});
