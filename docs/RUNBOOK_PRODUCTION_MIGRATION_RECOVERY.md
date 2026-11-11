# HƯỚNG DẪN XỬ LÝ SỰ CỐ & PHỤC HỒI KHI MIGRATION LỖI (RUNBOOK)
**Dự án**: DENSO Industrial IoT Monitoring System (KaiLink)  
**Tài liệu áp dụng**: Migration `002_production_kailink_schema_sync_mysql84.sql`  
**Mục tiêu**: Hướng dẫn xử lý có kiểm soát cho DBA / Kỹ sư vận hành khi gặp sự cố, **tuyệt đối không tự ý restore đè dữ liệu Production**.

---

## 1. NGUYÊN TẮC AN TOÀN BẮT BUỘC
1. **Không tự động khôi phục (Auto-restore) khi chưa kiểm toán nguyên nhân**: Việc restore đè ngay lập tức có thể gây xung đột khóa (MDL) hoặc làm mất dữ liệu telemetry phát sinh mới trong thời gian chạy.
2. **Luôn giữ nguyên bản sao lưu gốc**: Bản backup gốc tại `backups/backup_aiven_defaultdb_20261108175611.sql` (20.44 MB) là tài sản bất khả xâm phạm.
3. **Mọi thao tác can thiệp thủ công phải do con người phê duyệt**.

---

## 2. QUY TRÌNH XỬ LÝ THEO TỪNG KỊCH BẢN SỰ CỐ

### KỊCH BẢN 1: MIGRATION BỊ DỪNG NGAY DO FAIL-FAST PRE-VALIDATION
- **Hiện tượng**: MySQL ném lỗi dạng:
  ```text
  Error 1146 (42S02): Table 'defaultdb.fatal_preval_missing_table_...' doesn't exist
  ```
- **Bản chất kỹ thuật**: Bộ kiểm định tiền thực thi (Pre-validation) phát hiện schema hiện tại của CSDL thiếu bảng cha bắt buộc hoặc kiểu dữ liệu cột không tương thích. Lệnh này đã **CHẶN ĐỨNG TOÀN BỘ TIẾN TRÌNH**.
- **Tác động đến dữ liệu**: **0%** (Chưa có bất kỳ lệnh `ALTER` hay `CREATE` nào được thực thi, CSDL giữ nguyên trạng 100%).
- **Hành động khắc phục**:
  1. Đọc tên bảng giả định trong thông báo lỗi để biết chính xác thành phần không tương thích:
     - `fatal_preval_missing_table_production_lines`: Thiếu bảng dây chuyền hoặc thiếu cột `id`.
     - `fatal_preval_missing_table_machines_or_columns`: Thiếu bảng máy móc hoặc thiếu cột `id`, `lineId`.
     - `fatal_preval_missing_table_plc_stations`: Thiếu bảng trạm PLC.
     - `fatal_preval_insecure_plc_enabled_default_nonzero`: Cột `enabled` đã tồn tại nhưng có DEFAULT khác 0 (rủi ro bảo mật socket).
  2. Khắc phục nguyên nhân gốc rễ trên schema trước khi thực hiện chạy lại migration.

---

### KỊCH BẢN 2: MIGRATION BỊ GIÁN ĐOẠN GIỮA CHỪNG (MẤT KẾT NỐI MẠNG / TIMEOUT)
- **Hiện tượng**: MySQL Workbench bị ngắt kết nối (`Connection Lost`) hoặc timeout khi đang thực thi script. Một số cột đã được thêm, một số cột/bảng chưa kịp tạo.
- **Bản chất kỹ thuật**: Script được thiết kế theo chuẩn **Deep Idempotency** (tất cả các lệnh `ALTER TABLE` đều bọc trong kiểm tra `information_schema.COLUMNS` và các bảng dùng `CREATE TABLE IF NOT EXISTS`).
- **Hành động khắc phục**:
  1. Mở lại kết nối MySQL Workbench tới Aiven Cloud `defaultdb`.
  2. Chạy lại toàn bộ file [`002_production_kailink_schema_sync_mysql84.sql`](file:///e:/HOCTAP/Denso/WEBAPPIOT/scripts/migrations/002_production_kailink_schema_sync_mysql84.sql) từ dòng đầu tiên.
  3. Script sẽ tự động nhận diện những cột/bảng đã tồn tại, bỏ qua an toàn và tiếp tục hoàn tất các hạng mục còn dang dở (Đã được kiểm chứng thực tế trong Kịch bản 4: hoàn tất trong 132ms mà không gặp lỗi Duplicate).

---

### KỊCH BẢN 3: HOÀN NGUYÊN KHẨN CẤP (EMERGENCY ROLLBACK)
*Chỉ áp dụng khi có quyết định hủy bỏ triển khai từ Quản trị viên dự án.*

#### Cách 1: Sử dụng Aiven Point-in-Time Recovery (PITR) - Khuyến nghị số 1
1. Đăng nhập Aiven Console -> Chọn MySQL Service -> Chọn tab **Backups**.
2. Chọn tính năng **Fork / Restore to point in time**.
3. Chọn mốc thời gian ngay trước thời điểm chạy migration.
4. Hệ thống sẽ tạo một service mới song song với nguyên trạng dữ liệu hoàn hảo, không gây downtime service chính.

#### Cách 2: Khôi phục có kiểm soát từ bản Dump
1. Chụp snapshot trạng thái hiện tại trước khi khôi phục:
   ```bash
   mysqldump -h <HOST> -P <PORT> -u <USER> --single-transaction --quick --skip-lock-tables defaultdb > rollback_pre_check.sql
   ```
2. Thực hiện gỡ bỏ 3 bảng mới và khóa ngoại:
   ```sql
   USE defaultdb;
   SET FOREIGN_KEY_CHECKS = 0;
   DROP TABLE IF EXISTS collection_schedules;
   DROP TABLE IF EXISTS metric_thresholds;
   DROP TABLE IF EXISTS metric_mappings;
   ALTER TABLE plc_stations DROP FOREIGN KEY IF EXISTS fk_plc_line_id;
   ALTER TABLE plc_stations DROP INDEX IF EXISTS uq_plc_line_id;
   ALTER TABLE plc_stations DROP COLUMN IF EXISTS line_id, DROP COLUMN IF EXISTS machine_id, DROP COLUMN IF EXISTS connection_status, DROP COLUMN IF EXISTS enabled, DROP COLUMN IF EXISTS is_demo;
   ALTER TABLE machines DROP COLUMN IF EXISTS management_status, DROP COLUMN IF EXISTS location, DROP COLUMN IF EXISTS description;
   SET FOREIGN_KEY_CHECKS = 1;
   ```
3. Chạy script kiểm chứng [`002_post_migration_verification_mysql84.sql`](file:///e:/HOCTAP/Denso/WEBAPPIOT/scripts/migrations/002_post_migration_verification_mysql84.sql) để nghiệm thu hệ thống đã quay về đúng 7 bảng ban đầu.
