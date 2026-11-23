/**
 * @file i18n/tr.ts
 * @description Dịch chuỗi giao diện theo "câu gốc tiếng Việt".
 * - tr('Câu tiếng Việt') → trả về bản EN/JA trong dict/en.json, dict/ja.json; không có thì giữ tiếng Việt.
 * - Biến chèn dạng {0}, {1}: tr('Máy {0} lỗi', code).
 * - Ngôn ngữ đọc một lần khi tải trang; đổi ngôn ngữ sẽ tải lại trang (xem LanguageSwitcher)
 *   nên cả dữ liệu khai báo sẵn trong module (mock, cấu hình sơ đồ…) cũng được dịch.
 * - Kiểm tra chuỗi còn thiếu bản dịch: `node scripts/i18n-check.mjs`.
 */
import en from './dict/en.json';
import ja from './dict/ja.json';

type Dict = Record<string, string>;
const DICTS: Record<string, Dict> = { en: en as Dict, ja: ja as Dict };

function readLang(): string {
  try {
    return localStorage.getItem('denso_iot_lang') || 'vi';
  } catch {
    return 'vi';
  }
}

const active: Dict | undefined = DICTS[readLang()];

/** Kiểu trả về giữ nguyên kiểu literal của câu gốc để không phá các union type sẵn có. */
export function tr<T extends string>(vi: T, ...args: unknown[]): T {
  let s: string = (active && active[vi]) || vi;
  if (args.length) s = s.replace(/\{(\d+)\}/g, (m, i) => (Number(i) < args.length ? String(args[Number(i)]) : m));
  return s as T;
}

// ---------------------------------------------------------------------------
// Dịch dữ liệu từ CSDL (tên dây chuyền, máy, thông số, mô tả…).
// Dữ liệu trả về từ API được dịch khi hiển thị; khi gửi ngược lên server,
// các giá trị đã dịch được đổi lại câu gốc tiếng Việt để không ghi đè CSDL.
// ---------------------------------------------------------------------------
const VI_CHARS = /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/i;
const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

let lowerIndex: Map<string, string> | null = null;
let patterns: { re: RegExp; key: string }[] | null = null;
let prefixKeys: string[] | null = null;
let reverse: Map<string, string> | null = null;

function ensureIndexes(dict: Dict) {
  if (lowerIndex) return;
  lowerIndex = new Map();
  patterns = [];
  const plain: string[] = [];
  for (const k of Object.keys(dict)) {
    if (/\{\d+\}/.test(k)) {
      const literal = k.replace(/\{\d+\}/g, '').trim();
      if (literal.length < 3 || !/[a-zà-ỹ]/i.test(literal)) continue;
      const src = k.split(/(\{\d+\})/).map((p) => (/^\{\d+\}$/.test(p) ? '(.+?)' : escapeRe(p))).join('');
      patterns.push({ re: new RegExp(`^${src}$`, 'i'), key: k });
    } else {
      lowerIndex.set(k.toLowerCase(), k);
      if (VI_CHARS.test(k) && k.length >= 4) plain.push(k);
    }
  }
  prefixKeys = plain.sort((a, b) => b.length - a.length);
}

/** Dịch một chuỗi dữ liệu; không khớp quy tắc nào thì giữ nguyên. */
export function trData(value: string, depth = 0): string {
  if (!active || !value || depth > 3 || !VI_CHARS.test(value)) return value;
  ensureIndexes(active);
  const exact = active[value] || active[lowerIndex!.get(value.toLowerCase()) || ''];
  if (exact) return exact;
  // "Thông số - Tên máy"
  if (value.includes(' - ')) {
    const parts = value.split(' - ');
    const out = parts.map((p) => trData(p, depth + 1));
    if (out.some((o, i) => o !== parts[i])) return out.join(' - ');
  }
  for (const { re, key } of patterns!) {
    const m = value.match(re);
    if (m) {
      const args = m.slice(1).map((a) => trData(a, depth + 1));
      return (active[key] || key).replace(/\{(\d+)\}/g, (_, i) => args[Number(i)] ?? '');
    }
  }
  // "Câu đã biết" + phần đuôi không có tiếng Việt (VD: "Kẹt phôi OP30 (40')")
  const lower = value.toLowerCase();
  for (const k of prefixKeys!) {
    if (lower.startsWith(k.toLowerCase())) {
      const rest = value.slice(k.length);
      if (!VI_CHARS.test(rest) && /^[\s(:×-]/.test(rest)) return (active[k] || k) + rest;
    }
  }
  return value;
}

const SKIP_KEYS = /^(id|.*Id|.*_id|code|.*Code|.*_code|email|username|full_?[nN]ame|fullName|password.*|token.*|avatar.*|url|.*Url)$/;

/** Dịch mọi chuỗi tiếng Việt trong dữ liệu JSON trả về (trừ id, mã, email, họ tên). */
export function localizeData<T>(data: T): T {
  if (!active) return data;
  const walk = (v: unknown, key: string): unknown => {
    if (typeof v === 'string') return SKIP_KEYS.test(key) ? v : trData(v);
    if (Array.isArray(v)) return v.map((x) => walk(x, key));
    if (v && typeof v === 'object') {
      const o: Record<string, unknown> = {};
      for (const [k, x] of Object.entries(v as Record<string, unknown>)) o[k] = walk(x, k);
      return o;
    }
    return v;
  };
  return walk(data, '') as T;
}

/** Đổi các chuỗi đã dịch trong body JSON gửi lên server về câu gốc tiếng Việt. */
export function delocalizeBody(body: string): string {
  if (!active) return body;
  if (!reverse) {
    reverse = new Map();
    for (const [vi, txt] of Object.entries(active)) if (!/\{\d+\}/.test(vi) && !reverse.has(txt)) reverse.set(txt, vi);
  }
  const back = (s: string): string => {
    const r = reverse!.get(s);
    if (r) return r;
    if (s.includes(' - ')) {
      const parts = s.split(' - ');
      const out = parts.map((p) => reverse!.get(p) || p);
      if (out.some((o, i) => o !== parts[i])) return out.join(' - ');
    }
    return s;
  };
  try {
    const walk = (v: unknown): unknown =>
      typeof v === 'string' ? back(v) : Array.isArray(v) ? v.map(walk) : v && typeof v === 'object'
        ? Object.fromEntries(Object.entries(v as Record<string, unknown>).map(([k, x]) => [k, walk(x)]))
        : v;
    return JSON.stringify(walk(JSON.parse(body)));
  } catch {
    return body;
  }
}
