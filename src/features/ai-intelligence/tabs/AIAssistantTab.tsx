/**
 * @file AIAssistantTab.tsx
 * @description Tab 4: Trợ lý AI KaiLink – hỏi đáp văn xuôi như nói chuyện với một kỹ sư.
 *
 * - Màn hình bắt đầu: lời chào + tóm tắt nhanh + 6 nhóm câu hỏi mẫu (bấm là hỏi).
 * - Hội thoại: câu trả lời văn xuôi tính từ dữ liệu trực tiếp (assistant/assistantEngine.ts),
 *   kèm dòng nguồn dữ liệu, nút sao chép, câu hỏi gợi ý tiếp theo và dòng thời gian cho câu dự báo.
 * - Cột phải: Bộ câu hỏi mẫu 32 câu (assistant/questionBank.ts), mở / thu gọn theo nhóm.
 * - Gõ tự do vẫn hiểu: matchIntent đoán ý theo từ khóa + mã máy / tên dây chuyền.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Send,
  Sparkles,
  Database,
  Copy,
  Check,
  ChevronDown,
  ChevronRight,
  Wrench,
  Activity,
  BarChart3,
  Cpu,
  BookOpen,
  FileText,
  Info,
  Plus,
} from 'lucide-react';
import { AIProcessedMachine } from '../adapters/aiTelemetryAdapter';
import { useMonitoringStore } from '../../../stores/useMonitoringStore';
import { useAlarmStore } from '../../../stores/useAlarmStore';
import { useAuthStore } from '../../../stores/useAuthStore';
import { apiClient as api } from '../../../services/api';
import type { FactoryProductionOverview, LineShiftProduction } from '../../../types/production';
import { tr } from '../../../i18n/tr';
import { QUESTION_GROUPS, TOTAL_QUESTIONS, GroupKey, IntentId, IntentParams } from '../assistant/questionBank';
import {
  AssistantAnswer,
  AssistantContext,
  answerQuestion,
  matchIntent,
  quickStats,
} from '../assistant/assistantEngine';

interface AIAssistantTabProps {
  allMachines: AIProcessedMachine[];
  selectedMachineId?: string;
  onSelectMachine?: (machineId: string) => void;
  onNavigateToTab?: (tab: 'overview' | 'anomaly' | 'predictive' | 'assistant') => void;
}

interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  time: string;
  text: string;
  answer?: AssistantAnswer;
}

const GROUP_STYLE: Record<GroupKey, { icon: React.ElementType; cls: string }> = {
  predict: { icon: Wrench, cls: 'bg-red-500/10 text-red-600 dark:text-red-400' },
  status: { icon: Activity, cls: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' },
  output: { icon: BarChart3, cls: 'bg-blue-500/10 text-blue-600 dark:text-blue-400' },
  machine: { icon: Cpu, cls: 'bg-violet-500/10 text-violet-600 dark:text-violet-400' },
  guide: { icon: BookOpen, cls: 'bg-amber-500/10 text-amber-600 dark:text-amber-400' },
  report: { icon: FileText, cls: 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400' },
};

const pad = (n: number) => String(n).padStart(2, '0');
const hhmm = (d = new Date()) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;

/** Logo chữ D đỏ – giống logo ở thanh bên trái */
export const KaiLinkAvatar: React.FC<{ size?: 'sm' | 'lg' }> = ({ size = 'sm' }) => (
  <div
    className={`${size === 'lg' ? 'h-14 w-14 rounded-2xl' : 'h-9 w-9 rounded-xl'} flex shrink-0 items-center justify-center bg-white dark:bg-slate-900 border border-red-500/30 shadow-sm shadow-red-500/10`}
    aria-hidden="true"
  >
    <span className={`${size === 'lg' ? 'text-3xl' : 'text-xl'} font-black italic tracking-tighter text-[#E60012] select-none leading-none pr-0.5`}>D</span>
  </div>
);

// ---------------------------------------------------------------------------
// Hiển thị văn bản: **đậm**, đoạn văn, danh sách "1. " / "- "
// ---------------------------------------------------------------------------
function inline(s: string, key: string) {
  return s.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith('**') && part.endsWith('**') ? (
      <strong key={`${key}-${i}`} className="font-bold text-slate-900 dark:text-slate-50 tabular-nums">
        {part.slice(2, -2)}
      </strong>
    ) : (
      <React.Fragment key={`${key}-${i}`}>{part}</React.Fragment>
    )
  );
}

