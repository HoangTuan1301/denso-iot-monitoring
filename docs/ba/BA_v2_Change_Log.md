# NHẬT KÝ THAY ĐỔI VÀ NÂNG CẤP TÀI LIỆU BA (BA CHANGE LOG v2.0)
## DỰ ÁN: HỆ THỐNG GIÁM SÁT IoT NHÀ MÁY DENSO (KaiLink)

- **Mã tài liệu:** `DENSO-BA-CHANGELOG-v2.0`
- **Tài liệu gốc (v1.0):** `docs/ba/DENSO_IoT_Monitoring_BA_Documentation.docx`
- **Tài liệu nâng cấp (v2.0):** `docs/ba/DENSO_IoT_Monitoring_BA_Documentation_v2.0.docx`
- **Nhánh Git đối chiếu:** `feature/web-log-export` (Commit: `8ac31eabbb565788db640d73526df8daec8b0506`)
- **Ngày thực hiện:** 22/10/2026
- **Tác giả:** Lead Business Analyst & Technical Reviewer

---

## 1. TỔNG QUAN ĐỢT AUDIT & REFACTORING v2.0

Đợt nâng cấp tài liệu BA từ phiên bản 1.0 lên 2.0 được thực hiện nhằm mục tiêu chuẩn hóa tài liệu đặc tả nghiệp vụ theo các chuẩn quốc tế (BABOK v3, ISO/IEC/IEEE 29148), đồng thời **loại bỏ 100% các nhận định suy diễn, chưa được kiểm chứng**, và đồng bộ chính xác với hiện trạng mã nguồn thực tế của dự án DENSO KaiLink tại mốc phát triển Stage 4A.

Tài liệu v1.0 được giữ nguyên vẹn để phục vụ đối chiếu lịch sử và lưu trữ kiểm toán.

---

## 2. BẢNG TỔNG HỢP CÁC ĐIỂM SỬA ĐỔI, ĐÍNH CHÍNH VÀ BỔ SUNG

