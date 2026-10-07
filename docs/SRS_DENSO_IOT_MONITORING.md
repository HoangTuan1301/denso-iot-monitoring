# TÀI LIỆU ĐẶC TẢ YÊU CẦU PHẦN MỀM & LUỒNG DỮ LIỆU (SRS)
## DỰ ÁN: DENSO INDUSTRIAL IOT MONITORING SYSTEM
**Hệ Thống Giám Sát Thiết Bị & Dây Chuyền Sản Xuất Thời Gian Thực**

---

| Thông Tin Tài Liệu | Chi Tiết |
| :--- | :--- |
| **Dự án** | DENSO Industrial IoT Monitoring System |
| **Mã tài liệu** | SRS-DENSO-IOT-2026-V1.0 |
| **Phiên bản** | v1.0 (Production-Ready Draft) |
| **Ngày lập** | 06/10/2026 |
| **Đối tượng tiếp nhận** | Nhóm Phát triển Hệ thống (Development Team) & Mentor / Hội đồng Đánh giá |
| **Tech Stack** | Frontend: React 18, TypeScript, Vite, Tailwind CSS, HeroUI, Lucide Icons<br>Backend: Node.js, Express, Socket.io, MySQL, JWT, Bcrypt |

---

## MỤC LỤC
1. [TỔNG QUAN HỆ THỐNG](#1-tổng-quan-hệ-thống)
   - 1.1. Bối cảnh & Bài toán Doanh nghiệp
   - 1.2. Mục tiêu Hệ thống
   - 1.3. Phạm vi Dự án (System Scope)
2. [MÔ HÌNH PHÂN QUYỀN NGƯỜI DÙNG (RBAC)](#2-mô-hình-phân-quyền-người-dùng-rbac)
   - 2.1. Danh mục các Vai trò (User Roles)
   - 2.2. Ma trận Phân quyền Chức năng (Permission Matrix)
3. [KIẾN TRÚC HỆ THỐNG & LUỒNG DỮ LIỆU (DATA PIPELINE & USER FLOW)](#3-kiến-trúc-hệ-thống--luồng-dữ-liệu)
   - 3.1. Luồng truyền nhận dữ liệu Cảm biến/PLC thời gian thực (IoT Data Pipeline)
   - 3.2. Luồng quy trình Xử lý Sự cố & Cảnh báo (Alarm Handling Lifecycle)
4. [MÔ TẢ CHI TIẾT CHỨC NĂNG & CÁCH BIỂU DIỄN DỮ LIỆU (UI DATA REPRESENTATION)](#4-mô-tả-chi-tiết-chức-năng--cách-biểu-diễn-dữ-liệu)
   - 4.1. Giám sát Phân cấp 3 Cấp độ (Tier 1 - Tier 2 - Tier 3)
   - 4.2. Quản lý Nhật ký Sự cố & Báo cáo (Alarm Log & Reporting)
   - 4.3. Quản trị & Cấu hình Ngưỡng (Threshold Configuration & Audit Log)
   - 4.4. Quét mã QR & Phân tích Dữ liệu Lịch sử (QR Scanner & Historical Trends)
5. [HƯỚNG DẪN THAO TÁC NGƯỜI DÙNG (USER GUIDE HIGHLIGHTS)](#5-hướng-dẫn-thao-tác-người-dùng)
   - 5.1. Kịch bản dành cho Công nhân Vận hành (Operator Flow)
   - 5.2. Kịch bản dành cho Kỹ thuật viên Bảo trì (Technician Flow)
6. [DANH SÁCH THẮC MẮC & CÂU HỎI NHỜ MENTOR TƯ VẤN](#6-danh-sách-thắc-mắc--câu-hỏi-nhờ-mentor-tư-vấn)

---

## 1. TỔNG QUAN HỆ THỐNG

### 1.1. Bối cảnh & Bài toán Doanh nghiệp
Tại các nhà máy sản xuất phụ tùng và linh kiện ô tô công nghệ cao của DENSO, dây chuyền gia công và lắp ráp cơ khí chính xác đòi hỏi tính liên tục và ổn định nghiêm ngặt. Việc máy móc bất ngờ dừng hoạt động (Unplanned Downtime) do quá nhiệt vòng bi, áp suất dầu sụt giảm, độ rung động cơ bất thường hoặc quá tải điện lực không chỉ gây lãng phí hàng nghìn USD mỗi giờ mà còn ảnh hưởng trực tiếp đến chất lượng sản phẩm xuất xưởng.

Phương pháp bảo trì thủ công (ghi chép đồng hồ đo bằng giấy theo chu kỳ) bộc lộ nhiều hạn chế:
- **Độ trễ thông tin cao:** Khi phát hiện nhiệt độ tăng thì trục chính đã có nguy cơ kẹt/cháy.
- **Thiếu bức tranh tổng thể:** Quản đốc không nắm bắt được trạng thái đồng bộ giữa các công đoạn.
- **Quy trình xử lý sự cố rời rạc:** Thiếu bằng chứng và lịch sử can thiệp kỹ thuật (ai tiếp nhận, giải pháp thay thế linh kiện gì, vào thời điểm nào).

### 1.2. Mục tiêu Hệ thống
**DENSO Industrial IoT Monitoring System** được xây dựng nhằm giải quyết triệt để các bài toán trên thông qua:
1. **Giám sát thời gian thực (Real-time Telemetry):** Thu thập liên tục các chỉ số vật lý (Nhiệt độ, Độ rung, Áp suất, Dòng điện, RPM) với tần số cập nhật tính bằng mili-giây.
2. **Cảnh báo sớm đa cấp (Early Warning & Andon System):** Tự động so sánh dữ liệu cảm biến với bảng ngưỡng cài đặt sẵn (Normal / Warning / Critical) để phát cảnh báo tức thì qua giao diện Web và đèn tháp Andon.
3. **Chuẩn hóa quy trình phản ứng sự cố (Incident Response Workflow):** Thực hiện quy trình 3 bước chuẩn công nghiệp: *Phát sinh sự cố $\rightarrow$ Tiếp nhận (Acknowledge) $\rightarrow$ Khắc phục & Nghiệm thu (Resolve)*.
4. **Bảo trì dự đoán (Predictive Maintenance Data Foundation):** Lưu trữ lịch sử thông số phục vụ phân tích xu hướng suy hao cơ khí, hỗ trợ lập kế hoạch bảo trì ngăn ngừa trước khi xảy ra sự cố hỏng hóc.

### 1.3. Phạm vi Dự án (System Scope)
- **Hạ tầng kết nối:** Giả lập và sẵn sàng kết nối PLC (Siemens S7-1200/1500, Mitsubishi FX5U/Q-Series, Omron) qua cổng Industrial Gateway chuyển đổi sang WebSocket/REST API.
- **Nền tảng ứng dụng:** Web App chuẩn Responsive, hỗ trợ màn hình giám sát trung tâm nhà xưởng (TV/Andon Display), máy tính bàn quản đốc và thiết bị di động/máy tính bảng của kỹ thuật viên bảo dưỡng tại hiện trường.

---

## 2. MÔ HÌNH PHÂN QUYỀN NGƯỜI DÙNG (RBAC)

Hệ thống triển khai mô hình kiểm soát truy cập theo vai trò (Role-Based Access Control - RBAC) chặt chẽ, gắn liền với mã định danh nhân viên DENSO (`DNS-XXXX`) và xác thực bằng JSON Web Token (JWT).

```
                      ┌────────────────────────────────────────┐
                      │            HỆ THỐNG PHÂN QUYỀN         │
                      └───────────────────┬────────────────────┘
                                          │
            ┌─────────────────────────────┼─────────────────────────────┐
            ▼                             ▼                             ▼
   ┌─────────────────┐           ┌─────────────────┐           ┌─────────────────┐
   │      ADMIN      │           │   TECHNICIAN    │           │    OPERATOR     │
   │  (Quản Trị Viên) │           │ (Kỹ Thuật Viên) │           │ (Công Nhân Xưởng)│
   └────────┬────────┘           └────────┬────────┘           └────────┬────────┘
            │                             │                             │
    Toàn quyền hệ thống,          Giám sát sâu, nhận alarm,     Xem dây chuyền được
    cấu hình ngưỡng PLC,          xử lý & nghiệm thu sự cố,     phân công, tiếp nhận
    quản lý người dùng MySQL.     quét QR máy, hiệu chuẩn.      bước 1, ẩn nút sửa.
```

### 2.1. Danh mục các Vai trò (User Roles)

1. **Admin (Quản trị viên hệ thống):**
   - Tài khoản mặc định: `admin@denso.com` (Mã NV: `DNS-0001`).
   - Quyền hạn:
     - Toàn quyền cấu hình tham số hệ thống.
     - Cài đặt và chỉnh sửa ngưỡng cảnh báo (Warning/Critical) cho toàn bộ cảm biến.
     - Quản lý tài khoản (Thêm/Sửa/Khóa tài khoản, cấp phát vai trò SỬA/XEM, Reset mật khẩu).
     - Truy xuất nhật ký kiểm toán (Audit Logs) để truy vết mọi hành vi thay đổi cấu hình.

2. **Technician / Maintenance (Kỹ thuật viên cơ điện & bảo trì):**
   - Tài khoản mẫu: `tech@denso.com` (Mã NV: `DNS-2001`).
   - Quyền hạn:
     - Giám sát chi tiết thông số Tier 2 & Tier 3 (Độ rung FFT, nhiệt độ ổ bi, áp suất...).
     - Quyền thực hiện **Tiếp nhận (Acknowledge)** và **Hoàn tất khắc phục sự cố (Resolve Alarm)** kèm ghi nhận biên bản kỹ thuật.
     - Sử dụng tính năng Quét mã QR trên thân máy tại xưởng để mở ngay trang chẩn đoán.
     - Xem biểu đồ lịch sử để đánh giá độ ổn định của máy sau khi can thiệp sửa chữa.

3. **Operator (Công nhân vận hành trực tiếp ca sản xuất):**
   - Tài khoản mẫu: `user@denso.com` (Mã NV: `DNS-1024`).
   - Quyền hạn:
     - Giám sát màn hình Dashboard tổng quan của Dây chuyền được phân công (`assignedLineId`).
     - Theo dõi trạng thái máy móc (Chạy / Chờ / Sự cố).
     - Quyền bấm **Tiếp nhận bước 1 (Acknowledge)** khi phát hiện chuông/đèn cảnh báo tại vị trí làm việc.
     - **Bị khóa/Ẩn:** Toàn bộ nút thay đổi ngưỡng cảm biến, màn hình quản trị người dùng, nút cấu hình hệ thống.

### 2.2. Ma trận Phân quyền Chức năng (Permission Matrix)

| Nhóm Chức Năng | Chi Tiết Nghiệp Vụ | Admin | Technician | Operator |
| :--- | :--- | :---: | :---: | :---: |
| **Xác thực** | Đăng nhập bằng Email / Mã NV + Password | ✔ | ✔ | ✔ |
| | Đổi mật khẩu cá nhân, cập nhật Avatar | ✔ | ✔ | ✔ |
| **Giám sát thời gian thực** | Xem Tổng quan Dây chuyền (Tier 1) | ✔ | ✔ | ✔ (Phạm vi ca/chuyền) |
| | Xem Danh sách Máy & PLC (Tier 2) | ✔ | ✔ | ✔ (Chỉ xem) |
| | Xem Chi tiết Cảm biến & Biểu đồ sóng (Tier 3) | ✔ | ✔ | ✔ (Chỉ xem) |
| **Xử lý Sự cố (Alarms)** | Xem Danh sách Cảnh báo thời gian thực | ✔ | ✔ | ✔ |
| | Tiếp nhận sự cố (Acknowledge Alarm) | ✔ | ✔ | ✔ |
| | Xác nhận Đã Khắc Phục (Resolve Alarm) + Ghi chú | ✔ | ✔ | ✖ *(Không được phép)* |
| | Xuất báo cáo sự cố (Excel/CSV UTF-8 BOM) | ✔ | ✔ | ✖ *(Ẩn nút)* |
| **Cấu hình & Quản trị** | Chỉnh sửa Ngưỡng cảm biến (Threshold Config) | ✔ | ✖ *(Chỉ xem)* | ✖ *(Ẩn tính năng)* |
| | Quản lý Tài khoản & Phân quyền User | ✔ | ✖ | ✖ |
| | Xem Nhật ký Thao tác (Audit Logs) | ✔ | ✖ | ✖ |
| **Tiện ích Hiện trường** | Quét mã QR định danh máy móc | ✔ | ✔ | ✔ |
| | Tra cứu Lịch sử Dữ liệu (Metric History) | ✔ | ✔ | ✔ (Chỉ xem) |

---

## 3. KIẾN TRÚC HỆ THỐNG & LUỒNG DỮ LIỆU

### 3.1. Luồng truyền nhận dữ liệu Cảm biến/PLC thời gian thực (IoT Data Pipeline)

Dữ liệu vật lý từ các cảm biến gắn trên máy móc cơ khí được chuyển đổi và đẩy liên tục lên trình duyệt Web qua kiến trúc Stream Event-Driven:

```
[ CẢM BIẾN NHÀ XƯỞNG ]
(Nhiệt độ, Gia tốc rung, Áp suất, Biến dòng CT)
         │  (Tín hiệu 4-20mA, 0-10V, RS485)
         ▼
[ BỘ ĐIỀU KHIỂN PLC / IO-LINK MASTER ]
(Siemens S7-1200 / Mitsubishi FX5U)
         │  (Giao thức Modbus TCP / OPC-UA / MQTT)
         ▼
[ INDUSTRIAL EDGE GATEWAY ]
(Định dạng JSON Telemetry Payload)
         │  (HTTP Post / MQTT / WebSocket Uplink)
         ▼
[ BACKEND SERVICE (Node.js / Express Engine) ]
   ├── 1. Kiểm tra Ngưỡng Cảnh Báo (Threshold Engine)
   ├── 2. Lưu trữ Trạng thái CSDL (MySQL Storage)
   └── 3. Bắn gói tin Real-time qua Socket.io Server
         │  (Websocket Protocol - Broadcast to Room)
         ▼
[ FRONTEND WEB APP (React 18 + Zustand Store) ]
   ├── Tiếp nhận Event `telemetry_update`
   ├── Cập nhật State trong RAM không giật lag
   └── Render giao diện: Đồng hồ Gauge, Sóng dao động, Thẻ chỉ số
```

#### Cấu trúc Gói tin Telemetry Payload (JSON)
```json
{
  "timestamp": "2026-10-06T07:15:30.125Z",
  "lineId": "line-assembly-01",
  "machineId": "cnc-denso-04",
  "machineStatus": "RUNNING",
  "metrics": {
    "spindle_temperature": { "value": 68.4, "unit": "°C", "quality": "GOOD" },
    "vibration_rms": { "value": 2.15, "unit": "mm/s", "quality": "GOOD" },
    "hydraulic_pressure": { "value": 142.8, "unit": "bar", "quality": "GOOD" },
    "current_load": { "value": 18.2, "unit": "A", "quality": "GOOD" },
    "motor_speed": { "value": 3200, "unit": "RPM", "quality": "GOOD" }
  }
}
```

---

### 3.2. Luồng quy trình Xử lý Sự cố & Cảnh báo (Alarm Handling Lifecycle)

Hệ thống thiết lập quy trình phản ứng khép kín 3 bước nhằm đảm bảo không có bất kỳ sự cố kỹ thuật nào bị bỏ sót:

```
  [ CẢM BIẾN VƯỢT NGƯỠNG ]
 (VD: Nhiệt độ vượt 85°C)
            │
            ▼
┌───────────────────────────────────────┐
│        BƯỚC 1: PHÁT SINH SỰ CỐ        │
│ ∙ Backend gắn cờ "PENDING"             │
│ ∙ Socket.io phát tán `alarm_triggered` │
│ ∙ Web hú còi cảnh báo + Đèn Andon Đỏ   │
│ ∙ Thêm dòng mới vào Bảng Alarm Log    │
└──────────────────┬────────────────────┘
                   │
                   │ Công nhân / Kỹ thuật viên thấy cảnh báo
                   ▼
┌───────────────────────────────────────┐
│         BƯỚC 2: TIẾP NHẬN XỬ LÝ       │
│             (ACKNOWLEDGE)             │
│ ∙ Bấm nút [Tiếp Nhận] trên Web         │
│ ∙ Lưu: Mã NV người nhận + Timestamp   │
│ ∙ Chuyển trạng thái sang "IN_PROGRESS"│
│ ∙ Tắt chuông báo, đèn chuyển VÀNG     │
└──────────────────┬────────────────────┘
                   │
                   │ Kỹ thuật viên kiểm tra cơ điện & sửa chữa xong
                   ▼
┌───────────────────────────────────────┐
│        BƯỚC 3: NGHIỆM THU HOÀN THÀNH  │
│               (RESOLVE)               │
│ ∙ Mở Modal Xác Nhận Hoàn Thành        │
│ ∙ Nhập nội dung: linh kiện thay thế   │
│ ∙ Backend kiểm tra thông số an toàn   │
│ ∙ Trạng thái chuyển sang "RESOLVED"   │
│ ∙ Ghi Audit Log & Lưu lịch sử sự cố   │
└───────────────────────────────────────┘
```

---

## 4. MÔ TẢ CHI TIẾT CHỨC NĂNG & CÁCH BIỂU DIỄN DỮ LIỆU

### 4.1. Giám sát Phân cấp 3 Cấp độ (Hierarchical Monitoring)

Mô hình thiết kế giao diện tuân theo nguyên lý thiết kế công nghiệp: **Tổng quan trước $\rightarrow$ Lọc theo cụm $\rightarrow$ Chi tiết chuyên sâu khi cần (Overview first, zoom and filter, details on demand)**.

```
┌─────────────────────────────────────────────────────────────────┐
│ TIER 1: PLANT / LINE OVERVIEW                                   │
│ ∙ Thẻ Dây Chuyền (Assembly, Stamping, Painting, Machining)      │
│ ∙ Trạng thái Andon tổng hợp (RUNNING / IDLE / ALARM)             │
│ ∙ Chỉ số OEE tóm tắt, Tốc độ chuyền (PPM), Tỷ lệ lỗi            │
└────────────────────────────────┬────────────────────────────────┘
                                 │ Click chọn 1 dây chuyền
                                 ▼
┌─────────────────────────────────────────────────────────────────┐
│ TIER 2: MACHINE / PLC LEVEL                                     │
│ ∙ Lưới thẻ Máy trong chuyền (CNC 01, Robot Arm, Máy Ép, Băng Tải)│
│ ∙ Badge màu nhấp nháy: Xanh lá (Normal), Vàng (Warn), Đỏ (Crit)  │
│ ∙ Thẻ tóm tắt các thông số sống tức thời của từng máy           │
└────────────────────────────────┬────────────────────────────────┘
                                 │ Click chọn 1 máy cụ thể / Quét QR
                                 ▼
┌─────────────────────────────────────────────────────────────────┐
│ TIER 3: SENSOR / METRIC DETAIL                                  │
│ ∙ Đồng hồ đo kim Gauge Chart (Vùng an toàn/nguy hiểm trực quan) │
│ ∙ Biểu đồ sóng thời gian thực Line Chart (Rolling 60 giây)      │
│ ∙ Bảng thông số kỹ thuật chi tiết: Tần số rung, Áp suất, Dòng điện│
└─────────────────────────────────────────────────────────────────┘
```

#### Quy chuẩn Biểu diễn Trực quan (UI Data Representation):
1. **Màu sắc Trạng thái (Industrial Semantic Palette):**
   - **Xanh lục (Emerald-500 `#10B981`):** `RUNNING` / `NORMAL` — Thiết bị hoạt động trong dải thông số lý tưởng.
   - **Vàng hổ phách (Amber-500 `#F59E0B`):** `IDLE` / `WARNING` — Máy tạm dừng chờ phôi hoặc thông số tiệm cận ngưỡng cảnh báo sớm.
   - **Đỏ tươi (Rose-600 `#E11D48`):** `CRITICAL` / `ALARM` — Sự cố nghiêm trọng, thông số vượt ngưỡng an toàn, nguy cơ hư hỏng thiết bị hoặc tai nạn lao động.
   - **Xám đậm (Slate-500 `#64748B`):** `OFFLINE` / `MAINTENANCE` — Máy ngắt điện hoặc đang dừng theo kế hoạch bảo trì.

2. **Dạng đồ thị sử dụng:**
   - **Đồng hồ đo kim (Radial / Gauge Chart):** Sử dụng cho các chỉ số có giới hạn vật lý rõ ràng (Nhiệt độ $0-120^\circ\text{C}$, Áp suất $0-250\,\text{bar}$). Vành đồng hồ chia 3 dải màu: Xanh lá $\rightarrow$ Vàng $\rightarrow$ Đỏ.
   - **Biểu đồ đường thời gian thực (Real-time Streaming Line Chart):** Sử dụng cho Độ rung và Tốc độ vòng quay. Cửa sổ trượt (Sliding Window) hiển thị 60 giây gần nhất, tự động trôi dữ liệu theo trục hoành $X$.
   - **Chỉ số tức thời (KPI Stat Badge):** Font chữ đơn không gian (Monospace: `font-mono`) hiển thị số đo lớn kèm đơn vị (`84.5 °C`, `2.15 mm/s`).

---

### 4.2. Quản lý Nhật ký Sự cố & Báo cáo (Alarm Log & Reporting)

Trang Nhật ký Cảnh báo (`AlarmLogView.tsx`) là trung tâm theo dõi và giải quyết sự cố với các thành phần chính:

1. **Thống kê Top-Card:**
   - 4 thẻ hiển thị tức thời: *Tổng số sự cố*, *Sự cố nghiêm trọng (Critical)*, *Chờ tiếp nhận (Pending)*, *Đang xử lý (In Progress)*.
2. **Bộ lọc Đa Tiêu Chí:**
   - Lọc theo Dây chuyền (`Line`), theo Mức độ nghiêm trọng (`Severity`), theo Trạng thái xử lý (`Status`), và Ô tìm kiếm tức thời theo từ khóa (Mã sự cố, Tên máy, Lỗi mô tả).
3. **Bảng Dữ liệu Động (Data Table):**
   - Cột: Mã sự cố $\rightarrow$ Dây chuyền $\rightarrow$ Thiết bị $\rightarrow$ Chỉ số đo & Giá trị vượt ngưỡng $\rightarrow$ Thời gian phát sinh $\rightarrow$ Trạng thái $\rightarrow$ Người tiếp nhận $\rightarrow$ Nút Thao tác.
4. **Modal Xác Nhận Hoàn Thành Xử Lý Sự Cố:**
   - Nền phủ mờ toàn trang (`bg-slate-900/50 backdrop-blur-sm fixed inset-0 z-50 animate-fade-in`) giúp tập trung tối đa thị giác người dùng.
   - Hộp thoại nổi bật (`rounded-2xl shadow-2xl bg-white dark:bg-slate-800 border p-6 max-w-lg`).
   - Tóm tắt thông tin sự cố, ô nhập liệu bắt buộc *Ghi chú khắc phục & biên bản xử lý*, cùng 2 nút hành động *Hủy* và *Xác Nhận Đã Khắc Phục* màu xanh lá.
5. **Xuất Báo Cáo Excel/CSV:**
   - Tự động mã hóa chuẩn **UTF-8 kèm Byte Order Mark (`\uFEFF`)**, đảm bảo mở trực tiếp trên Microsoft Excel không bị lỗi phông chữ tiếng Việt.

---

### 4.3. Quản trị & Cấu hình Ngưỡng (Threshold Configuration & Audit Log)

Trang Cấu hình Ngưỡng (`ConfigThresholdView.tsx`) và Quản lý Người dùng (`UserManagementView.tsx`) cung cấp công cụ kiểm soát an toàn cho Admin:

1. **Thiết lập Ngưỡng An Toàn (Thresholds Setting):**
   - Cho phép định nghĩa 4 mốc giá trị cho từng loại cảm biến:
     - `Min Warning` / `Max Warning`: Dải cảnh báo cần lưu ý theo dõi.
     - `Min Critical` / `Max Critical`: Dải nguy hiểm bắt buộc ngắt máy hoặc phát tín hiệu dừng khẩn cấp.
   - Hỗ trợ nút khôi phục ngưỡng mặc định ban đầu theo tiêu chuẩn kỹ thuật nhà sản xuất DENSO.
2. **Quản lý Tài khoản Doanh nghiệp:**
   - Bảng người dùng hiển thị Tên, Mã NV, Vai trò (SỬA / XEM), Trạng thái kích hoạt bằng Switch Toggle bo tròn mềm mại.
   - Modal Thêm Người Dùng nhập: Username, Họ tên, Quyền hạn (Hệ thống tự động sinh Email `@denso.com`, mã NV và mã hóa mật khẩu bcrypt).
   - Tính năng Reset mật khẩu về mặc định (`123456`) và Xóa tài khoản vĩnh viễn khỏi CSDL MySQL.
3. **Nhật ký Kiểm toán (Audit Logs):**
   - Lưu trữ tự động: *Thời điểm, Mã NV người thực hiện, Hành động (Thêm/Sửa/Xóa/Đổi ngưỡng), Dữ liệu cũ $\rightarrow$ Dữ liệu mới, Địa chỉ IP*. Đảm bảo tính minh bạch theo tiêu chuẩn ISO/IATF 16949.

---

### 4.4. Quét mã QR & Phân tích Dữ liệu Lịch sử (QR Scanner & Historical Trends)

1. **Tiện ích Quét mã QR (QR Code Scanner):**
   - Tích hợp thư viện quét mã vạch/QR qua camera thiết bị (`html5-qrcode`).
   - Mỗi máy cơ khí dán một tem QR chứa mã định danh (Ví dụ: `DENSO://MACHINE/CNC-04`).
   - Kỹ thuật viên khi đi kiểm tra xưởng chỉ cần bật camera quét tem $\rightarrow$ Hệ thống lập tức điều hướng trực tiếp đến trang thông số của máy đó trong vòng **< 1 giây**.
2. **Phân tích Xu hướng Lịch sử (Metric History Analytics):**
   - Cung cấp bộ chọn mốc thời gian: *1 Giờ qua*, *Theo Ca sản xuất (8 Giờ)*, *24 Giờ qua*, *7 Ngày qua*.
   - Đồ thị đối chiếu nhiều đường (Multi-axis Line Chart) cho phép so sánh mối tương quan giữa Nhiệt độ và Độ rung:
     - Hiện tượng thực tế: Khi độ rung vòng bi tăng dần theo thời gian là dấu hiệu mòn rãnh lăn, kéo theo nhiệt độ trục chính tăng vọt. Kỹ thuật viên có thể phát hiện hư hỏng trước từ 2-3 tuần.

---

## 5. HƯỚNG DẪN THAO TÁC NGƯỜI DÙNG (USER GUIDE HIGHLIGHTS)

### 5.1. Kịch bản dành cho Công nhân Vận hành (Operator Flow)
*Bối cảnh: Anh Nguyễn Văn A (Mã NV: DNS-1024) trực ca sản xuất tại Dây chuyền Lắp ráp 01.*

```
[ ĐĂNG NHẬP ]
Đăng nhập tài khoản Operator ──► Giao diện tự động mở Dây chuyền được phân công
       │
       ▼
[ THEO DÕI CA LÀM VIỆC ]
Quan sát trạng thái các máy trên màn hình. Nếu tất cả hiển thị Xanh lá: Ca chạy bình thường.
       │
       ▼ (Khi máy CNC-04 phát sinh rung động mạnh vượt ngưỡng cảnh báo)
[ PHÁT HIỆN SỰ CỐ ]
Còi Web kêu bip, Đèn tháp trên màn hình chuyển ĐỎ, Banner cảnh báo rung động nhấp nháy.
       │
       ▼
[ TIẾP NHẬN SỰ CỐ (ACKNOWLEDGE) ]
1. Bấm vào banner cảnh báo hoặc chuyển sang tab "Nhật Ký Sự Cố".
2. Tìm dòng sự cố CNC-04 ──► Bấm nút [Tiếp Nhận].
3. Hệ thống ghi nhận tên "Nguyễn Văn A" đã tiếp nhận, còi tắt, đèn chuyển VÀNG.
4. Gọi điện báo bộ phận Kỹ thuật viên bảo trì xưởng tới hiện trường.
```

---

### 5.2. Kịch bản dành cho Kỹ thuật viên Bảo trì (Technician Flow)
*Bối cảnh: Anh Trần Quang Huy (Mã NV: DNS-2001) nhận nhiệm vụ xử lý máy CNC-04.*

```
[ TIẾP CẬN THIẾT BỊ TẠI XƯỞNG ]
Cầm máy tính bảng/điện thoại di động đến vị trí máy CNC-04.
       │
       ▼
[ QUÉT MÃ QR TRÊN THÂN MÁY ]
Mở chức năng [Quét QR] trên Web ──► Hướng camera vào tem dán trên tủ điện máy.
Giao diện ngay lập tức mở trang Chi Tiết Thông Số của CNC-04.
       │
       ▼
[ CHẨN ĐOÁN VÀ SỬA CHỮA ]
1. Quan sát đồ thị sóng dao động và nhiệt độ ổ bi.
2. Thực hiện siết bu-lông chân máy, bơm dầu mỡ bôi trơn trục chính.
3. Cho máy chạy thử không tải: quan sát thấy độ rung giảm từ 4.8 mm/s về 1.2 mm/s (Dải xanh an toàn).
       │
       ▼
[ NGHIỆM THU & ĐÓNG SỰ CỐ (RESOLVE) ]
1. Mở tab "Nhật Ký Cảnh Báo" ──► Chọn sự cố đang xử lý của máy CNC-04.
2. Bấm nút [Hoàn Thành / Đã Khắc Phục].
3. Modal nổi bật hiện ra: Nhập nội dung "Đã siết chặt lại bu-lông bệ máy CNC và bổ sung mỡ bôi trơn SKF. Thông số rung đã về 1.2 mm/s ổn định".
4. Bấm [Xác Nhận Đã Khắc Phục].
5. Trạng thái chuyển sang Xanh lục (Resolved). Kết thúc quy trình.
```

---

## 6. DANH SÁCH THẮC MẮC & CÂU HỎI NHỜ MENTOR TƯ VẤN

Nhóm phát triển kính gửi Mentor các câu hỏi chuyên sâu về kiến trúc và chuẩn hóa công nghiệp để hoàn thiện dự án đạt chuẩn vận hành thực tế:

### 6.1. Câu hỏi về Giao thức Truyền dữ liệu & Tối ưu Băng thông
> **Câu hỏi 1:** *"Trong môi trường công nghiệp thực tế với hàng trăm PLC và cảm biến, nhóm nên áp dụng kiến trúc nào giữa **MQTT Broker (EMQX/Mosquitto)** và **Socket.io**? Liệu có nên dùng mô hình lai (Hybrid): PLC/Gateway gửi qua MQTT Broker $\rightarrow$ Backend nhận và chuyển tiếp qua Socket.io đến Web Client, hay nên cho Web Client kết nối MQTT over WebSocket trực tiếp tới Broker?"*
>
> *Mục tiêu cần mentor góp ý:* Đánh giá về khả năng chịu tải (Scalability), tính bảo mật (Authentication) và độ phức tạp khi triển khai hạ tầng.

### 6.2. Câu hỏi về Cơ sở Dữ liệu Chuỗi Thời Gian (Time-Series Database)
> **Câu hỏi 2:** *"Hiện tại hệ thống đang dùng MySQL để lưu trữ cả User, Cấu hình lẫn Lịch sử Log. Khi mở rộng tần số lấy mẫu lên 100ms - 500ms cho 50 máy (hàng triệu bản ghi mỗi ngày), MySQL sẽ gặp nút thắt cổ chai về I/O đĩa. Mentor khuyến nghị nên tích hợp giải pháp Time-Series Database nào: **TimescaleDB** (dựa trên PostgreSQL) hay **InfluxDB**? Cơ chế nén dữ liệu cũ (Downsampling / Data Retention Policy) trong các nhà máy của DENSO thường được cấu hình ra sao?"*
>
> *Mục tiêu cần mentor góp ý:* Lựa chọn công nghệ lưu trữ dữ liệu đo lường vừa đảm bảo tốc độ ghi cực nhanh, vừa truy vấn biểu đồ lịch sử mượt mà.

### 6.3. Câu hỏi về Chuẩn hóa Phân quyền Nhà máy & Bảo mật Doanh nghiệp
> **Câu hỏi 3:** *"Mô hình phân quyền RBAC hiện tại đang chia theo 3 nhóm vai trò (Admin, Technician, Operator). Trong thực tế nhà máy lớn, có cần áp dụng phân quyền theo thuộc tính (ABAC - Attribute-Based Access Control) như: phân quyền theo phân xưởng vật lý (Shop Floor Area), theo ca làm việc (Shift), và tích hợp hệ thống xác thực tập trung **LDAP / Microsoft Active Directory** của tập đoàn không ạ?"*
>
> *Mục tiêu cần mentor góp ý:* Định hướng mở rộng để hệ thống sẵn sàng tích hợp với hệ thống IT nội bộ của nhà máy.

### 6.4. Câu hỏi về Thuật toán Cảnh báo & Bảo trì Dự đoán (PdM)
> **Câu hỏi 4:** *"Hiện tại cơ chế cảnh báo đang dựa trên ngưỡng tĩnh (Static Threshold: Vượt Max là kêu). Để hướng tới bảo trì dự đoán thông minh (Predictive Maintenance), nhóm có nên cài đặt thêm các thuật toán phát hiện bất thường thống kê (như Moving Average, Z-Score) hoặc phân tích phổ tần số rung động FFT (Fast Fourier Transform) ngay trên Web/Backend không? Hay việc này nên giao cho các module Machine Learning chuyên dụng xử lý Offline?"*
>
> *Mục tiêu cần mentor góp ý:* Hướng đi thực tế và khả thi nhất cho phạm vi đồ án/dự án công nghiệp.

---

*Tài liệu được biên soạn bởi Nhóm Phát triển Dự án DENSO IoT Monitoring System.*
