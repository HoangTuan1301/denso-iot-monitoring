# DENSO IoT Monitoring System – KaiLink

## 1. Giới thiệu

DENSO IoT Monitoring System – KaiLink là một nền tảng **giám sát dây chuyền sản xuất thông minh** được thiết kế cho các nhà máy DENSO. Hệ thống thu thập, xử lý và hiển thị dữ liệu thời gian thực từ các thiết bị PLC, máy móc và cảm biến trên dây chuyền, đồng thời cung cấp các công cụ quản trị, cảnh báo và phân tích an toàn.

## 2. Mục tiêu & bài toán

- **Giám sát toàn bộ trạng thái** của dây chuyền (line) và máy móc (machine) trong thời gian thực.
- **Cảnh báo ngưỡng** (warning / critical) dựa trên các quy tắc kinh doanh (Business Rules) đã xác định.
- **Tính điểm an toàn** (Safety Score) cho từng dây chuyền.
- **Quản lý người dùng** với phân quyền RBAC (ADMIN, OPERATOR, MAINTENANCE).
- **Hỗ trợ nhập dữ liệu** từ file CSV (tùy chọn) và mô phỏng dữ liệu khi không có kết nối PLC thực.

## 3. Các chức năng thực tế

| Chức năng | Mô tả | Ghi chú |
|-----------|------|---------|
| Đăng nhập / Đăng ký | Xác thực JWT, refresh token. | Dùng `bcryptjs` để lưu mật khẩu băm. |
| Quản lý người dùng | CRUD người dùng, phân quyền. | |
| Quản lý dây chuyền & máy móc | Xem danh sách, chi tiết, cập nhật trạng thái. | |
| Dashboard thời gian thực | Biểu đồ, bản đồ mặt bằng, hiển thị trạng thái thiết bị qua WebSocket (`/ws`). | |
| Cảnh báo ngưỡng | Áp dụng các quy tắc (BR‑01 … BR‑15) để đánh giá trạng thái và gửi thông báo. | |
| Nhập file CSV (tùy chọn) | Giám sát thư mục, phân tích và đưa dữ liệu vào hệ thống khi `ENABLE_FILE_INGESTION=true`. | |
| Tính điểm an toàn | Dựa trên số lượng warning / critical, tính điểm (%) cho mỗi dây chuyền. | |
| API RESTful | Cung cấp các endpoint cho frontend và các hệ thống tích hợp khác. | |

## 4. Công nghệ sử dụng

- **Frontend**: React 18, Vite 6, TypeScript, TailwindCSS, Zustand, Framer Motion, Three.js (đồ họa 3D), `@heroui/react`.
- **Backend**: Node.js (ESM), Express 5, TypeScript, MySQL2 (promise), JWT (`jsonwebtoken`), Multer (upload ảnh), WebSocket (`ws`).
- **Database**: MySQL 8 (schema được tạo tự động khi server khởi động).
- **Công cụ hỗ trợ**: `concurrently` (chạy backend + frontend cùng lúc), `dotenv` (quản lý biến môi trường), `bcryptjs` (băm mật khẩu).

## 5. Kiến trúc tổng quan

```
+-------------------+        +--------------------+        +-------------------+
|   Frontend (Vite) | <----> |   Backend (Express) | <----> |   MySQL Database |
+-------------------+        +--------------------+        +-------------------+
        ^                      ^                ^
        | WebSocket (/ws)      |                |  (auto‑create tables)
        +----------------------+                |
                                                 |
                                         +-----------------+
                                         |  File Ingestion |
                                         +-----------------+
```
- **Frontend** giao tiếp với backend qua HTTP (REST) và WebSocket (`/ws`).
- **Backend** expose các endpoint, thực hiện xác thực JWT, quản lý RBAC, kết nối MySQL và khởi tạo schema nếu chưa tồn tại.
- **Database** chứa các bảng: `users`, `production_lines`, `machines`, `audit_logs`, `plc_stations` (được tạo trong `server/db-mysql.js`).

## 6. Cấu trúc thư mục source code

