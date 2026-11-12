# BÁO CÁO KIỂM TOÁN KIẾN TRÚC AI & GIẢ LẬP SỰ CỐ
## DỰ ÁN: DENSO SMART FACTORY — INDUSTRIAL IOT MONITORING SYSTEM (KAILINK)
**Phiên bản kiểm toán:** PRE-AI UPGRADE AUDIT v1.0  
**Ngày thực hiện:** 12/11/2026  
**Chế độ thực thi:** Read-Only Audit (Không thay đổi mã nguồn, không ghi CSDL Production)

---

## 1. TỔNG QUAN ĐIỀU HÀNH (EXECUTIVE SUMMARY)

Đợt kiểm toán kiến trúc toàn diện này được thực hiện trước khi nâng cấp phân hệ **AI Giám sát & Dự đoán (AI Intelligence)** nhằm đánh giá thực trạng luồng dữ liệu, tính toàn vẹn của mô hình AI, và mối liên kết giữa chức năng **Giả lập sự cố** với module AI trong mã nguồn dự án DENSO Smart Factory.

### Các kết luận cốt lõi:
1. **Sự tồn tại của hai hệ thống giả lập song song và hoàn toàn cô lập (VERIFIED):**
   - **Hệ thống 1 — Header Incident Simulation:** Nút *"Giả lập Sự cố"* tại thanh tiêu đề (`Header.tsx`) tác động trực tiếp vào `useMonitoringStore` và `useAlarmStore`. Hệ thống này làm đổi màu Dashboard, đổi trạng thái Dây chuyền và Thiết bị sang `critical`, sinh cảnh báo khẩn cấp và ghi log kiểm toán.
   - **Hệ thống 2 — AI Module Simulation:** Thanh công cụ *"Mô phỏng AI"* (`AISimulationControls.tsx`) nằm trong tab AI, quản lý 5 kịch bản độc lập qua `useAIStore` và `aiSimulationEngine.ts`.
   - **Mối liên hệ giữa 2 hệ thống: HOÀN TOÀN KHÔNG CÓ (0% TƯƠNG TÁC).** Khi kích hoạt sự cố trên Header, Dashboard báo động đỏ nhưng AI Module vẫn báo 100% an toàn (98/100 điểm). Ngược lại, khi kích hoạt kịch bản lỗi trong AI Module, điểm số AI giảm nhưng Dashboard và danh mục cảnh báo vẫn hoàn toàn bình thường.
2. **Bản chất thực tế của Phân hệ AI hiện tại (VERIFIED):**
   - **0% Machine Learning:** Không có mô hình ML nào được huấn luyện (không có TensorFlow, PyTorch, ONNX, scikit-learn).
   - **0% LLM Integration:** Trợ lý AI KaiLink không kết nối với bất kỳ API mô hình ngôn ngữ lớn nào (không OpenAI, không Gemini, không Claude, không Ollama). Trợ lý hoạt động bằng kỹ thuật so khớp từ khóa cơ bản (`if (q.includes(...))`) với mẫu câu dựng sẵn.
   - **100% Mock & Thuật toán Giả lập cục bộ trên Frontend:** Cả 4 tab AI không gọi bất kỳ REST API nào từ Backend, không truy vấn CSDL và không đọc chuỗi dữ liệu đo lường thời gian thực (Telemetry).
3. **Nguyên nhân chỉ số "14/14 An toàn" và "Điểm sức khỏe 98/100" (VERIFIED):**
   - Hàm `computeEquipmentHealth()` trong `aiSimulationEngine.ts` tính điểm bằng công thức cố định: `100 - agePenalty` (với `agePenalty = 2 ÷ 3`).
   - Hàm này hoàn toàn bỏ qua trạng thái thực tế của máy trong database (`status: 'no_data'`), không kiểm tra telemetry hay cảnh báo, dẫn đến việc 7 máy mới chưa có dữ liệu PLC vẫn được hệ thống AI tự động xếp loại là "An toàn tuyệt đối" (97-98 điểm).
4. **Định hướng kiến trúc:** Cần loại bỏ thanh chọn kịch bản riêng trong AI, xây dựng **Unified Simulation & Telemetry Adapter** lấy `useMonitoringStore` làm nguồn dữ liệu duy nhất (Single Source of Truth) phục vụ đồng bộ cho cả Dashboard và 4 tab AI.

---

## 2. KIẾN TRÚC HỆ THỐNG HIỆN TẠI (CURRENT SYSTEM ARCHITECTURE)

Hệ thống DENSO Smart Factory hiện đang vận hành theo mô hình phân tách sau:

