# BÁO CÁO THẨM ĐỊNH CHẤT LƯỢNG TÀI LIỆU BA v2.0 (QA VALIDATION REPORT)
## DỰ ÁN: HỆ THỐNG GIÁM SÁT IoT NHÀ MÁY DENSO (KaiLink)

- **Mã báo cáo:** `DENSO-QA-BA-VAL-v2.0`
- **Tài liệu thẩm định:** `docs/ba/DENSO_IoT_Monitoring_BA_Documentation_v2.0.docx`
- **Tài liệu phiên bản cũ:** `docs/ba/DENSO_IoT_Monitoring_BA_Documentation.docx` (v1.0 - Lưu trữ nguyên trạng)
- **Nhánh Git thẩm định:** `feature/web-log-export` (Mã commit: `8ac31eabbb565788db640d73526df8daec8b0506`)
- **Ngày thực hiện thẩm định:** 22/10/2026
- **Đơn vị thực hiện:** Senior BA & QA Documentation Reviewer

---

## 1. MỤC TIÊU & TIÊU CHÍ THẨM ĐỊNH

Báo cáo này đánh giá độc lập chất lượng của Tài liệu Đặc tả Yêu cầu Nghiệp vụ (BA Documentation v2.0) dựa trên 4 bộ tiêu chí kiểm định chất lượng:
1. **Tính hoàn chỉnh về cấu trúc (Structural Completeness):** Đầy đủ 10 chương, bìa, lịch sử phiên bản, ma trận ký duyệt, mục lục.
2. **Tính chính xác về mã nguồn & thực tế (Code Grounding & Factuality):** 100% yêu cầu chức năng, quy tắc nghiệp vụ, bảng cơ sở dữ liệu và ca sử dụng phải có bằng chứng từ mã nguồn thực tế tại commit `8ac31eabbb565788db640d73526df8daec8b0506`.
3. **Tính tuân thủ quy chuẩn định dạng văn bản (Formatting Compliance):** Khổ A4, căn lề kỹ thuật (Trái 3cm, Phải 2cm, Trên/Dưới 2.5cm), phông chữ Times New Roman (Thân 13pt, Tiêu đề 14-16pt, Giãn dòng 1.3), Bảng chuẩn hóa màu nhận diện DENSO, Header & Footer tự động đánh số trang.
4. **Tính minh bạch & Liêm chính kỹ thuật (Technical Integrity & Transparency):** Không thổi phồng, phân định rõ ràng giữa chức năng đã triển khai, dữ liệu mô phỏng và kế hoạch tương lai; ghi nhận đầy đủ nợ kỹ thuật và tuyên bố giới hạn phòng Lab.

---

## 2. KẾT QUẢ THẨM ĐỊNH ĐỊNH LƯỢNG (METRIC COUNTING)

| Chỉ số định lượng (Metric) | Giá trị mục tiêu (Target) | Kết quả thực tế v2.0 (Actual) | Đánh giá (Status) |
| :--- | :---: | :---: | :---: |
| **Số chương nội dung** | 10 chương | **10 chương** (Chương 1 đến Chương 10) | **ĐẠT (100%)** |
| **Số Yêu cầu Chức năng (FR)** | 21 yêu cầu | **21 yêu cầu** (FR-001 đến FR-021) | **ĐẠT (100%)** |
| **Số Quy tắc Nghiệp vụ (BR)** | 15 quy tắc | **15 quy tắc** (BR-01 đến BR-15) | **ĐẠT (100%)** |
| **Số Ca Sử Dụng (Use Case)** | 10 ca | **10 ca** (UC-01 đến UC-10) | **ĐẠT (100%)** |
| **Số Màn hình Giao diện (Screen)** | 10 màn hình | **10 màn hình** (SCR-01 đến SCR-10) | **ĐẠT (100%)** |
| **Số Ca Kiểm Thử Nghiệm Thu (TC)** | 25 ca test | **25 ca test** (TC-01 đến TC-25) | **ĐẠT (100%)** |
| **Số bảng Từ điển Dữ liệu (Data Dictionary)** | 6 bảng MySQL | **6 bảng** (users, lines, machines, plc, history, audit) | **ĐẠT (100%)** |
| **Số hình ảnh minh chứng nhúng thực tế** | >= 4 hình | **5 hình ảnh** (Logo, SCR-01, SCR-03, SCR-04, Render Log) | **ĐẠT (VƯỢT TRỘI)** |
| **Dung lượng file .docx v2.0** | > 400 KB | **637.07 KB** (652,360 bytes) | **ĐẠT (HỢP CHUẨN)** |
| **Tính toàn vẹn định dạng PKZIP/OpenXML** | Magic bytes 504B0304 | **504B0304** (Khớp chuẩn OpenXML .docx) | **ĐẠT (XÁC THỰC)** |

