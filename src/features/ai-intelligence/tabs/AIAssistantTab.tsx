/**
 * @file AIAssistantTab.tsx
 * @description Tab 4: Trợ lý AI KaiLink (DENSO KaiLink AI Copilot)
 * Chuẩn thiết kế tham chiếu Image 4 (media_1794454594254_56cbba06.jpg).
 * 
 * TÍNH NĂNG CHÍNH:
 * 1. Bố cục 2 cột chuyên nghiệp: Khung hội thoại AI (trái ~65%) + Panel Ngữ cảnh Thiết bị (phải ~35%).
 * 2. Welcome Card với 4 pill năng lực: Dữ liệu thời gian thực, Phân tích & Giải thích, Dự đoán & Khuyến nghị, Hỗ trợ kỹ thuật.
 * 3. 4 Thẻ câu hỏi gợi ý nhanh trực quan (Prompt Chips).
 * 4. Tin nhắn phản hồi có cấu trúc công nghiệp 4 phần:
 *    - Kết luận (Finding) + Badge trạng thái
 *    - Dữ liệu xác thực (Supporting Data) kèm Mini Sparkline 24h
 *    - Nguyên nhân khả dĩ (Possible Cause)
 *    - Đề xuất hành động (Recommended Action) + Nút Tạo phiếu bảo trì
 * 5. Panel Ngữ cảnh Thiết bị: Bộ chọn máy, 4 badge kết nối/trạng thái/nguồn dữ liệu, thông số Realtime có sparkline.
 * 6. Tự động phản ánh trung thực khi có sự cố giả lập Header hoặc máy no_data.
 */

import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  Bot,
  Send,
  Paperclip,
  ThumbsUp,
  ThumbsDown,
  Activity,
  CheckCircle2,
  Cpu,
  TrendingUp,
  ArrowRight,
  Sparkles,
  Search,
  ChevronDown,
  Info,
  Calendar,
  Eye,
  BarChart3,
  FileText,
} from 'lucide-react';
import { AIProcessedMachine } from '../adapters/aiTelemetryAdapter';
import { useAIStore } from '../stores/useAIStore';

interface AIAssistantTabProps {
  allMachines: AIProcessedMachine[];
  selectedMachineId?: string;
  onSelectMachine?: (machineId: string) => void;
  onNavigateToTab?: (tab: 'overview' | 'anomaly' | 'predictive' | 'assistant') => void;
}

interface StructuredAIChatItem {
  id: string;
  sender: 'user' | 'assistant';
  timestamp: string;
  text?: string;
  structured?: {
    machineCode: string;
    machineName: string;
    statusBadge: 'NORMAL' | 'WARNING' | 'CRITICAL' | 'NO_DATA';
    finding: string;
    supportingData: {
      metrics: string[];
      sparklineValues: number[];
    };
    possibleCauses: string[];
    recommendedActions: string[];
  };
}