```
+---------------------------------------------------------------------------------------------------+
|                                      NGƯỜI DÙNG / TRÌNH DUYỆT                                      |
+-------------------------------------------------+-------------------------------------------------+
                                                  |
                                                  v
+---------------------------------------------------------------------------------------------------+
|                                       HỆ THỐNG GIAO DIỆN FRONTEND                                 |
|                                                                                                   |
|  +---------------------------------------+       +---------------------------------------------+  |
|  |       LUỒNG VẬN HÀNH CHÍNH            |       |           LUỒNG AI INTELLIGENCE             |  |
|  |       (Dashboard, Lines, Devices)     |       |           (4 Tabs AI Command Center)        |  |
|  |                                       |       |                                             |  |
|  |  +---------------------------------+  |       |  +---------------------------------------+  |  |
|  |  | Header: Nút "Giả lập Sự cố"     |  |       |  | AISimulationControls: 5 Kịch bản      |  |  |
|  |  | (Header.tsx)                    |  |       |  | (AISimulationControls.tsx)            |  |  |
|  |  +----------------+----------------+  |       |  +-------------------+-------------------+  |  |
|  |                   |                   |       |                      |                      |  |
|  |                   v                   |       |                      v                      |  |
|  |  +---------------------------------+  |       |  +---------------------------------------+  |  |
|  |  | useMonitoringStore.ts           |  |       |  | useAIStore.ts                         |  |  |
|  |  | - lines, machines, metrics     |  |       |  | - activeScenarioId, isDemoActive      |  |  |
|  |  | - triggerEmergencyDemo()        |  |       |  | - selectedMachineId, chatHistory      |  |  |
|  |  | - resetEmergencyDemo()          |  |       |  +-------------------+-------------------+  |  |
|  |  +----------------+----------------+  |       |                      |                      |  |
|  |                   |                   |       |                      v                      |  |
|  |                   v                   |       |  +---------------------------------------+  |  |
|  |  +---------------------------------+  |       |  | aiSimulationEngine.ts (100% Local)    |  |  |
|  |  | useAlarmStore.ts                |  |       |  | - computeEquipmentHealth()            |  |  |
|  |  | - triggerNewAlarm(isDemo: true) |  |       |  | - generateTrendPoints() (Sin wave)    |  |  |
|  |  +---------------------------------+  |       |  | - generateAnomalyEvents() (Hardcoded) |  |  |
|  |                   |                   |       |  | - generatePredictiveOrders() (Mock)   |  |  |
|  |                   | (Audit Log)       |       |  | - answerAssistantQuery() (Keywords)   |  |  |
|  +-------------------|-------------------+       |  +---------------------------------------+  |  |
|                      |                           +---------------------------------------------+  |
|                      |                                                  |                         |
+----------------------|--------------------------------------------------|-------------------------+
                       |                                                  | (HOÀN TOÀN KHÔNG GỌI API)
                       v                                                  x
+---------------------------------------------------+                     |
|            BACKEND RENDER & MYSQL AIVEN           |                     |
|  - REST API (/api/lines, /api/machines, /api/auth)| <-------------------+
|  - WebSocket Telemetry (ws://.../ws)              |
|  - Database: 14 máy, 11 metric mappings           |
+---------------------------------------------------+
```

---

## 3. KIỂM TOÁN CHỨC NĂNG GIẢ LẬP SỰ CỐ (EXISTING SIMULATION SCENARIOS)

Qua rà soát mã nguồn, hệ thống đang tồn tại **hai hệ thống kịch bản giả lập độc lập**:

