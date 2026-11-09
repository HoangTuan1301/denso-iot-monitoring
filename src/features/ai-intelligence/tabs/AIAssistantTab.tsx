/**
 * @file AIAssistantTab.tsx
 * @description Tab 4 Redesign: Modern Industrial DENSO AI Assistant
 * - Bố cục desktop: Khung hội thoại chính (trái) + Panel ngữ cảnh thiết bị (phải)
 * - Ô nhập tin nhắn cố định tuyệt đối dưới cùng, không bị che khuất
 * - Câu hỏi gợi ý nhanh trực quan, trạng thái xử lý và empty state chuyên nghiệp
 */

import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  Send,
  Sparkles,
  Bot,
  User,
  HelpCircle,
  Cpu,
  MessageSquare,
} from 'lucide-react';
import { useAIStore } from '../stores/useAIStore';
import { computeAllEquipmentHealth } from '../simulation/aiSimulationEngine';

interface AIAssistantTabProps {
  machines: any[];
}

export const AIAssistantTab: React.FC<AIAssistantTabProps> = ({ machines }) => {
  const {
    chatHistory,
    isAssistantTyping,
    sendUserMessage,
    selectedMachineId,
    activeScenarioId,
    isDemoActive,
  } = useAIStore();

  const [inputQuery, setInputQuery] = useState('');
  const chatBottomRef = useRef<HTMLDivElement>(null);

  // Tính toán sức khỏe cho thiết bị đang chọn
  const allEquipment = useMemo(() => {
    return computeAllEquipmentHealth(machines, activeScenarioId, isDemoActive);
  }, [machines, activeScenarioId, isDemoActive]);

  const selectedEquipment = useMemo(() => {
    return (
      allEquipment.find((e) => e.machineId === selectedMachineId) ||
      allEquipment[0]
    );
  }, [allEquipment, selectedMachineId]);

  // Tự động cuộn mượt mà xuống tin nhắn mới nhất
  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory, isAssistantTyping]);

  const handleSend = () => {
    if (!inputQuery.trim() || isAssistantTyping) return;
    sendUserMessage(inputQuery, machines);
    setInputQuery('');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSelectSuggested = (prompt: string) => {
    if (isAssistantTyping) return;
    sendUserMessage(prompt, machines);
  };

  // Render markdown đơn giản (in đậm, danh sách)
  const renderMessageContent = (text: string) => {
    const lines = text.split('\n');
    return lines.map((line, index) => {
      const parts = line.split(/(\*\*.*?\*\*)/g);
      const formattedParts = parts.map((part, pIdx) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          return (
            <strong key={pIdx} className="font-semibold text-slate-900 dark:text-white">
              {part.slice(2, -2)}
            </strong>
          );
        }
        return part;
      });

      if (line.trim().startsWith('-') || line.trim().startsWith('•')) {
        return (
          <li key={index} className="ml-4 list-disc text-slate-700 dark:text-slate-300">
            {formattedParts}
          </li>
        );
      }

      if (/^\d+\./.test(line.trim())) {
        return (
          <li key={index} className="ml-4 list-decimal text-slate-700 dark:text-slate-300">
            {formattedParts}
          </li>
        );
      }

      return (
        <p key={index} className={line.trim() === '' ? 'h-1.5' : 'mb-1 text-slate-700 dark:text-slate-300'}>
          {formattedParts}
        </p>
      );
    });
  };

  const quickPrompts = [
    'Máy nào hiện có nguy cơ cao nhất?',
    'Giải thích cảnh báo nhiệt độ Máy dập MCH-PRS-01',
    'Chẩn đoán độ rung Robot hàn MCH-WLD-01',
    'Đề xuất kế hoạch bảo trì ca này',
    'Tổng quan tình trạng toàn xưởng',
  ];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 h-[650px]">
      {/* ============================================================= */}
      {/* CỘT CHÍNH (8 COLS): KHUNG HỘI THOẠI & Ô NHẬP TIN NHẮN          */}
      {/* ============================================================= */}
      <div className="lg:col-span-8 bg-white dark:bg-slate-800 rounded-xl border border-slate-200/90 dark:border-slate-700/70 shadow-xs flex flex-col h-full overflow-hidden">
        {/* Header */}
        <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-700/60 flex items-center justify-between bg-slate-50/70 dark:bg-slate-900/40">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400 flex items-center justify-center border border-emerald-200 dark:border-emerald-800">
              <Bot className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  DENSO KaiLink AI Assistant
                </h3>
                <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[10px] font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Sẵn sàng
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                Chẩn đoán lỗi kỹ thuật, phân tích dị biệt & tư vấn bảo dưỡng
              </p>
            </div>
          </div>

          <div className="hidden sm:flex items-center gap-1.5 text-xs text-slate-400">
            <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
            <span>Mô hình tri thức công nghiệp</span>
          </div>
        </div>

        {/* Message Stream */}
        <div className="flex-1 p-4 overflow-y-auto space-y-3.5">
          {chatHistory.length === 0 && (
            <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-400">
              <MessageSquare className="w-10 h-10 mb-2 opacity-50" />
              <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                Chưa có hội thoại
              </h4>
              <p className="text-xs max-w-sm mt-1">
                Hãy chọn một câu hỏi gợi ý bên dưới hoặc nhập yêu cầu để bắt đầu chẩn đoán kỹ thuật.
              </p>
            </div>
          )}

          {chatHistory.map((msg) => {
            const isUser = msg.sender === 'user';

            return (
              <div
                key={msg.id}
                className={`flex items-start gap-2.5 ${
                  isUser ? 'flex-row-reverse' : 'flex-row'
                }`}
              >
                {/* Avatar */}
                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-xs font-bold ${
                    isUser
                      ? 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200'
                      : 'bg-emerald-600 text-white shadow-xs'
                  }`}
                >
                  {isUser ? <User className="w-3.5 h-3.5" /> : <Bot className="w-3.5 h-3.5" />}
                </div>

                {/* Message Bubble */}
                <div
                  className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-xs leading-relaxed ${
                    isUser
                      ? 'bg-emerald-600 text-white rounded-tr-none shadow-xs'
                      : 'bg-slate-50 dark:bg-slate-900 border border-slate-200/80 dark:border-slate-700/70 text-slate-800 dark:text-slate-200 rounded-tl-none shadow-xs'
                  }`}
                >
                  <div className="space-y-1">
                    {isUser ? (
                      <p className="whitespace-pre-wrap">{msg.text}</p>
                    ) : (
                      renderMessageContent(msg.text)
                    )}
                  </div>

                  {/* Highlight Card */}
                  {msg.highlightCard && (
                    <div className="mt-2 p-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-900 dark:text-slate-100">
                          {msg.highlightCard.title}
                        </span>
                        {msg.highlightCard.badge && (
                          <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-rose-100 text-rose-700 dark:bg-rose-950/70 dark:text-rose-400">
                            {msg.highlightCard.badge}
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                        {msg.highlightCard.subtitle}
                      </p>
                      {msg.highlightCard.score !== undefined && (
                        <div className="mt-1 flex items-baseline gap-1">
                          <span className="text-lg font-black text-rose-600 dark:text-rose-400">
                            {msg.highlightCard.score}
                          </span>
                          <span className="text-[10px] text-slate-400">/ 100 điểm</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Suggested pills inside message */}
                  {msg.suggestedPrompts && msg.suggestedPrompts.length > 0 && (
                    <div className="mt-2 pt-2 border-t border-slate-200/70 dark:border-slate-700/60">
                      <div className="flex flex-wrap gap-1">
                        {msg.suggestedPrompts.map((prompt, pIdx) => (
                          <button
                            key={pIdx}
                            onClick={() => handleSelectSuggested(prompt)}
                            disabled={isAssistantTyping}
                            className="px-2 py-0.5 rounded text-[11px] bg-white hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 transition-colors shadow-xs"
                          >
                            {prompt}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  <div
                    className={`mt-1 text-[10px] ${
                      isUser ? 'text-emerald-100 text-right' : 'text-slate-400 text-left'
                    }`}
                  >
                    {msg.timestamp}
                  </div>
                </div>
              </div>
            );
          })}

          {/* Typing indicator */}
          {isAssistantTyping && (
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-full bg-emerald-600 text-white flex items-center justify-center shrink-0">
                <Bot className="w-3.5 h-3.5" />
              </div>
              <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200/80 dark:border-slate-700/70 rounded-2xl rounded-tl-none px-3.5 py-2 shadow-xs">
                <div className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-bounce" />
                  <span
                    className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-bounce"
                    style={{ animationDelay: '150ms' }}
                  />
                  <span
                    className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-bounce"
                    style={{ animationDelay: '300ms' }}
                  />
                  <span className="text-xs text-slate-400 ml-1">Đang phân tích dữ liệu...</span>
                </div>
              </div>
            </div>
          )}

          <div ref={chatBottomRef} />
        </div>

        {/* Fixed Sticky Input Bar */}
        <div className="p-3 border-t border-slate-200/90 dark:border-slate-700/70 bg-white dark:bg-slate-800 shrink-0">
          <div className="flex items-center gap-2">
            <input
              type="text"
              placeholder="Nhập câu hỏi hoặc yêu cầu chẩn đoán kỹ thuật..."
              value={inputQuery}
              onChange={(e) => setInputQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isAssistantTyping}
              className="flex-1 px-3.5 py-2 text-xs rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500 disabled:opacity-50"
            />
            <button
              onClick={handleSend}
              disabled={!inputQuery.trim() || isAssistantTyping}
              className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed shadow-xs shrink-0"
              title="Gửi câu hỏi"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="mt-1 flex items-center justify-between text-[11px] text-slate-400 px-0.5">
            <span>Nhấn Enter để gửi</span>
            <span>Mô hình mô phỏng nội tại v2.0</span>
          </div>
        </div>
      </div>

      {/* ============================================================= */}
      {/* CỘT PHỤ (4 COLS): PANEL NGỮ CẢNH THIẾT BỊ & CÂU HỎI GỢI Ý      */}
      {/* ============================================================= */}
      <div className="lg:col-span-4 space-y-3 flex flex-col h-full overflow-hidden">
        {/* Device Context Panel */}
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200/90 dark:border-slate-700/70 p-3.5 shadow-xs">
          <div className="flex items-center justify-between pb-2.5 border-b border-slate-100 dark:border-slate-700/60">
            <div className="flex items-center gap-2">
              <Cpu className="w-4 h-4 text-emerald-600" />
              <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100">
                Ngữ cảnh Thiết bị Đang chọn
              </h4>
            </div>
            <span
              className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${
                selectedEquipment.riskLevel === 'CRITICAL'
                  ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/70 dark:text-rose-400'
                  : selectedEquipment.riskLevel === 'HIGH'
                  ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/70 dark:text-amber-400'
                  : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-400'
              }`}
            >
              {selectedEquipment.riskLevel}
            </span>
          </div>

          <div className="mt-3 space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Mã thiết bị:</span>
              <strong className="text-slate-800 dark:text-slate-200">
                {selectedEquipment.machineCode}
              </strong>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-slate-400">Tên máy:</span>
              <span className="text-slate-800 dark:text-slate-200 truncate max-w-[170px]" title={selectedEquipment.machineName}>
                {selectedEquipment.machineName}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-slate-400">Dây chuyền:</span>
              <span className="text-slate-700 dark:text-slate-300">
                {selectedEquipment.lineName}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-slate-400">Điểm sức khỏe AI:</span>
              <strong
                className={`font-black ${
                  selectedEquipment.healthScore >= 85
                    ? 'text-emerald-600'
                    : selectedEquipment.healthScore >= 70
                    ? 'text-amber-600'
                    : 'text-rose-600'
                }`}
              >
                {selectedEquipment.healthScore}/100
              </strong>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-slate-400">{selectedEquipment.keyMetricName}:</span>
              <span className="font-semibold text-slate-800 dark:text-slate-200">
                {selectedEquipment.keyMetricValue} {selectedEquipment.keyMetricUnit}
              </span>
            </div>
          </div>
        </div>

        {/* Quick Suggested Prompts List */}
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200/90 dark:border-slate-700/70 p-3.5 shadow-xs flex-1 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 pb-2.5 border-b border-slate-100 dark:border-slate-700/60">
              <HelpCircle className="w-4 h-4 text-emerald-600" />
              <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100">
                Câu hỏi Gợi ý Nhanh
              </h4>
            </div>

            <div className="mt-3 space-y-1.5">
              {quickPrompts.map((p, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSelectSuggested(p)}
                  disabled={isAssistantTyping}
                  className="w-full text-left p-2 rounded-lg text-xs bg-slate-50 hover:bg-emerald-50 hover:text-emerald-800 dark:bg-slate-900/60 dark:hover:bg-slate-700 border border-slate-100 dark:border-slate-800 text-slate-700 dark:text-slate-300 transition-colors shadow-2xs leading-snug"
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          <div className="pt-2 text-[11px] text-slate-400 border-t border-slate-100 dark:border-slate-700/50">
            Hỗ trợ phản hồi theo kịch bản vận hành hiện hành
          </div>
        </div>
      </div>
    </div>
  );
};