```
.
├─ .env.example               # mẫu cấu hình môi trường
├─ .gitignore                 # ignore node_modules, dist, .env …
├─ index.html                 # entry HTML cho Vite
├─ package.json               # scripts, dependencies
├─ tsconfig.json / tsconfig.node.json
├─ vite.config.ts
├─ postcss.config.js
├─ tailwind.config.js
├─ vercel.json                # cấu hình Deploy trên Vercel (nếu dùng)
├─ docs/                      # tài liệu dự án (SRS, runbook, diagram)
├─ src/                       # mã nguồn frontend
│   ├─ components/            # React components
│   ├─ pages/                 # các route / page
│   ├─ hooks/                 # custom hooks
│   ├─ stores/                # Zustand stores
│   ├─ services/              # API services
│   ├─ utils/                 # helper utils (mockData.ts, plcConverter.ts, …)
│   └─ index.tsx              # entry point React
├─ tests/                     # bộ kiểm thử (Jest / Cypress scripts)
├─ server/                    # backend Node.js
│   ├─ index.js               # entry point server
│   ├─ db-mysql.js            # khởi tạo DB, pool, seed
│   ├─ ingestion/ …           # file ingestion service (optional)
│   ├─ telemetry/ …           # WebSocket telemetry engine
│   └─ uploads/               # thư mục lưu avatar & machine ảnh
└─ ...
```

## 7. Yêu cầu môi trường cài đặt

| Yêu cầu | Phiên bản đề xuất |
|----------|------------------|
| Node.js | >= 20 (LTS) |
| npm      | >= 10 |
| MySQL    | 8.x (hoặc MariaDB tương thích) |
| Git      | bất kỳ |
| (Optional) Docker | để chạy MySQL trong container |

## 8. Cài đặt dependencies

```bash
# Tại thư mục gốc của dự án
npm install
```
Lệnh này sẽ cài đặt **cả frontend** và **backend** vì `package.json` chứa các dependency cho cả hai.

## 9. Cấu hình biến môi trường

1. Sao chép file mẫu:
   ```bash
   cp .env.example .env
   ```
2. Mở `.env` và chỉnh sửa các giá trị:
   - `PORT` – cổng backend (mặc định 5000).
   - `JWT_SECRET`, `JWT_REFRESH_SECRET` – khóa ký JWT (đặt giá trị ngẫu nhiên trong môi trường production).
   - `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` – thông tin kết nối MySQL.
   - `VITE_API_URL` và `VITE_WS_URL` (không bắt buộc trong chế độ dev, dùng khi build production).
   - `ENABLE_FILE_INGESTION` – `true` nếu muốn bật tính năng đọc CSV.
   - `FILE_INGESTION_WATCH_DIR` – đường dẫn thư mục quan sát khi bật ingestion.

> **Lưu ý**: Không được commit `.env` có chứa thông tin nhạy cảm.

## 10. Chạy frontend & backend trên localhost

### Chạy toàn bộ stack (đề xuất)
```bash
npm run dev
```
- Lệnh này sử dụng `concurrently` để khởi động **backend** (`npm:server`) và **frontend Vite** (`npm:vite`).
- Backend sẽ lắng nghe trên `http://localhost:5000`.
- Frontend dev server thường chạy trên `http://localhost:5173` và sẽ proxy các request API tới backend.

### Chạy riêng rẽ
- **Chỉ backend**:
  ```bash
  npm run server   # tương đương: node server/index.js
  ```
- **Chỉ frontend**:
  ```bash
  npm run vite     # khởi động Vite dev server
  ```
- **Build & preview (production)**:
  ```bash
  npm run build    # tạo thư mục dist
  npm run preview  # chạy server tĩnh để kiểm tra bản build
  ```

## 11. Chuẩn bị MySQL

1. **Tạo database** (nếu chưa có):
   ```sql
   CREATE DATABASE denso_iot CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
   ```
2. **Tạo người dùng** (nếu không dùng `root`):
   ```sql
   CREATE USER 'denso_user'@'%' IDENTIFIED BY 'your_password';
   GRANT ALL PRIVILEGES ON denso_iot.* TO 'denso_user'@'%';
   FLUSH PRIVILEGES;
   ```
3. Đảm bảo MySQL cho phép kết nối từ `localhost` (hoặc địa chỉ trong `DB_HOST`).
4. Khi server khởi động, **`server/db-mysql.js` sẽ tự tạo các bảng** (`users`, `production_lines`, `machines`, `audit_logs`, `plc_stations`) nếu chúng chưa tồn tại và **seed** dữ liệu mặc định cho người dùng, dây chuyền và máy móc.

## 12. Cơ chế khởi tạo database & giới hạn đã xác minh