const RichText: React.FC<{ text: string }> = ({ text }) => (
  <>
    {text.split(/\n{2,}/).map((block, bi) => {
      const lines = block.split('\n').filter(Boolean);
      if (lines.length && lines.every((l) => /^\d+\.\s/.test(l))) {
        return (
          <ol key={bi} className="list-decimal pl-5 space-y-1.5 marker:font-semibold marker:text-slate-500">
            {lines.map((l, i) => (
              <li key={i} className="pl-1">{inline(l.replace(/^\d+\.\s/, ''), `${bi}-${i}`)}</li>
            ))}
          </ol>
        );
      }
      if (lines.length && lines.every((l) => l.startsWith('- '))) {
        return (
          <ul key={bi} className="list-disc pl-5 space-y-1 marker:text-slate-400">
            {lines.map((l, i) => (
              <li key={i} className="pl-1">{inline(l.slice(2), `${bi}-${i}`)}</li>
            ))}
          </ul>
        );
      }
      return (
        <p key={bi}>
          {lines.map((l, i) => (
            <React.Fragment key={i}>
              {i > 0 && <br />}
              {inline(l, `${bi}-${i}`)}
            </React.Fragment>
          ))}
        </p>
      );
    })}
  </>
);

/** Dòng thời gian nhỏ cho câu trả lời dự báo */
const ForecastTimeline: React.FC<{ hours: number; items: NonNullable<AssistantAnswer['timeline']>['items'] }> = ({ hours, items }) => {
  const W = 560;
  const L = 24;
  const R = W - 24;
  const X = (h: number) => L + (Math.min(Math.max(h, 0), hours) / hours) * (R - L);
  const now = new Date();
  const step = hours <= 8 ? 1 : hours <= 24 ? 4 : 12;
  const ticks: number[] = [];
  for (let h = 0; h <= hours; h += step) ticks.push(h);
  const label = (h: number) => hhmm(new Date(now.getTime() + h * 3600_000));
  // Tránh nhãn đè nhau: đẩy nhãn lên hàng trên khi quá gần
  const placed: Array<{ x: number; row: number }> = [];
  const rowOf = (x: number) => {
    const row = placed.some((p) => Math.abs(p.x - x) < 70 && p.row === 0) ? 1 : 0;
    placed.push({ x, row });
    return row;
  };
  return (
    <div className="mt-1 rounded-xl border border-slate-200 dark:border-slate-700/70 bg-slate-50 dark:bg-slate-950/60 px-3 pt-2">
      <svg viewBox={`0 0 ${W} 92`} width="100%" role="img" aria-label={tr('Dòng thời gian {0} giờ tới', hours)} className="block">
        {ticks.map((h) => (
          <g key={h}>
            <line x1={X(h)} y1={34} x2={X(h)} y2={70} className="stroke-slate-200 dark:stroke-slate-700" />
            <text x={X(h)} y={86} fontSize={10.5} textAnchor="middle" className="fill-slate-400 font-mono">{label(h)}</text>
          </g>
        ))}
        <rect x={L} y={48} width={R - L} height={8} rx={4} className="fill-slate-200 dark:fill-slate-800" />
        <circle cx={L} cy={52} r={5} className="fill-emerald-500" />
        <text x={L} y={14} fontSize={10.5} fontWeight={700} className="fill-emerald-600 dark:fill-emerald-400">{tr('Bây giờ {0}', hhmm(now))}</text>
        {items.map((it, i) => {
          const x = X(it.hours);
          const row = rowOf(x);
          const color = it.severity === 'critical' ? '#EF4444' : '#F59E0B';
          return (
            <g key={i}>
              <circle cx={x} cy={52} r={7} fill={color} className="stroke-white dark:stroke-slate-950" strokeWidth={3} />
              <text x={x} y={row ? 42 : 28} fontSize={11} fontWeight={800} textAnchor="middle" fill={color}>{it.label}</text>
            </g>
          );
        })}
      </svg>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Component chính
// ---------------------------------------------------------------------------
export const AIAssistantTab: React.FC<AIAssistantTabProps> = ({ allMachines }) => {
  const lines = useMonitoringStore((s) => s.lines);
  const alarms = useAlarmStore((s) => s.alarms);
  const currentUser = useAuthStore((s) => s.currentUser);
  const userName = currentUser?.fullName || currentUser?.email || '';
  const initials = (userName.split(/\s+/).filter(Boolean).slice(-2).map((w) => w[0]).join('') || 'U').toUpperCase();
  const firstName = userName.includes('@') ? '' : userName.split(/\s+/).filter(Boolean).pop() || '';

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [openGroup, setOpenGroup] = useState<GroupKey | null>('predict');
  const [copied, setCopied] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Bộ nhớ đệm 30 giây cho dữ liệu sản lượng để trả lời liên tiếp không phải tải lại
  const cache = useRef<{ ov?: { t: number; p: Promise<FactoryProductionOverview | null> }; ln: Record<string, { t: number; p: Promise<LineShiftProduction | null> }> }>({ ln: {} });
  const getOverview = useCallback(() => {
    const c = cache.current.ov;
    if (c && Date.now() - c.t < 30_000) return c.p;
    const p = api.getProductionOverview().catch(() => null);
    cache.current.ov = { t: Date.now(), p };
    return p;
  }, []);
  const getLineShift = useCallback((lineId: string) => {
    const c = cache.current.ln[lineId];
    if (c && Date.now() - c.t < 30_000) return c.p;
    const p = api.getLineProduction(lineId).catch(() => null);
    cache.current.ln[lineId] = { t: Date.now(), p };
    return p;
  }, []);

  const ctx = useMemo<AssistantContext>(
    () => ({ machines: allMachines, lines, alarms, now: new Date(), getOverview, getLineShift }),
    [allMachines, lines, alarms, getOverview, getLineShift]
  );
  const stats = useMemo(() => quickStats(ctx), [ctx]);

  useEffect(() => {
    if (messages.length) bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, busy]);

  const ask = useCallback(
    async (text: string, intent?: IntentId, params?: IntentParams) => {
      const q = text.trim();
      if (!q || busy) return;
      const t = hhmm();
      setMessages((m) => [...m, { id: `u-${Date.now()}`, sender: 'user', time: t, text: q }]);
      setInput('');
      setBusy(true);
      const liveCtx = { ...ctx, now: new Date() };
      const matched = intent ? { intent, params: params || {} } : matchIntent(liveCtx, q);
      const started = Date.now();
      let answer: AssistantAnswer;
      try {
        answer = await answerQuestion(liveCtx, matched.intent, matched.params, firstName || undefined);
      } catch {
        answer = { text: tr('Xin lỗi, mình gặp lỗi khi tổng hợp dữ liệu. Bạn thử hỏi lại nhé.'), sources: tr('KaiLink'), chips: [] };
      }
      // Giữ hiệu ứng "đang soạn" tối thiểu 0,7 giây cho tự nhiên
      const wait = Math.max(0, 700 - (Date.now() - started));
      await new Promise((r) => setTimeout(r, wait));
      setMessages((m) => [...m, { id: `a-${Date.now()}`, sender: 'assistant', time: hhmm(), text: answer.text, answer }]);
      setBusy(false);
    },
    [busy, ctx, firstName]
  );

  const copy = (id: string, text: string) => {
    const plain = text.replace(/\*\*/g, '');
    try {
      void navigator.clipboard?.writeText(plain);
    } catch {
      /* trình duyệt chặn clipboard */
    }
    setCopied(id);
    setTimeout(() => setCopied((c) => (c === id ? null : c)), 1500);
  };

  const inputBar = (
    <div className="space-y-2">
      <form
        className="flex items-center gap-2 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 pl-4 pr-2 py-2 focus-within:ring-2 focus-within:ring-emerald-500/40"
        onSubmit={(e) => {
          e.preventDefault();
          void ask(input);
        }}
      >
        <label htmlFor="kailink-ask" className="sr-only">{tr('Câu hỏi cho trợ lý')}</label>
        <input
          id="kailink-ask"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={tr('Hỏi về dây chuyền, máy, sản lượng, bảo trì…')}
          autoComplete="off"
          className="flex-1 bg-transparent text-sm text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none py-1.5"
        />
        <button
          type="submit"
          disabled={!input.trim() || busy}
          aria-label={tr('Gửi')}
          className="h-10 w-10 shrink-0 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white flex items-center justify-center transition-colors"
        >
          <Send className="h-4 w-4" />
        </button>
      </form>
      <p className="text-center text-[11px] text-slate-400">
        {tr('Câu trả lời được tính từ dữ liệu trực tiếp của hệ thống · có thể gõ tự do, không cần đúng nguyên văn câu mẫu')}
      </p>
    </div>
  );

  const toolbar = (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <span className="inline-flex items-center gap-2 rounded-full bg-emerald-50 dark:bg-emerald-500/10 px-3 py-1.5 text-xs font-bold text-emerald-700 dark:text-emerald-400">
        <span className="h-2 w-2 rounded-full bg-emerald-500" />
        {tr('Dữ liệu trực tiếp · {0} dây chuyền · {1} máy', stats.lines, stats.machines)}
      </span>
      {messages.length > 0 && (
        <button
          type="button"
          onClick={() => setMessages([])}
          className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 px-3 py-1.5 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
        >
          <Plus className="h-3.5 w-3.5" /> {tr('Cuộc trò chuyện mới')}
        </button>
      )}
    </div>
  );

  // ------------------------- Màn hình bắt đầu -------------------------
  if (!messages.length) {
    return (
      <div className="space-y-4">
        {toolbar}
        <div className="rounded-2xl border border-slate-200 dark:border-slate-700/80 bg-slate-50/60 dark:bg-slate-950/40 p-5 sm:p-6 space-y-6">
          <div className="flex flex-col items-center text-center gap-3 pt-2">
            <KaiLinkAvatar size="lg" />
            <h3 className="text-xl font-extrabold text-slate-900 dark:text-white">
              {firstName ? tr('Chào {0}, hôm nay mình giúp gì được?', firstName) : tr('Xin chào, hôm nay mình giúp gì được?')}
            </h3>
            <div className="max-w-2xl text-sm leading-relaxed text-slate-600 dark:text-slate-400">
              <RichText
                text={tr('Mình đang theo dõi {0} dây chuyền và {1} máy. Hiện có **{2} cảnh báo** chưa xử lý và **{3} dây chuyền** dự báo cần bảo trì trong 6 giờ tới. Bạn có thể chọn một câu bên dưới hoặc gõ tự do.', stats.lines, stats.machines, stats.openAlarms, stats.linesNeedMaintenance)}
              />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {QUESTION_GROUPS.map((g) => {
              const st = GROUP_STYLE[g.key];
              const Icon = st.icon;
              return (
                <section key={g.key} className="rounded-2xl border border-slate-200 dark:border-slate-700/80 bg-white dark:bg-slate-900 p-3.5 space-y-2.5">
                  <div className="flex items-center gap-2.5">
                    <span className={`h-8 w-8 rounded-lg flex items-center justify-center ${st.cls}`}><Icon className="h-4 w-4" /></span>
                    <h4 className="flex-1 text-sm font-bold text-slate-900 dark:text-white">{g.title}</h4>
                    <span className="text-[11px] text-slate-400">{tr('{0} câu', g.questions.length)}</span>
                  </div>
                  {g.questions.slice(0, 3).map((q) => (
                    <button
                      key={q.text}
                      type="button"
                      onClick={() => void ask(q.text, q.intent, q.params)}
                      className="w-full flex items-center justify-between gap-2 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/50 px-3 py-2 text-left text-[13px] text-slate-700 dark:text-slate-300 hover:border-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 transition-colors"
                    >
                      <span>{q.text}</span>
                      <ChevronRight className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                    </button>
                  ))}
                </section>
              );
            })}
          </div>
          {inputBar}
        </div>
      </div>
    );
  }

  // ------------------------- Hội thoại -------------------------
  return (
    <div className="space-y-4">
      {toolbar}
      <div className="flex flex-col xl:flex-row gap-4 items-start">
        <div className="flex-1 min-w-0 w-full rounded-2xl border border-slate-200 dark:border-slate-700/80 bg-slate-50/60 dark:bg-slate-950/40 flex flex-col">
          <div ref={scrollRef} className="max-h-[calc(100vh-300px)] min-h-[520px] overflow-y-auto p-4 sm:p-5 space-y-6" aria-live="polite">
            {messages.map((msg) =>
              msg.sender === 'user' ? (
                <div key={msg.id} className="flex justify-end items-end gap-2.5">
                  <div className="flex max-w-[75%] flex-col items-end gap-1">
                    <div className="rounded-2xl rounded-br-md bg-blue-600 px-4 py-2.5 text-sm leading-relaxed text-white">{msg.text}</div>
                    <span className="text-[11px] text-slate-400">{msg.time}{userName ? ` · ${userName}` : ''}</span>
                  </div>
                  <span className="h-9 w-9 shrink-0 rounded-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 flex items-center justify-center text-xs font-extrabold text-slate-500 dark:text-slate-300">{initials}</span>
                </div>
              ) : (
                <div key={msg.id} className="flex items-start gap-3">
                  <KaiLinkAvatar />
                  <div className="min-w-0 max-w-[88%] space-y-2.5">
                    <div className="flex items-center gap-2">
                      <strong className="text-[13px] text-slate-900 dark:text-white">{tr('Trợ lý KaiLink')}</strong>
                      <span className="text-[11px] text-slate-400">{msg.time}</span>
                    </div>
                    <div className="rounded-2xl rounded-tl-md border border-slate-200 dark:border-slate-700/80 bg-white dark:bg-slate-900 px-4 sm:px-5 py-4 text-sm leading-7 text-slate-700 dark:text-slate-300 space-y-2.5">
                      <RichText text={msg.text} />
                      {msg.answer?.timeline && msg.answer.timeline.items.length > 0 && (
                        <ForecastTimeline hours={msg.answer.timeline.hours} items={msg.answer.timeline.items} />
                      )}
                      <div className="mt-1 flex items-center justify-between gap-3 border-t border-slate-100 dark:border-slate-800 pt-2.5">
                        <span className="flex items-center gap-1.5 text-[11.5px] text-slate-400">
                          <Database className="h-3.5 w-3.5 shrink-0" />
                          {tr('Nguồn: {0}', msg.answer?.sources || '')}
                        </span>
                        <button
                          type="button"
                          onClick={() => copy(msg.id, msg.text)}
                          className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                          aria-label={tr('Sao chép câu trả lời')}
                          title={tr('Sao chép câu trả lời')}
                        >
                          {copied === msg.id ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>
                    {!!msg.answer?.chips.length && (
                      <div className="flex flex-wrap gap-2">
                        {msg.answer.chips.map((c) => (
                          <button
                            key={c.label}
                            type="button"
                            disabled={busy}
                            onClick={() => void ask(c.label, c.intent, c.params)}
                            className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-1.5 text-[12.5px] font-semibold text-slate-700 dark:text-slate-200 hover:border-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 disabled:opacity-50 transition-colors"
                          >
                            <Sparkles className="h-3 w-3 text-emerald-500" />
                            {c.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )
            )}
            {busy && (
              <div className="flex items-center gap-3">
                <KaiLinkAvatar />
                <div className="flex items-center gap-1.5 rounded-2xl rounded-tl-md border border-slate-200 dark:border-slate-700/80 bg-white dark:bg-slate-900 px-4 py-3" aria-label={tr('Trợ lý đang soạn câu trả lời')}>
                  {[0, 1, 2].map((i) => (
                    <span key={i} className="h-2 w-2 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
                  ))}
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>
          <div className="border-t border-slate-200 dark:border-slate-800 p-4">{inputBar}</div>
        </div>

        {/* Bộ câu hỏi mẫu */}
        <aside className="w-full xl:w-[330px] shrink-0 space-y-2.5">
          <div className="flex items-baseline justify-between">
            <h3 className="text-xs font-extrabold tracking-wider text-slate-800 dark:text-slate-100">{tr('BỘ CÂU HỎI MẪU')}</h3>
            <span className="text-xs text-slate-400">{tr('{0} câu · {1} nhóm', TOTAL_QUESTIONS, QUESTION_GROUPS.length)}</span>
          </div>
          {QUESTION_GROUPS.map((g) => {
            const st = GROUP_STYLE[g.key];
            const Icon = st.icon;
            const open = openGroup === g.key;
            return (
              <div key={g.key} className={`overflow-hidden rounded-xl border bg-white dark:bg-slate-900 ${open ? 'border-blue-500' : 'border-slate-200 dark:border-slate-700/80'}`}>
                <button
                  type="button"
                  aria-expanded={open}
                  onClick={() => setOpenGroup(open ? null : g.key)}
                  className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left"
                >
                  <span className={`h-7 w-7 rounded-lg flex items-center justify-center ${st.cls}`}><Icon className="h-3.5 w-3.5" /></span>
                  <span className="flex-1 text-[13px] font-bold text-slate-900 dark:text-white">{g.title}</span>
                  <span className="rounded-full bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-[11px] font-bold text-slate-500 dark:text-slate-400">{g.questions.length}</span>
                  <ChevronDown className={`h-4 w-4 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />
                </button>
                {open && (
                  <div className="space-y-1.5 px-3 pb-3">
                    {g.questions.map((q) => (
                      <button
                        key={q.text}
                        type="button"
                        disabled={busy}
                        onClick={() => void ask(q.text, q.intent, q.params)}
                        className="w-full rounded-lg border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 px-3 py-2 text-left text-[12.5px] leading-snug text-slate-700 dark:text-slate-300 hover:border-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 disabled:opacity-50 transition-colors"
                      >
                        {q.text}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
          <div className="flex gap-2 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 px-3 py-2.5 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
            <Info className="h-4 w-4 shrink-0" />
            <span>{tr('Bấm một câu để hỏi ngay. Bạn cũng có thể gõ tự do, kể cả mã máy như {0}.', 'DCS-DCM-01')}</span>
          </div>
        </aside>
      </div>
    </div>
  );
};

export default AIAssistantTab;