| STT | Vấn đề phát hiện trong v1.0 | Giải pháp xử lý & Nâng cấp trong v2.0 | Mã tham chiếu & File mã nguồn liên quan |
| :--- | :--- | :--- | :--- |
| **01** | **Lệch số trang Mục lục (TOC Mismatch):** Mục lục v1.0 liệt kê số trang lên đến 37, nhưng tài liệu thực tế chỉ dài 29 trang. | Tái cấu trúc mục lục hoàn chỉnh, phân chia 10 chương rõ ràng, căn chỉnh ngắt trang giữa các chương lớn. | Phần 1 - Mục lục tổng thể tài liệu |
| **02** | **Thiếu sót Quy tắc nghiệp vụ (BR Inconsistency):** Phần lời văn v1.0 tuyên bố có 15 Business Rules nhưng bảng tổng hợp chỉ liệt kê từ BR-01 đến BR-12 (thiếu 3 BR). | Bổ sung đầy đủ toàn bộ 15 Business Rules (BR-01 đến BR-15), đặc tả chi tiết công thức, điều kiện kích hoạt và ánh xạ chính xác tới từng dòng code. | Chương 3 (3.3): BR-01 đến BR-15 (`src/utils/plcConverter.ts`, `server/db-mysql.js`, `server/index.js`, `src/utils/exportEngine.ts`) |
| **03** | **Tuyên bố phê duyệt sớm (Premature Sign-off):** v1.0 ghi nhận trạng thái "ĐÃ KÝ" / "ĐÃ PHÊ DUYỆT" như thể là chính sách chính thức được ban lãnh đạo DENSO ban hành. | Đính chính trạng thái tài liệu thành **"CHỜ THẨM ĐỊNH KỸ THUẬT"** (Pending Technical Sign-off); ma trận ký duyệt ghi rõ ngày chờ duyệt và loại bỏ các tuyên bố phê duyệt giả định. | Trang bìa & Bảng ký duyệt phê duyệt tài liệu |
| **04** | **Tuyên bố sai thực tế về kết nối PLC vật lý:** v1.0 mô tả hệ thống đã đấu nối vật lý tới tủ điện PLC Siemens S7-1500 và Omron NX1P2 tại xưởng. | Minh định rõ ràng: Toàn bộ các trạm PLC hiện tại là **mô hình phần mềm giả lập (Mock / Loopback Protocol Software Model)**, chưa đấu nối cáp quang/cáp đồng Profinet thật tại xưởng. | Chương 1 (1.4), Chương 4 (FR-009), Chương 9 (9.3) |
| **05** | **Tuyên bố chưa kiểm chứng về tải đồng thời và độ trễ:** v1.0 khẳng định hệ thống đã được kiểm thử tải 1000 người dùng đồng thời và độ trễ <100ms trên toàn nhà máy. | Đính chính: 1000 người dùng là **chỉ số mục tiêu thiết kế (Target Capacity)**, chưa stress test bằng k6/JMeter. Độ trễ <100ms là kết quả đo trên mạng nội bộ phòng Lab / Localhost trong bài kiểm thử Stage 4A. | Chương 6 (NFR-03, NFR-04), Chương 9 (9.3) |
| **06** | **Giả định thời gian quy trình AS-IS:** v1.0 trình bày khoảng thời gian 30-120 phút ghi chép thủ công như là dữ liệu đo đạc thực nghiệm tại nhà máy. | Gắn nhãn tường minh: Đây là **số liệu giả định tham chiếu ngành (Reference Assumption)** dựa trên khảo sát sơ bộ, không phải là kết quả Time-Motion Study thực tế tại xưởng. | Chương 3 (3.1) - Quy trình nghiệp vụ hiện tại |
| **07** | **Nhầm lẫn cơ chế lưu trữ Cảnh báo:** v1.0 gây hiểu nhầm toàn bộ cảnh báo được lưu bền vững trong CSDL. | Phân định rạch ròi: Chuỗi thời gian Telemetry được lưu bền vững trong bảng `machine_telemetry_history` (MySQL), còn Cảnh báo hiện được quản lý trên RAM trình duyệt qua Zustand Store (`useAlarmStore`). Ghi nhận nợ kỹ thuật TD-01. | Chương 7 (7.4), Chương 10 (10.2) |
| **08** | **Lệch phân quyền vai trò trên UI so với Backend:** v1.0 chưa làm rõ sự không đồng bộ giữa giao diện quản lý người dùng và cơ sở dữ liệu. | Làm rõ: Backend và MySQL hỗ trợ đầy đủ 3 vai trò (ADMIN, OPERATOR, MAINTENANCE), nhưng giao diện `UserManagementView.tsx` hiện chỉ có nút lọc nhanh cho ADMIN và OPERATOR, thiếu nút cho MAINTENANCE (Ghi nhận nợ kỹ thuật TD-02). | Chương 2 (2.2), Chương 4 (FR-016), Chương 8 (SCR-09) |
| **09** | **Thiếu minh chứng giao diện thực tế:** v1.0 hoàn toàn không có hình ảnh minh họa màn hình. | Nhúng 5 hình ảnh thực tế trực tiếp vào file Word: Logo DENSO, Hộp thoại Đăng nhập (SCR-01), Danh mục máy Tầng 2 (SCR-03), Đồ thị Telemetry Tầng 3 (SCR-04), và Nhật ký vận hành Render Cloud. | Chương 8 (Hình 8.1, 8.2, 8.3, 8.4) & Trang bìa |
| **10** | **Chuẩn hóa đặc tả 21 FR theo cấu trúc 19 trường:** v1.0 mô tả sơ sài các yêu cầu chức năng. | Nâng cấp toàn bộ 21 FR (FR-001 đến FR-021) theo tiêu chuẩn 19 trường nghiệp vụ, bao gồm luồng chính, luồng ngoại lệ, và tiêu chí nghiệm thu Given-When-Then. | Chương 4 (4.2): Toàn bộ 21 FRs |
| **11** | **Bổ sung đặc tả 10 Use Case hoàn chỉnh:** v1.0 thiếu đặc tả Use Case chi tiết. | Xây dựng đầy đủ 10 Use Case (UC-01 đến UC-10) với Actor chính/phụ, Preconditions, Postconditions, Main Flow, Alt Flow, Exception Flow và 3 biểu đồ tuần tự kỹ thuật (Sequence Diagrams). | Chương 5: UC-01 đến UC-10 |
| **12** | **Ma trận truy vết RTM & Kế hoạch kiểm thử:** v1.0 thiếu ma trận RTM và ca kiểm thử chi tiết. | Xây dựng ma trận RTM đa chiều kết nối Goal -> BR -> FR -> UC -> Source Code -> Test Case -> Trạng thái; kèm theo danh mục 25 ca kiểm thử thực nghiệm chi tiết (TC-01 đến TC-25). | Chương 9 (9.1, 9.2) |
| **13** | **Lộ trình triển khai 3 giai đoạn thực tế:** v1.0 thiếu định hướng phát triển rõ ràng. | Hoạch định lộ trình 3 giai đoạn: Giai đoạn 1 (Lab MVP - Hiện tại), Giai đoạn 2 (Pilot Dây chuyền D-01 - 3-6 tháng tới), Giai đoạn 3 (Toàn nhà máy & AI PdM - 6-12 tháng tới). | Chương 10 (10.3) |

