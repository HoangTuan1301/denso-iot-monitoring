/**
 * @file MainLayout.tsx
 * @description Layout tổng thể chuẩn công nghiệp: Sidebar cố định bên trái, Header điều hành phía trên, Main Content ở giữa
 */

import React from 'react';
import { Sidebar } from '../components/common/Sidebar';
import { Header } from '../components/common/Header';

interface MainLayoutProps {
  children: React.ReactNode;
}

export function MainLayout({ children }: MainLayoutProps) {
  return (
    <div className="flex h-screen w-full overflow-hidden bg-factory-bg text-foreground font-sans antialiased">
      {/* Sidebar điều hướng cố định bên trái */}
      <Sidebar />

      {/* Vùng nội dung chính bên phải */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Header điều hành phía trên */}
        <Header />

        {/* Nội dung trang có thanh cuộn riêng */}
        <main className="flex-1 overflow-y-auto p-6 md:p-8 space-y-6">
          {children}
        </main>
      </div>
    </div>
  );
}
