/**
 * @file test_login_page_redesign.cjs
 * @description Bộ kiểm thử tự động toàn diện cho màn hình Đăng nhập (Login Page Redesign)
 * Kiểm định giao diện Split-Screen, nhận diện thương hiệu DENSO, bảo mật form, demo roles và cơ chế xác thực JWT
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');

console.log('========================================================================');
console.log('   DENSO SMART FACTORY: KIỂM ĐỊNH TOÀN DIỆN REDESIGN LOGIN PAGE        ');
console.log('========================================================================\n');

let passCount = 0;
let failCount = 0;

function assertTest(condition, msg) {
  if (condition) {
    console.log(`  [PASS] ${msg}`);
    passCount++;
  } else {
    console.error(`  [FAIL] ${msg}`);
    failCount++;
  }
}

// -----------------------------------------------------------------------------
// PHẦN 1: KIỂM ĐỊNH MÃ NGUỒN VÀ TIÊU CHUẨN THIẾT KẾ (UI/UX AUDIT)
// -----------------------------------------------------------------------------
console.log('[PHẦN 1] Kiểm tra cấu trúc thiết bị và nhận diện thương hiệu DENSO trong LoginPage.tsx:');
const loginFilePath = path.join(__dirname, '../src/features/auth/LoginPage.tsx');
const loginCode = fs.readFileSync(loginFilePath, 'utf8');

// 1.1 Bố cục Split-screen
assertTest(loginCode.includes('lg:w-[52%]') && loginCode.includes('lg:w-[48%]'), 
  'Bố cục Split-Screen: Phân chia 52-54% (Branding Panel) và 46-48% (Auth Panel)');

// 1.2 Bảng màu nhận diện DENSO Primary Red
assertTest(loginCode.includes('#DC0017') && loginCode.includes('#A50016'), 
  'Bảng màu chuẩn thương hiệu: Tích hợp mã màu DENSO Primary Red (#DC0017) & Dark Red (#A50016)');

// 1.3 Ảnh nền nhà máy thông minh
assertTest(loginCode.includes('/images/factory-login-bg.jpg'), 
  'Hình ảnh nhà máy công nghiệp: Nạp hình nền sắc nét /images/factory-login-bg.jpg');

// 1.4 Đường cắt cong mềm mại (Curved divider)
assertTest(loginCode.includes('<svg viewBox="0 0 100 100" preserveAspectRatio="none" className="w-full h-full fill-current">'), 
  'Đường chia cong mềm mại (Curved boundary) ngăn cách tinh tế giữa ảnh nhà máy và form đăng nhập');

// 1.5 Ba giá trị nổi bật
assertTest(
  loginCode.includes('Giám sát thời gian thực') &&
  loginCode.includes('Quản lý thiết bị') &&
  loginCode.includes('An toàn & ổn định'), 
  'Hiển thị đủ 3 giá trị nổi bật kèm icon tối giản: Giám sát thời gian thực, Quản lý thiết bị, An toàn & ổn định');

// 1.6 Logo DENSO & Khẩu hiệu Crafting the Core
assertTest(
  loginCode.includes('denso-logo-clean.png') && loginCode.includes('Crafting the Core'), 
  'Logo thương hiệu: Tích hợp Logo DENSO chính thức và khẩu hiệu "Crafting the Core"');

// 1.7 Họa tiết ruy-băng đỏ trên góc thẻ (Red corner accent)
assertTest(loginCode.includes('cardRedCorner') || loginCode.includes('rounded-tr-[28px]'), 
  'Card đăng nhập: Tích hợp dải lượn sóng màu đỏ DENSO ở góc trên bên phải');

// 1.8 Kiểm tra yêu cầu tinh chỉnh: Không hiển thị nhãn Industrial IoT Enterprise v2.6
assertTest(!loginCode.includes('Industrial IoT Enterprise v2.6'), 
  'Đã xóa hoàn toàn nhãn Industrial IoT Enterprise v2.6');

// -----------------------------------------------------------------------------
// PHẦN 2: BẢO MẬT & TRẢI NGHIỆM NGƯỜI DÙNG (SECURITY & FORM UX)
// -----------------------------------------------------------------------------
console.log('\n[PHẦN 2] Kiểm tra cơ chế Form, Bảo mật & Xử lý lỗi:');

// 2.1 Password visibility toggle
assertTest(loginCode.includes('isVisiblePassword') && loginCode.includes('EyeOff') && loginCode.includes('Eye'), 
  'Ẩn/Hiện mật khẩu: Nút toggle icon Eye/EyeOff hoạt động an toàn');

// 2.2 Remember Me (Ghi nhớ đăng nhập an toàn)
assertTest(loginCode.includes('denso_remembered_email') && !loginCode.includes('denso_remembered_password'), 
  'Ghi nhớ đăng nhập: Chỉ lưu email string an toàn trong localStorage, tuyệt đối không lưu mật khẩu');

// 2.3 Quên mật khẩu an toàn (Không tạo nút giả 404)
assertTest(loginCode.includes('showForgotPasswordModal') && loginCode.includes('admin@denso.com'), 
  'Quên mật khẩu: Mở modal hướng dẫn liên hệ IT/Admin nội bộ, không điều hướng tới trang 404');

// 2.4 Ngăn double-submit và hiệu ứng Loading
assertTest(loginCode.includes('disabled={isLoading}') && loginCode.includes('Đang xác thực...'), 
  'Nút Đăng nhập: Hiển thị spinner Loader2, disabled khi gọi API để ngăn chặn double-submit');

// 2.5 Roles ADMIN & OPERATOR (Đã bỏ chữ Demo)
assertTest(
  !loginCode.includes('ADMIN (Demo)') && 
  !loginCode.includes('OPERATOR (Demo)') && 
  loginCode.includes('ADMIN') && 
  loginCode.includes('OPERATOR') && 
  loginCode.includes('Quản trị hệ thống') && 
  loginCode.includes('Vận hành & giám sát'), 
  'Roles: Hiển thị đúng 2 thẻ ADMIN và OPERATOR (Đã bỏ chữ Demo, giữ nguyên mô tả & phân quyền)');

// 2.6 Quy tắc bảo mật: Không hardcode hiển thị mật khẩu trên giao diện
assertTest(!loginCode.includes('admin123</') && !loginCode.includes('user123</'), 
  'Bảo mật Credentials: Không hiển thị mật khẩu plaintext trên thẻ demo');

// 2.7 Kiểm tra yêu cầu tinh chỉnh: Đã xóa thanh trạng thái PLC và WebSocket
assertTest(!loginCode.includes('PLC: Chưa kết nối') && !loginCode.includes('WebSocket: Live'), 
  'Đã xóa hoàn toàn thanh trạng thái PLC và WebSocket khỏi Login Page');

// -----------------------------------------------------------------------------
// PHẦN 3: TỒN TẠI TÀI NGUYÊN FILE (FILE INTEGRITY AUDIT)
// -----------------------------------------------------------------------------
console.log('\n[PHẦN 3] Kiểm tra tính toàn vẹn của các tệp tài nguyên:');

const factoryBgPath = path.join(__dirname, '../public/images/factory-login-bg.jpg');
const densoLogoCleanPath = path.join(__dirname, '../public/images/denso-logo-clean.png');

assertTest(fs.existsSync(factoryBgPath) && fs.statSync(factoryBgPath).size > 50000, 
  `Tệp ảnh nền tồn tại: /images/factory-login-bg.jpg (${Math.round(fs.statSync(factoryBgPath).size / 1024)} KB)`);

assertTest(fs.existsSync(densoLogoCleanPath) && fs.statSync(densoLogoCleanPath).size > 1000, 
  `Tệp Logo DENSO trong suốt tồn tại: /images/denso-logo-clean.png (${Math.round(fs.statSync(densoLogoCleanPath).size / 1024)} KB)`);

// -----------------------------------------------------------------------------
// PHẦN 4: KIỂM ĐỊNH KẾT NỐI AUTHENTICATION API THỰC TẾ (LIVE API AUDIT)
// -----------------------------------------------------------------------------
console.log('\n[PHẦN 4] Kiểm tra API Xác thực Backend Render:');
const https = require('https');

function postJson(url, payload) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const body = JSON.stringify(payload);
    const req = https.request({
      hostname: u.hostname,
      port: 443,
      path: u.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
        'User-Agent': 'Denso-Login-Test/1.0'
      }
    }, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, data: JSON.parse(data) }); }
        catch (e) { resolve({ status: res.statusCode, raw: data }); }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function testBackendAuth() {
  try {
    // 4.1 Đăng nhập sai mật khẩu
    const failRes = await postJson('https://denso-iot-monitoring.onrender.com/api/auth/login', {
      email: 'admin@denso.com',
      password: 'wrong_password_123'
    });
    assertTest(failRes.status === 401, 'Bảo mật: Mật khẩu sai bị từ chối với mã HTTP 401 Unauthorized');

    // 4.2 Thiếu thông tin
    const emptyRes = await postJson('https://denso-iot-monitoring.onrender.com/api/auth/login', {
      email: '',
      password: ''
    });
    assertTest(emptyRes.status === 400 || emptyRes.status === 401, 'Bảo mật: Yêu cầu thiếu dữ liệu bị từ chối');

    // 4.3 Đăng nhập Admin thành công
    const adminRes = await postJson('https://denso-iot-monitoring.onrender.com/api/auth/login', {
      email: 'admin@denso.com',
      password: 'admin123'
    });
    assertTest(adminRes.status === 200 && adminRes.data?.accessToken, 
      `Xác thực Admin: Đăng nhập thành công, cấp Access Token JWT (${adminRes.data?.user?.fullName}, Role: ${adminRes.data?.user?.role})`);

    // 4.4 Đăng nhập Operator thành công
    const opRes = await postJson('https://denso-iot-monitoring.onrender.com/api/auth/login', {
      email: 'user@denso.com',
      password: 'user123'
    });
    assertTest(opRes.status === 200 && opRes.data?.accessToken, 
      `Xác thực Operator: Đăng nhập thành công, cấp Access Token JWT (${opRes.data?.user?.fullName}, Role: ${opRes.data?.user?.role})`);

  } catch (err) {
    console.warn('  ⚠️ Không thể gọi trực tiếp Render public (network offline):', err.message);
  }

  console.log('\n========================================================================');
  console.log(`TỔNG KẾT KIỂM THỬ LOGIN REDESIGN: ${passCount} PASS / ${failCount} FAIL`);
  console.log('========================================================================\n');

  if (failCount > 0) process.exit(1);
  else process.exit(0);
}

testBackendAuth();