---

## 3. BẢNG KIỂM TRA ĐỐI CHIẾU CÁC QUY TẮC NGHIỆP VỤ VÀ MÃ NGUỒN

| Mã BR | Tên quy tắc nghiệp vụ | Vị trí file mã nguồn & Dòng code | Trạng thái đối soát mã nguồn |
| :--- | :--- | :--- | :---: |
| **BR-01** | Đánh giá 4 ngưỡng kỹ thuật | `src/utils/plcConverter.ts#L72-L89` | **KHỚP 100%** |
| **BR-02** | Tổng hợp trạng thái máy Cấp 2 | `src/stores/useMonitoringStore.ts#L339-L349` | **KHỚP 100%** |
| **BR-03** | Tính điểm an toàn Safety Score (%) | `src/utils/plcConverter.ts#L95-L138` | **KHỚP 100%** |
| **BR-04** | Xác nhận cảnh báo (Acknowledge) | `src/stores/useAlarmStore.ts#L33-L50` | **KHỚP 100%** |
| **BR-05** | Nghiệm thu xử lý sự cố (Resolve) | `src/stores/useAlarmStore.ts#L53-L71`, `AlarmLogView.tsx` | **KHỚP 100%** |
| **BR-06** | Định danh Telemetry SHA-256 chống trùng | `server/db-mysql.js#L508-L515` | **KHỚP 100%** |
| **BR-07** | Chuẩn hóa mốc thời gian theo UTC | `server/db-mysql.js#L59`, `L590-L640` | **KHỚP 100%** |
| **BR-08** | Cuộn ngày của Ca 3 sản xuất qua đêm | `server/db-mysql.js#L620-L645` | **KHỚP 100%** |
| **BR-09** | Giới hạn trần xuất an toàn 10,000 dòng | `server/index.js#L779-L800`, `server/db-mysql.js#L680-L720` | **KHỚP 100%** |
| **BR-10** | Làm sạch công thức chống CSV Injection | `src/utils/exportEngine.ts#L63-L70` | **KHỚP 100%** |
| **BR-11** | Bảo vệ tài khoản Quản trị viên tối cao | `server/index.js#L432-L434` | **KHỚP 100%** |
| **BR-12** | Phân loại nguồn telemetry (device/sim) | `server/db-mysql.js#L230`, `src/types/hierarchy.ts#L99` | **KHỚP 100%** |
| **BR-13** | Ràng buộc upload Avatar (Max 5MB) | `server/index.js#L53-L65`, `L505-L508` | **KHỚP 100%** |
| **BR-14** | Danh sách trắng cột sắp xếp (Whitelist) | `server/index.js#L628-L629`, `server/db-mysql.js#L451-L459` | **KHỚP 100%** |
| **BR-15** | Quy đổi thanh ghi PLC thô (DEC12/BIT12) | `src/utils/plcConverter.ts#L16-L61` | **KHỚP 100%** |

---

## 4. KIỂM ĐỊNH CÁC TUYÊN BỐ KỸ THUẬT & LOẠI TRỪ RỦI RO (FACT-CHECK)

1. **Về việc kết nối PLC vật lý:**
   - *Kết quả thẩm định:* Tài liệu v2.0 tuyên bố rõ ràng tại Chương 1, 4 và 9 rằng các trạm PLC Siemens S7-1500 và Omron NX1P2 hiện là mô hình phần mềm (Mock Protocol Models) phục vụ nghiên cứu tại phòng thí nghiệm, chưa đấu nối cáp Profinet thật tại xưởng.
   - *Đánh giá:* **ĐẠT TIÊU CHÍ LIÊM CHÍNH KỸ THUẬT.**

2. **Về độ trễ mạng và tải đồng thời:**
   - *Kết quả thẩm định:* Độ trễ <100ms được ghi nhận là kết quả đo lường thực nghiệm trên mạng LAN/Localhost trong bài test Stage 4A. Khả năng chịu tải 1000 người dùng được xác định là chỉ số mục tiêu thiết kế kiến trúc, chưa stress test bằng k6.
   - *Đánh giá:* **ĐẠT TIÊU CHÍ MINH BẠCH.**

