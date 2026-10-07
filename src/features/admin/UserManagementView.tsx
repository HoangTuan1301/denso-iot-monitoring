/**
 * @file UserManagementView.tsx
 * @description Trang Quản lý Người dùng & Phân quyền Doanh nghiệp (Enterprise RBAC)
 * CSDL MySQL: denso_iot@localhost:3306
 * - 3 Thẻ Thống kê Top-Card: Tổng tài khoản, Quyền SỬA (Admin), Quyền XEM (Operator)
 * - Bảng Danh sách Tài khoản: Avatar 2 chữ cái đầu, "Bạn đang đăng nhập", Dropdown Đổi quyền trực tiếp,
 *   Phạm vi thấy được (9 màn / 3 màn), Công tắc Kích hoạt CustomSwitch, Reset mật khẩu 123456, Xóa tài khoản MySQL.
 */

import React, { useState, useEffect } from 'react';
import {
  Button,
  Input,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
} from '@heroui/react';
import {
  Users,
  UserPlus,
  Shield,
  ShieldCheck,
  Eye,
  Search,
  CheckCircle2,
  AlertCircle,
  Pencil,
  Trash2,
  Camera,
  RotateCcw,
  KeyRound,
  AlertTriangle,
  Info,
  X,
} from 'lucide-react';
import { CustomSwitch } from '../../components/common/CustomSwitch';
import { apiClient } from '../../services/api';
import { socketClient } from '../../services/socket';
import { useAuthStore } from '../../stores/useAuthStore';
import { UserProfile, UserRole } from '../../types/auth';

/**
 * Trích xuất 2 chữ cái đầu từ họ tên nhân viên
 * Ví dụ: "Hoàng Minh Hải" -> "MH", "Trần Quang Huy" -> "QH"
 */
function getTwoInitials(name?: string, fallback = 'DN'): string {
  if (!name || !name.trim()) return fallback;
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 1) {
    return words[0].substring(0, 2).toUpperCase();
  }
  return (words[words.length - 2][0] + words[words.length - 1][0]).toUpperCase();
}