### 3.1. Hệ thống Giả lập Sự cố Khẩn cấp trên Header (Header Emergency Simulation)
- **Vị trí trên giao diện:** Góc phải thanh Header chính (`src/components/common/Header.tsx:229-238`), nút viền vàng/đỏ có nhãn *"Giả lập Sự cố"* (kèm icon `AlertOctagon`). Chỉ hiển thị đối với tài khoản vai trò `ADMIN`.
- **Cơ chế thực thi:** 
  - Gọi trực tiếp hàm `triggerEmergencyDemo()` tại [`src/stores/useMonitoringStore.ts:935-1047`](file:///e:/HOCTAP/Denso/WEBAPPIOT/src/stores/useMonitoringStore.ts#L935-L1047).
  - Chọn máy và thông số đang được quan sát (hoặc ngẫu nhiên nếu chưa chọn).
  - Tính toán giá trị đột biến: `spikeValue = crit + (crit - warn) * 1.5 + 2`, đẩy giá trị vượt 20-50% trên ngưỡng nguy hiểm (`criticalMax`).
  - Gán cờ `isEmergencySpike: true`, cập nhật `metric.currentValue` và mảng `metric.history`.
  - Chuyển `machine.status` và `line.status` sang `'critical'`.
  - Sinh cảnh báo mới qua `useAlarmStore.getState().triggerNewAlarm(...)` với cờ `isDemo: true`, `source: 'DEMO'`.
  - Gửi log kiểm toán lên backend qua `apiClient.recordAudit('TRIGGER_EMERGENCY', ...)`.
- **Cơ chế khôi phục (Reset):** Nút *"Khôi phục ngay"* trên banner gọi `resetEmergencyDemo()` ([`src/stores/useMonitoringStore.ts:885-929`](file:///e:/HOCTAP/Denso/WEBAPPIOT/src/stores/useMonitoringStore.ts#L885-L929)), khôi phục giá trị nominal theo baseline, xóa cờ `isEmergencySpike`, chuyển trạng thái về `'normal'` và đóng các cảnh báo có `isDemo: true` trong `useAlarmStore`.
- **Đặc điểm dữ liệu:** Tác động trực tiếp vào một điểm thời gian và đẩy vào mảng 20 điểm lịch sử của metric trong Zustand.

### 3.2. Hệ thống Mô phỏng Kịch bản trong Phân hệ AI (AI Module Scenarios)
- **Vị trí trên giao diện:** Nằm tại toolbar trên cùng của trang AI Giám sát & Dự đoán (`src/features/ai-intelligence/components/AISimulationControls.tsx`).
- **Mã nguồn định nghĩa:** [`src/features/ai-intelligence/simulation/aiSimulationEngine.ts:162-213`](file:///e:/HOCTAP/Denso/WEBAPPIOT/src/features/ai-intelligence/simulation/aiSimulationEngine.ts#L162-L213).
- **Số lượng kịch bản:** Gồm đúng **5 kịch bản** được lập trình:

| STT | Mã kịch bản (`id`) | Tên kịch bản | Thiết bị tác động | Thông số tác động (`Metrics`) | Giá trị mô phỏng | Mức độ (`Severity`) |
| :---: | :--- | :--- | :--- | :--- | :--- | :---: |
| **1** | `normal` | Kịch bản 1: Hoạt động Tiêu chuẩn | Toàn bộ thiết bị (`ALL`) | Tất cả thông số chuẩn | Mức định mức danh định (`nominal`) | `low` |
| **2** | `high_temp` | Kịch bản 2: Quá nhiệt Trục chính & Dầu Thủy lực | `MCH-PRS-01` (Máy dập 500T - LINE-01) | `TEMP_HYD` (Nhiệt độ dầu)<br>`PRESSURE_HYD` (Áp suất ép) | 86.4 °C (Vượt Crit 80°C)<br>236 bar (Vọt áp) | `critical` |
| **3** | `abnormal_vibration` | Kịch bản 3: Rung động Bất thường Robot Hàn | `MCH-WLD-01` (Robot hàn Fanuc - LINE-01) | `VIB_RMS` (Vận tốc rung hiệu dụng) | 8.4 mm/s (Vượt Crit 7.0 mm/s) | `high` |
| **4** | `multiple_anomalies` | Kịch bản 4: Đa Thiết bị Bất thường Đồng thời | `MCH-DRY-01` (Lò sấy - LINE-02)<br>`MCH-PRS-01` (Máy dập - LINE-01) | `TEMP_CHAMBER` (Nhiệt lò sấy)<br>`PRESSURE_HYD` (Áp suất ép) | 188.0 °C (Vượt Crit 185°C)<br>142 bar (Tụt sâu áp) | `critical` |
| **5** | `recovery` | Kịch bản 5: Phục hồi Ổn định sau Bảo trì | Toàn bộ thiết bị (`ALL`) | Tất cả thông số | Trở về vùng xanh an toàn | `low` |

### 3.3. Bảng tổng hợp đối chiếu hai hệ thống Giả lập

| Tiêu chí | Hệ thống 1 (Header Incident Simulation) | Hệ thống 2 (AI Module Simulation) | Đánh giá kiến trúc |
| :--- | :--- | :--- | :--- |
| **Giao diện kích hoạt** | Nút trên Header chính (Toàn cục) | Toolbar trong màn hình AI Giám sát | **Trùng lặp giao diện điều khiển** |
| **Phạm vi tác động** | `useMonitoringStore`, `useAlarmStore` | `useAIStore`, `aiSimulationEngine` | **Hai kho dữ liệu riêng biệt** |
| **Tác động Dashboard** | Có (Đổi màu dây chuyền, máy, cảnh báo) | Không tác động | **Bất nhất trải nghiệm người dùng** |
| **Tác động Module AI** | **Không nhận được dữ liệu (0%)** | Có (Đổi điểm sức khỏe AI, sinh bất thường) | **AI bị "mù" trước sự cố Header** |
| **Loại dữ liệu sinh ra** | Đột biến giá trị tức thời + điểm lịch sử | Mảng dữ liệu toán học (Hàm Sin + Ramp) | Khác biệt cơ chế tạo chuỗi thời gian |
| **Lưu trữ dữ liệu** | Bộ nhớ RAM Zustand | Bộ nhớ RAM Zustand | Không lưu localStorage, mất khi F5 |
| **Nguy cơ ghi đè CSDL** | Không (Chỉ ghi audit log qua POST API) | Không (Không gọi bất kỳ API nào) | **Tuyệt đối an toàn cho CSDL** |
| **Nguy cơ can thiệp PLC** | 0% (Không có API ghi thanh ghi PLC) | 0% (Không có kết nối PLC) | **Tuyệt đối an toàn cho PLC thật** |

---

## 4. KIỂM TOÁN NGUỒN DỮ LIỆU CỦA 4 TAB PHÂN HỆ AI (AI MODULE DATA SOURCE AUDIT)

### Tab 1 — Tổng quan AI (AI Overview Tab)
- **Mã nguồn:** [`src/features/ai-intelligence/tabs/AIOverviewTab.tsx`](file:///e:/HOCTAP/Denso/WEBAPPIOT/src/features/ai-intelligence/tabs/AIOverviewTab.tsx)
- **Nguồn dữ liệu:**
  - Danh sách thiết bị đầu vào: Nhận `machines` truyền từ `AIIntelligenceView.tsx`. Nếu `useMonitoringStore.lines` đã nạp, `machines` gồm 14 thiết bị; nếu chưa nạp, sử dụng mảng dự phòng `FALLBACK_MACHINES` (6 thiết bị).
  - Điểm sức khỏe & Phân bổ rủi ro: Được tính toán bởi hàm `computeAllEquipmentHealth(machines, activeScenarioId, isDemoActive)` trong `aiSimulationEngine.ts`.
  - Biểu đồ xu hướng: Do hàm `generateTrendPoints()` sinh chuỗi điểm giả định theo sóng hình Sin: `nominal + Math.sin(i * 0.6) * (nominal * 0.04)`.
- **Bằng chứng giải mã hiện tượng 14/14 An toàn & Điểm sức khỏe 98/100:**
  - Tại [`aiSimulationEngine.ts:224-231`](file:///e:/HOCTAP/Denso/WEBAPPIOT/src/features/ai-intelligence/simulation/aiSimulationEngine.ts#L224-L231), hàm đặt `base = 100`, các điểm phạt vi phạm (`tempPenalty`, `vibrationPenalty`, `pressurePenalty`) mặc định là `0`. Điểm phạt khấu hao `agePenalty = 2 ÷ 3`.
  - Khi kịch bản là `normal` (mặc định), không có máy nào bị phạt vi phạm: `finalScore = 100 - agePenalty = 97` hoặc `98`.
  - Vì `finalScore >= 90`, hệ thống tự động gán `riskLevel = 'LOW'` và `status = 'NORMAL'`.
  - Thuật toán hoàn toàn không kiểm tra thuộc tính `machine.status === 'no_data'` hay `machine.status === 'critical'`, cũng không kiểm tra xem máy có metric nào đang kết nối hay không.
  - Do đó: **Toàn bộ 14 máy (kể cả 7 máy mới chưa có dữ liệu PLC) đều được chấm 97-98 điểm và tính là "An toàn".**

### Tab 2 — Phát hiện Bất thường (Anomaly Detection Tab)
- **Mã nguồn:** [`src/features/ai-intelligence/tabs/AIAnomalyDetectionTab.tsx`](file:///e:/HOCTAP/Denso/WEBAPPIOT/src/features/ai-intelligence/tabs/AIAnomalyDetectionTab.tsx)
- **Nguồn dữ liệu:** Hàm `generateAnomalyEvents(healthList, activeScenarioId, isDemoActive)` tại [`aiSimulationEngine.ts:513-629`](file:///e:/HOCTAP/Denso/WEBAPPIOT/src/features/ai-intelligence/simulation/aiSimulationEngine.ts#L513-L629).
- **Thuật toán phát hiện:** **HOÀN TOÀN KHÔNG CÓ THUẬT TOÁN ĐỘNG.**
  - Không có Isolation Forest, One-Class SVM, Z-Score hay Moving Average tính toán trên dữ liệu thật.
  - Hàm sử dụng câu lệnh `switch(scenarioId)` để trả về các đối tượng sự kiện được dựng sẵn (hardcoded mock data):
    - `high_temp` $\rightarrow$ Trả về đúng 2 sự kiện: `ANM-PRS-001` (86.4°C) và `ANM-PRS-002` (236 bar).
    - `abnormal_vibration` $\rightarrow$ Trả về đúng 1 sự kiện: `ANM-WLD-001` (8.4 mm/s).
    - `multiple_anomalies` $\rightarrow$ Trả về đúng 2 sự kiện: `ANM-DRY-001` (188°C) và `ANM-PRS-003` (142 bar).
    - `normal` $\rightarrow$ Trả về mảng rỗng `[]`.
- **Kết luận:** Tab 2 hoàn toàn không nhận diện được bất kỳ sự cố nào phát sinh từ hệ thống đo lường thực tế hay sự cố kích hoạt từ nút Header.

### Tab 3 — Dự đoán Bảo trì (Predictive Maintenance Tab)
- **Mã nguồn:** [`src/features/ai-intelligence/tabs/AIPredictiveMaintenanceTab.tsx`](file:///e:/HOCTAP/Denso/WEBAPPIOT/src/features/ai-intelligence/tabs/AIPredictiveMaintenanceTab.tsx)
- **Nguồn dữ liệu:** Hàm `generatePredictiveOrders()` tại [`aiSimulationEngine.ts:634-763`](file:///e:/HOCTAP/Denso/WEBAPPIOT/src/features/ai-intelligence/simulation/aiSimulationEngine.ts#L634-L763).
- **Thuật toán dự đoán RUL (Remaining Useful Life):** **KHÔNG CÓ.**
  - Thời gian suy thoái dự kiến (`estimatedTimeToDegrade`) là các chuỗi văn bản tĩnh được viết sẵn kèm nhãn `(Mô phỏng Demo)` như: `"> 720 giờ máy (Mô phỏng Demo)"`, `"Khoảng 4 - 6 giờ máy (Mô phỏng Demo)"`.
  - Danh sách phiếu bảo trì (P1 Khẩn cấp, P2 Ưu tiên cao, P4 Định kỳ) được sinh tĩnh dựa theo kịch bản chọn trong `useAIStore`.
- **Kết luận:** Tab 3 đưa ra các khuyến nghị bảo dưỡng độc lập hoàn toàn với lịch sử chạy máy hay dữ liệu sensor thực tế.

### Tab 4 — Trợ lý AI KaiLink (AI Assistant Tab)
- **Mã nguồn:** [`src/features/ai-intelligence/tabs/AIAssistantTab.tsx`](file:///e:/HOCTAP/Denso/WEBAPPIOT/src/features/ai-intelligence/tabs/AIAssistantTab.tsx)
- **Động cơ trả lời:** Hàm `answerAssistantQuery()` tại [`aiSimulationEngine.ts:769-911`](file:///e:/HOCTAP/Denso/WEBAPPIOT/src/features/ai-intelligence/simulation/aiSimulationEngine.ts#L769-L911).
- **Bản chất công nghệ:**
  - **Không sử dụng bất kỳ LLM API nào.**
  - Thực hiện so khớp chuỗi chữ thường `q.toLowerCase().includes(...)` với 5 nhóm từ khóa:
    1. Nhóm từ khóa *"nguy cơ/nguy cấp/hỏng/rủi ro"* $\rightarrow$ Lấy máy có điểm thấp nhất trong `healthList` giả lập.
    2. Nhóm từ khóa *"nhiệt độ/máy dập/mch-prs-01"* $\rightarrow$ Trả về đoạn văn mẫu giải thích lỗi máy dập MCH-PRS-01.
    3. Nhóm từ khóa *"rung/robot/wld/hàn"* $\rightarrow$ Trả về đoạn văn mẫu chẩn đoán rung động MCH-WLD-01.
    4. Nhóm từ khóa *"kế hoạch/bảo trì/bảo dưỡng/phiếu"* $\rightarrow$ Đếm số phiếu bảo trì trong `orders` giả lập.
    5. Mặc định $\rightarrow$ Trả về mẫu câu chào hỏi và tóm tắt điểm sức khỏe trung bình giả lập.
- **Rủi ro vận hành:** Nếu trên nhà máy xảy ra sự cố thật (ví dụ trạm cấp phôi `MC-FDR-01` bị mất áp suất), người dùng hỏi Trợ lý AI sẽ nhận được câu trả lời khẳng định: *"Toàn bộ 14 thiết bị hiện đang hoạt động ổn định trong vùng an toàn"*. Đây là rủi ro sai lệch thông tin nghiêm trọng.

---

## 5. MA TRẬN LIÊN THÔNG: GIẢ LẬP SỰ CỐ VÀ PHÂN HỆ AI (SIMULATION-TO-AI INTEGRATION MATRIX)

| Tình huống kiểm thử | Hành vi Dashboard & Giám sát | Hành vi Module AI (4 Tabs) | Nhận định kỹ thuật |
| :--- | :--- | :--- | :--- |
| **Tình huống A:<br>Hệ thống bình thường (Chưa chạy giả lập)** | - Dashboard hiển thị sơ đồ 3 dây chuyền, 14 máy.<br>- 7 máy có dữ liệu hiển thị trạng thái thực.<br>- 7 máy chưa nối PLC hiển thị `no_data`. | - Tab 1: Hiển thị 14/14 máy an toàn, sức khỏe 98/100.<br>- Tab 2: 0 bất thường.<br>- Tab 3: Phiếu bảo trì định kỳ P4.<br>- Tab 4: Báo toàn bộ ổn định. | **BẤT NHẤT:**<br>AI không nhận biết trạng thái `no_data` của 7 máy mới, tự động báo an toàn 100%. |
| **Tình huống B1:<br>Bấm "Giả lập Sự cố" trên Header** | - Toast báo động đỏ xuất hiện.<br>- Một máy và dây chuyền chuyển sang màu đỏ (`critical`).<br>- Bảng Cảnh báo & Sự cố nhận 1 alarm `isDemo: true`. | - Tab 1: **Vẫn hiển thị 14/14 an toàn, sức khỏe 98/100!**<br>- Tab 2: **Vẫn 0 cảnh báo bất thường!**<br>- Tab 3: **Vẫn P4 định kỳ!**<br>- Tab 4: **Khẳng định nhà máy an toàn!** | **CÔ LẬP HOÀN TOÀN:**<br>Dữ liệu sự cố của Header chỉ nằm trong `useMonitoringStore` và `useAlarmStore`, AI Module không hề đọc các store này. |
| **Tình huống B2:<br>Chọn Kịch bản lỗi trong Toolbar AI** | - Dashboard **hoàn toàn bình thường (xanh)**.<br>- Dây chuyền không có cảnh báo.<br>- Bảng Cảnh báo không có alarm mới.<br>- Header không có toast. | - Tab 1: Điểm máy mục tiêu tụt xuống 48-52 (Đỏ/Vàng).<br>- Tab 2: Xuất hiện sự cố bất thường `ANM-xxx`.<br>- Tab 3: Xuất hiện lệnh bảo trì P1/P2.<br>- Tab 4: Trợ lý giải thích nguyên nhân lỗi. | **CÔ LẬP HOÀN TOÀN:**<br>Dữ liệu kịch bản AI chỉ thay đổi trong `useAIStore`, không phát tín hiệu sang `useMonitoringStore`. |
| **Tình huống C:<br>Khôi phục / Reset giả lập** | - Bấm *"Khôi phục ngay"* trên Header $\rightarrow$ Dashboard và Alarms trở về chuẩn, nhưng không ảnh hưởng kịch bản AI nếu đang chạy.<br>- Bấm *"Đặt lại"* trong AI $\rightarrow$ AI trở về Kịch bản 1, nhưng không giải quyết sự cố Header nếu đang kích hoạt. | **HAI CÔNG TẮC ĐỘC LẬP:**<br>Người dùng phải reset ở cả 2 nơi mới đưa giao diện về trạng thái chuẩn đồng nhất. |

---

## 6. PHÂN TÍCH TÌNH TRẠNG DỮ LIỆU 14 MÁY VÀ TRẠNG THÁI `NO_DATA`

### 6.1. Đối chiếu danh mục thiết bị thực tế
Theo kiểm toán CSDL Aiven Production (Migration 005) và API backend `/api/machines`:
- **Tổng số máy:** 14 máy.
- **Phân bổ 3 dây chuyền (6–4–4):**
  - **LINE-01 (6 máy):** `MCH-PRS-01`, `MCH-WLD-01`, `MC-ASM-01`, `MC-CYL-01`, `MC-FDR-01`, `MC-TEST-C01`.
  - **LINE-02 (4 máy):** `MCH-DRY-01`, `MCH-PNT-01`, `MC-DRY-01`, `MC-PNT-01`.
  - **LINE-03 (4 máy):** `MCH-ASM-01`, `MCH-TST-01`, `MCH-MS10` (Code: `MS-10`), `MC-TST-01`.

### 6.2. Phân loại trạng thái vận hành vs trạng thái dữ liệu

| Nhóm máy | Số lượng | Trạng thái Database | Trạng thái hiển thị đúng chuẩn | Trạng thái hiển thị trong AI Module hiện tại | Nhận xét rủi ro |
| :--- | :---: | :---: | :---: | :---: | :--- |
| **Máy hiện hữu (Legacy)** | 7 máy | `normal` / `active` | Có dữ liệu PLC / Ingestion | Điểm sức khỏe: 97-98đ (`NORMAL`) | Hoạt động bình thường theo kịch bản |
| **Máy mới bổ sung (New)** | 7 máy | `no_data` | `Chưa có dữ liệu PLC` (Chấm xám, Không có điểm số) | **Điểm sức khỏe: 97đ (`NORMAL` - An toàn)** | **VI PHẠM NGUYÊN TẮC:** Máy không có dữ liệu bị gán nhãn an toàn, tạo ảo giác hệ thống 100% hoàn hảo. |

---

## 7. BẢNG PHÂN LOẠI NĂNG LỰC AI THỰC TẾ (AI CAPABILITY CLASSIFICATION)

Bảng phân loại dưới đây áp dụng tiêu chuẩn kiểm toán kỹ thuật phần mềm công nghiệp:

| Thành phần chức năng | Phân loại năng lực thực tế | Công nghệ / Thuật toán sử dụng | Trạng thái xác minh | Bằng chứng mã nguồn |
| :--- | :--- | :--- | :---: | :--- |
| **KPI Sức khỏe Tổng quan** | **Simulation / Rule-based** | Trừ điểm khấu hao cố định (`100 - agePenalty`) | **VERIFIED** | `aiSimulationEngine.ts:224-349` |
| **Biểu đồ Xu hướng AI** | **Simulation** | Hàm toán học hình Sin (`Math.sin`) + độ dốc Ramp | **VERIFIED** | `aiSimulationEngine.ts:418-508` |
| **Phát hiện Bất thường** | **Mock / Hardcoded** | Đối tượng JSON tĩnh dựng sẵn trong `switch-case` | **VERIFIED** | `aiSimulationEngine.ts:513-629` |
| **Dự đoán RUL & Bảo trì** | **Mock / Hardcoded** | Mảng đối tượng phiếu công tác tĩnh, văn bản mẫu | **VERIFIED** | `aiSimulationEngine.ts:634-763` |
| **Trợ lý AI KaiLink** | **Rule-based (Pattern Matching)** | So khớp từ khóa chuỗi tĩnh (`String.includes`) | **VERIFIED** | `aiSimulationEngine.ts:769-911` |
| **Tích hợp Machine Learning** | **KHÔNG CÓ (0%)** | Không có mô hình train/infer, không thư viện ML | **VERIFIED** | Toàn bộ thư mục `src/` |
| **Tích hợp Large Language Model** | **KHÔNG CÓ (0%)** | Không gọi OpenAI, Gemini, Claude, Ollama API | **VERIFIED** | Toàn bộ thư mục `src/` |

---

## 8. PHÂN TÍCH NGUYÊN NHÂN GỐC RỄ (ROOT CAUSE ANALYSIS)

1. **Kiến trúc phát triển phân tán không đồng bộ:**
   Phân hệ AI Giám sát ban đầu được thiết kế như một module "Proof of Concept / Demo Showcase" độc lập trên frontend để trình diễn giao diện, dẫn đến việc tác giả xây dựng riêng `useAIStore` và `aiSimulationEngine` với dữ liệu tự sinh mà chưa tích hợp vào luồng dữ liệu trung tâm `useMonitoringStore`.
2. **Thiếu lớp chuyển đổi dữ liệu (Data Adapter Layer):**
   Không có tầng trung gian chuyển đổi từ `ProductionLine[]` $\rightarrow$ `EquipmentHealthItem[]`. Hàm `computeEquipmentHealth` nhận danh sách máy nhưng chỉ trích xuất thông tin định danh (`id`, `name`, `code`) mà bỏ qua các trường trạng thái sống như `metrics`, `telemetry`, `status`, `isEmergencySpike`.
3. **Mô hình giả lập "Điểm xuất phát hoàn hảo":**
   Thuật toán tính điểm lấy mặc định 100 điểm cho mọi thiết bị mà không có điều kiện rẽ nhánh kiểm tra sự tồn tại của dữ liệu cảm biến (`if (machine.status === 'no_data') return null;`).

---

## 9. ĐỀ XUẤT KIẾN TRÚC MỤC TIÊU (TARGET ARCHITECTURE)

Nhằm xóa bỏ hoàn toàn tình trạng "hai thế giới song song" và đảm bảo **Single Source of Truth**, đề xuất đánh giá hai phương án:

### Phương án A — Cầu nối hai chiều (Dual-Mode Simulation Bridge)
- Giữ nguyên cả hai thanh điều khiển (Header và AI Toolbar).
- Viết hàm đồng bộ: Khi bấm kịch bản trong AI thì dispatch cập nhật `useMonitoringStore`, khi bấm Header thì dispatch cập nhật `useAIStore`.
- **Nhược điểm:** Phức tạp, dễ gây lặp vòng lặp vô tận (infinite state loop), gây xung đột trạng thái khi hai người dùng cùng thao tác hoặc khi mạng chập chờn. Không khuyến nghị.

### Phương án B — Hợp nhất Nguồn điều khiển & Bộ chuyển đổi Dữ liệu AI (Unified Simulation & AI Telemetry Adapter) — **KHUYÊN DÙNG (RECOMMENDED)**

```
                                  +------------------------------------+
                                  |     NGUỒN ĐIỀU KHIỂN DUY NHẤT      |
                                  |    (Header: Nút Giả lập Sự cố)     |
                                  +-----------------+------------------+
                                                    |
                                                    v
                                  +------------------------------------+
                                  |       useMonitoringStore.ts        |
                                  |  (Single Source of Truth cho App)  |
                                  |  - Telemetry thật từ WebSocket/API |
                                  |  - Trạng thái Giả lập khẩn cấp     |
                                  |  - 14 máy với đúng status          |
                                  +-----------------+------------------+
                                                    |
                                                    v
                                  +------------------------------------+
                                  |      AI TELEMETRY ADAPTER          |
                                  | (Adapter chuyển đổi dữ liệu sống)  |
                                  +--------+------------------+--------+
                                           |                  |
                    (Dữ liệu có Telemetry) |                  | (Máy status = 'no_data')
                                           v                  v
         +---------------------------------------+      +---------------------------------------+
         |     DYNAMIC AI ANALYTICS ENGINE       |      |     TRẠNG THÁI NO_DATA TRUNG THỰC     |
         |  - Tính Health Score từ vi phạm thực  |      |  - Health Score: N/A (Không tính ảo)  |
         |  - Anomaly Detection từ ngưỡng SPC    |      |  - Phân loại: Chưa kết nối cảm biến   |
         |  - Predictive Maintenance từ giờ máy  |      |  - Không đưa vào thống kê an toàn     |
         +-------------------+-------------------+      +-------------------+-------------------+
                             |                                              |
                             +----------------------+-----------------------+
                                                    |
                                                    v
                                  +------------------------------------+
                                  |         4 TABS AI COMMAND          |
                                  |     (Đồng bộ 100% với Dashboard)   |
                                  +------------------------------------+
```

### Các nguyên tắc vàng của Kiến trúc Phương án B:
1. **Loại bỏ bộ chọn kịch bản riêng trong AI (`AISimulationControls`):** Thay thế bằng một Banner trạng thái hiển thị rõ: *"Chế độ: Dữ liệu Vận hành Thời gian thực"* hoặc *"Chế độ: Đang mô phỏng sự cố từ Header"*.
2. **AI Telemetry Adapter:** Module AI sẽ đọc dữ liệu trực tiếp từ `useMonitoringStore.lines`. Nếu có sự cố kích hoạt từ Header, thông số máy bị spike sẽ lập tức được chuyển đổi thành cảnh báo Anomaly và hạ điểm sức khỏe của máy đó trên cả 4 tab AI.
3. **Minh bạch hóa máy `no_data`:** Nếu máy có `status === 'no_data'`, AI hiển thị nhãn `N/A - Chưa có dữ liệu quan trắc`, điểm sức khỏe để trống, không tính vào điểm trung bình toàn nhà máy.
4. **Không can thiệp CSDL & PLC:** Toàn bộ quá trình diễn ra trên frontend store, không gửi dữ liệu mô phỏng vào telemetry table của CSDL Production.

---

## 10. ĐỀ XUẤT LỘ TRÌNH NÂNG CẤP AI (DETAILED UPGRADE ROADMAP)

### Phase AI-01 — Data Integration & Telemetry Adapter
- **Mục tiêu:** Xây dựng `AITelemetryAdapter` liên kết `useMonitoringStore` sang AI Module. Xóa bỏ toolbar chọn kịch bản độc lập trong AI. Xử lý chính xác máy `no_data`.
- **Files dự kiến tác động:**
  - `src/features/ai-intelligence/adapters/aiTelemetryAdapter.ts` (Mới)
  - `src/features/ai-intelligence/AIIntelligenceView.tsx`
  - `src/features/ai-intelligence/components/AISimulationControls.tsx` (Thu gọn thành Status Bar)
  - `src/features/ai-intelligence/simulation/aiSimulationEngine.ts`
- **Tiêu chí nghiệm thu:** Kích hoạt "Giả lập Sự cố" trên Header $\rightarrow$ AI Overview lập tức ghi nhận thiết bị bị sự cố; tắt giả lập $\rightarrow$ AI lập tức trở về trạng thái bình thường. 7 máy mới hiển thị đúng `Chưa có dữ liệu`.

### Phase AI-02 — AI Overview Command Center
- **Mục tiêu:** Thiết kế lại Tab 1 để các thẻ KPI và biểu đồ phản ánh đúng thực tế. Điểm sức khỏe tính toán dựa trên mức độ lệch chuẩn của các thông số so với ngưỡng Warning/Critical thực tế.
- **Files dự kiến tác động:** `AIOverviewTab.tsx`, `AIHealthScoreCard.tsx`, `AITrendChart.tsx`.
- **Tiêu chí nghiệm thu:** KPI hiển thị rõ: 7 máy hoạt động, 7 máy chưa có dữ liệu; điểm sức khỏe trung bình tính trên 7 máy thực tế.

### Phase AI-03 — Dynamic Anomaly Detection Engine
- **Mục tiêu:** Thay thế mảng sự kiện hardcoded bằng thuật toán phát hiện dị biệt thống kê động (Z-Score + Ngưỡng vi phạm giới hạn) chạy trực tiếp trên chuỗi dữ liệu `metric.history`.
- **Files dự kiến tác động:** `AIAnomalyDetectionTab.tsx`, `aiSimulationEngine.ts`.
- **Tiêu chí nghiệm thu:** Khi bất kỳ thông số nào vượt ngưỡng cảnh báo (dù là do sensor thật hay do diễn tập Header), sự kiện bất thường tự động được tạo động với độ lệch chuẩn và giải thích kỹ thuật chuẩn xác.

### Phase AI-04 — Predictive Maintenance & Degradation Curve
- **Mục tiêu:** Tính toán mức độ ưu tiên bảo trì dựa trên số giờ vận hành tích lũy (`operatingHours`), số lần vượt ngưỡng cảnh báo và tỷ lệ suy giảm áp suất/nhiệt độ theo thời gian.
- **Files dự kiến tác động:** `AIPredictiveMaintenanceTab.tsx`.
- **Tiêu chí nghiệm thu:** Phiếu bảo trì chỉ phát sinh cho các thiết bị thực sự có nguy cơ hoặc đến hạn bảo dưỡng định kỳ; không sinh phiếu ảo cho máy chưa có dữ liệu.

### Phase AI-05 — KaiLink AI Assistant & Contextual Explainer
- **Mục tiêu:** Nâng cấp Trợ lý AI có khả năng đọc toàn bộ ngữ cảnh hiện tại của `useMonitoringStore` và `useAlarmStore` để giải thích đúng sự cố đang diễn ra trên nhà máy. Chuẩn bị sẵn giao diện Adapter để kết nối với Google Gemini API hoặc Local LLM khi người dùng cấp API key.
- **Files dự kiến tác động:** `AIAssistantTab.tsx`, `aiSimulationEngine.ts`.
- **Tiêu chí nghiệm thu:** Khi Header đang kích hoạt sự cố tại máy Dập, hỏi trợ lý *"Máy nào đang nguy cấp nhất?"* $\rightarrow$ Trợ lý chỉ đích danh máy Dập và nêu đúng thông số bị vượt ngưỡng.

---

## 11. MA TRẬN RỦI RO VÀ PHỤ THUỘC (RISKS & DEPENDENCIES)

| Rủi ro kỹ thuật | Mức độ | Biện pháp giảm thiểu |
| :--- | :---: | :--- |
| **Xung đột state khi WebSocket cập nhật liên tục** | Vừa | `AITelemetryAdapter` sử dụng kỹ thuật memoization (`useMemo`) và cơ chế so sánh nông (shallow compare) để tránh re-render liên tục. |
| **Hiểu lầm máy `no_data` là máy hỏng** | Cao | Thiết kế rõ UI phân biệt 3 trạng thái: Xanh (Bình thường), Đỏ/Vàng (Bất thường/Nguy cơ), Xám (Chưa lắp cảm biến - Không đánh giá). |
| **Phụ thuộc vào CSDL Production** | Thấp | Toàn bộ thuật toán chạy client-side trên state Zustand, tuyệt đối không gửi request ghi làm ảnh hưởng tải của Aiven MySQL. |

---

## 12. KẾT LUẬN VÀ KHUYẾN NGHỊ CUỐI CÙNG (FINAL RECOMMENDATION)

1. **Khẳng định kết quả:** Phân hệ AI hiện tại là một bản dựng mô phỏng độc lập (Standalone Simulation Sandbox), chưa liên thông với chức năng Giả lập sự cố của Header và chưa đọc dữ liệu từ CSDL hay Telemetry thật.
2. **Khuyến nghị hành động:** 
   - **KHÔNG xây dựng thêm bộ kịch bản thứ ba.**
   - Triển khai **Phương án B (Unified Telemetry Adapter)** bắt đầu từ **Phase AI-01**.
   - Hợp nhất nút *"Giả lập Sự cố"* trên Header thành nguồn kích hoạt sự cố chung cho toàn bộ website (bao gồm cả Dashboard và AI Module).
   - Tôn trọng tính trung thực công nghiệp: 7 máy mới chưa có PLC phải hiển thị đúng trạng thái `no_data` trong AI, không gán điểm sức khỏe ảo 97-98/100.
