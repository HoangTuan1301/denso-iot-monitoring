/**
 * @file questionBank.ts
 * @description Bộ 32 câu hỏi mẫu của Trợ lý AI KaiLink, chia 6 nhóm.
 * Mỗi câu gắn với một "intent" để bấm là trả lời đúng, kể cả khi giao diện đang ở tiếng Anh / Nhật.
 * Người dùng gõ tự do thì `matchIntent` (assistantEngine.ts) đoán intent theo từ khóa.
 */
import { tr } from '../../../i18n/tr';

export type IntentId =
  // Dự báo bảo trì
  | 'forecast' | 'highest_risk' | 'pm_week' | 'parts_due' | 'calibration_due'
  // Tình trạng hiện tại
  | 'lines_stopped' | 'open_alarms' | 'over_threshold' | 'factory_status' | 'no_data'
  // Sản lượng & OEE
  | 'line_output' | 'behind_plan' | 'ng_rate' | 'factory_oee' | 'end_of_shift' | 'top_downtime'
  // Hỏi theo máy / dây chuyền
  | 'machine_status' | 'machine_why' | 'machine_alarms' | 'machine_metrics' | 'line_status'
  // Hướng dẫn xử lý
  | 'guide_hydraulic' | 'guide_torque' | 'guide_robot_pm' | 'guide_vibration' | 'guide_leak'
  // Báo cáo & tổng hợp
  | 'shift_summary' | 'top_risks' | 'compare_oee' | 'handover' | 'best_line'
  // Khác
  | 'greeting' | 'help' | 'fallback';

/** Tham số đi kèm câu hỏi: số giờ dự báo, máy, dây chuyền */
export interface IntentParams {
  hours?: number;
  machineId?: string;
  lineId?: string;
}

export interface SampleQuestion {
  intent: IntentId;
  params?: IntentParams;
  text: string;
}

export type GroupKey = 'predict' | 'status' | 'output' | 'machine' | 'guide' | 'report';

export interface QuestionGroup {
  key: GroupKey;
  title: string;
  questions: SampleQuestion[];
}

export const QUESTION_GROUPS: QuestionGroup[] = [
  {
    key: 'predict',
    title: tr('Dự báo bảo trì'),
    questions: [
      { intent: 'forecast', params: { hours: 6 }, text: tr('Trong 6 giờ tới dây chuyền nào cần bảo trì?') },
      { intent: 'highest_risk', text: tr('Máy nào có nguy cơ hỏng cao nhất hôm nay?') },
      { intent: 'pm_week', text: tr('Tuần này cần bảo dưỡng định kỳ những máy nào?') },
      { intent: 'forecast', params: { hours: 24 }, text: tr('Dự báo 24 giờ tới cho toàn xưởng') },
      { intent: 'parts_due', text: tr('Linh kiện nào sắp cần thay?') },
      { intent: 'calibration_due', text: tr('Máy nào sắp đến hạn hiệu chuẩn?') },
    ],
  },
  {
    key: 'status',
    title: tr('Tình trạng hiện tại'),
    questions: [
      { intent: 'lines_stopped', text: tr('Hiện có dây chuyền nào đang dừng không?') },
      { intent: 'open_alarms', text: tr('Có bao nhiêu cảnh báo chưa xử lý?') },
      { intent: 'over_threshold', text: tr('Máy nào đang vượt ngưỡng?') },
      { intent: 'factory_status', text: tr('Tình hình toàn xưởng lúc này thế nào?') },
      { intent: 'no_data', text: tr('Có máy nào mất kết nối hoặc chưa có dữ liệu không?') },
    ],
  },
  {
    key: 'output',
    title: tr('Sản lượng & OEE'),
    questions: [
      { intent: 'line_output', params: { lineId: 'LINE-06' }, text: tr('Ca này line JATCO đạt bao nhiêu % kế hoạch?') },
      { intent: 'behind_plan', text: tr('Dây chuyền nào đang chậm kế hoạch nhất?') },
      { intent: 'ng_rate', text: tr('Tỉ lệ NG ca này của toàn xưởng là bao nhiêu?') },
      { intent: 'factory_oee', text: tr('OEE toàn xưởng ca này là bao nhiêu?') },
      { intent: 'end_of_shift', text: tr('Cuối ca dự kiến đạt bao nhiêu sản phẩm?') },
      { intent: 'top_downtime', text: tr('Dây chuyền nào dừng máy nhiều nhất ca này?') },
    ],
  },
  {
    key: 'machine',
    title: tr('Hỏi theo máy'),
    questions: [
      { intent: 'machine_status', params: { machineId: 'DCS-DCM-01' }, text: tr('Máy DCS-DCM-01 đang thế nào?') },
      { intent: 'machine_why', params: { machineId: 'JAT-PRF-01' }, text: tr('Vì sao máy JAT-PRF-01 báo cảnh báo?') },
      { intent: 'machine_alarms', params: { machineId: 'AT-CNC-01' }, text: tr('Lịch sử cảnh báo của AT-CNC-01 hôm nay?') },
      { intent: 'machine_metrics', params: { machineId: 'HSG-MC-01' }, text: tr('Thông số hiện tại của máy HSG-MC-01?') },
      { intent: 'line_status', params: { lineId: 'LINE-09' }, text: tr('Dây chuyền Decast 1 có máy nào đang có vấn đề không?') },
    ],
  },
  {
    key: 'guide',
    title: tr('Hướng dẫn xử lý'),
    questions: [
      { intent: 'guide_hydraulic', text: tr('Nhiệt dầu thủy lực cao thì xử lý thế nào?') },
      { intent: 'guide_torque', text: tr('Mô-men siết NG thì kiểm tra gì trước?') },
      { intent: 'guide_robot_pm', text: tr('Quy trình bảo dưỡng 1.000 giờ cho robot hàn?') },
      { intent: 'guide_vibration', text: tr('Độ rung trục chính tăng cao thì làm gì?') },
      { intent: 'guide_leak', text: tr('Máy kiểm tra rò rỉ báo NG hàng loạt thì xử lý ra sao?') },
    ],
  },
  {
    key: 'report',
    title: tr('Báo cáo & tổng hợp'),
    questions: [
      { intent: 'shift_summary', text: tr('Tóm tắt ca hiện tại cho quản đốc') },
      { intent: 'top_risks', text: tr('Top 3 rủi ro hôm nay là gì?') },
      { intent: 'compare_oee', text: tr('So sánh OEE các dây chuyền ca này') },
      { intent: 'handover', text: tr('Soạn nội dung bàn giao ca') },
      { intent: 'best_line', text: tr('Dây chuyền nào chạy tốt nhất ca này?') },
    ],
  },
];

export const TOTAL_QUESTIONS = QUESTION_GROUPS.reduce((s, g) => s + g.questions.length, 0);