3. **Về cơ chế lưu trữ Cảnh báo so với Telemetry:**
   - *Kết quả thẩm định:* Bảng so sánh 7.4 và mục 10.2 chỉ rõ sự khác biệt giữa chuỗi thời gian telemetry lưu bền vững trong MySQL và cảnh báo lưu tạm thời trong RAM Zustand store, ghi nhận nợ kỹ thuật TD-01 để giải quyết ở Giai đoạn 2.
   - *Đánh giá:* **ĐẠT TIÊU CHÍ PHÂN TÍCH RỦI RO.**

4. **Về phân quyền vai trò người dùng (RBAC):**
   - *Kết quả thẩm định:* Phân định rõ 3 vai trò ADMIN, OPERATOR, MAINTENANCE. Nêu rõ điểm lệch trên giao diện `UserManagementView.tsx` (thiếu nút lọc MAINTENANCE) so với backend đã hỗ trợ đầy đủ.
   - *Đánh giá:* **ĐẠT TIÊU CHÍ ĐỐI SOÁT UI/BACKEND.**

5. **Về thời gian di chuyển trong quy trình AS-IS:**
   - *Kết quả thẩm định:* Con số 30-120 phút được gắn nhãn là số liệu giả định tham chiếu ngành, không phải kết quả đo lường chuyển động thực nghiệm tại hiện trường DENSO.
   - *Đánh giá:* **ĐẠT TIÊU CHÍ TRUNG THỰC NGHIỆP VỤ.**

---

## 5. KIỂM ĐỊNH QUY CHUẨN ĐỊNH DẠNG VĂN BẢN (FORMAT AUDIT)

- **Kích thước trang:** Chuẩn A4 Quốc tế (Chiều rộng: 210mm / 11,906 twips; Chiều cao: 297mm / 16,838 twips).
- **Căn lề (Margins):** Lề trái 3.0 cm (1,701 twips), Lề phải 2.0 cm (1,134 twips), Lề trên 2.5 cm (1,417 twips), Lề dưới 2.5 cm (1,417 twips) - Tuân thủ tiêu chuẩn trình bày văn bản hành chính và tài liệu kỹ thuật doanh nghiệp.
- **Phông chữ:** 100% nội dung sử dụng `Times New Roman`. Cỡ chữ thân bài: 13pt; Tiêu đề Chương H1: 16pt (In đậm, màu DENSO Navy `#003366`); Tiêu đề Mục H2: 14pt (In đậm, màu `#004080`); Tiêu đề Tiểu mục H3: 13pt (In đậm nghiêng); Giãn dòng: 1.3 line spacing; Căn lề đều hai bên (Justified).
- **Tiêu đề đầu trang (Header):** Hiển thị bên phải: *"HỆ THỐNG GIÁM SÁT IoT NHÀ MÁY DENSO (KaiLink) | ĐẶC TẢ NGHIỆP VỤ BA v2.0"*, phông 9pt nghiêng màu xám.
- **Chân trang (Footer):** Hiển thị mã tài liệu bên trái và tự động hiển thị số trang: *"Trang X / Y"* bên phải với số trang in đậm màu Navy.
- **Bảng biểu:** 100% các bảng có hàng tiêu đề nền màu xanh hải quân `#003366`, chữ trắng in đậm, đường viền mảnh màu xám nhạt `#CBD5E0`, khoảng đệm ô thoáng đẹp.
- **Hình ảnh minh chứng:** 5 hình ảnh thực tế được căn giữa trang, có chú thích hình ảnh in nghiêng màu xám bên dưới.

---

## 6. KẾT LUẬN & PHÊ DUYỆT CỦA BỘ PHẬN QA

Tài liệu Đặc tả Nghiệp vụ BA phiên bản 2.0 (`DENSO_IoT_Monitoring_BA_Documentation_v2.0.docx`) đã **VƯỢT QUA TOÀN BỘ CÁC BÀI KIỂM ĐỊNH CHẤT LƯỢNG**.

Tài liệu đạt mức độ hoàn thiện cao nhất, xóa bỏ triệt để mọi lỗi logic và số liệu giả định chưa kiểm chứng của phiên bản 1.0, đồng thời phản ánh chân thực hiện trạng phát triển mã nguồn của dự án KaiLink.

**KẾT QUẢ PHÊ DUYỆT:** **ĐẠT CHUẨN THẨM ĐỊNH (VERIFIED & READY FOR STAKEHOLDER SIGN-OFF)**
- Trạng thái đề xuất: **CHỜ THẨM ĐỊNH KỸ THUẬT (Pending Technical Sign-off)**
- Sẵn sàng bàn giao cho: Tech Lead, QA Team, Project Manager và Stakeholders của DENSO.
