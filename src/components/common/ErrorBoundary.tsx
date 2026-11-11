/**
 * @file ErrorBoundary.tsx
 * @description Rào chắn bắt lỗi React Runtime (Error Boundary) chuẩn công nghiệp
 * Ngăn chặn tuyệt đối tình trạng "màn hình trắng" (White Screen of Death)
 * Bắt lỗi tại chỗ và cung cấp nút phục hồi an toàn về Dashboard Tổng quan
 */

import { Component, ErrorInfo, ReactNode } from 'react';
import { AlertOctagon, RotateCcw, Home } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
  onReset?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[React ErrorBoundary caught error]:', error, errorInfo);
    this.setState({ errorInfo });
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    if (this.props.onReset) {
      this.props.onReset();
    } else {
      window.location.hash = '';
      window.location.reload();
    }
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-[400px] flex items-center justify-center p-6 animate-in fade-in duration-200">
          <div className="w-full max-w-xl p-6 rounded-2xl border border-rose-200 dark:border-rose-900/60 bg-white dark:bg-factory-card shadow-lg text-center space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 flex items-center justify-center mx-auto border border-rose-200 dark:border-rose-800">
              <AlertOctagon className="w-6 h-6" />
            </div>

            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                {this.props.fallbackTitle || 'Đã xảy ra sự cố khi hiển thị màn hình này'}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-md mx-auto">
                Hệ thống đã tự động chặn lỗi và bảo vệ phiên làm việc của bạn. Không phát sinh mất mát dữ liệu hoặc gián đoạn luồng giám sát.
              </p>
            </div>

            {this.state.error && (
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 text-left font-mono text-[11px] text-rose-600 dark:text-rose-400 max-h-32 overflow-y-auto">
                <p className="font-bold">{this.state.error.name}: {this.state.error.message}</p>
                {this.state.error.stack && (
                  <pre className="text-[10px] text-slate-400 mt-1 whitespace-pre-wrap">
                    {this.state.error.stack.slice(0, 300)}...
                  </pre>
                )}
              </div>
            )}

            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={this.handleReset}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all shadow-sm cursor-pointer"
              >
                <Home className="w-4 h-4" />
                <span>Quay lại Dashboard Tổng quan</span>
              </button>

              <button
                type="button"
                onClick={() => window.location.reload()}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 text-xs font-semibold transition-all cursor-pointer"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Tải lại trang</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
