/**
 * @file LoginPage.tsx
 * @description Màn hình Đăng nhập Xác thực JWT & Phân quyền Doanh nghiệp (Enterprise Login)
 * Thiết kế chuẩn phong cách Nhà máy Công nghiệp Denso IoT, hỗ trợ 2 tài khoản mặc định (Admin / Operator)
 */

import React, { useState } from 'react';
import {
  Card,
  CardBody,
  Button,
  Input,
  Chip,
} from '@heroui/react';
import {
  ShieldCheck,
  Lock,
  Mail,
  Eye,
  EyeOff,
  Activity,
  Cpu,
  Server,
  KeyRound,
  Sun,
  Moon,
} from 'lucide-react';
import { useAuthStore } from '../../stores/useAuthStore';
import { useThemeStore } from '../../stores/useThemeStore';

export function LoginPage() {
  const { login, isLoading, error } = useAuthStore();
  const { theme, toggleTheme } = useThemeStore();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isVisiblePassword, setIsVisiblePassword] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!email.trim() || !password.trim()) {
      setFormError('Vui lòng nhập đầy đủ Email và Mật khẩu.');
      return;
    }

    const success = await login(email, password);
    if (!success) {
      setFormError(error || 'Đăng nhập không thành công. Vui lòng kiểm tra lại thông tin.');
    }
  };

  // Nút đăng nhập nhanh cho buổi thuyết trình Demo
  const handleQuickLogin = (demoEmail: string, demoPass: string) => {
    setEmail(demoEmail);
    setPassword(demoPass);
    login(demoEmail, demoPass);
  };

  return (
    <div className="relative min-h-screen w-full flex items-center justify-center p-4 bg-factory-bg transition-colors duration-200">
      {/* Nút đổi Theme nhanh ở góc trên bên phải */}
      <div className="absolute top-4 right-4 z-20">
        <button
          onClick={toggleTheme}
          title={theme === 'dark' ? 'Chuyển sang Sáng' : 'Chuyển sang Tối'}
          className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 dark:border-factory-border bg-factory-card text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white shadow-xs cursor-pointer transition-colors"
        >
          {theme === 'dark' ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4 text-amber-500" />}
        </button>
      </div>

      {/* Hiệu ứng tia sáng nền Ambient */}
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md space-y-6 z-10">
        {/* Logo & Tiêu đề hệ thống */}
        <div className="text-center space-y-2">
          <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-400 text-white shadow-xl shadow-emerald-500/30">
            <span className="font-black text-2xl tracking-tighter">D</span>
          </div>
          <div>
            <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
              DENSO SMART FACTORY
            </h1>
            <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 font-medium">
              Hệ Thống Giám Sát Nhà Máy & Thiết Bị IoT 3 Tầng
            </p>
          </div>
          <div className="flex items-center justify-center gap-2 pt-1">
            <Chip size="sm" color="success" variant="flat" className="text-[10px] font-bold">
              ENTERPRISE v2.6
            </Chip>
            <Chip size="sm" color="default" variant="flat" className="text-[10px] font-mono">
              JWT &bull; RBAC &bull; WS
            </Chip>
          </div>
        </div>

        {/* Khung Card Form Đăng nhập */}
        <Card className="bg-factory-card border border-factory-border shadow-xl rounded-2xl p-6">
          <CardBody className="p-0 space-y-5">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Đăng Nhập Hệ Thống
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Vui lòng nhập tài khoản nhân viên được cấp quyền để truy cập
              </p>
            </div>

            {/* Thông báo lỗi nếu có */}
            {(formError || error) && (
              <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-500/30 text-rose-600 dark:text-rose-400 text-xs font-medium animate-shake">
                {formError || error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Email Nhân Viên:
                </label>
                <Input
                  type="email"
                  size="md"
                  placeholder="admin@denso.com hoặc user@denso.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  startContent={<Mail className="w-4 h-4 text-slate-400" />}
                  classNames={{
                    input: 'text-xs',
                    inputWrapper: 'bg-slate-100 dark:bg-factory-bg border border-slate-200 dark:border-factory-border h-10',
                  }}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Mật Khẩu:
                </label>
                <Input
                  type={isVisiblePassword ? 'text' : 'password'}
                  size="md"
                  placeholder="Nhập mật khẩu..."
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  startContent={<Lock className="w-4 h-4 text-slate-400" />}
                  endContent={
                    <button
                      type="button"
                      onClick={() => setIsVisiblePassword(!isVisiblePassword)}
                      className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 focus:outline-none cursor-pointer"
                    >
                      {isVisiblePassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  }
                  classNames={{
                    input: 'text-xs',
                    inputWrapper: 'bg-slate-100 dark:bg-factory-bg border border-slate-200 dark:border-factory-border h-10',
                  }}
                />
              </div>

              <Button
                type="submit"
                size="md"
                color="primary"
                variant="solid"
                isLoading={isLoading}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs h-10 shadow-md shadow-emerald-600/25 mt-2"
                startContent={!isLoading && <KeyRound className="w-4 h-4" />}
              >
                {isLoading ? 'Đang xác thực...' : 'Đăng Nhập'}
              </Button>
            </form>

            {/* Khu vực Chọn Nhanh Tài Khoản Demo */}
            <div className="pt-4 border-t border-slate-200 dark:border-factory-border space-y-2.5">
              <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider text-center">
                Tài Khoản Mặc Định (Demo Phân Quyền)
              </p>

              <div className="grid grid-cols-2 gap-2">
                {/* Nút Demo 1: Admin */}
                <button
                  type="button"
                  onClick={() => handleQuickLogin('admin@denso.com', 'admin123')}
                  className="p-2.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/20 text-left transition-all cursor-pointer group"
                >
                  <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-700 dark:text-emerald-400">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span>ADMIN</span>
                  </div>
                  <p className="text-[11px] font-mono text-slate-700 dark:text-slate-300 mt-1 truncate">
                    admin@denso.com
                  </p>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                    Toàn quyền hệ thống
                  </p>
                </button>

                {/* Nút Demo 2: Operator */}
                <button
                  type="button"
                  onClick={() => handleQuickLogin('user@denso.com', 'user123')}
                  className="p-2.5 rounded-xl border border-blue-500/30 bg-blue-500/10 hover:bg-blue-500/20 text-left transition-all cursor-pointer group"
                >
                  <div className="flex items-center gap-1.5 text-xs font-bold text-blue-700 dark:text-blue-400">
                    <Activity className="w-3.5 h-3.5" />
                    <span>OPERATOR</span>
                  </div>
                  <p className="text-[11px] font-mono text-slate-700 dark:text-slate-300 mt-1 truncate">
                    user@denso.com
                  </p>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                    Vận hành & giám sát
                  </p>
                </button>
              </div>
            </div>
          </CardBody>
        </Card>

        {/* Footer bảo mật */}
        <div className="flex items-center justify-center gap-4 text-[11px] text-slate-500 dark:text-slate-400 font-mono">
          <span className="flex items-center gap-1">
            <Server className="w-3 h-3 text-emerald-500" />
            <span>PLC Server Online</span>
          </span>
          <span>&bull;</span>
          <span className="flex items-center gap-1">
            <Cpu className="w-3 h-3 text-blue-500" />
            <span>WebSocket Live</span>
          </span>
        </div>
      </div>
    </div>
  );
}
