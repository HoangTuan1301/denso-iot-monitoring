/**
 * @file server/ingestion/FileProfileRegistry.js
 * @description Quản lý đăng ký và tra cứu các Hồ sơ Tệp (File Profiles) của hệ thống Ingestion:
 * - Định nghĩa mẫu tên file (RegExp pattern).
 * - Quy định Parser tương ứng (CSV 2 dòng, JSON, TXT,...).
 * - Ánh xạ tường minh sang Máy mục tiêu (targetMachineId) và Kênh đo (channelMappings).
 * - Tuyệt đối không tự suy đoán mã máy hoặc gán ngầm tên file vào máy sản xuất.
 */

export class FileProfileRegistry {
  constructor() {
    this.profiles = new Map();
  }

  /**
   * Đăng ký một hồ sơ tệp mới
   * @param {Object} profile
   * @param {string} profile.id Mã hồ sơ duy nhất
   * @param {RegExp|string} profile.pattern Mẫu regex tên file
   * @param {string} profile.parserType Loại parser ('CSV_TWO_LINE', 'JSON', 'TXT')
   * @param {string} [profile.targetMachineId] Mã máy đích được cấu hình rõ ràng
   * @param {Object} [profile.channelMappings] Ánh xạ tag file -> mapping_code
   * @param {string} [profile.mode='LIVE_ELIGIBLE'] Chế độ nạp: 'LIVE_ELIGIBLE' hoặc 'HISTORICAL_ONLY'
   * @param {number} [profile.expectedCycleSeconds=60] Chu kỳ xuất file dự kiến (giây)
   * @param {number} [profile.staleMultiplier=2.5] Hệ số xác định nguồn bị chậm/stale
   */
  registerProfile(profile) {
    if (!profile || !profile.id) {
      throw new Error('Hồ sơ tệp bắt buộc phải có thuộc tính id.');
    }
    const compiled = {
      mode: 'LIVE_ELIGIBLE',
      expectedCycleSeconds: 60,
      staleMultiplier: 2.5,
      ...profile,
      regex: profile.pattern instanceof RegExp ? profile.pattern : new RegExp(profile.pattern, 'i'),
    };
    this.profiles.set(profile.id, compiled);
  }

  /**
   * Gỡ bỏ một hồ sơ tệp
   * @param {string} profileId
   */
  unregisterProfile(profileId) {
    this.profiles.delete(profileId);
  }

  /**
   * Lấy thông tin một hồ sơ theo mã định danh
   * @param {string} profileId
   * @returns {Object|null}
   */
  getProfile(profileId) {
    return this.profiles.get(profileId) || null;
  }

  /**
   * Tìm hồ sơ tệp phù hợp nhất theo tên file
   * @param {string} fileName Tên file (ví dụ: "log215_DATA_260522.csv")
   * @returns {Object|null}
   */
  findProfileForFile(fileName) {
    for (const profile of this.profiles.values()) {
      if (profile.regex.test(fileName)) {
        const match = fileName.match(profile.regex);
        return {
          ...profile,
          matchGroups: match ? match.slice(1) : [],
        };
      }
    }
    return null;
  }

  /**
   * Lấy danh sách toàn bộ hồ sơ đang hoạt động
   */
  getAllProfiles() {
    return Array.from(this.profiles.values());
  }

  /**
   * Đặt lại toàn bộ danh mục hồ sơ
   */
  clear() {
    this.profiles.clear();
  }
}

// Khởi tạo Singleton Registry mặc định
export const defaultProfileRegistry = new FileProfileRegistry();

// Đăng ký hồ sơ chuẩn cho mẫu log215_DATA_*.csv
defaultProfileRegistry.registerProfile({
  id: 'PROFILE-DENSO-LOG215',
  name: 'Hồ sơ Tệp Trạm Đo log215',
  pattern: /^log215_DATA_(\d{6})\.csv$/i,
  parserType: 'CSV_TWO_LINE',
  description: 'Hồ sơ định dạng CSV 2 dòng header cho trạm đo log215 (DATA No, DATE, TIME, POS1, POS2, POS3)',
  // targetMachineId để null: Bắt buộc kỹ sư DENSO cấu hình tường minh cho máy chỉ định
  targetMachineId: null,
  channelTags: ['POS1', 'POS2', 'POS3'],
});