export function UserManagementView() {
  const { currentUser } = useAuthStore();

  const [users, setUsers] = useState<UserProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [selectedRoleFilter, setSelectedRoleFilter] = useState<'all' | 'ADMIN' | 'OPERATOR'>('all');

  // Modal Thêm / Chỉnh Sửa Nhân Viên
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);

  // Form State
  const [username, setUsername] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState<UserRole>('OPERATOR');
  const [uploadingUserId, setUploadingUserId] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Modal Xác nhận Reset Mật Khẩu
  const [resettingUser, setResettingUser] = useState<UserProfile | null>(null);
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

  // Modal Xác nhận Xóa Tài Khoản
  const [deletingUser, setDeletingUser] = useState<UserProfile | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Thông báo phản hồi thao tác nhanh (Toast / Notice)
  const [feedbackNotice, setFeedbackNotice] = useState<{
    type: 'success' | 'error' | 'info';
    message: string;
  } | null>(null);

  const showFeedback = (type: 'success' | 'error' | 'info', message: string) => {
    setFeedbackNotice({ type, message });
    setTimeout(() => {
      setFeedbackNotice(null);
    }, 4000);
  };

  // Tải danh sách người dùng từ API Backend MySQL
  const loadUsers = async () => {
    setIsLoading(true);
    try {
      const res = await apiClient.getUsers();
      setUsers(res.users);
    } catch {
      // Mock fallback nếu máy chủ chưa mở
      setUsers([
        {
          id: 'usr-admin-01',
          employeeId: 'DNS-1001',
          email: 'admin@denso.com',
          name: 'Hoàng Minh Hải',
          fullName: 'Hoàng Minh Hải',
          role: 'ADMIN',
          assignedLineId: 'ALL',
          status: 'active',
          lastLoginAt: new Date().toISOString(),
        },
        {
          id: 'usr-operator-01',
          employeeId: 'DNS-1024',
          email: 'user@denso.com',
          name: 'Trần Quang Huy',
          fullName: 'Trần Quang Huy',
          role: 'OPERATOR',
          assignedLineId: 'LINE-01',
          status: 'active',
          lastLoginAt: '2026-09-28T07:30:00.000Z',
        },
        {
          id: 'usr-maint-01',
          employeeId: 'DNS-1088',
          email: 'tech@denso.com',
          name: 'Lê Văn Tiến',
          fullName: 'Lê Văn Tiến',
          role: 'OPERATOR',
          assignedLineId: 'LINE-02',
          status: 'active',
          lastLoginAt: '2026-09-27T14:15:00.000Z',
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();

    // Lắng nghe cập nhật thời gian thực từ WebSocket
    const unsubAvatar = socketClient.on('user_avatar_updated', (data: any) => {
      setUsers((prev) =>
        prev.map((u) => (u.id === data.userId ? { ...u, avatarUrl: data.avatarUrl } : u))
      );
    });

    const unsubCreated = socketClient.on('user_created', (data: any) => {
      setUsers((prev) => {
        if (prev.some((u) => u.id === data.user.id)) return prev;
        return [...prev, data.user];
      });
    });

    const unsubUpdated = socketClient.on('user_updated', (data: any) => {
      setUsers((prev) =>
        prev.map((u) => (u.id === data.user.id ? { ...u, ...data.user } : u))
      );
    });

    const unsubDeleted = socketClient.on('user_deleted', (data: any) => {
      setUsers((prev) => prev.filter((u) => u.id !== data.userId));
    });

    return () => {
      unsubAvatar();
      unsubCreated();
      unsubUpdated();
      unsubDeleted();
    };
  }, []);

  // Upload Avatar trực tiếp
  const handleDirectAvatarUpload = async (userId: string, file: File) => {
    try {
      setUploadingUserId(userId);
      const res = await apiClient.uploadAvatar(file, userId);
      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, avatarUrl: res.avatarUrl } : u))
      );
      showFeedback('success', 'Đã cập nhật ảnh đại diện thành công.');
    } catch (err: any) {
      showFeedback('error', err.message || 'Lỗi khi tải ảnh đại diện.');
    } finally {
      setUploadingUserId(null);
    }
  };

  // Đổi vai trò trực tiếp trên từng dòng bảng (Select Dropdown)
  const handleRoleChange = async (user: UserProfile, newRole: UserRole) => {
    const isCurrent = user.id === currentUser?.id || user.email === currentUser?.email;
    if (isCurrent && newRole !== 'ADMIN') {
      showFeedback('error', 'Bạn không thể tự hạ quyền Admin của chính mình!');
      return;
    }

    try {
      // Cập nhật giao diện ngay lập tức
      setUsers((prev) =>
        prev.map((u) => (u.id === user.id ? { ...u, role: newRole } : u))
      );
      await apiClient.updateUser(user.id, { role: newRole });
      showFeedback(
        'success',
        `Đã chuyển quyền của nhân viên "${user.fullName || user.name}" thành ${
          newRole === 'ADMIN' ? 'SỬA (Quản trị)' : 'XEM (Vận hành)'
        }.`
      );
    } catch (err: any) {
      showFeedback('error', err.message || 'Lỗi khi cập nhật quyền tài khoản.');
      loadUsers();
    }
  };

  // Bật / Khóa tài khoản (CustomSwitch kích hoạt)
  const handleToggleStatus = async (user: UserProfile, currentActive: boolean) => {
    const isCurrent = user.id === currentUser?.id || user.email === currentUser?.email;
    if (isCurrent) {
      showFeedback('error', 'Không thể tự khóa tài khoản của chính mình!');
      return;
    }

    const nextStatus = currentActive ? 'INACTIVE' : 'ACTIVE';
    try {
      setUsers((prev) =>
        prev.map((u) => (u.id === user.id ? { ...u, status: nextStatus.toLowerCase() as any } : u))
      );
      await apiClient.updateUser(user.id, { status: nextStatus as any });
      showFeedback(
        'success',
        `Tài khoản "${user.fullName || user.name}" đã được ${
          nextStatus === 'ACTIVE' ? 'KÍCH HOẠT hoạt động' : 'TẠM KHÓA thành công'
        }.`
      );
    } catch (err: any) {
      showFeedback('error', err.message || 'Lỗi khi thay đổi trạng thái tài khoản.');
      loadUsers();
    }
  };

  // Xử lý Đặt lại mật khẩu mặc định (123456)
  const confirmResetPassword = async () => {
    if (!resettingUser) return;
    setIsResetting(true);
    try {
      const res = await apiClient.resetPassword(resettingUser.id, '123456');
      setIsResetModalOpen(false);
      showFeedback(
        'success',
        res.message || `Đã đặt lại mật khẩu của ${resettingUser.fullName || resettingUser.name} về: 123456`
      );
      setResettingUser(null);
    } catch (err: any) {
      showFeedback('error', err.message || 'Lỗi khi đặt lại mật khẩu.');
    } finally {
      setIsResetting(false);
    }
  };

  // Xử lý Xóa tài khoản vĩnh viễn khỏi MySQL
  const confirmDeleteUser = async () => {
    if (!deletingUser) return;
    if (deletingUser.id === currentUser?.id || deletingUser.email === currentUser?.email) {
      showFeedback('error', 'Không thể tự xóa tài khoản của chính bạn!');
      setIsDeleteModalOpen(false);
      return;
    }

    setIsDeleting(true);
    try {
      await apiClient.deleteUser(deletingUser.id);
      setUsers((prev) => prev.filter((u) => u.id !== deletingUser.id));
      setIsDeleteModalOpen(false);
      showFeedback('success', `Đã xóa tài khoản "${deletingUser.fullName || deletingUser.name}" khỏi CSDL MySQL.`);
      setDeletingUser(null);
    } catch (err: any) {
      showFeedback('error', err.message || 'Lỗi khi xóa tài khoản.');
    } finally {
      setIsDeleting(false);
    }
  };

  // Mở modal tạo mới
  const openCreateModal = () => {
    setEditingUser(null);
    setUsername('');
    setFullName('');
    setRole('OPERATOR');
    setFormError(null);
    setIsModalOpen(true);
  };

  // Mở modal chỉnh sửa
  const openEditModal = (user: UserProfile) => {
    setEditingUser(user);
    const uName = user.email ? user.email.split('@')[0] : user.employeeId;
    setUsername(uName);
    setFullName(user.fullName || user.name);
    setRole(String(user.role).toUpperCase() === 'ADMIN' ? 'ADMIN' : 'OPERATOR');
    setFormError(null);
    setIsModalOpen(true);
  };

  // Submit Form Tạo / Chỉnh sửa
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const cleanUsername = username.trim();
    const cleanFullName = fullName.trim();

    if (!cleanUsername || !cleanFullName) {
      setFormError('Vui lòng điền đầy đủ thông tin bắt buộc (Username, Họ tên).');
      return;
    }

    setIsSubmitting(true);
    try {
      if (editingUser) {
        await apiClient.updateUser(editingUser.id, {
          fullName: cleanFullName,
          name: cleanFullName,
          role,
        });
        showFeedback('success', `Đã cập nhật thông tin người dùng "${cleanFullName}".`);
      } else {
        const payload = {
          username: cleanUsername,
          fullName: cleanFullName,
          role,
          status: 'ACTIVE',
        };
        const res = await apiClient.createUser(payload);
        showFeedback('success', res.message || `Đã thêm người dùng "${cleanFullName}" thành công.`);
      }

      setIsModalOpen(false);
      await loadUsers();
    } catch (err: any) {
      const errorMsg = err.message || 'Lỗi khi lưu thông tin người dùng.';
      setFormError(errorMsg);
      showFeedback('error', errorMsg);
    } finally {
      setIsSubmitting(false);
    }
  };

  // =========================================================================
  // TÍNH TOÁN CÁC THỐNG KÊ TOP-CARD
  // =========================================================================
  const totalCount = users.length;
  const activeCount = users.filter((u) => (u.status || 'ACTIVE').toUpperCase() === 'ACTIVE').length;
  const inactiveCount = totalCount - activeCount;

  const adminCount = users.filter((u) => String(u.role).toUpperCase() === 'ADMIN').length;
  const operatorCount = users.filter((u) => String(u.role).toUpperCase() !== 'ADMIN').length;

  const isCurrentUserAdmin = (currentUser?.role || '').toUpperCase() === 'ADMIN';

  // Lọc danh sách hiển thị
  const filteredUsers = users.filter((u) => {
    const roleUpper = String(u.role).toUpperCase();
    let matchRole = true;
    if (selectedRoleFilter === 'ADMIN') {
      matchRole = roleUpper === 'ADMIN';
    } else if (selectedRoleFilter === 'OPERATOR') {
      matchRole = roleUpper !== 'ADMIN';
    }

    const q = searchKeyword.toLowerCase().trim();
    const matchSearch =
      q === '' ||
      u.employeeId.toLowerCase().includes(q) ||
      (u.fullName || u.name || '').toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q);

    return matchRole && matchSearch;
  });

  // Nếu tài khoản hiện tại không phải là ADMIN, chặn hiển thị hoặc thông báo không có quyền
  if (!isCurrentUserAdmin) {
    return (
      <div className="p-8 text-center bg-white dark:bg-slate-800 rounded-2xl border border-rose-500/20 shadow-sm max-w-xl mx-auto my-12">
        <div className="w-12 h-12 rounded-2xl bg-rose-500/10 text-rose-600 border border-rose-500/20 flex items-center justify-center mx-auto mb-4">
          <AlertTriangle className="w-6 h-6" />
        </div>
        <h2 className="text-lg font-bold text-slate-900 dark:text-white">
          Truy Cập Bị Giới Hạn (403 Forbidden)
        </h2>
        <p className="text-xs text-slate-600 dark:text-slate-400 mt-2 leading-relaxed">
          Phân hệ Quản Lý Người Dùng & Phân Quyền chỉ dành riêng cho tài khoản có vai trò <strong>Quản Trị Viên (ADMIN)</strong>. Tài khoản của bạn hiện là <strong>{currentUser?.role || 'OPERATOR'}</strong> và không có quyền thực hiện hoặc sửa đổi thông tin người dùng.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Banner Thông Báo Tác Vụ Nhanh (Feedback Toast) */}
      {feedbackNotice && (
        <div
          className={`p-3.5 rounded-xl border flex items-center justify-between text-xs font-semibold shadow-md transition-all ${
            feedbackNotice.type === 'success'
              ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-500/30 text-emerald-800 dark:text-emerald-300'
              : feedbackNotice.type === 'error'
              ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-500/30 text-rose-800 dark:text-rose-300'
              : 'bg-blue-50 dark:bg-blue-950/40 border-blue-500/30 text-blue-800 dark:text-blue-300'
          }`}
        >
          <div className="flex items-center gap-2">
            {feedbackNotice.type === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />}
            {feedbackNotice.type === 'error' && <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />}
            {feedbackNotice.type === 'info' && <Info className="w-4 h-4 text-blue-600 shrink-0" />}
            <span>{feedbackNotice.message}</span>
          </div>
          <button
            onClick={() => setFeedbackNotice(null)}
            className="text-slate-400 hover:text-slate-700 dark:hover:text-white transition-colors"
          >
            ✕
          </button>
        </div>
      )}

      {/* Tiêu đề & Nút Thêm Nhân Viên */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded text-xs font-bold bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30">
              PHÂN HỆ QUẢN TRỊ & PHÂN QUYỀN
            </span>
            <h1 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">
              Quản Lý Người Dùng & Phân Quyền
            </h1>
          </div>
          <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
            Quản trị tài khoản MySQL, cấu hình vai trò SỬA/XEM và phân bổ phạm vi giám sát nhà máy Denso.
          </p>
        </div>

        <button
          onClick={openCreateModal}
          className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-medium shadow-sm transition-all cursor-pointer text-xs sm:text-sm"
        >
          <UserPlus className="w-4 h-4 shrink-0" />
          <span>+ Thêm người dùng</span>
        </button>
      </div>

      {/* ========================================================================= */}
      {/* 1. CẤU TRÚC 3 THẺ THỐNG KÊ TOP-CARD                                        */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Thẻ 1: Tổng tài khoản */}
        <div className="flex items-center justify-between p-5 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm transition-colors">
          <div className="flex-1 min-w-0 pr-3">
            <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Tổng tài khoản
            </p>
            <p className="font-mono text-3xl font-extrabold text-slate-900 dark:text-white mt-1 leading-none">
              {totalCount}
            </p>
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-2 truncate">
              <span className="text-emerald-600 dark:text-emerald-400 font-semibold">{activeCount} đang hoạt động</span>
              {' · '}
              <span className="text-slate-500 dark:text-slate-400">{inactiveCount} bị khóa</span>
            </p>
          </div>
          <div className="shrink-0 w-12 h-12 rounded-xl flex items-center justify-center bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200/80 dark:border-slate-600">
            <Users className="w-6 h-6" />
          </div>
        </div>

        {/* Thẻ 2: Quyền SỬA (Admin) */}
        <div className="flex items-center justify-between p-5 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm transition-colors">
          <div className="flex-1 min-w-0 pr-3">
            <p className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
              Quyền SỬA (Admin)
            </p>
            <p className="font-mono text-3xl font-extrabold text-emerald-600 dark:text-emerald-400 mt-1 leading-none">
              {adminCount}
            </p>
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-2 truncate">
              Quản trị & cấu hình hệ thống
            </p>
          </div>
          <div className="shrink-0 w-12 h-12 rounded-xl flex items-center justify-center bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
            <Shield className="w-6 h-6" />
          </div>
        </div>

        {/* Thẻ 3: Quyền XEM (Operator) */}
        <div className="flex items-center justify-between p-5 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm transition-colors">
          <div className="flex-1 min-w-0 pr-3">
            <p className="text-[11px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider">
              Quyền XEM (Operator)
            </p>
            <p className="font-mono text-3xl font-extrabold text-blue-600 dark:text-blue-400 mt-1 leading-none">
              {operatorCount}
            </p>
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-2 truncate">
              Đội vận hành theo dõi
            </p>
          </div>
          <div className="shrink-0 w-12 h-12 rounded-xl flex items-center justify-center bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
            <Eye className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. BẢNG DANH SÁCH NGƯỜI DÙNG & PHÂN QUYỀN                                 */}
      {/* ========================================================================= */}
      <div className="bg-factory-card rounded-2xl border border-factory-border p-5 space-y-4 shadow-xs">
        {/* Thanh công cụ tìm kiếm và lọc */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-factory-border pb-4">
          <div className="flex items-center gap-2 flex-1 max-w-sm">
            <Input
              size="sm"
              placeholder="Tìm theo Mã NV, họ tên, email..."
              value={searchKeyword}
              onChange={(e) => setSearchKeyword(e.target.value)}
              startContent={<Search className="w-4 h-4 text-slate-400" />}
              isClearable
              onClear={() => setSearchKeyword('')}
              classNames={{
                input: 'text-xs',
                inputWrapper: 'bg-slate-100 dark:bg-factory-bg border border-slate-200 dark:border-factory-border h-9 rounded-xl',
              }}
            />
          </div>

          <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-factory-bg p-1 rounded-xl border border-slate-200 dark:border-factory-border text-xs">
            <button
              onClick={() => setSelectedRoleFilter('all')}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer ${
                selectedRoleFilter === 'all'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Tất cả ({totalCount})
            </button>
            <button
              onClick={() => setSelectedRoleFilter('ADMIN')}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer ${
                selectedRoleFilter === 'ADMIN'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Quyền SỬA ({adminCount})
            </button>
            <button
              onClick={() => setSelectedRoleFilter('OPERATOR')}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer ${
                selectedRoleFilter === 'OPERATOR'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Quyền XEM ({operatorCount})
            </button>
          </div>
        </div>

        {/* Bảng Dữ Liệu Chuẩn Doanh Nghiệp */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-factory-border text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                <th className="py-3.5 px-3">TÀI KHOẢN</th>
                <th className="py-3.5 px-3">HỌ TÊN</th>
                <th className="py-3.5 px-3">QUYỀN TRUY CẬP</th>
                <th className="py-3.5 px-3">PHẠM VI THẤY ĐƯỢC</th>
                <th className="py-3.5 px-3 text-center">KÍCH HOẠT</th>
                <th className="py-3.5 px-3 text-right">THAO TÁC</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-factory-border">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400 text-xs">
                    Đang tải danh sách tài khoản từ CSDL MySQL...
                  </td>
                </tr>
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400 text-xs">
                    Không tìm thấy tài khoản nào phù hợp với điều kiện tìm kiếm.
                  </td>
                </tr>
              ) : (
                filteredUsers.map((user) => {
                  const roleUpper = String(user.role).toUpperCase();
                  const isCurrent = user.id === currentUser?.id || user.email === currentUser?.email;
                  const isActive = (user.status || 'ACTIVE').toUpperCase() === 'ACTIVE';
                  const initials = getTwoInitials(user.fullName || user.name);
                  const username = user.email ? user.email.split('@')[0] : user.employeeId;

                  return (
                    <tr
                      key={user.id}
                      className={`hover:bg-slate-50 dark:hover:bg-white/5 transition-colors ${
                        isCurrent ? 'bg-emerald-500/[0.03] dark:bg-emerald-500/[0.04]' : ''
                      }`}
                    >
                      {/* Cột 1: TÀI KHOẢN */}
                      <td className="py-3.5 px-3">
                        <div className="flex items-center gap-3">
                          {/* Badge Avatar tròn bo góc hiển thị ảnh hoặc 2 chữ cái đầu */}
                          <div className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-xl overflow-hidden bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 font-bold text-xs border border-emerald-500/30 shadow-xs">
                            {user.avatarUrl ? (
                              <img
                                src={user.avatarUrl}
                                alt={user.fullName || user.name}
                                className="h-full w-full object-cover"
                                onError={(e) => {
                                  (e.currentTarget as HTMLElement).style.display = 'none';
                                }}
                              />
                            ) : (
                              <span>{initials}</span>
                            )}
                          </div>

                          <div className="min-w-0">
                            <p className="font-mono font-bold text-slate-900 dark:text-white leading-tight truncate">
                              {username}
                            </p>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                              {user.email}
                            </p>
                            {/* Nhãn bạn đang đăng nhập */}
                            {isCurrent && (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">
                                <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                Bạn đang đăng nhập
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Cột 2: HỌ TÊN */}
                      <td className="py-3.5 px-3">
                        <div>
                          <p className="font-semibold text-slate-800 dark:text-slate-200">
                            {user.fullName || user.name}
                          </p>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="text-[10px] font-mono font-bold px-1.5 py-0.2 rounded bg-slate-100 dark:bg-factory-bg text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-factory-border">
                              {user.employeeId}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Cột 3: QUYỀN TRUY CẬP (Select Dropdown Tùy Chọn) */}
                      <td className="py-3.5 px-3">
                        <select
                          value={roleUpper === 'ADMIN' ? 'ADMIN' : 'OPERATOR'}
                          onChange={(e) => handleRoleChange(user, e.target.value as UserRole)}
                          disabled={isCurrent}
                          className={`bg-slate-100 dark:bg-factory-bg border border-slate-200 dark:border-factory-border text-xs font-semibold rounded-xl px-2.5 py-1.5 outline-none transition-colors ${
                            roleUpper === 'ADMIN'
                              ? 'text-emerald-700 dark:text-emerald-400 font-bold'
                              : 'text-blue-700 dark:text-blue-400 font-semibold'
                          } ${
                            isCurrent
                              ? 'opacity-80 cursor-not-allowed'
                              : 'cursor-pointer hover:border-emerald-500/50 focus:border-emerald-500'
                          }`}
                        >
                          <option value="ADMIN">SỬA (Quản trị)</option>
                          <option value="OPERATOR">XEM (Vận hành)</option>
                        </select>
                      </td>

                      {/* Cột 4: PHẠM VI THẤY ĐƯỢC (Tự động tính dựa trên quyền) */}
                      <td className="py-3.5 px-3">
                        {roleUpper === 'ADMIN' ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">
                            <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
                            9 màn — cấu hình + giám sát
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-blue-500/10 text-blue-700 dark:text-blue-400 border border-blue-500/20">
                            <Eye className="w-3.5 h-3.5 shrink-0" />
                            3 màn — chỉ giám sát
                          </span>
                        )}
                      </td>

                      {/* Cột 5: KÍCH HOẠT (CustomSwitch) */}
                      <td className="py-3.5 px-3 text-center">
                        <div className="flex items-center justify-center">
                          <CustomSwitch
                            size="sm"
                            color="success"
                            isSelected={isCurrent ? true : isActive}
                            isDisabled={isCurrent}
                            onValueChange={(val) => !isCurrent && handleToggleStatus(user, !val)}
                          />
                        </div>
                      </td>

                      {/* Cột 6: THAO TÁC */}
                      <td className="py-3.5 px-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Nút Reset Mật Khẩu ↻ */}
                          <button
                            type="button"
                            onClick={() => {
                              setResettingUser(user);
                              setIsResetModalOpen(true);
                            }}
                            className="p-1.5 rounded-lg bg-slate-100 dark:bg-factory-bg border border-slate-200 dark:border-factory-border text-slate-600 dark:text-slate-400 hover:text-amber-600 dark:hover:text-amber-400 hover:bg-amber-500/10 transition-colors cursor-pointer"
                            aria-label="Đặt lại mật khẩu"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                          </button>

                          {/* Nút Chỉnh sửa ✎ */}
                          <button
                            type="button"
                            onClick={() => openEditModal(user)}
                            className="p-1.5 rounded-lg bg-slate-100 dark:bg-factory-bg border border-slate-200 dark:border-factory-border text-slate-600 dark:text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-emerald-500/10 transition-colors cursor-pointer"
                            aria-label="Chỉnh sửa"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>

                          {/* Nút Xóa 🗑 */}
                          {isCurrent ? (
                            <span
                              className="p-1.5 rounded-lg bg-slate-100/50 dark:bg-factory-bg/50 border border-slate-200/50 dark:border-factory-border/50 text-slate-300 dark:text-slate-600 cursor-not-allowed"
                              aria-label="Không thể xóa"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => {
                                setDeletingUser(user);
                                setIsDeleteModalOpen(true);
                              }}
                              className="p-1.5 rounded-lg bg-slate-100 dark:bg-factory-bg border border-slate-200 dark:border-factory-border text-slate-600 dark:text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
                              aria-label="Xóa tài khoản"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* POPUP XÁC NHẬN ĐẶT LẠI MẬT KHẨU (RESET PASSWORD)                          */}
      {/* ========================================================================= */}
      <Modal
        isOpen={isResetModalOpen}
        onClose={() => setIsResetModalOpen(false)}
        backdrop="blur"
        classNames={{
          base: 'bg-factory-card border border-factory-border text-foreground rounded-2xl max-w-md',
        }}
      >
        <ModalContent>
          {() => (
            <div>
              <ModalHeader className="flex items-center gap-2 border-b border-factory-border pb-3">
                <div className="p-2 rounded-xl bg-amber-500/15 text-amber-600 border border-amber-500/30">
                  <KeyRound className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    Đặt Lại Mật Khẩu Mặc Định
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 font-normal">
                    Xác nhận gửi yêu cầu cập nhật CSDL MySQL
                  </p>
                </div>
              </ModalHeader>

              <ModalBody className="py-4 text-xs space-y-3">
                <p className="text-slate-700 dark:text-slate-300 leading-relaxed">
                  Bạn có chắc chắn muốn đặt lại mật khẩu của nhân viên{' '}
                  <strong className="text-slate-900 dark:text-white font-bold">
                    {resettingUser?.fullName || resettingUser?.name}
                  </strong>{' '}
                  ({resettingUser?.email}) về mật khẩu mặc định không?
                </p>

                <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/20 border border-amber-500/30 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Info className="w-4 h-4 text-amber-600 shrink-0" />
                    <span className="text-amber-800 dark:text-amber-300 font-medium text-[11px]">
                      Mật khẩu mặc định sau khi đặt lại:
                    </span>
                  </div>
                  <span className="font-mono font-bold text-xs px-2.5 py-0.5 rounded bg-amber-500/20 text-amber-800 dark:text-amber-200 border border-amber-500/30">
                    123456
                  </span>
                </div>
              </ModalBody>

              <ModalFooter className="border-t border-factory-border pt-3">
                <Button
                  size="sm"
                  variant="light"
                  onPress={() => setIsResetModalOpen(false)}
                  disabled={isResetting}
                >
                  Hủy Bỏ
                </Button>
                <Button
                  size="sm"
                  color="warning"
                  isLoading={isResetting}
                  onPress={confirmResetPassword}
                  className="bg-amber-600 hover:bg-amber-700 text-white font-semibold shadow-xs"
                  startContent={!isResetting && <RotateCcw className="w-3.5 h-3.5" />}
                >
                  Xác Nhận Đặt Lại
                </Button>
              </ModalFooter>
            </div>
          )}
        </ModalContent>
      </Modal>

      {/* ========================================================================= */}
      {/* POPUP XÁC NHẬN XÓA TÀI KHOẢN (DELETE USER MODAL)                          */}
      {/* ========================================================================= */}
      <Modal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        backdrop="blur"
        classNames={{
          base: 'bg-factory-card border border-factory-border text-foreground rounded-2xl max-w-md',
        }}
      >
        <ModalContent>
          {() => (
            <div>
              <ModalHeader className="flex items-center gap-2 border-b border-factory-border pb-3">
                <div className="p-2 rounded-xl bg-rose-500/15 text-rose-600 border border-rose-500/30">
                  <AlertTriangle className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    Xác Nhận Xóa Tài Khoản
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 font-normal">
                    Thao tác xóa vĩnh viễn khỏi CSDL MySQL
                  </p>
                </div>
              </ModalHeader>

              <ModalBody className="py-4 text-xs space-y-3">
                <p className="text-slate-700 dark:text-slate-300 leading-relaxed">
                  Bạn có chắc chắn muốn xóa vĩnh viễn tài khoản của nhân viên{' '}
                  <strong className="text-slate-900 dark:text-white font-bold">
                    {deletingUser?.fullName || deletingUser?.name}
                  </strong>{' '}
                  ({deletingUser?.email}) không?
                </p>

                <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/20 border border-rose-500/30 text-rose-800 dark:text-rose-300 text-[11px] font-medium leading-relaxed">
                  ⚠️ Hành động này sẽ xóa toàn bộ dữ liệu nhân viên, hủy phân quyền và không thể phục hồi lại.
                </div>
              </ModalBody>

              <ModalFooter className="border-t border-factory-border pt-3">
                <Button
                  size="sm"
                  variant="light"
                  onPress={() => setIsDeleteModalOpen(false)}
                  disabled={isDeleting}
                >
                  Hủy Bỏ
                </Button>
                <Button
                  size="sm"
                  color="danger"
                  isLoading={isDeleting}
                  onPress={confirmDeleteUser}
                  className="bg-rose-600 hover:bg-rose-700 text-white font-semibold shadow-xs"
                  startContent={!isDeleting && <Trash2 className="w-3.5 h-3.5" />}
                >
                  Xóa Vĩnh Viễn
                </Button>
              </ModalFooter>
            </div>
          )}
        </ModalContent>
      </Modal>

      {/* ========================================================================= */}
      {/* MODAL THÊM / CHỈNH SỬA NGƯỜI DÙNG CHUẨN 100% THIẾT KẾ MẪU                  */}
      {/* ========================================================================= */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 w-full max-w-md shadow-2xl border border-slate-200 dark:border-slate-700 relative animate-in fade-in zoom-in-95 duration-150">
            {/* Header: Tiêu đề "Thêm người dùng" và nút icon đóng ✕ ở góc trên bên phải */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-700/60">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                {editingUser ? 'Chỉnh sửa người dùng' : 'Thêm người dùng'}
              </h2>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-white transition-colors p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700/50 cursor-pointer"
                aria-label="Đóng modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="mt-4 space-y-4">
              {formError && (
                <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-500/30 text-rose-600 dark:text-rose-400 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              {/* Ô 1: Username * */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Username <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="VD: nguyenvana"
                  disabled={!!editingUser}
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700 rounded-xl text-xs sm:text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                />
              </div>

              {/* Ô 2: Họ tên * */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Họ tên <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="VD: Nguyễn Văn A"
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700 rounded-xl text-xs sm:text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all"
                />
              </div>

              {/* Ô 3: Quyền */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Quyền
                </label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as UserRole)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700 rounded-xl text-xs sm:text-sm text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all cursor-pointer"
                >
                  <option value="OPERATOR">XEM — chỉ theo dõi giám sát</option>
                  <option value="ADMIN">SỬA — quản trị & cấu hình hệ thống</option>
                </select>
              </div>

              {/* Ô 4: Ảnh đại diện (Avatar) - CHỈ DÀNH CHO ADMIN THỰC HIỆN TẠI ĐÂY */}
              {editingUser && isCurrentUserAdmin && (
                <div className="pt-2 border-t border-slate-100 dark:border-slate-700/60">
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">
                    Ảnh đại diện (Avatar)
                  </label>
                  <div className="flex items-center gap-3">
                    <div className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-xl overflow-hidden bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 font-bold text-sm border border-emerald-500/30 shadow-xs">
                      {editingUser.avatarUrl ? (
                        <img
                          src={editingUser.avatarUrl}
                          alt={editingUser.fullName || editingUser.name}
                          className="h-full w-full object-cover"
                          onError={(e) => {
                            (e.currentTarget as HTMLElement).style.display = 'none';
                          }}
                        />
                      ) : (
                        <span>{getTwoInitials(editingUser.fullName || editingUser.name)}</span>
                      )}
                    </div>
                    <div className="flex-1">
                      <label className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-700/50 hover:bg-slate-100 dark:hover:bg-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 cursor-pointer transition-colors shadow-xs">
                        <Camera className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
                        <span>{uploadingUserId === editingUser.id ? 'Đang tải ảnh...' : 'Chọn ảnh mới...'}</span>
                        <input
                          type="file"
                          accept="image/png,image/jpeg,image/webp,image/svg+xml"
                          className="hidden"
                          disabled={uploadingUserId === editingUser.id}
                          onChange={async (e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              await handleDirectAvatarUpload(editingUser.id, file);
                              // Cập nhật lại editingUser với avatar mới
                              setEditingUser((prev) =>
                                prev ? { ...prev, avatarUrl: URL.createObjectURL(file) } : null
                              );
                            }
                          }}
                        />
                      </label>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">
                        Hỗ trợ PNG, JPG, WebP. Tối đa 5MB.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Footer Buttons: Đặt ở góc dưới bên phải */}
              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-700/60">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  disabled={isSubmitting}
                  className="border border-slate-300 text-slate-700 hover:bg-slate-50 px-5 py-2 rounded-xl font-medium text-xs sm:text-sm cursor-pointer transition-colors"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2 rounded-xl font-medium text-xs sm:text-sm shadow-sm cursor-pointer transition-colors flex items-center justify-center min-w-[80px]"
                >
                  {isSubmitting ? (
                    <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : editingUser ? (
                    'Lưu'
                  ) : (
                    'Thêm'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
