/**
 * @file LoginPage.tsx
 * @description Màn hình Đăng nhập Doanh nghiệp Hiện đại (DENSO Smart Factory – Modern Enterprise Login)
 * Thiết kế Split-Screen chuẩn nhận diện DENSO Industrial Red & Nhà máy Thông minh (Ảnh tham chiếu)
 * Giữ nguyên 100% chức năng xác thực JWT, phân quyền RBAC (ADMIN / OPERATOR), và điều hướng an toàn.
 */

import React, { useState, useEffect } from 'react';
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  LogIn,
  User,
  HardHat,
  BarChart3,
  Settings,
  ShieldCheck,
  Sun,
  Moon,
  Loader2,
  AlertCircle,
  HelpCircle,
  X,
} from 'lucide-react';
import { useAuthStore } from '../../stores/useAuthStore';
import { useThemeStore } from '../../stores/useThemeStore';

const REMEMBERED_EMAIL_KEY = 'denso_remembered_email';

export function LoginPage() {
  const { login, isLoading, error } = useAuthStore();
  const { theme, toggleTheme } = useThemeStore();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isVisiblePassword, setIsVisiblePassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [showForgotPasswordModal, setShowForgotPasswordModal] = useState(false);

  // Nạp email đã ghi nhớ (nếu có) khi khởi động
  useEffect(() => {
    const savedEmail = localStorage.getItem(REMEMBERED_EMAIL_KEY);
    if (savedEmail) {
      setEmail(savedEmail);
      setRememberMe(true);
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const trimmedEmail = email.trim();
    const trimmedPass = password.trim();

    if (!trimmedEmail || !trimmedPass) {
      setFormError('Vui lòng nhập đầy đủ Email và Mật khẩu.');
      return;
    }

    // Xử lý ghi nhớ email an toàn (Chỉ lưu email string, không lưu mật khẩu hoặc JWT)
    if (rememberMe) {
      localStorage.setItem(REMEMBERED_EMAIL_KEY, trimmedEmail);
    } else {
      localStorage.removeItem(REMEMBERED_EMAIL_KEY);
    }

    const success = await login(trimmedEmail, trimmedPass);
    if (!success) {
      setFormError(error || 'Đăng nhập không thành công. Vui lòng kiểm tra lại thông tin.');
    }
  };

  // Nút đăng nhập nhanh Demo (ADMIN / OPERATOR)
  const handleQuickLogin = (demoEmail: string, demoPass: string) => {
    setEmail(demoEmail);
    setPassword(demoPass);
    setFormError(null);
    login(demoEmail, demoPass);
  };

  return (
    <div className="relative min-h-screen w-full flex flex-col lg:flex-row bg-[#F8FAFC] dark:bg-[#0B1120] text-slate-800 dark:text-slate-100 font-sans overflow-x-hidden selection:bg-[#DC0017] selection:text-white transition-colors duration-200">
      {/* ========================================================================= */}
      {/* 1. KHU VỰC BÊN TRÁI – INDUSTRIAL BRANDING (52-54% MÀN HÌNH TRÊN DESKTOP)    */}
      {/* ========================================================================= */}
      <div className="relative w-full lg:w-[52%] xl:w-[54%] flex flex-col justify-between p-6 sm:p-10 lg:p-14 xl:p-16 min-h-[380px] sm:min-h-[460px] lg:min-h-screen overflow-hidden">
        {/* Ảnh nền Nhà máy Công nghiệp Hiện đại */}
        <img
          src="/images/factory-login-bg.jpg"
          alt="DENSO Smart Factory Floor"
          className="absolute inset-0 w-full h-full object-cover object-center scale-105 transition-transform duration-700 ease-out"
        />

        {/* Lớp phủ Dark Navy Gradient bảo đảm độ tương phản tối đa cho chữ */}
        <div className="absolute inset-0 bg-gradient-to-r from-slate-950/92 via-slate-900/82 to-slate-900/65 backdrop-blur-[0.5px]" />

        {/* Họa tiết sóng đỏ DENSO góc dưới bên trái (Geometric Wave Accent) */}
        <div className="absolute -bottom-8 -left-8 w-72 h-72 sm:w-96 sm:h-96 pointer-events-none opacity-85">
          <svg viewBox="0 0 200 200" className="w-full h-full" preserveAspectRatio="none">
            <defs>
              <linearGradient id="densoBgWave" x1="0" y1="1" x2="1" y2="0">
                <stop offset="0%" stopColor="#DC0017" stopOpacity="0.85" />
                <stop offset="60%" stopColor="#A50016" stopOpacity="0.45" />
                <stop offset="100%" stopColor="#DC0017" stopOpacity="0" />
              </linearGradient>
            </defs>
            <path d="M0,200 L0,70 C70,110 130,160 200,200 Z" fill="url(#densoBgWave)" />
            <path d="M0,200 L0,120 C50,150 95,175 160,200 Z" fill="#DC0017" opacity="0.35" />
          </svg>
        </div>

        {/* Đường cắt cong mềm mại giữa 2 panel (Desktop only - Curved Divider) */}
        <div className="hidden lg:block absolute top-0 bottom-0 -right-0.5 w-16 xl:w-24 h-full pointer-events-none z-10 text-[#F8FAFC] dark:text-[#0B1120]">
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="w-full h-full fill-current">
            <path d="M100,0 C65,30 35,70 0,100 L100,100 Z" />
          </svg>
        </div>

        {/* Nội dung thương hiệu trung tâm */}
        <div className="relative z-10 my-auto py-8 sm:py-12 space-y-4 max-w-xl animate-in fade-in duration-500">
          {/* Thanh nhấn màu đỏ DENSO */}
          <div className="w-12 h-1.5 bg-[#DC0017] rounded-full shadow-sm shadow-[#DC0017]/60" />

          {/* Tiêu đề chính */}
          <div className="space-y-0.5 sm:space-y-1">
            <h1 className="text-3xl sm:text-5xl xl:text-6xl font-black text-white tracking-tight leading-none drop-shadow-sm">
              DENSO
            </h1>
            <h2 className="text-3xl sm:text-5xl xl:text-6xl font-black text-white tracking-tight leading-none drop-shadow-sm">
              Smart Factory
            </h2>
          </div>

          {/* Dòng mô tả chi tiết */}
          <div className="space-y-0.5 pt-1.5 text-slate-200">
            <p className="text-sm sm:text-base font-medium">
              Hệ thống giám sát & quản lý thiết bị công nghiệp
            </p>
            <p className="text-xs sm:text-sm text-slate-300">
              Nhà máy DENSO Việt Nam
            </p>
          </div>
        </div>

        {/* Ba giá trị cốt lõi (3 Feature Badges) */}
        <div className="relative z-10 pt-4 sm:pt-6 border-t border-white/15">
          <div className="grid grid-cols-3 gap-2 sm:gap-4 max-w-lg">
            {/* Mục 1: Giám sát thời gian thực */}
            <div className="flex flex-col items-center text-center space-y-2 group cursor-default">
              <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-full bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center text-white transition-all duration-200 group-hover:scale-105 group-hover:border-[#DC0017]/60 shadow-xs">
                <BarChart3 className="w-5 h-5 text-white" />
              </div>
              <span className="text-[11px] sm:text-xs text-slate-200 font-medium leading-tight">
                Giám sát thời gian thực
              </span>
            </div>

            {/* Mục 2: Quản lý thiết bị */}
            <div className="flex flex-col items-center text-center space-y-2 group cursor-default">
              <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-full bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center text-white transition-all duration-200 group-hover:scale-105 group-hover:border-[#DC0017]/60 shadow-xs">
                <Settings className="w-5 h-5 text-white" />
              </div>
              <span className="text-[11px] sm:text-xs text-slate-200 font-medium leading-tight">
                Quản lý thiết bị
              </span>
            </div>

            {/* Mục 3: An toàn & ổn định */}
            <div className="flex flex-col items-center text-center space-y-2 group cursor-default">
              <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-full bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center text-white transition-all duration-200 group-hover:scale-105 group-hover:border-[#DC0017]/60 shadow-xs">
                <ShieldCheck className="w-5 h-5 text-white" />
              </div>
              <span className="text-[11px] sm:text-xs text-slate-200 font-medium leading-tight">
                An toàn & ổn định
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. KHU VỰC BÊN PHẢI – AUTHENTICATION PANEL (46-48% MÀN HÌNH TRÊN DESKTOP)  */}
      {/* ========================================================================= */}
      <div className="w-full lg:w-[48%] xl:w-[46%] flex flex-col items-center justify-center p-4 sm:p-8 lg:p-10 xl:p-12 relative z-20">
        {/* Nút chuyển đổi Theme (Sáng / Tối) góc trên bên phải */}
        <div className="absolute top-4 right-4 sm:top-6 sm:right-6 z-30">
          <button
            type="button"
            onClick={toggleTheme}
            title={theme === 'dark' ? 'Chuyển sang chế độ Sáng' : 'Chuyển sang chế độ Tối'}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white shadow-xs cursor-pointer transition-all hover:scale-105"
          >
            {theme === 'dark' ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4 text-amber-500" />}
          </button>
        </div>

        {/* THẺ ĐĂNG NHẬP CHÍNH (AUTHENTICATION FLOATING CARD) */}
        <div className="w-full max-w-[430px] sm:max-w-[450px] bg-white dark:bg-slate-900 rounded-[28px] p-6 sm:p-9 shadow-xl shadow-slate-200/50 dark:shadow-black/50 border border-slate-100 dark:border-slate-800/80 relative overflow-hidden transition-all duration-300">
          {/* Họa tiết dải ruy-băng đỏ DENSO góc trên bên phải của card */}
          <div className="absolute top-0 right-0 w-24 h-24 sm:w-28 sm:h-28 pointer-events-none overflow-hidden rounded-tr-[28px]">
            <svg viewBox="0 0 100 100" className="absolute top-0 right-0 w-full h-full" preserveAspectRatio="none">
              <defs>
                <linearGradient id="cardRedCorner" x1="1" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#DC0017" />
                  <stop offset="70%" stopColor="#A50016" />
                  <stop offset="100%" stopColor="#DC0017" stopOpacity="0" />
                </linearGradient>
              </defs>
              <path d="M100,0 L35,0 C65,15 75,55 100,85 Z" fill="url(#cardRedCorner)" opacity="0.95" />
              <path d="M100,0 L58,0 C78,12 88,40 100,65 Z" fill="#DC0017" opacity="0.55" />
            </svg>
          </div>

          {/* Đầu card: Logo DENSO & Khẩu hiệu */}
          <div className="flex flex-col items-center text-center">
            <img
              src="/images/denso-logo-clean.png"
              alt="DENSO"
              className="h-8 sm:h-9 object-contain"
            />
            <span className="text-[11px] sm:text-xs font-semibold text-slate-800 dark:text-slate-200 tracking-wider mt-1">
              Crafting the Core
            </span>

            <h3 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight mt-4">
              Đăng nhập hệ thống
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-medium">
              DENSO Smart Factory – Industrial IoT Monitoring
            </p>
          </div>

          {/* Thông báo lỗi nếu đăng nhập thất bại */}
          {(formError || error) && (
            <div className="mt-4 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 text-rose-600 dark:text-rose-400 text-xs font-medium flex items-start gap-2 animate-in fade-in duration-200">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-500" />
              <span className="flex-1">{formError || error}</span>
            </div>
          )}

          {/* Form nhập liệu */}
          <form onSubmit={handleSubmit} className="mt-5 space-y-3.5">
            {/* Trường Email / Tên đăng nhập */}
            <div className="space-y-1">
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Email hoặc tên đăng nhập"
                  autoComplete="username"
                  className="w-full pl-10 pr-3.5 py-2.5 sm:py-3 text-xs sm:text-sm rounded-xl border border-slate-200 dark:border-slate-700/80 bg-white dark:bg-slate-900/90 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-[#DC0017] focus:ring-2 focus:ring-[#DC0017]/20 transition-all"
                />
              </div>
            </div>

            {/* Trường Mật khẩu */}
            <div className="space-y-1">
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type={isVisiblePassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Mật khẩu"
                  autoComplete="current-password"
                  className="w-full pl-10 pr-10 py-2.5 sm:py-3 text-xs sm:text-sm rounded-xl border border-slate-200 dark:border-slate-700/80 bg-white dark:bg-slate-900/90 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-[#DC0017] focus:ring-2 focus:ring-[#DC0017]/20 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setIsVisiblePassword(!isVisiblePassword)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 focus:outline-none cursor-pointer"
                  aria-label={isVisiblePassword ? 'Ẩn mật khẩu' : 'Hiển thị mật khẩu'}
                >
                  {isVisiblePassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Dòng Ghi nhớ đăng nhập & Quên mật khẩu */}
            <div className="flex items-center justify-between text-xs pt-0.5">
              <label className="flex items-center gap-2 cursor-pointer select-none text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="w-3.5 h-3.5 rounded border-slate-300 text-[#DC0017] focus:ring-[#DC0017] cursor-pointer"
                />
                <span className="text-[11px] sm:text-xs">Ghi nhớ đăng nhập</span>
              </label>

              <button
                type="button"
                onClick={() => setShowForgotPasswordModal(true)}
                className="text-[11px] sm:text-xs font-semibold text-[#DC0017] hover:text-[#A50016] hover:underline cursor-pointer transition-colors"
              >
                Quên mật khẩu?
              </button>
            </div>

            {/* Nút Đăng nhập chính */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-2.5 sm:py-3 px-4 rounded-xl bg-[#DC0017] hover:bg-[#B80013] active:bg-[#A50016] text-white font-bold text-xs sm:text-sm shadow-md shadow-rose-600/30 flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed hover:shadow-lg hover:shadow-rose-600/40 mt-2"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Đang xác thực...</span>
                </>
              ) : (
                <>
                  <LogIn className="w-4 h-4" />
                  <span>Đăng nhập</span>
                </>
              )}
            </button>
          </form>

          {/* Dòng phân cách vai trò */}
          <div className="relative flex items-center justify-center my-4">
            <div className="border-t border-slate-200 dark:border-slate-800 w-full" />
            <span className="bg-white dark:bg-slate-900 px-3 text-[10px] sm:text-[11px] font-medium text-slate-400 whitespace-nowrap">
              Hoặc đăng nhập với vai trò
            </span>
            <div className="border-t border-slate-200 dark:border-slate-800 w-full" />
          </div>

          {/* Hai nút phân quyền: ADMIN & OPERATOR */}
          <div className="grid grid-cols-2 gap-2 sm:gap-2.5">
            {/* Nút ADMIN */}
            <button
              type="button"
              onClick={() => handleQuickLogin('admin@denso.com', 'admin123')}
              disabled={isLoading}
              className="p-2.5 sm:p-3 rounded-2xl border border-emerald-500/30 bg-emerald-50/60 hover:bg-emerald-100/70 dark:bg-emerald-950/20 dark:hover:bg-emerald-950/40 text-left transition-all cursor-pointer group hover:scale-[1.02] shadow-2xs"
            >
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-xl bg-emerald-100 dark:bg-emerald-900/60 flex items-center justify-center text-emerald-700 dark:text-emerald-400 shrink-0">
                  <User className="w-3.5 h-3.5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-bold text-[11px] sm:text-xs text-emerald-700 dark:text-emerald-400 truncate">
                    ADMIN
                  </div>
                  <div className="text-[9px] sm:text-[10px] text-slate-500 dark:text-slate-400 truncate">
                    Quản trị hệ thống
                  </div>
                </div>
              </div>
            </button>

            {/* Nút OPERATOR */}
            <button
              type="button"
              onClick={() => handleQuickLogin('user@denso.com', 'user123')}
              disabled={isLoading}
              className="p-2.5 sm:p-3 rounded-2xl border border-blue-500/30 bg-blue-50/60 hover:bg-blue-100/70 dark:bg-blue-950/20 dark:hover:bg-blue-950/40 text-left transition-all cursor-pointer group hover:scale-[1.02] shadow-2xs"
            >
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-xl bg-blue-100 dark:bg-blue-900/60 flex items-center justify-center text-blue-700 dark:text-blue-400 shrink-0">
                  <HardHat className="w-3.5 h-3.5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-bold text-[11px] sm:text-xs text-blue-700 dark:text-blue-400 truncate">
                    OPERATOR
                  </div>
                  <div className="text-[9px] sm:text-[10px] text-slate-500 dark:text-slate-400 truncate">
                    Vận hành & giám sát
                  </div>
                </div>
              </div>
            </button>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 3. MODAL HƯỚNG DẪN QUÊN MẬT KHẨU (DOANH NGHIỆP NỘI BỘ - SECTION 5.6)       */}
      {/* ========================================================================= */}
      {showForgotPasswordModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2 text-slate-900 dark:text-white font-bold text-sm">
                <HelpCircle className="w-4 h-4 text-[#DC0017]" />
                <span>Hướng dẫn khôi phục mật khẩu</span>
              </div>
              <button
                type="button"
                onClick={() => setShowForgotPasswordModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="text-xs text-slate-600 dark:text-slate-300 space-y-2.5 leading-relaxed">
              <p>
                Hệ thống <strong>DENSO Smart Factory (KaiLink)</strong> áp dụng quy định bảo mật công nghiệp với cơ chế xác thực nội bộ tập trung.
              </p>
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-mono text-[11px] space-y-1">
                <div>📧 Quản trị viên: <strong>admin@denso.com</strong></div>
                <div>🏢 Đơn vị: Phòng Tự động hóa &amp; IT Nhà máy DENSO</div>
              </div>
              <p>
                Để đảm bảo an toàn vận hành sản xuất, nhân viên vui lòng liên hệ trực tiếp Quản trị viên hoặc Trưởng ca để được cấp lại mật khẩu truy cập.
              </p>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setShowForgotPasswordModal(false)}
                className="px-4 py-2 rounded-xl bg-[#DC0017] hover:bg-[#B80013] text-white text-xs font-bold transition-colors cursor-pointer"
              >
                Đã hiểu
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