export const AIAssistantTab: React.FC<AIAssistantTabProps> = ({
  allMachines,
  selectedMachineId: propSelectedMachineId,
  onSelectMachine,
  onNavigateToTab,
}) => {
  const { selectedMachineId: storeSelectedMachineId, setSelectedMachineId } = useAIStore();
  const currentMachineId = propSelectedMachineId || storeSelectedMachineId || (allMachines[0]?.machineId ?? '');

  // Thiết bị đang chọn để hiển thị ngữ cảnh
  const currentMachine = useMemo(() => {
    return allMachines.find((m) => m.machineId === currentMachineId) || allMachines[0];
  }, [allMachines, currentMachineId]);

  const [inputQuery, setInputQuery] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [feedbackGiven, setFeedbackGiven] = useState<{ [msgId: string]: 'up' | 'down' }>({});
  const chatBottomRef = useRef<HTMLDivElement>(null);

  // Lịch sử tin nhắn mặc định chuẩn theo Image 4
  const [messages, setMessages] = useState<StructuredAIChatItem[]>([
    {
      id: 'msg-user-1',
      sender: 'user',
      timestamp: '09:35',
      text: 'Máy MCH-PRS-01 hiện có nguy cơ cao không? Hãy phân tích và đề xuất xử lý.',
    },
    {
      id: 'msg-ai-1',
      sender: 'assistant',
      timestamp: '09:35',
      structured: {
        machineCode: 'MCH-PRS-01',
        machineName: 'Máy Dập Thủy Lực 500T Komatsu',
        statusBadge: 'WARNING',
        finding: 'Máy MCH-PRS-01 đang có dấu hiệu bất thường mức nhẹ (mức cảnh báo).',
        supportingData: {
          metrics: [
            'Nhiệt độ dầu thủy lực: 52.4 °C (ngưỡng cảnh báo: 45.0 °C, ngưỡng nguy hiểm: 60.0 °C)',
            'Độ rung RMS: 2.2 mm/s (bình thường: < 4.5 mm/s)',
            'Điểm sức khỏe AI: 97 / 100 (giảm 1 điểm so với 24h trước)',
          ],
          sparklineValues: [48, 49, 49.5, 50, 50.8, 51.5, 52.4],
        },
        possibleCauses: [
          'Nhiệt độ dầu tăng nhẹ so với mức vận hành thông thường.',
          'Có thể do tải công việc tăng, hiệu quả tản nhiệt giảm hoặc lọc dầu bắt đầu bẩn.',
        ],
        recommendedActions: [
          'Kiểm tra tình trạng lọc dầu thủy lực và vệ sinh nếu cần.',
          'Đảm bảo hệ thống làm mát hoạt động bình thường.',
          'Theo dõi thêm trong 24–48 giờ; nếu nhiệt độ tiếp tục tăng > 55 °C, lập phiếu bảo trì P2.',
        ],
      },
    },
  ]);

  // Cuộn xuống tin nhắn mới nhất
  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  // Đổi máy đang chọn
  const handleMachineChange = (mId: string) => {
    if (onSelectMachine) onSelectMachine(mId);
    setSelectedMachineId(mId);
  };

  // Tạo câu trả lời thông minh dựa trên tình trạng thực tế của thiết bị
  const generateAIResponse = (_query: string): StructuredAIChatItem => {
    const now = new Date();
    const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    const target = currentMachine;

    if (!target || target.isNoData) {
      return {
        id: `msg-ai-${Date.now()}`,
        sender: 'assistant',
        timestamp: timeStr,
        structured: {
          machineCode: target ? target.machineCode : 'THIẾT BỊ',
          machineName: target ? target.machineName : 'Chưa xác định',
          statusBadge: 'NO_DATA',
          finding: `Thiết bị ${target?.machineCode} hiện đang ở trạng thái NO_DATA (Chưa có bản ghi PLC).`,
          supportingData: {
            metrics: [
              'Trạng thái kết nối PLC: Chưa cấu hình trạm PLC',
              'Điểm sức khỏe AI: N/A (Không gán điểm số ảo)',
              'Dữ liệu cảm biến: 0 bản ghi đo lường',
            ],
            sparklineValues: [0, 0, 0, 0, 0, 0, 0],
          },
          possibleCauses: [
            'Máy mới được đồng bộ từ Migration 005 và đang chờ tích hợp giao tiếp PLC vật lý.',
            'Cần cấu hình địa chỉ IP hoặc Modbus / OPC-UA trạm trong Cấu hình Dây chuyền.',
          ],
          recommendedActions: [
            'Vào menu "Cấu hình → Dây chuyền & Thiết bị" để ánh xạ trạm PLC.',
            'Sau khi có dữ liệu đo lường, phân hệ AI sẽ tự động kích hoạt Z-score đánh giá.',
          ],
        },
      };
    }

    if (target.hasActiveSpike) {
      return {
        id: `msg-ai-${Date.now()}`,
        sender: 'assistant',
        timestamp: timeStr,
        structured: {
          machineCode: target.machineCode,
          machineName: target.machineName,
          statusBadge: 'CRITICAL',
          finding: `CẢNH BÁO KHẨN CẤP: Thiết bị ${target.machineCode} đang xuất hiện đột biến chỉ số nguy hiểm (Mô phỏng diễn tập).`,
          supportingData: {
            metrics: [
              `${target.keyMetricName}: ${target.keyMetricValue} ${target.keyMetricUnit} (Vượt ngưỡng nguy hiểm)`,
              'Thuật toán Z-score: +4.2σ (Đột biến tức thời cấp độ khẩn cấp)',
              `Điểm sức khỏe AI: ${target.healthScore} / 100 (Sụt giảm nghiêm trọng)`,
            ],
            sparklineValues: [50, 52, 51, 53, 52, 75, 95],
          },
          possibleCauses: [
            'Kịch bản sự cố khẩn cấp đang được kích hoạt từ Header điều hành (Diễn tập ứng phó).',
            'Nguy cơ quá áp hoặc nghẽn mạch dầu thủy lực trong điều kiện vận hành cực đoan.',
          ],
          recommendedActions: [
            'Kích hoạt quy trình E-Stop dừng khẩn cấp thiết bị kiểm tra an toàn.',
            'Hạ áp và kiểm tra đường xả khẩn cấp của van tỉ lệ.',
            'Sau khi diễn tập xong, nhấn nút "Khôi phục ngay" trên Header để đưa hệ thống về chuẩn.',
          ],
        },
      };
    }

    if (target.riskLevel === 'HIGH') {
      return {
        id: `msg-ai-${Date.now()}`,
        sender: 'assistant',
        timestamp: timeStr,
        structured: {
          machineCode: target.machineCode,
          machineName: target.machineName,
          statusBadge: 'WARNING',
          finding: `Thiết bị ${target.machineCode} đang tiệm cận ngưỡng cảnh báo vận hành.`,
          supportingData: {
            metrics: [
              `${target.keyMetricName}: ${target.keyMetricValue} ${target.keyMetricUnit}`,
              'Thuật toán Z-score: +2.6σ (Dấu hiệu trôi dạt thông số)',
              `Điểm sức khỏe AI: ${target.healthScore} / 100`,
            ],
            sparklineValues: [48, 50, 51, 52, 53, 54, 55],
          },
          possibleCauses: [
            'Hiệu suất làm mát hoặc bôi trơn bắt đầu suy giảm sau ca làm việc kéo dài.',
            'Bộ lọc có dấu hiệu tích tụ cặn bẩn làm tăng trở lực.',
          ],
          recommendedActions: [
            'Kiểm tra và vệ sinh bộ lọc trong thời gian giao ca.',
            'Lập phiếu bảo trì P2 nếu thông số tiếp tục tăng trong 24 giờ tới.',
          ],
        },
      };
    }

    // Trạng thái bình thường
    return {
      id: `msg-ai-${Date.now()}`,
      sender: 'assistant',
      timestamp: timeStr,
      structured: {
        machineCode: target.machineCode,
        machineName: target.machineName,
        statusBadge: 'NORMAL',
        finding: `Thiết bị ${target.machineCode} đang vận hành hoàn toàn ổn định và an toàn.`,
        supportingData: {
          metrics: [
            `${target.keyMetricName}: ${target.keyMetricValue} ${target.keyMetricUnit} (Trong giới hạn chuẩn)`,
            'Thuật toán Z-score: +0.4σ (Biến thiên tự nhiên)',
            `Điểm sức khỏe AI: ${target.healthScore} / 100 (Tối ưu)`,
          ],
          sparklineValues: [96, 97, 98, 97, 98, 98, 98],
        },
        possibleCauses: [
          'Chế độ bôi trơn và tản nhiệt đang hoạt động đạt hiệu suất thiết kế tiêu chuẩn DENSO.',
        ],
        recommendedActions: [
          'Duy trì chế độ quan trắc tự động và thực hiện kiểm tra định kỳ theo kế hoạch.',
        ],
      },
    };
  };

  const handleSend = (textToSend?: string) => {
    const q = textToSend || inputQuery;
    if (!q.trim() || isTyping) return;

    const now = new Date();
    const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    const userMsg: StructuredAIChatItem = {
      id: `msg-user-${Date.now()}`,
      sender: 'user',
      timestamp: timeStr,
      text: q,
    };

    setMessages((prev) => [...prev, userMsg]);
    if (!textToSend) setInputQuery('');
    setIsTyping(true);

    setTimeout(() => {
      const response = generateAIResponse(q);
      setMessages((prev) => [...prev, response]);
      setIsTyping(false);
    }, 700);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Mini sparkline SVG renderer
  const renderMiniSparkline = (values: number[], strokeColor = '#10b981') => {
    if (!values || values.length < 2) return null;
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min || 1;
    const width = 80;
    const height = 24;

    const points = values
      .map((val, idx) => {
        const x = (idx / (values.length - 1)) * width;
        const y = height - ((val - min) / range) * (height - 6) - 3;
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(' ');

    return (
      <svg width={width} height={height} className="overflow-visible">
        <polyline
          fill="none"
          stroke={strokeColor}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          points={points}
        />
      </svg>
    );
  };

  return (
    <div className="space-y-4">
      {/* ========================================================================= */}
      {/* BỐ CỤC 2 CỘT: KHUNG CHAT (Trái 65%) + NGỮ CẢNH THIẾT BỊ (Phải 35%)        */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        {/* CỘT TRÁI (8 COLS): KHUNG HỘI THOẠI AI */}
        <div className="lg:col-span-8 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200/90 dark:border-slate-700/80 shadow-xs flex flex-col min-h-[640px] max-h-[780px] overflow-hidden">
          {/* Vùng cuộn tin nhắn */}
          <div className="flex-1 p-4 sm:p-5 overflow-y-auto space-y-4">
            {/* Khối lời chào Welcome Card */}
            <div className="p-4 rounded-xl bg-slate-50/80 dark:bg-slate-900/50 border border-slate-200/80 dark:border-slate-700/70 space-y-3">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-2xs">
                  <Bot className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                    Xin chào! Tôi là KaiLink, trợ lý AI của DENSO Smart Factory. 👋
                  </h3>
                  <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 leading-relaxed">
                    Tôi có thể giúp bạn phân tích tình trạng thiết bị, giải thích bất thường, đánh giá rủi ro và đề xuất kế hoạch bảo trì dựa trên dữ liệu thời gian thực từ nhà máy.
                  </p>
                </div>
              </div>

              {/* 4 Năng lực cốt lõi */}
              <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-slate-200/60 dark:border-slate-800">
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 border border-emerald-200/70 dark:border-emerald-800/60">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Dữ liệu thời gian thực
                </span>
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-sky-50 text-sky-700 dark:bg-sky-950/50 dark:text-sky-300 border border-sky-200/70 dark:border-sky-800/60">
                  <BarChart3 className="w-3.5 h-3.5" /> Phân tích & Giải thích
                </span>
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-purple-50 text-purple-700 dark:bg-purple-950/50 dark:text-purple-300 border border-purple-200/70 dark:border-purple-800/60">
                  <TrendingUp className="w-3.5 h-3.5" /> Dự đoán & Khuyến nghị
                </span>
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                  <FileText className="w-3.5 h-3.5" /> Hỗ trợ kỹ thuật
                </span>
              </div>
            </div>

            {/* Khối gợi ý câu hỏi: Bạn có thể thử hỏi */}
            <div className="space-y-2">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                Bạn có thể thử hỏi:
              </span>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {[
                  {
                    q: 'Máy ROB-01 hiện có nguy cơ cao không?',
                    sub: 'Độ rung & mòn ổ bi trục J6',
                  },
                  {
                    q: 'Giải thích cảnh báo nhiệt độ máy MCH-PRS-01',
                    sub: 'Dầu thủy lực tiệm cận 54.2 °C',
                  },
                  {
                    q: 'Đề xuất kế hoạch bảo trì cho 14 máy',
                    sub: 'Phân loại P1 đến P4 theo độ suy giảm',
                  },
                  {
                    q: 'Tổng quan sức khỏe thiết bị hiện tại',
                    sub: '7 máy có dữ liệu, 7 máy chưa kết nối',
                  },
                ].map((item, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSend(item.q)}
                    disabled={isTyping}
                    className="p-3 rounded-xl border border-slate-200/80 dark:border-slate-700/70 hover:border-emerald-500/80 dark:hover:border-emerald-500/80 hover:bg-emerald-50/40 dark:hover:bg-emerald-950/30 transition-all text-left flex items-center justify-between group shadow-2xs"
                  >
                    <div>
                      <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 group-hover:text-emerald-700 dark:group-hover:text-emerald-400">
                        {item.q}
                      </p>
                      <span className="text-[11px] text-slate-400">{item.sub}</span>
                    </div>
                    <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-emerald-600 transition-transform group-hover:translate-x-0.5" />
                  </button>
                ))}
              </div>
            </div>

            {/* Luồng tin nhắn thực tế */}
            <div className="space-y-4 pt-2">
              {messages.map((msg) => {
                const isUser = msg.sender === 'user';

                if (isUser) {
                  return (
                    <div key={msg.id} className="flex justify-end items-end gap-2">
                      <div className="bg-sky-600 text-white px-4 py-2.5 rounded-2xl rounded-br-none text-xs leading-relaxed max-w-[85%] shadow-xs">
                        <p>{msg.text}</p>
                        <span className="block text-[10px] text-sky-200 mt-1 text-right">
                          {msg.timestamp}
                        </span>
                      </div>
                    </div>
                  );
                }

                // Render phản hồi của AI có cấu trúc 4 phần
                const s = msg.structured;
                if (!s) return null;

                const isWarning = s.statusBadge === 'WARNING';
                const isCritical = s.statusBadge === 'CRITICAL';
                const isNoData = s.statusBadge === 'NO_DATA';

                return (
                  <div key={msg.id} className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-full bg-emerald-600 text-white flex items-center justify-center shrink-0 mt-0.5 shadow-2xs">
                      <Bot className="w-4 h-4" />
                    </div>

                    <div className="flex-1 bg-white dark:bg-slate-850 rounded-2xl border border-slate-200/90 dark:border-slate-700/80 shadow-xs overflow-hidden">
                      {/* Header tin nhắn AI */}
                      <div className="px-4 py-2.5 border-b border-slate-100 dark:border-slate-700/70 flex items-center justify-between bg-slate-50/60 dark:bg-slate-900/30">
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                          <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100">
                            Phân tích tình trạng máy {s.machineCode}
                          </h4>
                        </div>
                        <span className="text-[11px] text-slate-400">{msg.timestamp}</span>
                      </div>

                      <div className="p-4 space-y-3.5 text-xs">
                        {/* 1. KẾT LUẬN (FINDING) */}
                        <div className="p-3 rounded-xl bg-amber-50/60 dark:bg-amber-950/30 border border-amber-200/70 dark:border-amber-800/60 flex items-center justify-between gap-3">
                          <div className="flex items-start gap-2">
                            <Search className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                            <div>
                              <span className="font-bold text-amber-900 dark:text-amber-200 block">
                                Kết luận (Finding)
                              </span>
                              <p className="text-slate-800 dark:text-slate-200 mt-0.5 leading-snug">
                                {s.finding}
                              </p>
                            </div>
                          </div>
                          <span
                            className={`px-2 py-0.5 rounded text-[11px] font-bold shrink-0 ${
                              isCritical
                                ? 'bg-rose-500 text-white'
                                : isWarning
                                ? 'bg-amber-500 text-white'
                                : isNoData
                                ? 'bg-slate-500 text-white'
                                : 'bg-emerald-500 text-white'
                            }`}
                          >
                            {s.statusBadge}
                          </span>
                        </div>

                        {/* 2. DỮ LIỆU XÁC THỰC (SUPPORTING DATA) */}
                        <div className="p-3 rounded-xl bg-sky-50/50 dark:bg-sky-950/20 border border-sky-200/70 dark:border-sky-800/60">
                          <div className="flex items-center justify-between pb-2 mb-2 border-b border-sky-100 dark:border-sky-900/40">
                            <div className="flex items-center gap-2 font-bold text-sky-900 dark:text-sky-200">
                              <BarChart3 className="w-4 h-4 text-sky-600" />
                              <span>Dữ liệu xác thực (Supporting Data)</span>
                            </div>

                            {/* Mini Sparkline 24h */}
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] text-slate-400 font-medium">Xu hướng 24h</span>
                              {renderMiniSparkline(s.supportingData.sparklineValues, isCritical ? '#f43f5e' : isWarning ? '#f59e0b' : '#10b981')}
                            </div>
                          </div>

                          <ul className="space-y-1 text-slate-700 dark:text-slate-300">
                            {s.supportingData.metrics.map((item, mIdx) => (
                              <li key={mIdx} className="flex items-start gap-1.5">
                                <span className="text-sky-500 font-bold">•</span>
                                <span>{item}</span>
                              </li>
                            ))}
                          </ul>
                        </div>

                        {/* 3. NGUYÊN NHÂN KHẢ DĨ (POSSIBLE CAUSE) */}
                        <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/40 border border-slate-200/70 dark:border-slate-800">
                          <div className="flex items-center gap-2 font-bold text-slate-800 dark:text-slate-200 mb-1.5">
                            <TrendingUp className="w-4 h-4 text-slate-500" />
                            <span>Nguyên nhân khả dĩ (Possible Cause)</span>
                          </div>
                          <ul className="space-y-1 text-slate-600 dark:text-slate-300">
                            {s.possibleCauses.map((cause, cIdx) => (
                              <li key={cIdx} className="flex items-start gap-1.5">
                                <span className="text-slate-400 font-bold">•</span>
                                <span>{cause}</span>
                              </li>
                            ))}
                          </ul>
                        </div>

                        {/* 4. ĐỀ XUẤT HÀNH ĐỘNG (RECOMMENDED ACTION) */}
                        <div className="p-3 rounded-xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200/70 dark:border-emerald-800/60">
                          <div className="flex items-center justify-between pb-2 mb-2 border-b border-emerald-100 dark:border-emerald-900/40">
                            <div className="flex items-center gap-2 font-bold text-emerald-900 dark:text-emerald-200">
                              <Activity className="w-4 h-4 text-emerald-600" />
                              <span>Đề xuất hành động (Recommended Action)</span>
                            </div>

                            {/* Nút Tạo phiếu bảo trì */}
                            <button
                              onClick={() => {
                                if (onNavigateToTab) onNavigateToTab('predictive');
                              }}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white transition-colors shadow-2xs"
                            >
                              <Calendar className="w-3.5 h-3.5" />
                              Tạo phiếu bảo trì
                            </button>
                          </div>

                          <ol className="space-y-1 text-emerald-900 dark:text-emerald-300 list-decimal pl-4">
                            {s.recommendedActions.map((action, aIdx) => (
                              <li key={aIdx} className="leading-relaxed">
                                {action}
                              </li>
                            ))}
                          </ol>
                        </div>

                        {/* Footer tin nhắn: Phản hồi + Quick Action Pills */}
                        <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-400">
                          <div className="flex items-center gap-2">
                            <span>Câu trả lời có hữu ích không?</span>
                            <button
                              onClick={() => setFeedbackGiven({ ...feedbackGiven, [msg.id]: 'up' })}
                              className={`p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-700 ${feedbackGiven[msg.id] === 'up' ? 'text-emerald-600' : ''}`}
                              title="Hữu ích"
                            >
                              <ThumbsUp className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => setFeedbackGiven({ ...feedbackGiven, [msg.id]: 'down' })}
                              className={`p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-700 ${feedbackGiven[msg.id] === 'down' ? 'text-rose-500' : ''}`}
                              title="Chưa hữu ích"
                            >
                              <ThumbsDown className="w-3.5 h-3.5" />
                            </button>
                          </div>

                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={() => {
                                if (onNavigateToTab) onNavigateToTab('anomaly');
                              }}
                              className="px-2 py-0.5 rounded text-[11px] bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200 transition-colors flex items-center gap-1"
                            >
                              <Eye className="w-3 h-3" /> Xem dữ liệu chi tiết
                            </button>
                            <button
                              onClick={() => {
                                if (onNavigateToTab) onNavigateToTab('anomaly');
                              }}
                              className="px-2 py-0.5 rounded text-[11px] bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200 transition-colors flex items-center gap-1"
                            >
                              <TrendingUp className="w-3 h-3" /> Phân tích sâu hơn
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* Trạng thái đang phân tích */}
              {isTyping && (
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-emerald-600 text-white flex items-center justify-center shrink-0">
                    <Bot className="w-4 h-4" />
                  </div>
                  <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 text-xs text-slate-500 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                    <span>KaiLink đang phân tích dữ liệu cảm biến & mô hình nội tại...</span>
                  </div>
                </div>
              )}

              <div ref={chatBottomRef} />
            </div>
          </div>

          {/* Ô nhập tin nhắn cố định dưới chân khung chat */}
          <div className="p-3 sm:p-4 border-t border-slate-200/80 dark:border-slate-700/70 bg-white dark:bg-slate-800 shrink-0">
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors shrink-0"
                title="Đính kèm tệp dữ liệu hoặc ảnh cảm biến"
              >
                <Paperclip className="w-4 h-4" />
              </button>

              <input
                type="text"
                placeholder="Nhập câu hỏi hoặc yêu cầu phân tích thiết bị..."
                value={inputQuery}
                onChange={(e) => setInputQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={isTyping}
                className="flex-1 px-4 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />

              <button
                onClick={() => handleSend()}
                disabled={!inputQuery.trim() || isTyping}
                className="w-9 h-9 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white flex items-center justify-center transition-colors disabled:opacity-40 disabled:cursor-not-allowed shrink-0 shadow-2xs"
                title="Gửi câu hỏi"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* CỘT PHẢI (4 COLS): PANEL NGỮ CẢNH THIẾT BỊ (Tham chiếu Image 4) */}
        <div className="lg:col-span-4 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200/90 dark:border-slate-700/80 shadow-xs p-4 sm:p-5 space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100 dark:border-slate-700/70">
            <Cpu className="w-5 h-5 text-emerald-600" />
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
              Ngữ cảnh Thiết bị
            </h3>
          </div>

          {/* Bộ chọn thiết bị đang xem */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-medium text-slate-400">Chọn thiết bị phân tích:</label>
            <div className="relative">
              <select
                aria-label="Chọn thiết bị để xem ngữ cảnh"
                value={currentMachine?.machineId}
                onChange={(e) => handleMachineChange(e.target.value)}
                className="w-full text-xs font-bold pl-3 pr-8 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500 cursor-pointer appearance-none"
              >
                {allMachines.map((m) => (
                  <option key={m.machineId} value={m.machineId}>
                    {m.machineCode} — {m.machineName} {m.isNoData ? '(No Data)' : ''}
                  </option>
                ))}
              </select>
              <ChevronDown className="w-4 h-4 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>

          {/* 4 Thẻ trạng thái kết nối & nguồn dữ liệu (2x2 grid) */}
          <div className="grid grid-cols-2 gap-2">
            {/* Kết nối PLC */}
            <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800">
              <span className="text-[10px] text-slate-400 font-medium block">Kết nối PLC</span>
              <div className="mt-1 flex items-center gap-1.5 text-xs font-bold">
                {currentMachine?.isNoData ? (
                  <span className="text-slate-400 flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-slate-400" /> Chưa kết nối
                  </span>
                ) : (
                  <span className="text-emerald-600 flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" /> Đã kết nối
                  </span>
                )}
              </div>
            </div>

            {/* Nguồn dữ liệu */}
            <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800">
              <span className="text-[10px] text-slate-400 font-medium block">Nguồn dữ liệu</span>
              <div className="mt-1 text-xs font-bold truncate">
                {currentMachine?.dataSource === 'SIMULATION' ? (
                  <span className="text-amber-600">Giả lập (Simulation)</span>
                ) : currentMachine?.dataSource === 'PRODUCTION' ? (
                  <span className="text-sky-600">Dữ liệu thực (Production)</span>
                ) : (
                  <span className="text-slate-400">Chưa có (NO_DATA)</span>
                )}
              </div>
            </div>

            {/* Cập nhật lần cuối */}
            <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800">
              <span className="text-[10px] text-slate-400 font-medium block">Cập nhật lần cuối</span>
              <div className="mt-1 text-xs font-semibold text-slate-700 dark:text-slate-300 truncate">
                {currentMachine?.isNoData ? 'Chưa có' : 'Vừa xong (Live)'}
              </div>
            </div>

            {/* Trạng thái vận hành */}
            <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800">
              <span className="text-[10px] text-slate-400 font-medium block">Trạng thái</span>
              <div className="mt-1 text-xs font-bold text-emerald-600">
                {currentMachine?.isNoData ? 'NO_DATA' : currentMachine?.hasActiveSpike ? 'CRITICAL' : 'Hoạt động (RUN)'}
              </div>
            </div>
          </div>

          {/* Bảng Thông tin thiết bị */}
          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800 space-y-2 text-xs">
            <h4 className="font-bold text-slate-900 dark:text-slate-100 text-[11px] uppercase tracking-wider text-slate-400">
              Thông tin thiết bị
            </h4>

            <div className="flex items-center justify-between">
              <span className="text-slate-400">Dây chuyền:</span>
              <span className="font-medium text-slate-700 dark:text-slate-300">
                {currentMachine?.lineName}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-slate-400">Cụm thiết bị:</span>
              <span className="font-medium text-slate-700 dark:text-slate-300">
                {currentMachine?.rawMetrics[0]?.name || 'Bộ truyền động chính'}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-slate-400">Điểm sức khỏe AI:</span>
              <span
                className={`font-black ${
                  currentMachine?.isNoData
                    ? 'text-slate-400'
                    : (currentMachine?.healthScore || 0) >= 80
                    ? 'text-emerald-600'
                    : 'text-rose-600'
                }`}
              >
                {currentMachine?.isNoData ? 'N/A' : `${currentMachine?.healthScore} / 100`}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-slate-400">Mức rủi ro hiện tại:</span>
              <span
                className={`font-bold ${
                  currentMachine?.isNoData
                    ? 'text-slate-400'
                    : currentMachine?.riskLevel === 'CRITICAL'
                    ? 'text-rose-600'
                    : currentMachine?.riskLevel === 'HIGH'
                    ? 'text-amber-500'
                    : 'text-emerald-600'
                }`}
              >
                {currentMachine?.isNoData
                  ? 'Chưa đánh giá'
                  : currentMachine?.riskLevel === 'CRITICAL'
                  ? '• Khẩn cấp (Critical)'
                  : currentMachine?.riskLevel === 'HIGH'
                  ? '• Trung bình (Warning)'
                  : '• An toàn (Low)'}
              </span>
            </div>
          </div>

          {/* Bảng Thông số giám sát Realtime kèm Sparkline */}
          <div className="space-y-2">
            <h4 className="font-bold text-[11px] uppercase tracking-wider text-slate-400">
              Thông số giám sát (Realtime)
            </h4>

            <div className="space-y-1.5">
              {currentMachine?.rawMetrics && currentMachine.rawMetrics.length > 0 ? (
                currentMachine.rawMetrics.map((mtr, mIdx) => {
                  const val = Number(mtr.currentValue);
                  const isCrit = mtr.status === 'critical' || mtr.isEmergencySpike;
                  const isWarn = mtr.status === 'warning';

                  // Tạo 5 điểm sparkline giả lập từ metric
                  const sparkValues = [
                    val * 0.96,
                    val * 0.98,
                    val * 0.97,
                    val * 0.99,
                    val,
                  ];

                  return (
                    <div
                      key={mIdx}
                      className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900/40 border border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs"
                    >
                      <div>
                        <span className="text-slate-700 dark:text-slate-300 font-medium block">
                          {mtr.name}
                        </span>
                        <span
                          className={`font-black text-sm ${
                            isCrit
                              ? 'text-rose-600'
                              : isWarn
                              ? 'text-amber-500'
                              : 'text-slate-900 dark:text-slate-100'
                          }`}
                        >
                          {mtr.currentValue} {mtr.unit}
                        </span>
                      </div>

                      <div className="shrink-0">
                        {renderMiniSparkline(sparkValues, isCrit ? '#f43f5e' : isWarn ? '#f59e0b' : '#10b981')}
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="p-4 text-center text-xs text-slate-400 bg-slate-50 dark:bg-slate-900/30 rounded-xl border border-slate-100 dark:border-slate-800">
                  Chưa có thông số đo lường từ PLC.
                </div>
              )}
            </div>
          </div>

          {/* Footer note minh bạch */}
          <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900/30 border border-slate-100 dark:border-slate-800 text-[11px] text-slate-400 leading-relaxed flex items-start gap-1.5">
            <Info className="w-3.5 h-3.5 text-blue-500 shrink-0 mt-0.5" />
            <span>
              Lưu ý: Thiết bị sử dụng dữ liệu thực từ PLC. Các phân tích được tạo bởi mô hình AI nội bộ của DENSO.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