- `initDatabase()` (trong `server/db-mysql.js`) thực hiện:
  1. **Tạo database** (chỉ khi không sử dụng SSL). Nếu MySQL không cho phép tạo database, lệnh sẽ bị bỏ qua và server sẽ tiếp tục kết nối tới database đã tồn tại.
  2. **Tạo connection pool** và log thành công.
  3. **Tạo các bảng** bằng câu lệnh `CREATE TABLE IF NOT EXISTS …` – do đó, nếu bảng đã tồn tại, không thay đổi cấu trúc.
  4. **Seed dữ liệu** – chỉ khi bảng `users` hoặc `production_lines` **trống**. Nếu bảng đã có dữ liệu, seed sẽ không được thực hiện.
- **Giới hạn**:
  - Không có hệ thống migration versioning; mọi thay đổi schema phải được cập nhật thủ công trong file `db-mysql.js`.
  - Khi **SSL** được bật (đối với dịch vụ Aiven/PlanetScale), việc tạo database tự động bị bỏ qua – người dùng phải tạo database và các bảng trước.
  - Các bảng **không** bao gồm các thực thể phụ (ví dụ: lịch sử sensor chi tiết) nếu chúng không được định nghĩa trong `db-mysql.js`.

## 13. Các lệnh build và kiểm thử hiện có

| Lệnh | Mô tả |
|------|------|
| `npm run dev` | Chạy backend + frontend trong môi trường development. |
| `npm run server` | Chỉ khởi động backend. |
| `npm run vite` | Chỉ khởi động frontend dev server. |
| `npm run build` | Kiểm tra TypeScript (`tsc --noEmit`) rồi tạo bundle production (`vite build`). |
| `npm run preview` | Chạy server tĩnh để xem bản build. |
| *(Không có script `test` trong `package.json`)* – các file test nằm trong thư mục `tests/` và được chạy bằng công cụ tùy chỉnh (Jest / Mocha) được cấu hình trong dự án con. Người nhận có thể thêm script `test` nếu muốn. |

## 14. Hướng dẫn triển khai và đường dẫn demo

> **Lưu ý**: Dự án có file `vercel.json` nên có thể triển khai trên Vercel bằng cách liên kết repository và thiết lập biến môi trường tương tự `.env`.

1. **Build** frontend: `npm run build` → thư mục `dist/`.
2. **Deploy** `dist/` lên bất kỳ static host** nào** (Vercel, Netlify, CloudFront…).
3. **Deploy** backend (Node.js) lên server có MySQL (Heroku, Railway, Render, VPS...).
4. Khi deploy, thiết lập biến môi trường `VITE_API_URL` và `VITE_WS_URL` sao cho frontend có thể gọi API và WebSocket tới backend.

Nếu muốn chạy **demo nhanh** trên localhost, chỉ cần thực hiện các bước trong mục **10** và **11**.

## 15. Hướng dẫn sử dụng các chức năng chính

| Chức năng | Cách truy cập | Ghi chú |
|-----------|----------------|--------|
| Đăng nhập | `POST /api/auth/login` (frontend: trang Login) | Trả về `accessToken` và `refreshToken`. |
| Xem Dashboard | URL `/dashboard` (frontend) | Kết nối WebSocket `/ws` để nhận dữ liệu thời gian thực. |
| Quản lý người dùng | Menu **Quản trị → Người dùng** (frontend) | Chỉ ADMIN mới được quyền. |
| Quản lý dây chuyền | Menu **Quản trị → Dây chuyền** (frontend) | CRUD dây chuyền, tính safety score. |
| Quản lý máy móc | Menu **Quản trị → Máy móc** (frontend) | CRUD máy móc, gán vào dây chuyền. |
| Xem chi tiết máy | Menu **Máy móc → Chi tiết** (frontend) | Hiển thị trạng thái, QR code, lịch sử cảnh báo. |
| Cảnh báo ngưỡng | UI hiển thị **badge** màu vàng / đỏ dựa trên `evaluateMetricStatus` (được triển khai trong `src/utils/plcConverter.ts`). |
| Nhập file CSV (tùy chọn) | Khi `ENABLE_FILE_INGESTION=true`, đặt file CSV vào thư mục được cấu hình (`FILE_INGESTION_WATCH_DIR`). Hệ thống sẽ tự parse và ghi vào CSDL. |

## 16. Thông tin nhóm phát triển

- **Dự án**: DENSO IoT Monitoring System – KaiLink
- **Người chịu trách nhiệm chính**: *không công khai* (thông tin sẽ được bổ sung bởi nhóm trưởng).
- **Liên hệ**: *địa chỉ email hoặc kênh Slack sẽ được cung cấp khi bàn giao.*

---

*File README này được tạo dựa trên mã nguồn hiện có. Vui lòng kiểm tra lại các phần liên quan tới môi trường triển khai và thông tin liên hệ trước khi phát hành.*