---

## 3. CHI TIẾT 15 BUSINESS RULES (QUY TẮC NGHIỆP VỤ) ĐƯỢC CHUẨN HÓA

1. **BR-01 (Đánh giá 4 ngưỡng kỹ thuật):** Bình thường (Normal) trong dải cảnh báo; Cảnh báo (Warning) khi vượt ngưỡng cảnh báo nhưng dưới ngưỡng nguy cấp; Nguy cấp (Critical) khi vượt ngưỡng nguy cấp. Triển khai tại `src/utils/plcConverter.ts#L72-L89`.
2. **BR-02 (Tổng hợp trạng thái máy Tầng 2):** Trạng thái máy được tổng hợp theo mức độ nghiêm trọng cao nhất của các thông số đo thành phần (Critical > Warning > Normal). Triển khai tại `src/stores/useMonitoringStore.ts#L339-L349`.
3. **BR-03 (Điểm số an toàn dây chuyền Safety Score):** Trừ 5 điểm cho mỗi thông số Warning, trừ 15 điểm cho mỗi thông số Critical; giá trị sàn là 0%. Triển khai tại `src/utils/plcConverter.ts#L95-L138`.
4. **BR-04 (Xác nhận cảnh báo bước 1 - Acknowledge):** Vận hành viên hoặc kỹ sư xác nhận đã nắm thông tin sự cố; còi Andon ngừng kêu nhưng trạng thái lỗi giữ nguyên cho đến khi khắc phục. Triển khai tại `src/stores/useAlarmStore.ts#L33-L50`.
5. **BR-05 (Nghiệm thu đóng cảnh báo bước 2 - Resolve):** Chỉ kỹ sư Bảo trì (MAINTENANCE) hoặc Quản trị viên (ADMIN) mới có quyền đóng sự cố và bắt buộc nhập biên bản xử lý sự cố. Triển khai tại `src/stores/useAlarmStore.ts#L53-L71` và `AlarmLogView.tsx`.
6. **BR-06 (Định danh Telemetry xác định chống trùng SHA-256):** Khóa chính được tính toán bằng hàm băm SHA-256: `hash(machineId + metricId + timestamp_iso)` kết hợp `INSERT IGNORE` trong MySQL, loại bỏ trùng lặp khi mạng thử lại (retry). Triển khai tại `server/db-mysql.js#L508-L515`.
7. **BR-07 (Chuẩn hóa múi giờ UTC):** Tất cả mốc thời gian telemetry được chuẩn hóa về UTC khi lưu trữ vào MySQL và chuyển đổi sang Asia/Ho_Chi_Minh khi hiển thị hoặc nhận tham số lọc. Triển khai tại `server/db-mysql.js#L59, L590-L640`.
8. **BR-08 (Xử lý cuộn ngày của ca kíp sản xuất qua đêm):** Ca 3 (22:00 hôm nay đến 06:00 sáng hôm sau) tự động cộng thêm 1 ngày theo lịch UTC (`Date.UTC` rollover), không bị cắt cụt dữ liệu ca đêm. Triển khai tại `server/db-mysql.js#L620-L645`.
9. **BR-09 (Giới hạn trần xuất an toàn 10,000 dòng):** Động cơ xuất dữ liệu chặn cứng ngưỡng trần 10,000 bản ghi/lần xuất nhằm bảo vệ bộ nhớ RAM máy chủ Node.js và trình duyệt. Triển khai tại `server/index.js#L779-L800` và `server/db-mysql.js#L680-L720`.
10. **BR-10 (Làm sạch công thức chống tấn công CSV Injection):** Tự động thêm dấu nháy đơn (`'`) vào đầu các chuỗi văn bản bắt đầu bằng ký tự `=`, `+`, `-`, `@`, `\t`, `\r` để ngăn chặn thực thi mã độc trong Microsoft Excel. Triển khai tại `src/utils/exportEngine.ts#L63-L70`.
11. **BR-11 (Bảo vệ tài khoản Quản trị viên tối cao):** Hệ thống chặn không cho phép Admin tự xóa chính tài khoản của mình và yêu cầu mật khẩu Bcrypt có độ dài tối thiểu 6 ký tự. Triển khai tại `server/index.js#L432-L434`.
12. **BR-12 (Phân loại nguồn dữ liệu Telemetry):** Phân định rạch ròi giữa bản ghi đo lường thực (`source='device'`) và bản ghi do bộ sinh dữ liệu nội bộ phát sinh (`source='simulation'`). Triển khai tại `server/db-mysql.js#L230` và `src/types/hierarchy.ts#L99`.
13. **BR-13 (Ràng buộc tải lên ảnh đại diện Avatar):** Chỉ chấp nhận định dạng ảnh hợp lệ (JPG, PNG, WEBP, SVG), kích thước tối đa 5MB, và chỉ người dùng chính chủ hoặc Admin mới có quyền tải lên. Triển khai tại `server/index.js#L53-L65, L505-L508`.
14. **BR-14 (Danh sách trắng cột sắp xếp - Whitelist Sorting):** Chỉ cho phép sắp xếp theo 7 cột hợp lệ được định nghĩa sẵn, tự động vô hiệu hóa các tham số sắp xếp lạ nhằm phòng chống tấn công SQL Injection. Triển khai tại `server/index.js#L628-L629` và `server/db-mysql.js#L451-L459`.
15. **BR-15 (Quy đổi thanh ghi PLC thô sang đơn vị kỹ thuật):** Hỗ trợ giải mã các định dạng thanh ghi công nghiệp tiêu chuẩn: số nguyên 12-bit (DEC12), bit trường (BIT12), và hàm tỷ lệ tuyến tính (Linear Scaling Formula). Triển khai tại `src/utils/plcConverter.ts#L16-L61`.

---

## 4. KẾT LUẬN & KIẾN NGHỊ BÀN GIAO

Phiên bản tài liệu BA v2.0 đã đạt đầy đủ các tiêu chuẩn khắt khe về độ chính xác nghiệp vụ, độ phủ yêu cầu phần mềm và tính minh bạch kỹ thuật. Tài liệu sẵn sàng được bàn giao cho:
- **Trưởng nhóm Kỹ thuật (Tech Lead):** Thẩm định kiến trúc và đối soát mã nguồn.
- **Đội ngũ Kiểm thử (QA/QC):** Sử dụng danh mục 25 Test Cases và ma trận RTM để xây dựng kế hoạch kiểm thử tự động hóa và nghiệm thu.
- **Khách hàng / Ban Giám đốc Nhà máy:** Đánh giá tính khả thi và thông qua kế hoạch triển khai Giai đoạn 2 (Pilot Line D-01).
